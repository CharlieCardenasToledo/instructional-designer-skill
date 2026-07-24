use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn home_dir() -> Result<PathBuf, String> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or_else(|| "No se pudo resolver la carpeta personal del usuario.".to_string())
}

pub fn app_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("APPDATA").map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let base = home_dir().ok().map(|p| p.join("Library").join("Application Support"));
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().ok().map(|p| p.join(".config")));

    base.map(|path| path.join("InstructionalDesignerManager"))
        .ok_or_else(|| "No se pudo resolver la carpeta de configuración de la aplicación.".to_string())
}

pub fn skill_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?
        .join(".claude")
        .join("skills")
        .join("instructional-designer-skill"))
}

pub fn claude_desktop_config_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| "No se pudo resolver APPDATA.".to_string())?;
        Ok(base.join("Claude").join("claude_desktop_config.json"))
    }
    #[cfg(target_os = "macos")]
    {
        Ok(home_dir()?
            .join("Library")
            .join("Application Support")
            .join("Claude")
            .join("claude_desktop_config.json"))
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Ok(home_dir()?.join(".config").join("Claude").join("claude_desktop_config.json"))
    }
}

pub fn claude_code_config_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".claude.json"))
}

pub fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "La ruta no tiene carpeta padre.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear {}: {error}", parent.display()))?;

    let file_name = path.file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Nombre de archivo inválido.".to_string())?;
    let temp = parent.join(format!(".{file_name}.tmp-{}", timestamp()));

    let result = (|| -> Result<(), String> {
        let mut file = fs::File::create(&temp)
            .map_err(|error| format!("No se pudo crear {}: {error}", temp.display()))?;
        file.write_all(bytes)
            .map_err(|error| format!("No se pudo escribir {}: {error}", temp.display()))?;
        file.sync_all()
            .map_err(|error| format!("No se pudo sincronizar {}: {error}", temp.display()))?;

        let swap = parent.join(format!(".{file_name}.swap-{}", timestamp()));
        if path.exists() {
            fs::rename(path, &swap)
                .map_err(|error| format!("No se pudo preparar el reemplazo de {}: {error}", path.display()))?;
        }
        match fs::rename(&temp, path) {
            Ok(_) => {
                if swap.exists() {
                    let _ = fs::remove_file(&swap);
                }
                Ok(())
            }
            Err(error) => {
                if swap.exists() {
                    let _ = fs::rename(&swap, path);
                }
                Err(format!("No se pudo activar {}: {error}", path.display()))
            }
        }
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

pub fn backup_file(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let name = path.file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Nombre de archivo inválido.".to_string())?;
    let backup = path.with_file_name(format!("{name}.bak-{}", timestamp()));
    fs::copy(path, &backup)
        .map_err(|error| format!("No se pudo crear el respaldo {}: {error}", backup.display()))?;
    Ok(Some(backup))
}

pub fn canonical_directory(raw: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw.trim());
    if !path.is_absolute() {
        return Err("Selecciona una ruta absoluta.".to_string());
    }
    let canonical = path.canonicalize()
        .map_err(|error| format!("No se pudo acceder a {}: {error}", path.display()))?;
    if !canonical.is_dir() {
        return Err(format!("{} no es una carpeta.", canonical.display()));
    }
    Ok(canonical)
}

pub fn safe_segment(value: &str, field: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} es obligatorio."));
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains("..") {
        return Err(format!("{field} contiene una secuencia de ruta no permitida."));
    }
    if trimmed.chars().any(|ch| ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err(format!("{field} contiene caracteres no permitidos."));
    }
    Ok(trimmed.to_string())
}

pub fn path_text(path: &Path) -> String {
    let text = path.to_string_lossy();
    // En Windows, canonicalize() antepone el prefijo de ruta extendida
    // \\?\, que no es válido dentro de una URL file:// ni útil para mostrar.
    let stripped = text.strip_prefix(r"\\?\").unwrap_or(&text);
    stripped.replace('\\', "/")
}
