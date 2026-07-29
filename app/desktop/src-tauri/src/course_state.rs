use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub fn read(project_path: String) -> Value {
    let root = PathBuf::from(project_path.trim());
    if !root.is_dir() {
        return serde_json::json!({ "success": false, "exists": false, "message": "La carpeta del proyecto no existe." });
    }
    let state_path = root.join(".jintia").join("state.json");
    if !state_path.is_file() {
        return serde_json::json!({ "success": true, "exists": false, "message": "El proyecto aún no tiene estado Jintia." });
    }
    match fs::read_to_string(&state_path).ok().and_then(|content| serde_json::from_str::<Value>(&content).ok()) {
        Some(state) => serde_json::json!({ "success": true, "exists": true, "path": state_path.to_string_lossy(), "state": state }),
        None => serde_json::json!({ "success": false, "exists": true, "message": "El archivo .jintia/state.json no contiene JSON válido." }),
    }
}

/// Verifica el archivo real `semanas/semana-XX/latex/guia-semana-XX.tex` en
/// disco (ver la estructura canónica en SKILL.md, sección 5). No se apoya en
/// `.jintia/state.json`: ese archivo solo se actualiza cuando la skill corre
/// `/jintia state`, así que puede quedar desactualizado si el docente borró
/// la guía a mano o si nunca se registró el estado.
pub fn week_guide_exists(project_path: String, week: u32) -> bool {
    let root = PathBuf::from(project_path.trim());
    root.join("semanas")
        .join(format!("semana-{week:02}"))
        .join("latex")
        .join(format!("guia-semana-{week:02}.tex"))
        .is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_existing_and_missing_week_guides() {
        let root = std::env::temp_dir().join(format!(
            "jintia-week-guide-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let week_dir = root.join("semanas").join("semana-03").join("latex");
        fs::create_dir_all(&week_dir).unwrap();
        fs::write(week_dir.join("guia-semana-03.tex"), "% guía").unwrap();

        assert!(week_guide_exists(root.to_string_lossy().to_string(), 3));
        assert!(!week_guide_exists(root.to_string_lossy().to_string(), 4));
        assert!(!week_guide_exists(
            root.join("no-existe").to_string_lossy().to_string(),
            3
        ));

        fs::remove_dir_all(&root).ok();
    }
}
