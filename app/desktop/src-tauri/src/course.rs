use crate::models::{ActionResult, DependencyStatus, WeekData};
use crate::paths::{
    atomic_write, atomic_write_if_changed, backup_file, canonical_directory, path_text,
    safe_segment, timestamp,
};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const DEPENDENCY_CACHE_TTL: Duration = Duration::from_secs(300);
static DEPENDENCY_CACHE: OnceLock<Mutex<Option<(Instant, Vec<DependencyStatus>)>>> =
    OnceLock::new();
static SYLLABUS_WRITE_OPERATION: Mutex<()> = Mutex::new(());
static PDF_COMPILE_OPERATION: Mutex<()> = Mutex::new(());
const COURSE_CODE_SLUG_MAX: usize = 24;
const COURSE_NAME_SLUG_MAX: usize = 48;
const KAOHANDT_MIKTEX_REQUIREMENTS: &[(&str, &str)] = &[
    ("abstract", "abstract.sty"),
    ("algorithm2e", "algorithm2e.sty"),
    ("bera", "beramono.sty"),
    ("bookmark", "bookmark.sty"),
    ("ccicons", "ccicons.sty"),
    ("chngcntr", "chngcntr.sty"),
    ("datatool", "datatool-base.sty"),
    ("etoc", "etoc.sty"),
    ("floatrow", "floatrow.sty"),
    ("footnotebackref", "footnotebackref.sty"),
    ("glossaries", "glossaries.sty"),
    ("marginnote", "marginnote.sty"),
    ("mathalpha", "mathalfa.sty"),
    ("morewrites", "morewrites.sty"),
    ("needspace", "needspace.sty"),
    ("newpx", "newpxtext.sty"),
    ("nomencl", "nomencl.sty"),
    ("pdfpages", "pdfpages.sty"),
    ("placeins", "placeins.sty"),
    ("sidenotes", "sidenotes.sty"),
    ("subfiles", "subfiles.sty"),
    ("tikzpagenodes", "tikzpagenodes.sty"),
    ("todonotes", "todonotes.sty"),
];

fn emit_compile_progress(
    app: &AppHandle,
    phase: &str,
    message: &str,
    detail: Option<&str>,
    started_at: Instant,
) {
    let _ = app.emit(
        "jintia://compile-progress",
        serde_json::json!({
            "phase": phase,
            "message": message,
            "detail": detail,
            "elapsedMs": started_at.elapsed().as_millis()
        }),
    );
}

#[cfg(target_os = "windows")]
fn ensure_miktex_package(
    app: &AppHandle,
    package_id: &str,
    file_name: &str,
    started_at: Instant,
) -> Result<(), String> {
    let available = Command::new("kpsewhich")
        .arg(file_name)
        .output()
        .ok()
        .is_some_and(|output| output.status.success() && !output.stdout.is_empty());
    if available {
        return Ok(());
    }

    emit_compile_progress(
        app,
        "package-install",
        "Instalando un componente LaTeX requerido",
        Some(package_id),
        started_at,
    );
    let mut modern = Command::new("miktex")
        .args(["packages", "install", package_id])
        .output();
    let mut installed = modern
        .as_ref()
        .ok()
        .is_some_and(|output| output.status.success());
    let package_unknown = modern.as_ref().ok().is_some_and(|output| {
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
        stderr.contains("package is unknown") || stderr.contains("paquete es desconocido")
    });
    if !installed && package_unknown {
        emit_compile_progress(
            app,
            "package-catalog",
            "Actualizando el catálogo de componentes LaTeX",
            Some(package_id),
            started_at,
        );
        let catalog_updated = Command::new("miktex")
            .args(["packages", "update-package-database"])
            .output()
            .ok()
            .is_some_and(|output| output.status.success());
        if catalog_updated {
            modern = Command::new("miktex")
                .args(["packages", "install", package_id])
                .output();
            installed = modern
                .as_ref()
                .ok()
                .is_some_and(|output| output.status.success());
        }
    }
    installed = installed
        || Command::new("mpm")
            .arg(format!("--install={package_id}"))
            .output()
            .ok()
            .is_some_and(|output| output.status.success());
    if installed {
        emit_compile_progress(
            app,
            "package-ready",
            "Componente LaTeX instalado",
            Some(package_id),
            started_at,
        );
        Ok(())
    } else {
        let detail = modern
            .ok()
            .map(|output| String::from_utf8_lossy(&output.stderr).trim().to_string())
            .filter(|text| !text.is_empty())
            .unwrap_or_else(|| "MiKTeX no permitió instalar el paquete.".to_string());
        Err(format!(
            "Falta `{file_name}`. No se pudo instalar automáticamente el paquete MiKTeX `{package_id}`: {detail}"
        ))
    }
}

#[cfg(not(target_os = "windows"))]
fn ensure_miktex_package(
    _app: &AppHandle,
    _package_id: &str,
    _file_name: &str,
    _started_at: Instant,
) -> Result<(), String> {
    Ok(())
}

fn dependency_cache() -> &'static Mutex<Option<(Instant, Vec<DependencyStatus>)>> {
    DEPENDENCY_CACHE.get_or_init(|| Mutex::new(None))
}

fn invalidate_dependency_cache() {
    if let Ok(mut cache) = dependency_cache().lock() {
        *cache = None;
    }
}

