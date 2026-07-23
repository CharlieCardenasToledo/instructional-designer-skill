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

// ── Instalar skill en ~/.claude/skills/ ───────────────────────────────────
#[tauri::command]
async fn install_skill() -> InstallResult {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();

    let skills_dir = format!("{}/.claude/skills", home);
    let skill_dir  = format!("{}/instructional-designer-skill", skills_dir);

    // Crear directorio de skills si no existe
    if let Err(e) = std::fs::create_dir_all(&skills_dir) {
        return InstallResult { success: false, message: format!("No se pudo crear {}: {}", skills_dir, e) };
    }

    // Si ya existe, solo actualizar con git pull
    if std::path::Path::new(&skill_dir).exists() {
        let status = Command::new("git")
            .args(["-C", &skill_dir, "pull", "origin", "master"])
            .status();
        return match status {
            Ok(s) if s.success() => InstallResult { success: true, message: format!("Skill actualizado en:\n{}", skill_dir) },
            _ => InstallResult { success: true, message: format!("Skill ya estaba instalado en:\n{}\n(No se pudo actualizar — sin conexión o sin Git)", skill_dir) },
        };
    }

    // Intentar clonar con git primero
    if command_exists("git") {
        let status = Command::new("git")
            .args(["clone", "https://github.com/CharlieCardenasToledo/instructional-designer-skill", &skill_dir])
            .status();
        if let Ok(s) = status {
            if s.success() {
                return InstallResult { success: true, message: format!("Skill instalado en:\n{}", skill_dir) };
            }
        }
    }

    // Fallback: descargar ZIP via PowerShell
    #[cfg(target_os = "windows")]
    {
        let zip_path = format!("{}/.claude/skills/ids-skill.zip", home);
        let ps_cmd = format!(
            "Invoke-WebRequest -Uri 'https://github.com/CharlieCardenasToledo/instructional-designer-skill/archive/refs/heads/master.zip' -OutFile '{}'; \
             Expand-Archive -Path '{}' -DestinationPath '{}'; \
             Rename-Item -Path '{}/instructional-designer-skill-master' -NewName 'instructional-designer-skill'; \
             Remove-Item '{}'",
            zip_path, zip_path, skills_dir, skills_dir, zip_path
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .status();
        return match status {
            Ok(s) if s.success() => InstallResult { success: true, message: format!("Skill instalado (ZIP) en:\n{}", skill_dir) },
            _ => InstallResult { success: false, message: "No se pudo descargar el skill. Verifica tu conexión a internet.".into() },
        };
    }

    #[cfg(not(target_os = "windows"))]
    InstallResult { success: false, message: "Instala Git e inténtalo de nuevo.".into() }
}

// ── Configurar MCP en Claude Desktop ──────────────────────────────────────
#[derive(Serialize, Deserialize)]
struct McpConfig {
    #[serde(rename = "mcpServers")]
    mcp_servers: std::collections::HashMap<String, McpServer>,
}

#[derive(Serialize, Deserialize, Clone)]
struct McpServer {
    command: String,
    args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    env: Option<std::collections::HashMap<String, String>>,
}

#[tauri::command]
async fn configure_mcp() -> InstallResult {
    // Rutas del config de Claude Desktop
    let config_path = {
        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").unwrap_or_default();
            format!("{}/Claude/claude_desktop_config.json", appdata)
        }
        #[cfg(target_os = "macos")]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{}/Library/Application Support/Claude/claude_desktop_config.json", home)
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{}/.config/claude/claude_desktop_config.json", home)
        }
    };

    // Crear directorio si no existe
    if let Some(parent) = std::path::Path::new(&config_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Leer config existente o crear vacía
    let mut config: McpConfig = std::fs::read_to_string(&config_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| McpConfig { mcp_servers: std::collections::HashMap::new() });

    // Agregar notebooklm MCP si no existe
    if !config.mcp_servers.contains_key("notebooklm") {
        config.mcp_servers.insert("notebooklm".into(), McpServer {
            command: "npx".into(),
            args: vec!["-y".into(), "notebooklm-mcp".into()],
            env: None,
        });
    }

    // Escribir config actualizado
    match serde_json::to_string_pretty(&config) {
        Ok(json) => match std::fs::write(&config_path, json) {
            Ok(_) => InstallResult {
                success: true,
                message: format!("NotebookLM MCP configurado en:\n{}\n\nReinicia Claude Desktop para aplicar los cambios.", config_path),
            },
            Err(e) => InstallResult { success: false, message: format!("Error escribiendo config: {}", e) },
        },
        Err(e) => InstallResult { success: false, message: format!("Error serializando config: {}", e) },
    }
}

