use tauri::Manager;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct DependencyStatus {
    name: String,
    installed: bool,
    version: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct InstallResult {
    success: bool,
    message: String,
}

// Verifica si un comando existe en PATH
fn command_exists(cmd: &str) -> bool {
    let output = if cfg!(target_os = "windows") {
        Command::new("where").arg(cmd).output()
    } else {
        Command::new("which").arg(cmd).output()
    };
    output.map(|o| o.status.success()).unwrap_or(false)
}

// Obtiene versión de un comando
fn get_version(cmd: &str, arg: &str) -> Option<String> {
    Command::new(cmd)
        .arg(arg)
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8(o.stdout).ok()
                .map(|s| s.lines().next().unwrap_or("").trim().to_string())
        })
}

#[tauri::command]
async fn check_dependencies() -> Vec<DependencyStatus> {
    let mut deps = Vec::new();

    // Git
    deps.push(DependencyStatus {
        name: "Git".into(),
        installed: command_exists("git"),
        version: get_version("git", "--version"),
    });

    // Node.js
    deps.push(DependencyStatus {
        name: "Node.js".into(),
        installed: command_exists("node"),
        version: get_version("node", "--version"),
    });

    // Python
    let python_cmd = if command_exists("python3") { "python3" } else { "python" };
    deps.push(DependencyStatus {
        name: "Python".into(),
        installed: command_exists(python_cmd),
        version: get_version(python_cmd, "--version"),
    });

    // WSL (solo Windows)
    #[cfg(target_os = "windows")]
    {
        let wsl_ok = Command::new("wsl")
            .arg("--status")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        deps.push(DependencyStatus {
            name: "WSL 2".into(),
            installed: wsl_ok,
            version: if wsl_ok { Some("disponible".into()) } else { None },
        });
    }

    // pdflatex (via WSL en Windows)
    #[cfg(target_os = "windows")]
    {
        let tex_ok = Command::new("wsl")
            .args(["bash", "-c", "which pdflatex"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        deps.push(DependencyStatus {
            name: "TeX Live (pdflatex)".into(),
            installed: tex_ok,
            version: if tex_ok { Some("en WSL".into()) } else { None },
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        deps.push(DependencyStatus {
            name: "TeX Live (pdflatex)".into(),
            installed: command_exists("pdflatex"),
            version: get_version("pdflatex", "--version"),
        });
    }

    deps
}

#[tauri::command]
async fn install_dependency(name: String) -> InstallResult {
    #[cfg(target_os = "windows")]
    {
        let (pkg_id, extra_args): (&str, Vec<&str>) = match name.as_str() {
            "Git"       => ("Git.Git",             vec![]),
            "Node.js"   => ("OpenJS.NodeJS.LTS",   vec![]),
            "Python"    => ("Python.Python.3",      vec![]),
            "WSL 2"     => {
                // WSL se instala diferente
                let status = Command::new("wsl")
                    .args(["--install", "--no-distribution"])
                    .status();
                return match status {
                    Ok(s) if s.success() => InstallResult {
                        success: true,
                        message: "WSL instalado. Reinicia el equipo para completar la instalación.".into(),
                    },
                    _ => InstallResult {
                        success: false,
                        message: "No se pudo instalar WSL. Ejecuta como Administrador.".into(),
                    },
                };
            },
            "TeX Live (pdflatex)" => {
                let status = Command::new("wsl")
                    .args(["bash", "-c", "sudo apt-get update -qq && sudo apt-get install -y texlive-full"])
                    .status();
                return match status {
                    Ok(s) if s.success() => InstallResult {
                        success: true,
                        message: "TeX Live instalado en WSL.".into(),
                    },
                    _ => InstallResult {
                        success: false,
                        message: "Error instalando TeX Live. Verifica que WSL esté funcionando.".into(),
                    },
                };
            },
            _ => return InstallResult { success: false, message: format!("Dependencia desconocida: {}", name) },
        };

        let mut args = vec!["install", "--id", pkg_id, "--silent", "--accept-source-agreements", "--accept-package-agreements"];
        args.extend(extra_args);

        let status = Command::new("winget").args(&args).status();
        match status {
            Ok(s) if s.success() => InstallResult {
                success: true,
                message: format!("{} instalado correctamente.", name),
            },
            Ok(s) => InstallResult {
                success: false,
                message: format!("winget salió con código {}. Puede que ya esté instalado.", s.code().unwrap_or(-1)),
            },
            Err(e) => InstallResult {
                success: false,
                message: format!("Error ejecutando winget: {}. ¿Está disponible?", e),
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        InstallResult {
            success: false,
            message: "Instalación automática solo disponible en Windows por ahora.".into(),
        }
    }
}

#[tauri::command]
async fn get_skill_path() -> String {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    format!("{}/.claude/skills/instructional-designer-skill", home)
        .replace("\\", "/")
}

#[tauri::command]
async fn create_course_structure(
    root_path: String,
    course_code: String,
    course_name: String,
    weeks: u32,
) -> InstallResult {
    let course_dir = format!("{}/{} {}", root_path, course_code, course_name);

    let dirs = vec![
        format!("{}/bibliografia/recortes_por_semana", course_dir),
        format!("{}/semanas/_shared/latex", course_dir),
    ];

    for i in 1..=weeks {
        let week = format!("{:02}", i);
        dirs.iter().for_each(|_| {});
        for sub in &["latex/sections", "latex/figure"] {
            let path = format!("{}/semanas/semana-{}/{}", course_dir, week, sub);
            if let Err(e) = std::fs::create_dir_all(&path) {
                return InstallResult {
                    success: false,
                    message: format!("Error creando {}: {}", path, e),
                };
            }
        }
    }

    for d in &dirs {
        if let Err(e) = std::fs::create_dir_all(d) {
            return InstallResult {
                success: false,
                message: format!("Error creando {}: {}", d, e),
            };
        }
    }

    InstallResult {
        success: true,
        message: format!("Estructura creada para {} semanas en:\n{}", weeks, course_dir),
    }
}

#[tauri::command]
async fn generate_syllabus(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> InstallResult {
    let content = build_syllabus_md(
        &course_code, &course_name, credits, &semester, &description, &weeks_data
    );

    let path = format!("{}/README.md", course_path);
    match std::fs::write(&path, content) {
        Ok(_) => InstallResult { success: true, message: format!("Sílabo generado en {}", path) },
        Err(e) => InstallResult { success: false, message: format!("Error escribiendo {}: {}", path, e) },
    }
}

#[derive(Serialize, Deserialize)]
struct WeekData {
    number: u32,
    unit: String,
    topics: String,
    outcomes: String,
    bibliography: String,
    graded_activity: Option<String>,
    autonomous_hours: u32,
    teaching_hours: u32,
}

fn build_syllabus_md(
    code: &str, name: &str, credits: u32, semester: &str,
    description: &str, weeks: &[WeekData]
) -> String {
    let mut md = format!(
        "# {} — {}\n\n\
        **Créditos:** {} | **Semestre:** {}\n\n\
        ## Descripción del curso\n\n\
        {}\n\n\
        ---\n\n\
        ## Plan semanal\n\n",
        code, name, credits, semester, description
    );

    for w in weeks {
        md.push_str(&format!(
            "### Semana {:02} — {}\n\n\
            **Tema / contenido semanal:**\n{}\n\n\
            **Resultados de aprendizaje:**\n{}\n\n\
            **Bibliografía:**\n{}\n\n\
            **Horas:** Docencia: {} | Autónomo: {}\n",
            w.number, w.unit,
            w.topics.lines().map(|l| format!("- {}", l)).collect::<Vec<_>>().join("\n"),
            w.outcomes.lines().map(|l| format!("- {}", l)).collect::<Vec<_>>().join("\n"),
            w.bibliography.lines().map(|l| format!("- {}", l)).collect::<Vec<_>>().join("\n"),
            w.teaching_hours, w.autonomous_hours,
        ));

        if let Some(act) = &w.graded_activity {
            md.push_str(&format!("\n**Actividad calificada:** {}\n", act));
        }

        md.push_str("\n---\n\n");
    }

    md
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            install_dependency,
            get_skill_path,
            create_course_structure,
            generate_syllabus,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