fn command_exists(command: &str) -> bool {
    let checker = if cfg!(target_os = "windows") {
        "where.exe"
    } else {
        "which"
    };
    Command::new(checker)
        .arg(command)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn chrome_executable() -> Option<PathBuf> {
    if let Ok(configured) = std::env::var("CHROME_PATH") {
        let path = PathBuf::from(configured);
        if path.is_file() {
            return Some(path);
        }
    }
    if cfg!(target_os = "windows") {
        for variable in ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"] {
            if let Ok(root) = std::env::var(variable) {
                let path = Path::new(&root)
                    .join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe");
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }
    ["google-chrome", "chromium", "chrome"]
        .into_iter()
        .find(|command| command_exists(command))
        .map(PathBuf::from)
}

fn version(command: &str, args: &[&str]) -> Option<String> {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .map(|output| {
            let text = if output.stdout.is_empty() {
                output.stderr
            } else {
                output.stdout
            };
            String::from_utf8_lossy(&text).into_owned()
        })
        .and_then(|text| {
            text.lines()
                .find(|line| !line.trim().is_empty())
                .map(str::trim)
                .map(str::to_string)
        })
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
    let npx = command_exists(if cfg!(target_os = "windows") {
        "npx.cmd"
    } else {
        "npx"
    });
    let python_command = if command_exists("python3") {
        "python3"
    } else {
        "python"
    };
    let python = command_exists(python_command);
    let git = command_exists("git");

    let mut dependencies = vec![
        DependencyStatus {
            name: "Node.js".to_string(),
            installed: node && npx,
            version: version("node", &["--version"]),
            required: true,
            installable: true,
            note: "Necesario para que la app funcione correctamente.".to_string(),
            command: "node --version".to_string(),
        },
        DependencyStatus {
            name: "Git".to_string(),
            installed: git,
            version: version("git", &["--version"]),
            required: false,
            installable: true,
            note: "Opcional: guarda el historial de cambios de tus cursos.".to_string(),
            command: "git --version".to_string(),
        },
        DependencyStatus {
            name: "Python".to_string(),
            installed: python,
            version: version(python_command, &["--version"]),
            required: true,
            installable: true,
            note: "Procesa recursos del curso (recortes bibliográficos).".to_string(),
            command: format!("{python_command} --version"),
        },
    ];

    // El compilador LaTeX (pdflatex + biber) se verifica e instala de forma
    // nativa en las tres plataformas: MiKTeX vía winget en Windows, TeX Live
    // vía Homebrew/apt en macOS/Linux. La app ya no detecta ni ofrece WSL ni
    // Docker: eran motores de compilación alternativos que el usuario final
    // no debería tener que evaluar. El nombre visible es genérico
    // ("Compilador LaTeX") porque el binario real detrás cambia según el SO.
    let latex = command_exists("pdflatex") && command_exists("biber");
    dependencies.push(DependencyStatus {
        name: "Compilador LaTeX".to_string(),
        installed: latex,
        version: version("pdflatex", &["--version"]),
        required: true,
        installable: true,
        note: "Genera el PDF de tu guía (MiKTeX en Windows).".to_string(),
        command: "pdflatex --version".to_string(),
    });

    let optional_visual_tools = [
        ("Graphviz", "dot", &["-V"][..], "Redes, mapas conceptuales y grafos."),
        ("Mermaid CLI", "mmdc", &["--version"][..], "Flujos y decisiones simples."),
        ("PlantUML", "plantuml", &["-version"][..], "UML y diagramas técnicos formales."),
        ("D2", "d2", &["--version"][..], "Diagramas declarativos y cronologías."),
        ("Vega-Lite CLI", "vl2svg", &["--version"][..], "Gráficos cuantitativos reproducibles."),
        ("WaveDrom", "wavedrom-cli", &["--version"][..], "Señales digitales."),
        ("Inkscape", "inkscape", &["--version"][..], "Conversión SVG, PDF y previsualizaciones."),
    ];
    dependencies.extend(optional_visual_tools.into_iter().map(
        |(name, command, version_args, note)| DependencyStatus {
            name: name.to_string(),
            installed: command_exists(command),
            version: version(command, version_args),
            required: false,
            installable: false,
            note: format!("{note} Capacidad visual opcional; Jintia aplicará un fallback cuando sea válido."),
            command: format!("{command} {}", version_args.join(" ")),
        },
    ));
    let chrome = chrome_executable();
    dependencies.push(DependencyStatus {
        name: "Google Chrome".to_string(),
        installed: chrome.is_some(),
        version: None,
        required: false,
        installable: false,
        note: "Capturas HTML reproducibles en segundo plano; Jintia no abre ventanas durante el renderizado.".to_string(),
        command: chrome
            .map(|path| path_text(&path))
            .unwrap_or_else(|| "CHROME_PATH".to_string()),
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
        if name == "Compilador LaTeX" && !confirmed {
            return ActionResult::error("Esta instalación cambia componentes del sistema y requiere confirmación explícita.");
        }

        let package = match name.as_str() {
            "Node.js" => "OpenJS.NodeJS.LTS",
            "Git" => "Git.Git",
            "Python" => "Python.Python.3.13",
            "Compilador LaTeX" => "MiKTeX.MiKTeX",
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
                if name == "Compilador LaTeX" {
                    return finish_miktex_install();
                }
                ActionResult::ok(format!("{name} instalado correctamente."))
            }
            Ok(status) => {
                ActionResult::error(format!("winget terminó con código {:?}.", status.code()))
            }
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

fn slug_component(value: &str, max_len: usize) -> String {
    let mut slug = String::new();
    let mut separator_pending = false;

    for character in value.trim().chars() {
        let folded = match character {
            'á' | 'à' | 'ä' | 'â' | 'ã' | 'å' | 'Á' | 'À' | 'Ä' | 'Â' | 'Ã' | 'Å' => {
                Some('a')
            }
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => Some('e'),
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => Some('i'),
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' | 'Ó' | 'Ò' | 'Ö' | 'Ô' | 'Õ' => Some('o'),
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => Some('u'),
            'ñ' | 'Ñ' => Some('n'),
            'ç' | 'Ç' => Some('c'),
            character if character.is_ascii_alphanumeric() => Some(character.to_ascii_lowercase()),
            _ => None,
        };

        if let Some(character) = folded {
            if separator_pending && !slug.is_empty() {
                slug.push('_');
            }
            slug.push(character);
            separator_pending = false;
        } else if !slug.is_empty() {
            separator_pending = true;
        }
    }

    if slug.len() <= max_len {
        return slug;
    }

    let prefix = &slug[..max_len];
    match prefix.rfind('_') {
        Some(position) if position >= max_len / 2 => prefix[..position].to_string(),
        _ => prefix.to_string(),
    }
}

fn course_folder_name(course_code: &str, course_name: &str) -> Result<String, String> {
    if course_code.trim().is_empty() {
        return Err("Código es obligatorio.".to_string());
    }
    if course_name.trim().is_empty() {
        return Err("Nombre es obligatorio.".to_string());
    }

    let code = slug_component(course_code, COURSE_CODE_SLUG_MAX);
    let name = slug_component(course_name, COURSE_NAME_SLUG_MAX);
    if code.is_empty() {
        return Err("El código debe contener al menos una letra o un número.".to_string());
    }
    if name.is_empty() {
        return Err("El nombre debe contener al menos una letra o un número.".to_string());
    }
    Ok(format!("{code}_{name}"))
}

fn course_directory(root: &Path, course_code: &str, course_name: &str) -> Result<PathBuf, String> {
    let canonical = root.join(course_folder_name(course_code, course_name)?);
    if canonical.exists() {
        return Ok(canonical);
    }

    // Las asignaturas creadas por versiones anteriores usaban "CÓDIGO Nombre".
    // Se conservan en su ubicación original para no separar sus archivos.
    if let (Ok(legacy_code), Ok(legacy_name)) = (
        safe_segment(course_code, "Código"),
        safe_segment(course_name, "Nombre"),
    ) {
        let legacy = root.join(format!("{legacy_code} {legacy_name}"));
        if legacy.exists() {
            return Ok(legacy);
        }
    }

    Ok(canonical)
}

pub fn create_course_structure(
    root_path: String,
    course_code: String,
    course_name: String,
    weeks: u32,
    initialize_readme: bool,
    include_graded_activities: bool,
) -> ActionResult {
    if !(1..=52).contains(&weeks) {
        return ActionResult::error("El número de semanas debe estar entre 1 y 52.");
    }
    let requested_root = PathBuf::from(root_path.trim());
    if root_path.trim().is_empty() {
        return ActionResult::error("Selecciona una carpeta para guardar el proyecto.");
    }
    if !requested_root.exists() {
        if let Err(error) = std::fs::create_dir_all(&requested_root) {
            return ActionResult::error(format!(
                "No se pudo crear la carpeta de proyectos: {error}"
            ));
        }
    }
    let root = match canonical_directory(&root_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let course = match course_directory(&root, &course_code, &course_name) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };

    let mut paths = vec![
        course.join("bibliografia").join("recortes_por_semana"),
        course.join("semanas").join("_shared").join("latex"),
    ];
    for week in 1..=weeks {
        let week_root = course
            .join("semanas")
            .join(format!("semana-{week:02}"))
            .join("latex");
        paths.push(week_root.join("sections"));
        paths.push(week_root.join("figure"));
    }
    for path in paths {
        if let Err(error) = std::fs::create_dir_all(&path) {
            return ActionResult::error(format!("No se pudo crear {}: {error}", path.display()));
        }
    }

    if let Err(error) = write_course_settings(&course, include_graded_activities) {
        return ActionResult::error(format!(
            "Las carpetas se crearon, pero no se pudo guardar la configuración de la asignatura: {error}"
        ));
    }

    if initialize_readme {
        let readme = course.join("README.md");
        if !readme.exists() {
            let content = format!(
                "# {} — {}\n\n\
                Proyecto académico preparado con Jintia.\n\n\
                ## Sílabo\n\n\
                El contenido semanal se completará desde el editor de sílabo.\n\n\
                ## Estructura\n\n\
                - `semanas/`: materiales organizados por semana.\n\
                - `bibliografia/`: referencias y recortes del curso.\n",
                course_code.trim(),
                course_name.trim(),
            );
            if let Err(error) = std::fs::write(&readme, content) {
                return ActionResult::error(format!(
                    "Las carpetas se crearon, pero no se pudo inicializar {}: {error}",
                    readme.display()
                ));
            }
        }
    }

    ActionResult::ok(format!(
        "Estructura creada para {weeks} semanas en:\n{}",
        path_text(&course)
    ))
    .with_path(path_text(&course))
}

fn write_course_settings(course: &Path, include_graded_activities: bool) -> Result<(), String> {
    let settings_dir = course.join(".jintia");
    std::fs::create_dir_all(&settings_dir)
        .map_err(|error| format!("no se pudo crear {}: {error}", settings_dir.display()))?;
    let settings = serde_json::json!({
        "schemaVersion": 1,
        "includeGradedActivities": include_graded_activities,
    });
    let bytes = serde_json::to_vec_pretty(&settings)
        .map_err(|error| format!("no se pudo serializar la configuración: {error}"))?;
    atomic_write(&settings_dir.join("course.json"), &bytes)
}

pub fn save_course_settings(
    course_path: String,
    course_code: String,
    course_name: String,
    include_graded_activities: bool,
) -> ActionResult {
    let root = match canonical_directory(&course_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let course = match course_directory(&root, &course_code, &course_name) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if !course.exists() {
        return ActionResult::error(format!(
            "Carpeta de la asignatura no encontrada: {}",
            course.display()
        ));
    }
    match write_course_settings(&course, include_graded_activities) {
        Ok(()) => ActionResult::ok("Configuración de la asignatura guardada."),
        Err(error) => ActionResult::error(error),
    }
}

fn bullets(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .map(|line| {
            line.trim_start_matches(|character: char| matches!(character, '-' | '*' | '•' | ' '))
                .trim()
        })
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn labelled_outcomes(text: &str) -> Vec<String> {
    bullets(text)
        .into_iter()
        .enumerate()
        .map(|(index, line)| {
            if [
                "docencia:",
                "práctica:",
                "practica:",
                "autónomo:",
                "autonomo:",
            ]
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
        items
            .into_iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
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
            topics
                .first()
                .cloned()
                .unwrap_or_else(|| week.unit.trim().to_string())
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
    let course = match course_directory(&root, &course_code, &course_name) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
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

    let result = ActionResult::ok(format!(
        "Sílabo canónico generado en:\n{}",
        path_text(&path)
    ))
    .with_path(path_text(&path));
    if let Some(backup) = backup {
        result.with_backup(path_text(&backup))
    } else {
        result
    }
}

fn append_demo_week(full_content: &mut String, week: &WeekData, marginal_layout: bool) {
    full_content.push_str(
        "\\begin{mintblock}[title=Resultado de aprendizaje de la semana]\n\
         Al finalizar, podrás:\n\\begin{itemize}\n",
    );
    for line in week.outcomes.lines().filter(|line| !line.trim().is_empty()) {
        full_content.push_str(&format!("\\item {}\n", line.trim()));
    }
    full_content.push_str("\\end{itemize}\n\\end{mintblock}\n\n");
    if marginal_layout {
        full_content.push_str(
            "\\marginconcept{Criterio}{Condición explícita y observable usada para comparar alternativas.}\n",
        );
    }
    full_content.push_str(
        "\
         \\guidesection{Antes de empezar: una decisión cotidiana}\n\
         \\begin{softblock}\n\
         Una organización debe elegir una nueva plataforma para atender solicitudes de sus usuarios. \
         Una opción es económica, otra es fácil de usar y una tercera ofrece mejores controles de seguridad. \
         Cada área recomienda una alternativa distinta y la reunión termina con una frase conocida: \
         ``escojamos la que parece mejor''.\n\n\
         El problema no es la falta de opiniones. El problema es que todavía no existe una forma compartida \
         de comparar las opciones. Esta semana aprenderás a transformar una preferencia intuitiva en una \
         recomendación profesional que otra persona pueda revisar, cuestionar y mejorar.\n\n\
         \\textbf{Tiempo estimado:} 2 horas de estudio guiado, 2 horas de práctica y 4 horas de trabajo autónomo.\n\
         \\end{softblock}\n\n\
         \\guidesection{1. De la información a la evidencia}\n\
         Una decisión justificable separa tres elementos que suelen confundirse:\n\
         \\begin{accentblock}[title=Tres niveles de lectura]\n\
         \\begin{itemize}\n\
         \\item \\textbf{Dato:} registro observable sin una conclusión incorporada. Ejemplo: 38 de 50 usuarios completaron una tarea.\n\
         \\item \\textbf{Evidencia:} dato pertinente y suficientemente confiable para responder una pregunta concreta. El mismo registro es evidencia si la pregunta es cuál opción facilita completar la tarea.\n\
         \\item \\textbf{Interpretación:} explicación razonada de lo que la evidencia significa, considerando contexto y límites. En este caso, el resultado sugiere facilidad de uso, pero no demuestra seguridad ni costo total.\n\
         \\end{itemize}\n\
         \\end{accentblock}\n\n\
         Una cifra no se convierte automáticamente en evidencia. Primero debe relacionarse con la decisión, \
         provenir de una fuente identificable y permitir una comparación razonable. Pregunta siempre: \
         \\textit{¿qué decisión ayuda a tomar este dato y qué no permite concluir?}\n\n\
         \\begin{sandblock}[title=Pausa de recuperación]\n\
         Un proveedor afirma que su plataforma tiene ``95 puntos de satisfacción''. Antes de aceptar esa cifra, \
         escribe tres preguntas sobre la muestra, la forma de medición y el grupo con el que se compara.\n\
         \\end{sandblock}\n\n\
         \\guidesection{2. Comparar alternativas con criterios explícitos}\n\
         Elegir profesionalmente requiere declarar qué significa una buena decisión antes de enamorarse de una opción. \
         Un \\textbf{criterio} es una condición utilizada para comparar alternativas. Debe ser relevante, comprensible \
         y observable.\n\n\
         \\begin{accentblock}[title=Herramienta: matriz de decisión en cinco pasos]\n\
         \\begin{enumerate}\n\
         \\item Formula la decisión en una pregunta: ``¿qué plataforma conviene implementar durante el próximo año?''\n\
         \\item Define criterios antes de puntuar: accesibilidad, facilidad de uso, seguridad, costo total y soporte.\n\
         \\item Asigna a cada criterio una importancia relativa y documenta por qué.\n\
         \\item Puntúa cada alternativa con la misma escala y vincula cada puntuación con una evidencia.\n\
         \\item Revisa si un cambio pequeño en los pesos modifica la recomendación. Si la cambia, la decisión es sensible y necesita más información.\n\
         \\end{enumerate}\n\
         \\end{accentblock}\n\n\
         Cuando varios criterios tienen distinta importancia, puede utilizarse una puntuación ponderada. \
         Para cada alternativa $A_j$, se multiplica el peso $w_i$ de cada criterio por su puntuación $s_{ij}$:\n\
         \\begin{equation}\n\
         P(A_j)=\\sum_{i=1}^{n} w_i s_{ij}, \\qquad \\sum_{i=1}^{n} w_i=1\n\
         \\label{eq:puntuacion-ponderada}\n\
         \\end{equation}\n\
         La ecuación no reemplaza el juicio profesional: hace visibles sus supuestos y permite revisar cómo se obtuvo el resultado.\n\n\
         \\begin{guidetable}\n\
         \\guidetablecaption{Comparación resumida de las alternativas del caso.}{tab:comparacion-alternativas}\n\
         \\small\n\
         \\begin{tabularx}{\\textwidth}{lXXX}\n\
         \\toprule\n\
         \\textbf{Alternativa} & \\textbf{Fortaleza principal} & \\textbf{Riesgo observado} & \\textbf{Evidencia disponible} \\\\\n\
         \\midrule\n\
         A & Menor costo inicial & Más pasos para el usuario & Cotización y prueba de tareas \\\\\n\
         B & Mejor accesibilidad y uso & Costo variable por volumen & Prueba con usuarios y revisión de seguridad \\\\\n\
         C & Mayor número de funciones & Soporte en otro huso horario & Demostración del proveedor \\\\\n\
         \\bottomrule\n\
         \\end{tabularx}\n\
         \\end{guidetable}\n\n\
         La Tabla~\\ref{tab:comparacion-alternativas} permite contrastar fortalezas, riesgos y calidad de evidencia, \
         mientras la Ecuación~\\ref{eq:puntuacion-ponderada} documenta cómo combinar criterios cuando se requiere una puntuación total.\n\n\
         \\begin{softblock}[title=Ejemplo trabajado]\n\
         El comité considera que la accesibilidad y la seguridad son críticas, mientras que el precio es importante \
         pero no decisivo. La opción A cuesta menos, aunque exige más pasos para completar una solicitud. La opción B \
         obtiene mejores resultados en una prueba con usuarios y cumple los controles requeridos. La opción C ofrece \
         más funciones, pero su soporte solo está disponible en otro huso horario.\n\n\
         La recomendación preliminar favorece la opción B. No porque ``sea la mejor'' en términos absolutos, sino porque \
         responde mejor a los criterios acordados y cuenta con evidencia directa en los aspectos de mayor importancia.\n\
         \\end{softblock}\n\n\
         La Figura~\\ref{fig:ruta-decision} resume la ruta completa. Observa que la recomendación no aparece al inicio: \
         es el resultado de hacer explícitos los criterios, contrastar evidencia y comparar alternativas.\n\n\
         \\begin{guidefigure}\n\
         \\begin{tikzpicture}[\n\
           node distance=5mm,\n\
           stage/.style={draw,rounded corners=2mm,fill=softbg,draw=softline,text=ink,\n\
             minimum width=7.2cm,text width=6.5cm,minimum height=9mm,align=center,inner sep=2.5mm},\n\
           key/.style={stage,fill=weekaccent!10,draw=weekaccent,line width=.8pt},\n\
           flow/.style={-{Stealth[length=2.5mm]},line width=.8pt,draw=weekaccent}\n\
         ]\n\
         \\node[stage] (question) {\\textbf{1. Formular la decisión}\\\\Una pregunta concreta y delimitada};\n\
         \\node[stage,below=of question] (criteria) {\\textbf{2. Acordar criterios}\\\\Qué significa una buena alternativa};\n\
         \\node[stage,below=of criteria] (evidence) {\\textbf{3. Reunir evidencia}\\\\Datos pertinentes, confiables y comparables};\n\
         \\node[stage,below=of evidence] (compare) {\\textbf{4. Comparar y probar sensibilidad}\\\\Puntuaciones, pesos, riesgos y vacíos};\n\
         \\node[key,below=of compare] (recommend) {\\textbf{5. Recomendar y revisar}\\\\Decisión, razones, límites y próximo paso};\n\
         \\draw[flow] (question) -- (criteria);\n\
         \\draw[flow] (criteria) -- (evidence);\n\
         \\draw[flow] (evidence) -- (compare);\n\
         \\draw[flow] (compare) -- (recommend);\n\
         \\end{tikzpicture}\n\
         \\guidefigurecaption{Ruta de una decisión profesional justificable.}{fig:ruta-decision}\n\
         \\end{guidefigure}\n\n\
         \\guidesection{3. Sesgos, incertidumbre y límites}\n\
         Incluso una matriz ordenada puede amplificar juicios débiles. Tres riesgos son especialmente frecuentes:\n\
         \\begin{roseblock}[title=Señales de alerta]\n\
         \\begin{itemize}\n\
         \\item \\textbf{Anclaje:} la primera cifra o propuesta condiciona las comparaciones posteriores.\n\
         \\item \\textbf{Confirmación:} se buscan datos que apoyan la opción preferida y se ignoran los contrarios.\n\
         \\item \\textbf{Exceso de confianza:} se presenta una estimación como certeza y se ocultan los vacíos de información.\n\
         \\end{itemize}\n\
         \\end{roseblock}\n\n\
         La respuesta profesional no consiste en fingir certeza. Consiste en declarar los límites: qué información falta, \
         qué riesgo permanece y qué hecho haría reconsiderar la decisión. Una prueba piloto puede ser una mejor decisión \
         que una adopción total cuando la evidencia todavía es incompleta.\n\n\
         \\guidesection{4. Del análisis a una recomendación clara}\n\
         \\begin{mintblock}[title=Estructura de una recomendación profesional]\n\
         \\begin{enumerate}\n\
         \\item \\textbf{Decisión:} expresa qué se recomienda y para qué contexto.\n\
         \\item \\textbf{Razones:} conecta los criterios prioritarios con la evidencia disponible.\n\
         \\item \\textbf{Límites:} identifica supuestos, datos faltantes y posibles efectos adversos.\n\
         \\item \\textbf{Próximo paso:} propone una acción verificable, una persona responsable y una fecha de revisión.\n\
         \\end{enumerate}\n\
         \\end{mintblock}\n\n\
         \\begin{accentblock}[title=Recomendación del caso]\n\
         Se recomienda realizar un piloto de cuatro semanas con la opción B porque obtuvo mejores resultados de accesibilidad \
         y facilidad de uso, y cumple los controles de seguridad establecidos. La estimación de costos aún depende del volumen \
         real de solicitudes; por ello, el piloto debe registrar tiempos de atención, incidencias, satisfacción y costo por caso. \
         El comité revisará esos indicadores antes de autorizar la implementación completa.\n\
         \\end{accentblock}\n\n\
         \\guidesection{Transferencia a cualquier profesión}\n\
         El método no depende del sector. Una profesional de salud puede comparar intervenciones; un docente, estrategias de \
         evaluación; una ingeniera, soluciones técnicas; un abogado, cursos de acción; y un administrador, proveedores. \
         En todos los casos cambia el contenido experto, pero permanece la secuencia: formular la decisión, acordar criterios, \
         buscar evidencia, comparar alternativas, declarar incertidumbre y comunicar una recomendación revisable.\n\n\
         \\begin{sandblock}[title=Actividad calificada]\n",
    );
    if let Some(activity) = week
        .graded_activity
        .as_ref()
        .filter(|activity| !activity.trim().is_empty())
    {
        full_content.push_str(activity.trim());
    }
    full_content.push_str(
        "\n\n\\textbf{Criterios de logro:} la entrega distingue hechos de supuestos, aplica los mismos criterios a todas \
         las alternativas, vincula cada conclusión con evidencia e identifica al menos una limitación.\n\
         \\end{sandblock}\n\n\
         \\guidesection{Autoevaluación}\n\
         Antes de entregar, comprueba:\n\
         \\begin{itemize}\n\
         \\item Puedo explicar la diferencia entre dato, evidencia e interpretación.\n\
         \\item Definí los criterios antes de seleccionar una alternativa.\n\
         \\item Puedo rastrear cada puntuación hasta una fuente o una observación.\n\
         \\item Reconocí un sesgo posible y un vacío de información.\n\
         \\item Mi recomendación incluye un próximo paso verificable.\n\
         \\end{itemize}\n\n\
         \\guidesection{Referencias bibliográficas}\n\
         \\begin{softblock}\n\\begin{itemize}\n",
    );
    for line in week
        .bibliography
        .lines()
        .filter(|line| !line.trim().is_empty())
    {
        full_content.push_str(&format!("\\item {}\n", line.trim()));
    }
    full_content.push_str("\\end{itemize}\n\\end{softblock}\n\n");
}

pub fn compile_syllabus_pdf(
    app: AppHandle,
    course_path: String,
    course_code: String,
    course_name: String,
    _credits: u32,
    academic_period: String,
    _semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
    include_jintia_credit: bool,
    reuse_if_valid: bool,
    preview_template_id: Option<String>,
) -> ActionResult {
    let started_at = Instant::now();
    emit_compile_progress(
        &app,
        "preparing",
        "Preparando el documento de prueba",
        None,
        started_at,
    );
    let _operation = match PDF_COMPILE_OPERATION.lock() {
        Ok(operation) => operation,
        Err(_) => return ActionResult::error("El estado interno de compilación está bloqueado."),
    };
    let course = match canonical_directory(&course_path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };

    let course_dir = match course_directory(&course, &course_code, &course_name) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if !course_dir.exists() {
        return ActionResult::error(format!(
            "Carpeta del curso no encontrada: {}",
            course_dir.display()
        ));
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
    let active_template = preview_template_id
        .filter(|template_id| {
            crate::config::list_templates()
                .iter()
                .any(|template| template.id == *template_id)
        })
        .unwrap_or_else(crate::config::get_active_template);
    emit_compile_progress(
        &app,
        "template",
        "Cargando la plantilla activa",
        Some(&active_template),
        started_at,
    );
    let author = if institution.author.is_empty() {
        "Autor académico no configurado".to_string()
    } else {
        institution.author
    };
    let institute_line = if institution.career.is_empty() {
        "Sistema Académico".to_string()
    } else {
        institution.career
    };
    let extrainfo_line = if institution.institution.is_empty() {
        String::new()
    } else {
        institution.institution
    };

    let is_demo_guide = course_code == "DEMO-DEC-101";
    let mut full_content = if is_demo_guide && active_template == "kaohandt-marginal" {
        format!(
            "\\documentclass[10pt,oneside]{{kaohandt}}\n\
             \\input{{preamble.tex}}\n\n\
             \\title{{Guía Didáctica Semanal}}\n\
             \\subtitle{{Semana 1: De la intuición a una decisión justificable}}\n\
             \\author{{{}}}\n\
             \\date{{{}}}\n\n\
             \\begin{{document}}\n\
             \\maketitle\n\
             \\pagelayout{{margin}}\n\n\
             \\coursemeta{{{} · {} · {}}}\n",
            author, academic_period, course_code, course_name, institute_line
        )
    } else if is_demo_guide {
        format!(
            "\\documentclass[11pt,oneside,lang=es,color=blue,citestyle=apa,bibstyle=apa]{{elegantbook}}\n\
             \\input{{preamble.tex}}\n\n\
             \\title{{Guía Didáctica Semanal}}\n\
             \\subtitle{{Semana 1\\\\De la intuición a una decisión justificable}}\n\
             \\author{{{}}}\n\
             \\institute{{{}}}\n\
             \\date{{{}}}\n\
             \\version{{Semana 1}}\n\
             \\bioinfo{{Asignatura}}{{{}\\\\{}}}\n\
             \\extrainfo{{{}}}\n\n\
             \\begin{{document}}\n\
             \\frontmatter\n\
             \\maketitle\n\
             \\mainmatter\n",
            author,
            institute_line,
            academic_period,
            course_code,
            course_name,
            extrainfo_line
        )
    } else if active_template == "kaohandt-marginal" {
        format!(
            "\\documentclass[10pt,oneside]{{kaohandt}}\n\
             \\input{{preamble.tex}}\n\n\
             \\title{{{} — {}}}\n\
             \\subtitle{{Guía Didáctica}}\n\
             \\author{{{}}}\n\
             \\date{{{}}}\n\n\
             \\begin{{document}}\n\
             \\maketitle\n\
             \\pagelayout{{margin}}\n\n\
             \\coursemeta{{{} · {}}}\n\
             \\guidesection{{Descripción del Curso}}\n\
             {}\n\n\
             \\guidesection{{Plan Semanal}}\n",
            course_code,
            course_name,
            author,
            academic_period,
            institute_line,
            extrainfo_line,
            description
        )
    } else {
        format!(
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
            course_code,
            course_name,
            author,
            institute_line,
            academic_period,
            extrainfo_line,
            description
        )
    };
    for week in &weeks_data {
        if is_demo_guide {
            if active_template == "kaohandt-marginal" {
                full_content.push_str(
                    "\\guidesection{Toma de Decisiones Basada en Evidencia}\n\n\
                     \\guidesection{Semana 1: De la Intuición a una Decisión Justificable}\n\n",
                );
            } else {
                full_content.push_str(
                    "\\chapter{Toma de Decisiones Basada en Evidencia}\n\n\
                     \\guidesection{Semana 1: De la Intuición a una Decisión Justificable}\n\n",
                );
            }
        }
        full_content.push_str(&format!(
            "\\editorialtitle{{Semana {:02}}}{{{}}}\n\n",
            week.number,
            week.title.trim()
        ));
        full_content.push_str(&format!(
            "\\coursemeta{{Unidad: {} \\quad Horas: Docencia {} · Práctica {} · Autónomo {}}}\n\n",
            week.unit.trim(),
            week.teaching_hours,
            week.practice_hours,
            week.autonomous_hours
        ));
        if is_demo_guide {
            append_demo_week(
                &mut full_content,
                week,
                active_template == "kaohandt-marginal",
            );
            continue;
        }
        if !week.topics.trim().is_empty() {
            full_content.push_str("\\begin{accentblock}[title=Temas]\n\\begin{itemize}\n");
            for line in week.topics.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{accentblock}\n\n");
        }
        if !week.outcomes.trim().is_empty() {
            full_content
                .push_str("\\begin{mintblock}[title=Resultado de aprendizaje]\n\\begin{itemize}\n");
            for line in week.outcomes.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{mintblock}\n\n");
        }
        if let Some(activity) = week
            .graded_activity
            .as_ref()
            .filter(|a| !a.trim().is_empty())
        {
            full_content.push_str(&format!(
                "\\begin{{sandblock}}[title=Actividad calificada]\n{}\n\\end{{sandblock}}\n\n",
                activity.trim()
            ));
        }
        if !week.bibliography.trim().is_empty() {
            full_content.push_str("\\begin{softblock}[title=Bibliografía]\n\\begin{itemize}\n");
            for line in week.bibliography.lines().filter(|l| !l.trim().is_empty()) {
                full_content.push_str(&format!("\\item {}\n", line.trim()));
            }
            full_content.push_str("\\end{itemize}\n\\end{softblock}\n\n");
        }
    }

    if include_jintia_credit {
        full_content.push_str(
            "\n\\clearpage\n\
             \\thispagestyle{empty}\n\
             \\vspace*{\\fill}\n\
             \\begin{center}\n\
             {\\footnotesize\\color{gray}Producido con Jintia\\\\\n\
             Diseña el camino del aprendizaje.\\\\\n\
             Software creado por Charlie Cárdenas Toledo.}\n\
             \\end{center}\n\
             \\vspace*{\\fill}\n",
        );
    }
    full_content.push_str("\n\\end{document}\n");

    let main_tex = latex_dir.join("main.tex");
    let pdf_path = latex_dir.join("main.pdf");
    let validation_path = latex_dir.join(".production-validation.json");
    let mut hasher = DefaultHasher::new();
    env!("CARGO_PKG_VERSION").hash(&mut hasher);
    active_template.hash(&mut hasher);
    crate::config::template_assets_fingerprint(&active_template).hash(&mut hasher);
    primary_rgb.hash(&mut hasher);
    full_content.hash(&mut hasher);
    let fingerprint = format!("{:016x}", hasher.finish());

    let valid_pdf = || {
        std::fs::metadata(&pdf_path)
            .ok()
            .is_some_and(|metadata| metadata.len() > 100)
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
        emit_compile_progress(
            &app,
            "complete",
            "Se reutilizó un PDF ya validado",
            Some(&path_text(&pdf_path)),
            started_at,
        );
        return ActionResult::ok(
            "La prueba de producción ya estaba validada y vigente; se reutilizó el PDF existente.",
        )
        .with_path(path_text(&pdf_path));
    }

    if let Err(error) = atomic_write(&main_tex, full_content.as_bytes()) {
        return ActionResult::error(format!("No se pudo escribir main.tex: {error}"));
    }

    if let Err(error) = crate::config::copy_template_assets(&active_template, &latex_dir) {
        return ActionResult::error(error);
    }
    emit_compile_progress(
        &app,
        "files-ready",
        "Archivos LaTeX preparados",
        Some(&path_text(&latex_dir)),
        started_at,
    );
    if let Err(error) = ensure_miktex_package(&app, "fixtounicode", "fixtounicode.sty", started_at)
    {
        emit_compile_progress(
            &app,
            "error",
            "No se pudo preparar MiKTeX",
            Some(&error),
            started_at,
        );
        return ActionResult::error(error);
    }
    if active_template == "kaohandt-marginal" {
        for (package_id, file_name) in KAOHANDT_MIKTEX_REQUIREMENTS {
            if let Err(error) = ensure_miktex_package(&app, package_id, file_name, started_at) {
                emit_compile_progress(
                    &app,
                    "error",
                    "No se pudo preparar una dependencia de Kaohandt",
                    Some(&error),
                    started_at,
                );
                return ActionResult::error(error);
            }
        }
    }

    // El preámbulo hace \addbibresource{reference.bib}; si el curso todavía
    // no tiene una, se crea vacía para que la compilación no falle.
    let bib_path = latex_dir.join("reference.bib");
    if !bib_path.exists() {
        if let Err(error) = atomic_write(&bib_path, b"% Sin referencias bibliograficas todavia.\n")
        {
            return ActionResult::error(format!("No se pudo crear reference.bib: {error}"));
        }
    }

    // pdflatex nativo (MiKTeX en Windows, TeX Live en macOS/Linux) es el
    // único motor de compilación: la app ya no ofrece Docker ni WSL como
    // alternativas, así que tampoco aparecen en un mensaje de error.
    match compile_via_pdflatex(&app, &latex_dir, "main", started_at) {
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
            emit_compile_progress(
                &app,
                "complete",
                "PDF compilado y validado",
                Some(&path_text(&pdf_path)),
                started_at,
            );
            ActionResult::ok("PDF compilado exitosamente").with_path(path_text(&pdf_path))
        }
        Err(error) => {
            emit_compile_progress(
                &app,
                "error",
                "La compilación terminó con un error",
                Some(&error),
                started_at,
            );
            ActionResult::error(error)
        }
    }
}

fn compile_via_pdflatex(
    app: &AppHandle,
    latex_dir: &std::path::Path,
    base_name: &str,
    started_at: Instant,
) -> Result<std::path::PathBuf, String> {
    for attempt in 1..=20 {
        emit_compile_progress(
            app,
            "engine-started",
            "Ejecutando el compilador LaTeX",
            Some(&format!("Intento {attempt}")),
            started_at,
        );
        let mut child = Command::new("pdflatex")
            .args(["-interaction=nonstopmode", &format!("{}.tex", base_name)])
            .current_dir(latex_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("No se pudo ejecutar pdflatex: {e}"))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "No se pudo leer la salida de pdflatex.".to_string())?;
        let mut captured_stdout = String::new();
        let mut stdout_reader = BufReader::new(stdout);
        let mut line_bytes = Vec::new();
        loop {
            line_bytes.clear();
            let read = stdout_reader
                .read_until(b'\n', &mut line_bytes)
                .map_err(|error| format!("No se pudo leer pdflatex: {error}"))?;
            if read == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&line_bytes)
                .trim_end_matches(['\r', '\n'])
                .to_string();
            captured_stdout.push_str(&line);
            captured_stdout.push('\n');
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                emit_compile_progress(
                    app,
                    "log",
                    "Compilando",
                    Some(&trimmed.chars().take(500).collect::<String>()),
                    started_at,
                );
            }
        }
        let mut captured_stderr = String::new();
        if let Some(mut stderr) = child.stderr.take() {
            let mut stderr_bytes = Vec::new();
            if stderr.read_to_end(&mut stderr_bytes).is_ok() {
                captured_stderr = String::from_utf8_lossy(&stderr_bytes).into_owned();
            }
        }
        let status = child
            .wait()
            .map_err(|error| format!("No se pudo esperar a pdflatex: {error}"))?;

        if status.success() {
            emit_compile_progress(
                app,
                "validating",
                "Validando el archivo PDF",
                None,
                started_at,
            );
            let pdf_path = latex_dir.join(format!("{}.pdf", base_name));
            if pdf_path.exists() {
                return Ok(pdf_path);
            } else {
                return Err("pdflatex no generó PDF.".to_string());
            }
        } else {
            let log_path = latex_dir.join(format!("{}.log", base_name));
            let error_log = if log_path.exists() {
                std::fs::read(&log_path)
                    .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
                    .unwrap_or_default()
            } else {
                format!("{captured_stdout}\n{captured_stderr}")
            };
            if let Some(file_name) = missing_latex_file(&error_log) {
                if let Some(package_id) = miktex_package_for_file(&file_name) {
                    ensure_miktex_package(app, package_id, &file_name, started_at)?;
                    emit_compile_progress(
                        app,
                        "compile-retry",
                        "Reintentando con el componente instalado",
                        Some(&file_name),
                        started_at,
                    );
                    continue;
                }
            }
            return Err(format!(
                "Error en compilación LaTeX:\n{}",
                extract_tex_error(&error_log)
            ));
        }
    }
    Err(
        "La compilación superó el límite de 20 intentos para instalar componentes LaTeX."
            .to_string(),
    )
}

fn missing_latex_file(log: &str) -> Option<String> {
    let file = log.split("File `").nth(1)?.split("' not found").next()?;
    let file = file.trim();
    (file.ends_with(".sty")
        && file
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_".contains(character)))
    .then(|| file.to_string())
}

fn miktex_package_for_file(file_name: &str) -> Option<&str> {
    let stem = file_name.strip_suffix(".sty")?;
    Some(match stem {
        "newpxtext" | "newpxmath" => "newpx",
        "beramono" => "bera",
        "mathalfa" => "mathalpha",
        "tikz" | "pgf" => "pgf",
        _ => stem,
    })
}

/// Extrae la parte útil de un log de pdflatex: las primeras líneas son
/// siempre el banner de la versión, nunca el error. Busca la línea que
/// empieza con "!" (marcador de error fatal de TeX) y su contexto; si no
/// la encuentra, devuelve el final del log (donde suele estar el error).
fn extract_tex_error(log: &str) -> String {
    let lines: Vec<&str> = log.lines().collect();
    if let Some(idx) = lines
        .iter()
        .position(|line| line.trim_start().starts_with('!'))
    {
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

    #[test]
    fn course_folders_use_a_short_portable_slug() {
        assert_eq!(
            course_folder_name("IFT 200", "Diseño e Interacción").unwrap(),
            "ift_200_diseno_e_interaccion"
        );
        assert_eq!(
            course_folder_name(
                "CC-05A",
                "Fundamentos profesionales para la toma de decisiones basada en evidencia"
            )
            .unwrap(),
            "cc_05a_fundamentos_profesionales_para_la_toma_de"
        );
    }

    #[test]
    fn course_folder_slug_rejects_empty_identifiers() {
        assert!(course_folder_name("", "Base de datos").is_err());
        assert!(course_folder_name("IFT200", "###").is_err());
    }

    #[test]
    fn missing_latex_dependencies_are_resolved_safely() {
        let log = "! LaTeX Error: File `needspace.sty' not found.";
        assert_eq!(missing_latex_file(log).as_deref(), Some("needspace.sty"));
        assert_eq!(miktex_package_for_file("needspace.sty"), Some("needspace"));
        assert_eq!(miktex_package_for_file("newpxtext.sty"), Some("newpx"));
        assert_eq!(miktex_package_for_file("tikz.sty"), Some("pgf"));
        assert_eq!(missing_latex_file("File `../secret.sty' not found."), None);
    }

    #[test]
    fn demo_pdf_contains_a_complete_transferable_week() {
        let week = WeekData {
            number: 1,
            title: "De la intuición a una decisión justificable".to_string(),
            unit: "Pensamiento crítico aplicado".to_string(),
            topics: String::new(),
            outcomes: "Comparar alternativas con evidencia".to_string(),
            bibliography: "Hammond, Keeney y Raiffa (1999). Smart Choices.".to_string(),
            graded_activity: Some("Elabora una recomendación profesional.".to_string()),
            autonomous_hours: 4,
            teaching_hours: 2,
            practice_hours: 2,
        };
        let mut latex = String::new();

        append_demo_week(&mut latex, &week, false);

        assert!(latex.contains("Antes de empezar: una decisión cotidiana"));
        assert!(latex.contains("matriz de decisión en cinco pasos"));
        assert!(latex.contains("\\begin{equation}"));
        assert!(latex.contains("\\begin{guidetable}"));
        assert!(latex.contains("\\begin{tabularx}"));
        assert!(latex.contains("\\begin{tikzpicture}"));
        assert!(latex.contains(
            "\\guidefigurecaption{Ruta de una decisión profesional justificable.}{fig:ruta-decision}"
        ));
        assert!(latex.contains("Transferencia a cualquier profesión"));
        assert!(latex.contains("Actividad calificada"));
        assert!(latex.contains("Autoevaluación"));
        assert!(latex.contains("Referencias bibliográficas"));
    }
}