// ── Aplicar configuración institucional en archivos del skill ──────────────
#[derive(Serialize, Deserialize)]
struct InstitutionConfig {
    author: String,
    degree: String,
    career: String,
    faculty: String,
    institution: String,
    color_r: u8,
    color_g: u8,
    color_b: u8,
    ecosystem: String,
}

#[tauri::command]
async fn apply_institution_config(config: InstitutionConfig) -> InstallResult {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    let skill_dir = format!("{}/.claude/skills/instructional-designer-skill", home);

    // ── 1. Actualizar plantilla-latex.md ──────────────────────────────────
    let latex_path = format!("{}/references/plantilla-latex.md", skill_dir);
    if let Ok(mut content) = std::fs::read_to_string(&latex_path) {
        // Reemplazar marcadores de autor e institución
        let replacements = [
            ("YOUR_FULL_NAME, Your_Degree",    format!("{}, {}", config.author, config.degree)),
            ("Your_Degree",                    config.degree.clone()),
            ("Your Full Name",                 config.author.clone()),
            ("Carrera de\\\\YOUR_CAREER",      format!("Carrera de\\\\{}", config.career)),
            ("YOUR_FACULTY\\\\YOUR_INSTITUTION", format!("{}\\\\{}", config.faculty, config.institution)),
            ("YOUR_INSTITUTION_NAME",          config.institution.clone()),
            // Color institucional
            ("RGB}{0,121,107}",                format!("RGB}}{{{},{},{}}}", config.color_r, config.color_g, config.color_b)),
        ];
        for (old, new) in &replacements {
            content = content.replace(old, new);
        }
        let _ = std::fs::write(&latex_path, &content);
    }

    // ── 2. Actualizar SKILL.md (anclaje institucional) ────────────────────
    let skill_md_path = format!("{}/SKILL.md", skill_dir);
    if let Ok(mut content) = std::fs::read_to_string(&skill_md_path) {
        content = content.replace("YOUR_INSTITUTION_NAME", &config.institution);
        content = content.replace("YOUR_CAREER", &config.career);
        content = content.replace("YOUR_FACULTY", &config.faculty);
        if !config.ecosystem.is_empty() {
            // Reemplazar bloque de ecosistema genérico
            let eco_lines: String = config.ecosystem.lines()
                .map(|l| format!("- {}", l))
                .collect::<Vec<_>>()
                .join("\n");
            content = content.replace(
                "- LMS institucional (ej: Moodle, Canvas, Blackboard)\n- Sistema de videoconferencia\n- Correo institucional",
                &eco_lines
            );
        }
        let _ = std::fs::write(&skill_md_path, &content);
    }

    InstallResult {
        success: true,
        message: format!(
            "Configuración aplicada en el skill:\n• {}/references/plantilla-latex.md\n• {}/SKILL.md\n\nClaude Desktop detectará los cambios en la próxima sesión.",
            skill_dir, skill_dir
        ),
    }
}

// ── Estado completo de configuración ──────────────────────────────────────
#[derive(Serialize)]
struct SetupStatus {
    skill_installed: bool,
    mcp_configured: bool,
    institution_configured: bool,
    skill_path: String,
    mcp_config_path: String,
}

#[tauri::command]
async fn get_setup_status() -> SetupStatus {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();

    let skill_path = format!("{}/.claude/skills/instructional-designer-skill", home);
    let skill_installed = std::path::Path::new(&format!("{}/SKILL.md", skill_path)).exists();

    #[cfg(target_os = "windows")]
    let mcp_config_path = format!("{}/Claude/claude_desktop_config.json", std::env::var("APPDATA").unwrap_or_default());
    #[cfg(not(target_os = "windows"))]
    let mcp_config_path = format!("{}/Library/Application Support/Claude/claude_desktop_config.json", home);

    let mcp_configured = std::fs::read_to_string(&mcp_config_path)
        .map(|s| s.contains("notebooklm"))
        .unwrap_or(false);

    // Verificar si la config institucional fue aplicada (no hay placeholder)
    let institution_configured = std::fs::read_to_string(format!("{}/SKILL.md", skill_path))
        .map(|s| !s.contains("YOUR_INSTITUTION_NAME"))
        .unwrap_or(false);

    SetupStatus { skill_installed, mcp_configured, institution_configured, skill_path, mcp_config_path }
}

