use crate::models::ActionResult;
use crate::paths::{app_config_dir, atomic_write, canonical_directory, path_text, skill_dir, timestamp};
use include_dir::{include_dir, Dir};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;

const SKILL_MD: &[u8] = include_bytes!("../../../SKILL.md");
const LICENSE: &[u8] = include_bytes!("../../../LICENSE");
const REQUIREMENTS: &[u8] = include_bytes!("../../../requirements.txt");
static REFERENCES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../references");
static SCRIPTS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../scripts");
static TEMPLATES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../templates");
static CONFIG: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../config");

fn write_embedded_dir(dir: &Dir<'_>, target: &Path) -> Result<(), String> {
    for entry in dir.files() {
        let destination = target.join(entry.path());
        atomic_write(&destination, entry.contents())?;
    }
    for child in dir.dirs() {
        write_embedded_dir(child, target)?;
    }
    Ok(())
}

fn read_valid_json(path: &Path) -> Option<Vec<u8>> {
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice::<serde_json::Value>(&bytes).ok()?;
    Some(bytes)
}

fn user_config(name: &str, installed: Option<&Path>) -> Option<Vec<u8>> {
    let manager_path = app_config_dir().ok()?.join(name);
    read_valid_json(&manager_path).or_else(|| {
        installed.and_then(|root| read_valid_json(&root.join("config").join(name)))
    })
}

fn materialize_payload(target: &Path, installed: Option<&Path>) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|error| format!("No se pudo crear {}: {error}", target.display()))?;
    atomic_write(&target.join("SKILL.md"), SKILL_MD)?;
    atomic_write(&target.join("LICENSE"), LICENSE)?;
    atomic_write(&target.join("requirements.txt"), REQUIREMENTS)?;
    write_embedded_dir(&REFERENCES, &target.join("references"))?;
    write_embedded_dir(&SCRIPTS, &target.join("scripts"))?;
    write_embedded_dir(&TEMPLATES, &target.join("templates"))?;
    write_embedded_dir(&CONFIG, &target.join("config"))?;

    for name in ["institution.json", "notebooks.json"] {
        if let Some(bytes) = user_config(name, installed) {
            atomic_write(&target.join("config").join(name), &bytes)?;
        }
    }
    Ok(())
}

