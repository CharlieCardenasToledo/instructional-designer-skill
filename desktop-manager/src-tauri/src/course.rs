use crate::models::{ActionResult, DependencyStatus, WeekData};
use crate::paths::{atomic_write, atomic_write_if_changed, backup_file, canonical_directory, path_text, safe_segment, timestamp};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const DEPENDENCY_CACHE_TTL: Duration = Duration::from_secs(300);
static DEPENDENCY_CACHE: OnceLock<Mutex<Option<(Instant, Vec<DependencyStatus>)>>> = OnceLock::new();
static SYLLABUS_WRITE_OPERATION: Mutex<()> = Mutex::new(());
static PDF_COMPILE_OPERATION: Mutex<()> = Mutex::new(());

fn dependency_cache() -> &'static Mutex<Option<(Instant, Vec<DependencyStatus>)>> {
    DEPENDENCY_CACHE.get_or_init(|| Mutex::new(None))
}

fn invalidate_dependency_cache() {
    if let Ok(mut cache) = dependency_cache().lock() {
        *cache = None;
    }
}

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

pub fn check_dependencies() -> Vec<DependencyStatus> {
    // El registro puede tener el PATH correcto (por una instalación de esta
    // sesión o de una sesión anterior de la app) sin que este proceso lo
    // haya heredado todavía. Releerlo antes de cada verificación evita que
    // "Verificar de nuevo" reporte "no encontrado" para algo que sí está
    // instalado, sin depender de que el usuario reinicie la app.
    #[cfg(target_os = "windows")]
    refresh_path_from_registry();

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

    // TeX Live (pdflatex + biber) se verifica e instala de forma nativa en
    // las tres plataformas (MiKTeX vía winget en Windows). La app ya no
    // detecta ni ofrece WSL ni Docker: eran motores de compilación
    // alternativos que el usuario final no debería tener que evaluar.
    let latex = command_exists("pdflatex") && command_exists("biber");
    dependencies.push(DependencyStatus {
        name: "TeX Live (pdflatex)".to_string(),
        installed: latex,
        version: version("pdflatex", &["--version"]),
        required: true,
        note: "Compilador LaTeX: genera el PDF de tu guía.".to_string(),
        command: "pdflatex --version".to_string(),
    });

    if let Ok(mut cache) = dependency_cache().lock() {
        *cache = Some((Instant::now(), dependencies.clone()));
    }
    dependencies
}

/// Reutiliza la inspección que ya mostró el paso de entorno. La verificación
/// de TeX Live puede tardar varios segundos, así que repetirla inmediatamente
/// al pulsar "Continuar" no aporta una validación más fiable.
pub fn check_dependencies_cached() -> Vec<DependencyStatus> {
    if let Ok(cache) = dependency_cache().lock() {
        if let Some((checked_at, dependencies)) = cache.as_ref() {
            if checked_at.elapsed() <= DEPENDENCY_CACHE_TTL {
                return dependencies.clone();
            }
        }
    }
    check_dependencies()
}

