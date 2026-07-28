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
