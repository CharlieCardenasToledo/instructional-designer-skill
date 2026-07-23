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
            note: "Requerido para NotebookLM MCP y los validadores.".to_string(),
        },
        DependencyStatus {
            name: "Git".to_string(),
            installed: git,
            version: version("git", &["--version"]),
            required: false,
            note: "Opcional: útil para versionar cursos; la skill ya viene incluida en la app.".to_string(),
        },
        DependencyStatus {
            name: "Python".to_string(),
            installed: python,
            version: version(python_command, &["--version"]),
            required: false,
            note: "Opcional: necesario solo para recortar PDFs con PyMuPDF.".to_string(),
        },
    ];

    #[cfg(target_os = "windows")]
    {
        let wsl = Command::new("wsl.exe")
            .arg("--status")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);
        dependencies.push(DependencyStatus {
            name: "WSL 2".to_string(),
            installed: wsl,
            version: wsl.then(|| "Disponible".to_string()),
            required: false,
            note: "Opcional: una vía para compilar LaTeX en Windows.".to_string(),
        });

        let latex = wsl
            && Command::new("wsl.exe")
                .args(["--", "sh", "-lc", "command -v pdflatex && command -v biber"])
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false);
        dependencies.push(DependencyStatus {
            name: "TeX Live (pdflatex)".to_string(),
            installed: latex,
            version: latex.then(|| "Disponible en WSL".to_string()),
            required: false,
            note: "Opcional y de gran tamaño: necesario solo para compilar guías localmente.".to_string(),
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
            note: "Opcional: necesario solo para compilar guías localmente.".to_string(),
        });
    }

    dependencies
}

pub fn install_dependency(name: String, confirmed: bool) -> ActionResult {
    #[cfg(target_os = "windows")]
    {
        if matches!(name.as_str(), "WSL 2" | "TeX Live (pdflatex)") && !confirmed {
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
            Ok(status) if status.success() => ActionResult::ok(format!("{name} instalado correctamente.")),
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
    let course = match canonical_directory(&course_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = safe_segment(&course_code, "Código") {
        return ActionResult::error(error);
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
