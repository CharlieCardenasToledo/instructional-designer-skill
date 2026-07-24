use crate::models::{ActionResult, DependencyStatus, WeekData};
use crate::paths::{atomic_write, backup_file, canonical_directory, path_text, safe_segment};
use std::process::Command;

fn command_exists(command: &str) -> bool {
    let checker = if cfg!(target_os = "windows") { "where.exe" } else { "which" };
    Command::new(checker)
        .arg(command)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn version(command: &str, args: &[&str]) -> Option<String> {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            let text = if output.stdout.is_empty() { output.stderr } else { output.stdout };
            String::from_utf8(text).ok()
        })
        .and_then(|text| text.lines().find(|line| !line.trim().is_empty()).map(str::trim).map(str::to_string))
}

/// Decodifica stdout/stderr de un proceso externo. wsl.exe emite UTF-16LE
/// (con o sin BOM) cuando su salida no va a una consola real, en vez de UTF-8.
fn decode_output(bytes: &[u8]) -> String {
    if let Ok(text) = std::str::from_utf8(bytes) {
        let trimmed = text.trim();
        if !trimmed.is_empty() && !trimmed.contains('\u{FFFD}') {
            return trimmed.to_string();
        }
    }
    let start = if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE { 2 } else { 0 };
    String::from_utf16_lossy(
        &bytes[start..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect::<Vec<_>>(),
    )
    .trim()
    .to_string()
}

/// Ejecuta un comando y devuelve (éxito, salida real decodificada) para
/// mostrarla tal cual al usuario, sin inventar un texto de estado genérico.
fn run_capture(mut cmd: Command) -> (bool, Option<String>) {
    match cmd.output() {
        Ok(output) => {
            let bytes = if output.stdout.is_empty() { &output.stderr } else { &output.stdout };
            let text = decode_output(bytes);
            (output.status.success(), if text.is_empty() { None } else { Some(text) })
        }
        Err(_) => (false, None),
    }
}

pub fn check_dependencies() -> Vec<DependencyStatus> {
    let node = command_exists("node");
    let npx = command_exists(if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" });
    let python_command = if command_exists("python3") { "python3" } else { "python" };
    let python = command_exists(python_command);
    let git = command_exists("git");

    let mut dependencies = vec![
        DependencyStatus {
            name: "Node.js".to_string(),
            installed: node && npx,
            version: version("node", &["--version"]),
            required: true,
            note: "Necesario para que la app funcione correctamente.".to_string(),
            command: "node --version".to_string(),
        },
        DependencyStatus {
            name: "Git".to_string(),
            installed: git,
            version: version("git", &["--version"]),
            required: false,
            note: "Opcional: guarda el historial de cambios de tus cursos.".to_string(),
            command: "git --version".to_string(),
        },
        DependencyStatus {
            name: "Python".to_string(),
            installed: python,
            version: version(python_command, &["--version"]),
            required: false,
            note: "Opcional: solo se usa para recortar imágenes de tus PDFs.".to_string(),
            command: format!("{python_command} --version"),
        },
    ];

    #[cfg(target_os = "windows")]
    {
        let mut wsl_cmd = Command::new("wsl.exe");
        wsl_cmd.arg("--status");
        let (wsl, wsl_output) = run_capture(wsl_cmd);
        dependencies.push(DependencyStatus {
            name: "WSL 2".to_string(),
            installed: wsl,
            version: wsl_output,
            required: false,
            note: "Opcional: una forma de generar tus PDFs en Windows.".to_string(),
            command: "wsl.exe --status".to_string(),
        });

        let latex_command = "wsl.exe -- sh -lc \"command -v pdflatex && command -v biber\"";
        let mut latex_cmd = Command::new("wsl.exe");
        latex_cmd.args(["--", "sh", "-lc", "command -v pdflatex && command -v biber"]);
        let (latex_ok, latex_output) = run_capture(latex_cmd);
        let latex = wsl && latex_ok;
        dependencies.push(DependencyStatus {
            name: "TeX Live (pdflatex)".to_string(),
            installed: latex,
            version: latex_output,
            required: false,
            note: "Ocupa bastante espacio, pero es lo que genera tus guías en PDF.".to_string(),
            command: latex_command.to_string(),
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let latex = command_exists("pdflatex") && command_exists("biber");
        dependencies.push(DependencyStatus {
            name: "TeX Live (pdflatex)".to_string(),
            installed: latex,
            version: version("pdflatex", &["--version"]),
            required: false,
            note: "Es lo que genera tus guías en PDF.".to_string(),
            command: "pdflatex --version".to_string(),
        });
    }

    let docker = command_exists("docker");
    dependencies.push(DependencyStatus {
        name: "Docker".to_string(),
        installed: docker,
        version: version("docker", &["--version"]),
        required: false,
        note: "Recomendado: la forma más simple de generar tus guías en PDF.".to_string(),
        command: "docker --version".to_string(),
    });

    dependencies
}

pub fn install_dependency(name: String, confirmed: bool) -> ActionResult {
    #[cfg(target_os = "windows")]
    {
        if matches!(name.as_str(), "WSL 2" | "TeX Live (pdflatex)" | "Docker") && !confirmed {
            return ActionResult::error("Esta instalación cambia componentes del sistema y requiere confirmación explícita.");
        }

        if name == "WSL 2" {
            return match Command::new("wsl.exe").args(["--install", "--no-distribution"]).status() {
                Ok(status) if status.success() => ActionResult::ok(
                    "WSL se habilitó. Windows puede requerir un reinicio antes de instalar una distribución.",
                ),
                Ok(status) => ActionResult::error(format!("WSL terminó con código {:?}.", status.code())),
                Err(error) => ActionResult::error(format!("No se pudo iniciar el instalador de WSL: {error}")),
            };
        }

        if name == "TeX Live (pdflatex)" {
            let script = "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y texlive-latex-extra texlive-bibtex-extra texlive-lang-spanish biber latexmk poppler-utils";
            return match Command::new("wsl.exe")
                .args(["-u", "root", "--", "sh", "-lc", script])
                .status()
            {
                Ok(status) if status.success() => ActionResult::ok("Componentes LaTeX instalados en WSL."),
                Ok(status) => ActionResult::error(format!("La instalación LaTeX terminó con código {:?}.", status.code())),
                Err(error) => ActionResult::error(format!("No se pudo ejecutar WSL: {error}")),
            };
        }

        let package = match name.as_str() {
            "Node.js" => "OpenJS.NodeJS.LTS",
            "Git" => "Git.Git",
            "Python" => "Python.Python.3.13",
            "Docker" => "Docker.DockerDesktop",
            _ => return ActionResult::error(format!("Dependencia desconocida: {name}")),
        };
        match Command::new("winget.exe")
            .args([
                "install",
                "--id",
                package,
                "--exact",
                "--silent",
                "--accept-source-agreements",
                "--accept-package-agreements",
            ])
            .status()
        {
            Ok(status) if status.success() => {
                let note = if name == "Docker" {
                    " Puede requerir cerrar sesión o reiniciar Windows antes de que el comando docker esté disponible."
                } else {
                    ""
                };
                ActionResult::ok(format!("{name} instalado correctamente.{note}"))
            }
            Ok(status) => ActionResult::error(format!("winget terminó con código {:?}.", status.code())),
            Err(error) => ActionResult::error(format!("No se pudo ejecutar winget: {error}")),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = confirmed;
        let instructions = if cfg!(target_os = "macos") {
            "En macOS: instala Node.js y Python con Homebrew (`brew install node python`); para LaTeX usa `brew install --cask basictex` y después `tlmgr install biber`. Reinicia la app y vuelve a verificar."
        } else {
            "En Linux: instala Node.js, npm y Python con el gestor de paquetes de tu distribución (por ejemplo `sudo apt install nodejs npm python3`); para LaTeX usa `sudo apt install texlive-latex-extra biber`. Reinicia la app y vuelve a verificar."
        };
        ActionResult::error(format!(
            "La instalación automática de {name} está disponible solo en Windows. {instructions}"
        ))
    }
}

pub fn create_course_structure(
    root_path: String,
    course_code: String,
    course_name: String,
    weeks: u32,
) -> ActionResult {
    if !(1..=52).contains(&weeks) {
        return ActionResult::error("El número de semanas debe estar entre 1 y 52.");
    }
    let root = match canonical_directory(&root_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let code = match safe_segment(&course_code, "Código") {
        Ok(value) => value,
        Err(error) => return ActionResult::error(error),
    };
    let name = match safe_segment(&course_name, "Nombre") {
        Ok(value) => value,
        Err(error) => return ActionResult::error(error),
    };
    let course = root.join(format!("{code} {name}"));

    let mut paths = vec![
        course.join("bibliografia").join("recortes_por_semana"),
        course.join("semanas").join("_shared").join("latex"),
    ];
    for week in 1..=weeks {
        let week_root = course.join("semanas").join(format!("semana-{week:02}")).join("latex");
        paths.push(week_root.join("sections"));
        paths.push(week_root.join("figure"));
    }
    for path in paths {
        if let Err(error) = std::fs::create_dir_all(&path) {
            return ActionResult::error(format!("No se pudo crear {}: {error}", path.display()));
        }
    }

    ActionResult::ok(format!("Estructura creada para {weeks} semanas en:\n{}", path_text(&course)))
        .with_path(path_text(&course))
}

fn bullets(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .map(|line| line.trim_start_matches(|character: char| matches!(character, '-' | '*' | '•' | ' ')).trim())
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn labelled_outcomes(text: &str) -> Vec<String> {
    bullets(text)
        .into_iter()
        .enumerate()
        .map(|(index, line)| {
            if ["docencia:", "práctica:", "practica:", "autónomo:", "autonomo:"]
                .iter()
                .any(|prefix| line.to_lowercase().starts_with(prefix))
            {
                line
            } else if index == 0 {
                format!("Docencia: {line}")
            } else {
                line
            }
        })
        .collect()
}

fn list_block(items: Vec<String>, empty: &str) -> String {
    if items.is_empty() {
        format!("- {empty}")
    } else {
        items.into_iter().map(|item| format!("- {item}")).collect::<Vec<_>>().join("\n")
    }
}

pub fn build_syllabus_md(
    code: &str,
    name: &str,
    credits: u32,
    academic_period: &str,
    semester: &str,
    description: &str,
    weeks: &[WeekData],
) -> Result<String, String> {
    if code.trim().is_empty() || name.trim().is_empty() {
        return Err("Código y nombre de asignatura son obligatorios.".to_string());
    }
    if weeks.is_empty() {
        return Err("Agrega al menos una semana.".to_string());
    }

    let mut output = format!(
        "# {code} — {name}\n\n**Asignatura:** {code} — {name}\n**Periodo académico ordinario:** {}\n**Créditos:** {credits}\n**Semestre:** {}\n\n## Descripción del curso\n\n{}\n\n---\n\n## Plan semanal\n\n",
        academic_period.trim(),
        semester.trim(),
        description.trim()
    );

    for week in weeks {
        if !(1..=52).contains(&week.number) {
            return Err(format!("Número de semana inválido: {}", week.number));
        }
        let topics = bullets(&week.topics);
        let title = if week.title.trim().is_empty() {
            topics.first().cloned().unwrap_or_else(|| week.unit.trim().to_string())
        } else {
            week.title.trim().to_string()
        };
        output.push_str(&format!(
            "### Semana {:02} — {}\n\n**Unidad:** {}\n\n**Tema / contenido semanal:**\n{}\n\n**Resultado de aprendizaje:**\n{}\n\n**Herramienta de aprendizaje:**\n{}\n\n**Horas:** Docencia: {} | Práctica: {} | Autónomo: {}\n\n**Actividades calificadas:**\n{}\n\n---\n\n",
            week.number,
            title,
            week.unit.trim(),
            list_block(topics, "No especificado"),
            list_block(labelled_outcomes(&week.outcomes), "No especificado"),
            list_block(bullets(&week.bibliography), "No especificada"),
            week.teaching_hours,
            week.practice_hours,
            week.autonomous_hours,
            list_block(
                week.graded_activity.as_deref().map(bullets).unwrap_or_default(),
                "Ninguna"
            )
        ));
    }
    Ok(output)
}

pub fn generate_syllabus(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    academic_period: String,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult {
    let root = match canonical_directory(&course_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = safe_segment(&course_code, "Código") {
        return ActionResult::error(error);
    }

    let course = root.join(format!("{} {}", course_code, course_name));
    if let Err(error) = std::fs::create_dir_all(&course) {
        return ActionResult::error(format!("No se pudo crear carpeta del curso: {error}"));
    }

    let content = match build_syllabus_md(
        &course_code,
        &course_name,
        credits,
        &academic_period,
        &semester,
        &description,
        &weeks_data,
    ) {
        Ok(content) => content,
        Err(error) => return ActionResult::error(error),
    };
    let path = course.join("README.md");
    let backup = match backup_file(&path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = atomic_write(&path, content.as_bytes()) {
        return ActionResult::error(error);
    }

    let result = ActionResult::ok(format!("Sílabo canónico generado en:\n{}", path_text(&path)))
        .with_path(path_text(&path));
    if let Some(backup) = backup {
        result.with_backup(path_text(&backup))
    } else {
        result
    }
}

pub fn compile_syllabus_pdf(
    course_path: String,
    course_code: String,
    course_name: String,
    _credits: u32,
    academic_period: String,
    _semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult {
    let course = match canonical_directory(&course_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };

    let course_dir = course.join(format!("{} {}", course_code, course_name));
    if !course_dir.exists() {
        return ActionResult::error(format!("Carpeta del curso no encontrada: {}", course_dir.display()));
    }

    let latex_dir = course_dir.join("latex");
    if let Err(error) = std::fs::create_dir_all(&latex_dir) {
        return ActionResult::error(format!("No se pudo crear carpeta latex: {error}"));
    }

    let sections_dir = latex_dir.join("sections");
    if let Err(error) = std::fs::create_dir_all(&sections_dir) {
        return ActionResult::error(format!("No se pudo crear carpeta sections: {error}"));
    }

    // Usa el mismo preámbulo (colores, bloques) que la skill usa para las
    // guías reales, en vez de reimplementar un documento genérico aparte.
    let institution = crate::config::active_institution();
    let author = if institution.author.is_empty() { "Instructional Designer Manager".to_string() } else { institution.author };
    let institute_line = if institution.career.is_empty() { "Sistema Académico".to_string() } else { institution.career };
    let extrainfo_line = if institution.institution.is_empty() { String::new() } else { institution.institution };

    let mut full_content = format!(
        "\\documentclass[11pt,oneside,lang=es,color=blue,citestyle=apa,bibstyle=apa]{{elegantbook}}\n\
         \\input{{preamble.tex}}\n\n\
         \\title{{{} — {}}}\n\
         \\subtitle{{Guía Didáctica}}\n\
         \\author{{{}}}\n\
         \\institute{{{}}}\n\
         \\date{{{}}}\n\
         \\extrainfo{{{}}}\n\n\
         \\begin{{document}}\n\
         \\frontmatter\n\
         \\maketitle\n\
         \\mainmatter\n\n\
         \\guidesection{{Descripción del Curso}}\n\
         {}\n\n\
         \\guidesection{{Plan Semanal}}\n",
        course_code, course_name, author, institute_line, academic_period, extrainfo_line, description
    );
    for week in &weeks_data {
        full_content.push_str(&format!(
            "\\editorialtitle{{Semana {:02}}}{{{}}}\n\n",
            week.number,
            week.title.trim()
        ));
        full_content.push_str(&format!(
            "\\coursemeta{{Unidad: {} \\quad Horas: Docencia {} · Práctica {} · Autónomo {}}}\n\n",
            week.unit.trim(), week.teaching_hours, week.practice_hours, week.autonomous_hours
        ));
        if !week.topics.trim().is_empty() {
            full_content.push_str("\\begin{accentblock}[title=Temas]\n\\begin{itemize}\n");
            for line in week.topics.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{accentblock}\n\n");
        }
        if !week.outcomes.trim().is_empty() {
            full_content.push_str("\\begin{mintblock}[title=Resultado de aprendizaje]\n\\begin{itemize}\n");
            for line in week.outcomes.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{mintblock}\n\n");
        }
        if let Some(activity) = week.graded_activity.as_ref().filter(|a| !a.trim().is_empty()) {
            full_content.push_str(&format!("\\begin{{sandblock}}[title=Actividad calificada]\n{}\n\\end{{sandblock}}\n\n", activity.trim()));
        }
        if !week.bibliography.trim().is_empty() {
            full_content.push_str("\\begin{softblock}[title=Bibliografía]\n\\begin{itemize}\n");
            for line in week.bibliography.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{softblock}\n\n");
        }
    }

    full_content.push_str("\n\\end{document}\n");

    let main_tex = latex_dir.join("main.tex");
    if let Err(error) = atomic_write(&main_tex, full_content.as_bytes()) {
        return ActionResult::error(format!("No se pudo escribir main.tex: {error}"));
    }

    if let Err(error) = crate::config::copy_active_template_assets(&latex_dir) {
        return ActionResult::error(error);
    }

    // El preámbulo hace \addbibresource{reference.bib}; si el curso todavía
    // no tiene una, se crea vacía para que la compilación no falle.
    let bib_path = latex_dir.join("reference.bib");
    if !bib_path.exists() {
        if let Err(error) = atomic_write(&bib_path, b"% Sin referencias bibliograficas todavia.\n") {
            return ActionResult::error(format!("No se pudo crear reference.bib: {error}"));
        }
    }

    let mut attempts: Vec<(&str, Box<dyn Fn() -> Result<std::path::PathBuf, String> + '_>)> = Vec::new();
    if docker_available() {
        attempts.push(("Docker", Box::new(|| compile_via_docker(&latex_dir, "main"))));
    }
    if cfg!(target_os = "windows") {
        attempts.push(("WSL", Box::new(|| compile_via_wsl(&latex_dir, "main"))));
    } else {
        attempts.push(("pdflatex", Box::new(|| compile_via_pdflatex(&latex_dir, "main"))));
    }
    let compile_result = try_compile(attempts);

    match compile_result {
        Ok(pdf_path) => {
            ActionResult::ok(format!("PDF compilado exitosamente"))
                .with_path(path_text(&pdf_path))
        }
        Err(error) => ActionResult::error(error),
    }
}

fn compile_via_wsl(latex_dir: &std::path::Path, base_name: &str) -> Result<std::path::PathBuf, String> {
    let mut path_str = latex_dir.display().to_string();
    path_str = path_str.strip_prefix("\\\\?\\").unwrap_or(&path_str).to_string();
    let wsl_path = format!(
        "/mnt/{}{}",
        path_str.chars().next().unwrap_or('c').to_lowercase().to_string(),
        path_str[2..].replace('\\', "/")
    );

    let cmd = format!(
        "cd '{}' && pdflatex -interaction=nonstopmode {} && echo 'success'",
        wsl_path, base_name
    );

    let output = Command::new("wsl.exe")
        .args(["--", "sh", "-c", &cmd])
        .output()
        .map_err(|e| format!("No se pudo ejecutar WSL: {e}"))?;

    if output.status.success() {
        let pdf_path = latex_dir.join(format!("{}.pdf", base_name));
        if pdf_path.exists() {
            Ok(pdf_path)
        } else {
            Err("pdflatex no generó PDF. Verifica que TeX Live esté instalado en WSL.".to_string())
        }
    } else {
        let log_path = latex_dir.join(format!("{}.log", base_name));
        let error_log = if log_path.exists() {
            std::fs::read_to_string(&log_path).unwrap_or_default()
        } else {
            String::from_utf8_lossy(&output.stderr).to_string()
        };
        Err(format!("Error en compilación LaTeX:\n{}", extract_tex_error(&error_log)))
    }
}

fn compile_via_pdflatex(latex_dir: &std::path::Path, base_name: &str) -> Result<std::path::PathBuf, String> {
    let output = Command::new("pdflatex")
        .args(["-interaction=nonstopmode", &format!("{}.tex", base_name)])
        .current_dir(latex_dir)
        .output()
        .map_err(|e| format!("No se pudo ejecutar pdflatex: {e}"))?;

    if output.status.success() {
        let pdf_path = latex_dir.join(format!("{}.pdf", base_name));
        if pdf_path.exists() {
            Ok(pdf_path)
        } else {
            Err("pdflatex no generó PDF.".to_string())
        }
    } else {
        let log_path = latex_dir.join(format!("{}.log", base_name));
        let error_log = if log_path.exists() {
            std::fs::read_to_string(&log_path).unwrap_or_default()
        } else {
            String::from_utf8_lossy(&output.stderr).to_string()
        };
        Err(format!("Error en compilación LaTeX:\n{}", extract_tex_error(&error_log)))
    }
}

/// Extrae la parte útil de un log de pdflatex: las primeras líneas son
/// siempre el banner de la versión, nunca el error. Busca la línea que
/// empieza con "!" (marcador de error fatal de TeX) y su contexto; si no
/// la encuentra, devuelve el final del log (donde suele estar el error).
fn extract_tex_error(log: &str) -> String {
    let lines: Vec<&str> = log.lines().collect();
    if let Some(idx) = lines.iter().position(|line| line.trim_start().starts_with('!')) {
        let end = (idx + 8).min(lines.len());
        return lines[idx..end].join("\n");
    }
    let start = lines.len().saturating_sub(15);
    lines[start..].join("\n")
}

fn docker_available() -> bool {
    Command::new("docker")
        .args(["--version"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Prueba cada motor de compilación en orden y conserva el error real de
/// todos los intentos fallidos, en vez de descartar los primeros con `or_else`.
fn try_compile<'a>(
    attempts: Vec<(&'a str, Box<dyn Fn() -> Result<std::path::PathBuf, String> + 'a>)>,
) -> Result<std::path::PathBuf, String> {
    let mut errors = Vec::new();
    for (label, attempt) in attempts {
        match attempt() {
            Ok(path) => return Ok(path),
            Err(err) => errors.push(format!("{label}: {err}")),
        }
    }
    Err(format!(
        "Ningún motor de compilación pudo generar el PDF:\n\n{}",
        errors.join("\n\n")
    ))
}

fn compile_via_docker(latex_dir: &std::path::Path, base_name: &str) -> Result<std::path::PathBuf, String> {
    let host_path = latex_dir.display().to_string();
    let container_path = "/workspace";

    let pdflatex_cmd = format!(
        "cd {} && pdflatex -interaction=nonstopmode {} && echo 'success'",
        container_path, base_name
    );

    let output = Command::new("docker")
        .args([
            "run",
            "--rm",
            "-v",
            &format!("{}:{}", host_path, container_path),
            "ids-texlive:latest",
            "sh",
            "-c",
            &pdflatex_cmd,
        ])
        .output()
        .map_err(|e| {
            if e.to_string().contains("No such file or directory") {
                "Docker no disponible o imagen no encontrada. Intenta WSL en su lugar.".to_string()
            } else {
                format!("Error ejecutando Docker: {e}")
            }
        })?;

    if output.status.success() {
        let pdf_path = latex_dir.join(format!("{}.pdf", base_name));
        if pdf_path.exists() {
            Ok(pdf_path)
        } else {
            Err("Docker compiló sin errores pero no generó PDF.".to_string())
        }
    } else {
        let log_path = latex_dir.join(format!("{}.log", base_name));
        let error_log = if log_path.exists() {
            std::fs::read_to_string(&log_path).unwrap_or_default()
        } else {
            String::from_utf8_lossy(&output.stderr).to_string()
        };
        Err(format!("Error en compilación LaTeX (Docker):\n{}", extract_tex_error(&error_log)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn syllabus_uses_canonical_labels() {
        let markdown = build_syllabus_md(
            "IFT200",
            "Interacción",
            3,
            "Abril–Agosto 2026",
            "Abril–Agosto 2026",
            "Curso",
            &[WeekData {
                number: 1,
                title: "Fundamentos".to_string(),
                unit: "Unidad 1".to_string(),
                topics: "Tema A\nTema B".to_string(),
                outcomes: "Analizar interfaces".to_string(),
                bibliography: "Autor (2024). Libro.".to_string(),
                graded_activity: None,
                autonomous_hours: 3,
                teaching_hours: 2,
                practice_hours: 1,
            }],
        )
        .unwrap();

        assert!(markdown.contains("**Asignatura:** IFT200 — Interacción"));
        assert!(markdown.contains("**Resultado de aprendizaje:**"));
        assert!(markdown.contains("**Herramienta de aprendizaje:**"));
        assert!(markdown.contains("**Actividades calificadas:**\n- Ninguna"));
        assert!(!markdown.contains("**Resultados de aprendizaje:**"));
    }
}