pub fn install_local_skill() -> ActionResult {
    let target = match skill_dir() {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let parent = match target.parent() {
        Some(path) => path.to_path_buf(),
        None => return ActionResult::error("Ruta de instalación inválida."),
    };
    if let Err(error) = fs::create_dir_all(&parent) {
        return ActionResult::error(format!("No se pudo crear {}: {error}", parent.display()));
    }

    let stage = parent.join(format!(".instructional-designer-skill.stage-{}", timestamp()));
    if let Err(error) = materialize_payload(&stage, target.exists().then_some(target.as_path())) {
        let _ = fs::remove_dir_all(&stage);
        return ActionResult::error(error);
    }

    let backup = parent.join(format!("instructional-designer-skill.backup-{}", timestamp()));
    if target.exists() {
        if let Err(error) = fs::rename(&target, &backup) {
            let _ = fs::remove_dir_all(&stage);
            return ActionResult::error(format!(
                "No se pudo respaldar la instalación actual en {}: {error}",
                backup.display()
            ));
        }
    }

    match fs::rename(&stage, &target) {
        Ok(_) => {
            let result = ActionResult::ok(format!(
                "Skill instalado para Claude Code en:\n{}",
                path_text(&target)
            ))
            .with_path(path_text(&target));
            if backup.exists() {
                result.with_backup(path_text(&backup))
            } else {
                result
            }
        }
        Err(error) => {
            if backup.exists() {
                let _ = fs::rename(&backup, &target);
            }
            let _ = fs::remove_dir_all(&stage);
            ActionResult::error(format!("No se pudo activar la nueva instalación: {error}"))
        }
    }
}

fn add_bytes(
    zip: &mut zip::ZipWriter<fs::File>,
    path: &str,
    bytes: &[u8],
) -> Result<(), String> {
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    zip.start_file(path.replace('\\', "/"), options)
        .map_err(|error| format!("No se pudo agregar {path} al ZIP: {error}"))?;
    zip.write_all(bytes)
        .map_err(|error| format!("No se pudo escribir {path} en el ZIP: {error}"))
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    dir: &Dir<'_>,
    prefix: &str,
) -> Result<(), String> {
    for file in dir.files() {
        let relative = file.path().to_string_lossy().replace('\\', "/");
        add_bytes(zip, &format!("{prefix}/{relative}"), file.contents())?;
    }
    for child in dir.dirs() {
        add_dir_to_zip(zip, child, prefix)?;
    }
    Ok(())
}

pub fn export_skill_zip(destination_dir: String) -> ActionResult {
    let destination = match canonical_directory(&destination_dir) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let final_path = destination.join("instructional-designer-skill-10.4.0.zip");
    let temp_path = destination.join(format!(".instructional-designer-skill-{}.tmp", timestamp()));
    let file = match fs::File::create(&temp_path) {
        Ok(file) => file,
        Err(error) => return ActionResult::error(format!("No se pudo crear el ZIP: {error}")),
    };

    let result = (|| -> Result<(), String> {
        let mut zip = zip::ZipWriter::new(file);
        add_bytes(&mut zip, "SKILL.md", SKILL_MD)?;
        add_bytes(&mut zip, "LICENSE", LICENSE)?;
        add_bytes(&mut zip, "requirements.txt", REQUIREMENTS)?;
        add_dir_to_zip(&mut zip, &REFERENCES, "references")?;
        add_dir_to_zip(&mut zip, &SCRIPTS, "scripts")?;
        add_dir_to_zip(&mut zip, &TEMPLATES, "templates")?;
        add_dir_to_zip(&mut zip, &CONFIG, "config")?;

        let installed = skill_dir().ok();
        for name in ["institution.json", "notebooks.json"] {
            if let Some(bytes) = user_config(name, installed.as_deref()) {
                add_bytes(&mut zip, &format!("config/{name}"), &bytes)?;
            }
        }
        zip.finish().map_err(|error| format!("No se pudo finalizar el ZIP: {error}"))?;

        if final_path.exists() {
            fs::remove_file(&final_path)
                .map_err(|error| format!("No se pudo reemplazar {}: {error}", final_path.display()))?;
        }
        fs::rename(&temp_path, &final_path)
            .map_err(|error| format!("No se pudo guardar {}: {error}", final_path.display()))
    })();

    match result {
        Ok(_) => {
            if let Err(error) = record_export(&final_path) {
                return ActionResult::error(format!(
                    "El ZIP se creó en {}, pero no se pudo registrar el progreso: {error}",
                    path_text(&final_path)
                ));
            }
            ActionResult::ok(format!(
                "ZIP listo para subir en Claude > Customize > Skills:\n{}",
                path_text(&final_path)
            ))
            .with_path(path_text(&final_path))
        }
        Err(error) => {
            let _ = fs::remove_file(&temp_path);
            ActionResult::error(error)
        }
    }
}

pub fn record_export(path: &Path) -> Result<(), String> {
    let value = serde_json::json!({
        "schemaVersion": 1,
        "lastExportPath": path_text(path),
        "exportedAt": timestamp()
    });
    let bytes = serde_json::to_vec_pretty(&value).map_err(|error| error.to_string())?;
    atomic_write(&app_config_dir()?.join("export.json"), &bytes)
}

pub fn last_export_path() -> Option<String> {
    let path = app_config_dir().ok()?.join("export.json");
    let value = serde_json::from_slice::<serde_json::Value>(&fs::read(path).ok()?).ok()?;
    let export = value.get("lastExportPath")?.as_str()?.to_string();
    Path::new(&export).is_file().then_some(export)
}

pub fn installed_skill_path() -> String {
    skill_dir().map(|path| path_text(&path)).unwrap_or_default()
}

pub fn skill_is_installed() -> bool {
    skill_dir().map(|path| path.join("SKILL.md").is_file()).unwrap_or(false)
}

pub fn sync_user_config_to_install(name: &str, bytes: &[u8]) -> Result<(), String> {
    let target = skill_dir()?.join("config").join(name);
    if target.parent().is_some_and(Path::exists) {
        atomic_write(&target, bytes)?;
    }
    Ok(())
}

pub fn config_file_path(name: &str) -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join(name))
}
