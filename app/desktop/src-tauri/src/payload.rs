use crate::models::ActionResult;
use crate::paths::{
    app_config_dir, atomic_write, atomic_write_if_changed, canonical_directory,
    installed_skill_dir, legacy_skill_dir, path_text, skill_dir, timestamp,
};
use include_dir::{include_dir, Dir};
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zip::write::SimpleFileOptions;

const SKILL_MD: &[u8] = include_bytes!("../../../../skill/SKILL.md");
const LICENSE: &[u8] = include_bytes!("../../../../LICENSE");
const REQUIREMENTS: &[u8] = include_bytes!("../../../../skill/requirements.txt");
static REFERENCES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../../skill/references");
static SCRIPTS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../../skill/scripts");
static TEMPLATES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../../skill/templates");
static CONFIG: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../../skill/config");
static PAYLOAD_OPERATION: Mutex<()> = Mutex::new(());

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
    read_valid_json(&manager_path)
        .or_else(|| installed.and_then(|root| read_valid_json(&root.join("config").join(name))))
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

fn embedded_dir_matches(
    dir: &Dir<'_>,
    target: &Path,
    installed: &Path,
    preserve_user_config: bool,
) -> bool {
    let files_match = dir.files().all(|file| {
        let name = file.path().file_name().and_then(|value| value.to_str());
        let expected = if preserve_user_config
            && matches!(name, Some("institution.json" | "notebooks.json"))
        {
            name.and_then(|name| user_config(name, Some(installed)))
                .unwrap_or_else(|| file.contents().to_vec())
        } else {
            file.contents().to_vec()
        };
        fs::read(target.join(file.path()))
            .ok()
            .is_some_and(|actual| actual == expected)
    });
    files_match
        && dir
            .dirs()
            .all(|child| embedded_dir_matches(child, target, installed, preserve_user_config))
}

fn installed_payload_matches(target: &Path) -> bool {
    fs::read(target.join("SKILL.md")).ok().as_deref() == Some(SKILL_MD)
        && fs::read(target.join("LICENSE")).ok().as_deref() == Some(LICENSE)
        && fs::read(target.join("requirements.txt")).ok().as_deref() == Some(REQUIREMENTS)
        && embedded_dir_matches(&REFERENCES, &target.join("references"), target, false)
        && embedded_dir_matches(&SCRIPTS, &target.join("scripts"), target, false)
        && embedded_dir_matches(&TEMPLATES, &target.join("templates"), target, false)
        && embedded_dir_matches(&CONFIG, &target.join("config"), target, true)
}