pub fn install_dependency(name: String, confirmed: bool) -> ActionResult {
    // Una instalación puede cambiar el estado del entorno. La siguiente
    // verificación debe inspeccionarlo de nuevo.
    invalidate_dependency_cache();
    #[cfg(target_os = "windows")]
    {
        if name == "TeX Live (pdflatex)" && !confirmed {
            return ActionResult::error("Esta instalación cambia componentes del sistema y requiere confirmación explícita.");
        }

        let package = match name.as_str() {
            "Node.js" => "OpenJS.NodeJS.LTS",
            "Git" => "Git.Git",
            "Python" => "Python.Python.3.13",
            "TeX Live (pdflatex)" => "MiKTeX.MiKTeX",
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
                // winget ya actualizó el PATH en el registro, pero este
                // proceso lo heredó una sola vez al arrancar. Releerlo ahora
                // permite que "Verificar de nuevo" encuentre la dependencia
                // sin reiniciar la app completa.
                refresh_path_from_registry();
                if name == "TeX Live (pdflatex)" {
                    return finish_miktex_install();
                }
                ActionResult::ok(format!("{name} instalado correctamente."))
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

/// El PATH del registro cambia con cada `winget install`, pero un proceso ya
/// en ejecución solo hereda el PATH una vez, al arrancar (Windows no lo
/// actualiza en caliente). Se relee Machine+User desde el registro -en ese
/// orden, igual que arma el PATH un proceso nuevo- y se aplica a este mismo
/// proceso con `set_var`, para que los siguientes `Command::new(...)` (y la
/// próxima verificación de dependencias) ya vean el binario recién instalado
/// sin necesidad de reiniciar la app completa.
#[cfg(target_os = "windows")]
fn refresh_path_from_registry() {
    let script = "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')";
    let Ok(output) = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
    else {
        return;
    };
    if !output.status.success() {
        return;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !path.is_empty() {
        std::env::set_var("PATH", path);
    }
}

/// Tras instalar MiKTeX vía winget, `initexmf`/`mpm` viven en una ruta fija
/// del perfil del usuario. Se usa esa ruta directa (en vez de depender del
/// PATH, por si `refresh_path_from_registry` no alcanzó a verlos todavía)
/// para: (1) desactivar el diálogo de "¿instalar paquete faltante?" que
/// colgaría una compilación no interactiva, y (2) instalar `biber`, que la
/// skill necesita para la bibliografía.
#[cfg(target_os = "windows")]
fn finish_miktex_install() -> ActionResult {
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let bin_dir = std::path::Path::new(&local_appdata)
        .join("Programs")
        .join("MiKTeX")
        .join("miktex")
        .join("bin")
        .join("x64");
    let initexmf = bin_dir.join("initexmf.exe");
    let mpm = bin_dir.join("mpm.exe");

    if !initexmf.exists() {
        return ActionResult::ok(
            "MiKTeX se instaló correctamente. Si “Verificar de nuevo” todavía no lo detecta, reinicia la app.",
        );
    }

    let auto_install = Command::new(&initexmf)
        .arg("--set-config-value=[MPM]AutoInstall=1")
        .status();
    let biber = Command::new(&mpm)
        .args(["--install=biber", "--install=biblatex"])
        .status();

    match (auto_install, biber) {
        (Ok(a), Ok(b)) if a.success() && b.success() => ActionResult::ok(
            "MiKTeX instalado y configurado: pdflatex y biber quedaron listos. Los paquetes LaTeX que falten se instalarán automáticamente durante la compilación.",
        ),
        _ => ActionResult::ok(
            "MiKTeX se instaló correctamente, pero no se pudo terminar de configurar biber en automático. Abre MiKTeX Console e instala el paquete “biber”, o reinicia la app y vuelve a verificar.",
        ),
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
    let _operation = match SYLLABUS_WRITE_OPERATION.lock() {
        Ok(operation) => operation,
        Err(_) => return ActionResult::error("El estado interno del sílabo está bloqueado."),
    };
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
    if std::fs::read(&path).ok().as_deref() == Some(content.as_bytes()) {
        return ActionResult::ok(format!(
            "El sílabo de prueba ya estaba actualizado; no se creó otro archivo ni respaldo.\n{}",
            path_text(&path)
        ))
        .with_path(path_text(&path));
    }
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
    reuse_if_valid: bool,
) -> ActionResult {
    let _operation = match PDF_COMPILE_OPERATION.lock() {
        Ok(operation) => operation,
        Err(_) => return ActionResult::error("El estado interno de compilación está bloqueado."),
    };
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
    let primary_rgb = institution.primary_rgb.clone();
    let active_template = crate::config::get_active_template();
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
    let pdf_path = latex_dir.join("main.pdf");
    let validation_path = latex_dir.join(".production-validation.json");
    let mut hasher = DefaultHasher::new();
    env!("CARGO_PKG_VERSION").hash(&mut hasher);
    active_template.hash(&mut hasher);
    primary_rgb.hash(&mut hasher);
    full_content.hash(&mut hasher);
    let fingerprint = format!("{:016x}", hasher.finish());

    let valid_pdf = || {
        std::fs::metadata(&pdf_path).ok().is_some_and(|metadata| metadata.len() > 100)
            && std::fs::read(&pdf_path)
                .ok()
                .is_some_and(|bytes| bytes.starts_with(b"%PDF-"))
    };
    let manifest_matches = || {
        std::fs::read(&validation_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .and_then(|value| value.get("fingerprint")?.as_str().map(str::to_string))
            .as_deref()
            == Some(fingerprint.as_str())
    };
    if reuse_if_valid && valid_pdf() && manifest_matches() {
        return ActionResult::ok(
            "La prueba de producción ya estaba validada y vigente; se reutilizó el PDF existente.",
        )
        .with_path(path_text(&pdf_path));
    }

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

    // pdflatex nativo (MiKTeX en Windows, TeX Live en macOS/Linux) es el
    // único motor de compilación: la app ya no ofrece Docker ni WSL como
    // alternativas, así que tampoco aparecen en un mensaje de error.
    match compile_via_pdflatex(&latex_dir, "main") {
        Ok(pdf_path) => {
            if reuse_if_valid {
                let manifest = serde_json::json!({
                    "schemaVersion": 1,
                    "fingerprint": fingerprint,
                    "pdfPath": path_text(&pdf_path),
                    "validatedAt": timestamp()
                });
                if let Ok(bytes) = serde_json::to_vec_pretty(&manifest) {
                    if let Err(error) = atomic_write_if_changed(&validation_path, &bytes) {
                        return ActionResult::error(format!(
                            "El PDF se generó, pero no se pudo registrar la validación: {error}"
                        ));
                    }
                }
            }
            ActionResult::ok(format!("PDF compilado exitosamente"))
                .with_path(path_text(&pdf_path))
        }
        Err(error) => ActionResult::error(error),
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