// ── Autenticación NotebookLM MCP ───────────────────────────────────────────

#[derive(Serialize)]
struct NotebookLMAuthStatus {
    authenticated: bool,
    message: String,
}

/// Llama al get_health del MCP via JSON-RPC en subproceso para saber si hay sesión activa.
/// Es la única forma fiable — no depende de rutas de cookies que cambian entre versiones.
#[tauri::command]
async fn check_notebooklm_auth() -> NotebookLMAuthStatus {
    use std::io::Write;
    use std::process::Stdio;

    // Levantar el proceso MCP
    let mut child = match Command::new("npx")
        .args(["-y", "notebooklm-mcp"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return NotebookLMAuthStatus {
            authenticated: false,
            message: "notebooklm-mcp no está instalado. Instala Node.js primero.".into(),
        },
    };

    // Protocolo MCP: primero initialize, luego tools/call get_health
    let initialize = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ids-manager","version":"0.1"}}}"#;
    let get_health = r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_health","arguments":{}}}"#;

    if let Some(stdin) = child.stdin.as_mut() {
        let _ = writeln!(stdin, "{}", initialize);
        let _ = writeln!(stdin, "{}", get_health);
    }

    // Leer respuesta con timeout de 8 segundos
    let output = {
        let handle = child.stdout.take();
        let result = std::thread::spawn(move || {
            use std::io::BufRead;
            let mut lines = Vec::new();
            if let Some(out) = handle {
                let reader = std::io::BufReader::new(out);
                for line in reader.lines().take(10) {
                    if let Ok(l) = line { lines.push(l); }
                }
            }
            lines
        });
        std::thread::sleep(std::time::Duration::from_secs(8));
        let _ = child.kill();
        result.join().unwrap_or_default()
    };

    // Buscar la respuesta de get_health (id:2) y extraer "authenticated"
    for line in &output {
        if line.contains("\"id\":2") || line.contains("authenticated") {
            // authenticated: true → sesión activa
            if line.contains("\"authenticated\":true") || line.contains("\"authenticated\": true") {
                return NotebookLMAuthStatus {
                    authenticated: true,
                    message: "Sesión activa — NotebookLM MCP puede consultar tus notebooks.".into(),
                };
            }
            // authenticated: false → sin sesión
            if line.contains("\"authenticated\":false") || line.contains("\"authenticated\": false") {
                return NotebookLMAuthStatus {
                    authenticated: false,
                    message: "Sin sesión activa. Debes iniciar sesión antes de usar el skill.".into(),
                };
            }
        }
    }

    // Sin respuesta clara → MCP instalado pero no autenticado
    NotebookLMAuthStatus {
        authenticated: false,
        message: "No se pudo verificar la sesión. Usa el botón de abajo para iniciar sesión.".into(),
    }
}

#[tauri::command]
async fn run_notebooklm_auth() -> InstallResult {
    // El MCP expone setup_auth como herramienta, pero para lanzarlo desde la app
    // lo más fiable es ejecutar npx notebooklm-mcp en modo interactivo y dejar
    // que el proceso abra el browser para que el usuario inicie sesión.
    use std::process::Stdio;

    let child = Command::new("npx")
        .args(["-y", "notebooklm-mcp"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => return InstallResult { success: false, message: format!("Error iniciando MCP: {}", e) },
    };

    // Enviar initialize + setup_auth
    use std::io::Write;
    let initialize = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ids-manager","version":"0.1"}}}"#;
    let setup_auth = r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"setup_auth","arguments":{}}}"#;

    if let Some(stdin) = child.stdin.as_mut() {
        let _ = writeln!(stdin, "{}", initialize);
        let _ = writeln!(stdin, "{}", setup_auth);
    }

    // Esperar hasta 3 min (el usuario necesita tiempo para iniciar sesión en el browser)
    std::thread::sleep(std::time::Duration::from_secs(180));
    let _ = child.kill();

    // Verificar si ahora está autenticado
    let status = check_notebooklm_auth().await;
    if status.authenticated {
        InstallResult { success: true, message: "Sesión iniciada correctamente. El skill ya puede consultar tus notebooks.".into() }
    } else {
        InstallResult { success: false, message: "No se pudo confirmar la sesión. Intenta de nuevo o inicia sesión manualmente desde Claude Desktop.".into() }
    }
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
            install_skill,
            configure_mcp,
            apply_institution_config,
            get_setup_status,
            check_notebooklm_auth,
            run_notebooklm_auth,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