pub fn install_local_skill() -> ActionResult {
    let _operation = match PAYLOAD_OPERATION.lock() {
        Ok(operation) => operation,
        Err(_) => return ActionResult::error("El estado interno de instalación está bloqueado."),
    };
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
    if target.exists() && installed_payload_matches(&target) {
        return ActionResult::ok(format!(
            "La skill ya estaba instalada y actualizada; no se creó otra copia ni respaldo.\n{}",
            path_text(&target)
        ))
        .with_path(path_text(&target));
    }

    let legacy = legacy_skill_dir().ok().filter(|path| path.exists());
    let migrating_legacy = !target.exists() && legacy.is_some();
    let installed = if target.exists() {
        Some(target.as_path())
    } else {
        legacy.as_deref()
    };
    let stage = parent.join(format!(".jintia-skill.stage-{}", timestamp()));
    if let Err(error) = materialize_payload(&stage, installed) {
        let _ = fs::remove_dir_all(&stage);
        return ActionResult::error(error);
    }
    let backup = parent.join(format!("jintia-skill.backup-{}", timestamp()));
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
            let legacy_backup = if migrating_legacy {
                legacy.as_ref().and_then(|previous| {
                    let archived = parent.join(format!(
                        "instructional-designer-skill.backup-{}",
                        timestamp()
                    ));
                    fs::rename(previous, &archived).ok().map(|_| archived)
                })
            } else {
                None
            };
            let result = ActionResult::ok(if let Some(archived) = legacy_backup.as_ref() {
                format!(
                    "Jintia Skill se instaló en:\n{}\n\nLa instalación anterior quedó archivada en:\n{}",
                    path_text(&target),
                    path_text(archived)
                )
            } else if migrating_legacy {
                format!(
                    "Jintia Skill se instaló en:\n{}\n\nNo se pudo archivar la carpeta anterior; puedes retirarla manualmente después de verificar Jintia.",
                    path_text(&target)
                )
            } else {
                format!("Jintia Skill se instaló para Claude Code en:\n{}", path_text(&target))
            })
            .with_path(path_text(&target));
            if backup.exists() {
                result.with_backup(path_text(&backup))
            } else if let Some(archived) = legacy_backup {
                result.with_backup(path_text(&archived))
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

fn add_bytes(zip: &mut zip::ZipWriter<fs::File>, path: &str, bytes: &[u8]) -> Result<(), String> {
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

fn hash_embedded_dir(
    dir: &Dir<'_>,
    hasher: &mut DefaultHasher,
    installed: Option<&Path>,
    preserve_user_config: bool,
) {
    for file in dir.files() {
        file.path().to_string_lossy().hash(hasher);
        let name = file.path().file_name().and_then(|value| value.to_str());
        let bytes = if preserve_user_config
            && matches!(name, Some("institution.json" | "notebooks.json"))
        {
            name.and_then(|name| user_config(name, installed))
                .unwrap_or_else(|| file.contents().to_vec())
        } else {
            file.contents().to_vec()
        };
        bytes.hash(hasher);
    }
    for child in dir.dirs() {
        hash_embedded_dir(child, hasher, installed, preserve_user_config);
    }
}

fn payload_fingerprint(installed: Option<&Path>) -> String {
    let mut hasher = DefaultHasher::new();
    SKILL_MD.hash(&mut hasher);
    LICENSE.hash(&mut hasher);
    REQUIREMENTS.hash(&mut hasher);
    hash_embedded_dir(&REFERENCES, &mut hasher, installed, false);
    hash_embedded_dir(&SCRIPTS, &mut hasher, installed, false);
    hash_embedded_dir(&TEMPLATES, &mut hasher, installed, false);
    hash_embedded_dir(&CONFIG, &mut hasher, installed, true);
    format!("{:016x}", hasher.finish())
}

fn export_record_matches(path: &Path, fingerprint: &str) -> bool {
    let record_path = match app_config_dir() {
        Ok(directory) => directory.join("export.json"),
        Err(_) => return false,
    };
    fs::read(record_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .is_some_and(|value| {
            value
                .get("lastExportPath")
                .and_then(serde_json::Value::as_str)
                == Some(path_text(path).as_str())
                && value.get("fingerprint").and_then(serde_json::Value::as_str) == Some(fingerprint)
                && path.is_file()
        })
}

fn files_equal(left: &Path, right: &Path) -> bool {
    let same_len = fs::metadata(left)
        .ok()
        .zip(fs::metadata(right).ok())
        .is_some_and(|(left_meta, right_meta)| left_meta.len() == right_meta.len());
    same_len
        && fs::read(left)
            .ok()
            .zip(fs::read(right).ok())
            .is_some_and(|(left_bytes, right_bytes)| left_bytes == right_bytes)
}

pub fn export_skill_zip(destination_dir: String) -> ActionResult {
    let _operation = match PAYLOAD_OPERATION.lock() {
        Ok(operation) => operation,
        Err(_) => return ActionResult::error("El estado interno de exportación está bloqueado."),
    };
    let destination = match canonical_directory(&destination_dir) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    let final_path = destination.join("jintia-skill-10.4.0.zip");
    let installed = installed_skill_dir().ok();
    let fingerprint = payload_fingerprint(installed.as_deref());
    if export_record_matches(&final_path, &fingerprint) {
        return ActionResult::ok(format!(
            "El ZIP existente ya corresponde a la versión actual de la skill; no se creó ningún archivo nuevo.\n{}",
            path_text(&final_path)
        ))
        .with_path(path_text(&final_path));
    }
    let temp_path = destination.join(format!(".jintia-skill-{}.tmp", timestamp()));
    let file = match fs::File::create(&temp_path) {
        Ok(file) => file,
        Err(error) => return ActionResult::error(format!("No se pudo crear el ZIP: {error}")),
    };

    let result = (|| -> Result<bool, String> {
        let mut zip = zip::ZipWriter::new(file);
        add_bytes(&mut zip, "SKILL.md", SKILL_MD)?;
        add_bytes(&mut zip, "LICENSE", LICENSE)?;
        add_bytes(&mut zip, "requirements.txt", REQUIREMENTS)?;
        add_dir_to_zip(&mut zip, &REFERENCES, "references")?;
        add_dir_to_zip(&mut zip, &SCRIPTS, "scripts")?;
        add_dir_to_zip(&mut zip, &TEMPLATES, "templates")?;
        add_dir_to_zip(&mut zip, &CONFIG, "config")?;

        for name in ["institution.json", "notebooks.json"] {
            if let Some(bytes) = user_config(name, installed.as_deref()) {
                add_bytes(&mut zip, &format!("config/{name}"), &bytes)?;
            }
        }
        zip.finish()
            .map_err(|error| format!("No se pudo finalizar el ZIP: {error}"))?;

        if final_path.exists() && files_equal(&temp_path, &final_path) {
            fs::remove_file(&temp_path)
                .map_err(|error| format!("No se pudo retirar el ZIP temporal: {error}"))?;
            return Ok(false);
        }
        if final_path.exists() {
            fs::remove_file(&final_path).map_err(|error| {
                format!("No se pudo reemplazar {}: {error}", final_path.display())
            })?;
        }
        fs::rename(&temp_path, &final_path)
            .map_err(|error| format!("No se pudo guardar {}: {error}", final_path.display()))?;
        Ok(true)
    })();

    match result {
        Ok(changed) => {
            if !changed {
                if last_export_path().as_deref() != Some(path_text(&final_path).as_str()) {
                    if let Err(error) = record_export(&final_path, &fingerprint) {
                        return ActionResult::error(format!(
                            "El ZIP ya era válido, pero no se pudo registrar su ubicación: {error}"
                        ));
                    }
                }
                return ActionResult::ok(format!(
                    "El ZIP existente ya contiene la versión actual de la skill; no se volvió a crear.\n{}",
                    path_text(&final_path)
                ))
                .with_path(path_text(&final_path));
            }
            if let Err(error) = record_export(&final_path, &fingerprint) {
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

pub fn record_export(path: &Path, fingerprint: &str) -> Result<(), String> {
    let value = serde_json::json!({
        "schemaVersion": 1,
        "lastExportPath": path_text(path),
        "fingerprint": fingerprint,
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
    installed_skill_dir()
        .map(|path| path_text(&path))
        .unwrap_or_default()
}

pub fn skill_is_installed() -> bool {
    installed_skill_dir()
        .map(|path| path.join("SKILL.md").is_file())
        .unwrap_or(false)
}

pub fn sync_user_config_to_install(name: &str, bytes: &[u8]) -> Result<(), String> {
    let target = installed_skill_dir()?.join("config").join(name);
    if target.parent().is_some_and(Path::exists) {
        atomic_write_if_changed(&target, bytes)?;
    }
    Ok(())
}

pub fn config_file_path(name: &str) -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join(name))
}
