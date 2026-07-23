use crate::models::{ActionResult, InstitutionConfig, NotebookEntry, SetupStatus, TemplateMeta};
use crate::paths::{app_config_dir, atomic_write, claude_code_config_path, claude_desktop_config_path, path_text};
use crate::payload::{config_file_path, installed_skill_path, skill_is_installed, sync_user_config_to_install};
use include_dir::{include_dir, Dir};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;

static TEMPLATES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../templates");
const DEFAULT_TEMPLATE: &str = "elegantbook-clasico";
const EMBEDDED_TEMPLATE_IDS: &[&str] = &[
    "elegantbook-clasico",
];

fn clean(value: &str) -> String {
    value.trim().chars().filter(|character| !character.is_control()).collect()
}

fn validate_institution(config: &InstitutionConfig) -> Result<(), String> {
    for (label, value) in [
        ("Autor", &config.author),
        ("Carrera", &config.career),
        ("Facultad", &config.faculty),
        ("Institución", &config.institution),
    ] {
        if clean(value).is_empty() {
            return Err(format!("{label} es obligatorio."));
        }
        if value.len() > 180 {
            return Err(format!("{label} supera el máximo de 180 caracteres."));
        }
    }
    Ok(())
}

fn active_template_from_settings() -> String {
    let path = app_config_dir().ok().map(|dir| dir.join("settings.json"));
    path.and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| value.get("activeTemplate")?.as_str().map(str::to_string))
        .filter(|id| template_exists(id))
        .unwrap_or_else(|| DEFAULT_TEMPLATE.to_string())
}

pub fn template_exists(id: &str) -> bool {
    !id.is_empty()
        && id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
        && TEMPLATES.get_file(format!("{id}/meta.json")).is_some()
        && TEMPLATES.get_file(format!("{id}/template.md")).is_some()
        && TEMPLATES.get_file(format!("{id}/preamble.tex")).is_some()
}

pub fn apply_institution(config: InstitutionConfig) -> ActionResult {
    if let Err(error) = validate_institution(&config) {
        return ActionResult::error(error);
    }

    let mut ecosystem = Vec::new();
    let mut seen = HashSet::new();
    for line in config.ecosystem.lines() {
        let item = clean(line.trim_start_matches(['-', '•', ' ']));
        if !item.is_empty() && seen.insert(item.to_lowercase()) {
            ecosystem.push(item);
        }
    }

    let active_template = active_template_from_settings();
    let value = json!({
        "schemaVersion": 1,
        "institution": {
            "name": clean(&config.institution),
            "faculty": clean(&config.faculty),
            "career": clean(&config.career),
            "author": clean(&config.author),
            "degree": clean(&config.degree)
        },
        "branding": {
            "primaryColor": format!("#{:02X}{:02X}{:02X}", config.color_r, config.color_g, config.color_b),
            "logoPath": "figure/logo-institution.png"
        },
        "digitalEcosystem": ecosystem,
        "integrations": {
            "partnerName": "",
            "partnerModule": "",
            "partnerLogoPath": ""
        },
        "activeTemplate": active_template,
        "options": {
            "evidenceMode": "notebooklm-preferred",
            "includeGradedActivities": false
        }
    });

    let bytes = match serde_json::to_vec_pretty(&value) {
        Ok(bytes) => bytes,
        Err(error) => return ActionResult::error(format!("No se pudo serializar la configuración: {error}")),
    };
    let path = match config_file_path("institution.json") {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = atomic_write(&path, &bytes) {
        return ActionResult::error(error);
    }
    if let Err(error) = sync_user_config_to_install("institution.json", &bytes) {
        return ActionResult::error(format!(
            "La configuración principal se guardó, pero no pudo sincronizarse con Claude Code: {error}"
        ));
    }

    ActionResult::ok(format!("Configuración institucional guardada en:\n{}", path_text(&path)))
        .with_path(path_text(&path))
}

pub fn save_notebooks(entries: Vec<NotebookEntry>) -> ActionResult {
    let mut seen = HashSet::new();
    let mut courses = Vec::new();
    for entry in entries {
        let code = clean(&entry.course_code);
        let name = clean(&entry.course_name);
        let root = clean(&entry.root_path);
        let id = clean(&entry.notebook_id);
        let url = clean(&entry.notebook_url);
        if code.is_empty() || name.is_empty() || root.is_empty() {
            return ActionResult::error("Cada notebook requiere código, nombre y carpeta del curso.");
        }
        if !url.is_empty() && !url.starts_with("https://notebooklm.google.com/notebook/") {
            return ActionResult::error(format!("La URL de {code} no pertenece a NotebookLM."));
        }
        if !seen.insert(code.to_lowercase()) {
            return ActionResult::error(format!("El curso {code} está duplicado."));
        }
        courses.push(json!({
            "courseCode": code,
            "courseName": name,
            "rootPath": root,
            "notebookId": id,
            "notebookUrl": url
        }));
    }

    let value = json!({ "schemaVersion": 1, "courses": courses });
    let bytes = match serde_json::to_vec_pretty(&value) {
        Ok(bytes) => bytes,
        Err(error) => return ActionResult::error(format!("No se pudo serializar el registro: {error}")),
    };
    let path = match config_file_path("notebooks.json") {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = atomic_write(&path, &bytes) {
        return ActionResult::error(error);
    }
    if let Err(error) = sync_user_config_to_install("notebooks.json", &bytes) {
        return ActionResult::error(format!(
            "El registro principal se guardó, pero no pudo sincronizarse con Claude Code: {error}"
        ));
    }

    ActionResult::ok(format!("Registro de notebooks guardado en:\n{}", path_text(&path)))
        .with_path(path_text(&path))
}

pub fn list_templates() -> Vec<TemplateMeta> {
    let mut templates = EMBEDDED_TEMPLATE_IDS
        .iter()
        .filter_map(|id| TEMPLATES.get_file(format!("{id}/meta.json")))
        .filter_map(|file| serde_json::from_slice::<TemplateMeta>(file.contents()).ok())
        .filter(|meta| template_exists(&meta.id))
        .collect::<Vec<_>>();
    templates.sort_by(|a, b| b.featured.cmp(&a.featured).then_with(|| a.name.cmp(&b.name)));
    templates
}

pub fn get_active_template() -> String {
    active_template_from_settings()
}

pub fn institution_is_configured() -> bool {
    config_file_path("institution.json")
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| {
            let institution = value.get("institution")?;
            Some(
                ["name", "faculty", "career", "author"]
                    .iter()
                    .all(|key| institution.get(key).and_then(Value::as_str).is_some_and(|text| !text.trim().is_empty())),
            )
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::list_templates;

    #[test]
    fn embedded_templates_are_available() {
        assert!(!list_templates().is_empty(), "expected embedded templates");
    }
}

pub fn set_active_template(template_id: String) -> ActionResult {
    if !template_exists(&template_id) {
        return ActionResult::error(format!("Plantilla desconocida o incompleta: {template_id}"));
    }
    let settings = json!({ "schemaVersion": 1, "activeTemplate": template_id });
    let settings_path = match app_config_dir() {
        Ok(dir) => dir.join("settings.json"),
        Err(error) => return ActionResult::error(error),
    };
    let settings_bytes = match serde_json::to_vec_pretty(&settings) {
        Ok(bytes) => bytes,
        Err(error) => return ActionResult::error(error.to_string()),
    };
    if let Err(error) = atomic_write(&settings_path, &settings_bytes) {
        return ActionResult::error(error);
    }

    if let Ok(institution_path) = config_file_path("institution.json") {
        if let Ok(text) = fs::read_to_string(&institution_path) {
            if let Ok(mut value) = serde_json::from_str::<Value>(&text) {
                value["activeTemplate"] = Value::String(template_id.clone());
                if let Ok(bytes) = serde_json::to_vec_pretty(&value) {
                    if let Err(error) = atomic_write(&institution_path, &bytes) {
                        return ActionResult::error(error);
                    }
                    if let Err(error) = sync_user_config_to_install("institution.json", &bytes) {
                        return ActionResult::error(error);
                    }
                }
            }
        }
    }

    ActionResult::ok(format!("Plantilla '{template_id}' activada y guardada en la configuración."))
}

fn server_configured(path: Result<std::path::PathBuf, String>) -> bool {
    path.ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| value.get("mcpServers")?.get("notebooklm").cloned())
        .and_then(|server| server.get("args")?.as_array().cloned())
        .is_some_and(|args| args.iter().any(|arg| arg.as_str() == Some("notebooklm-mcp@latest")))
}

pub fn setup_status() -> SetupStatus {
    let desktop_config = claude_desktop_config_path();
    let desktop_path_text = desktop_config.as_ref().map(|path| path_text(path)).unwrap_or_default();
    let desktop = server_configured(desktop_config);
    let code = server_configured(claude_code_config_path());
    let institution = institution_is_configured();

    SetupStatus {
        skill_installed: skill_is_installed(),
        mcp_configured: desktop || code,
        mcp_desktop_configured: desktop,
        mcp_claude_code_configured: code,
        institution_configured: institution,
        skill_path: installed_skill_path(),
        mcp_config_path: desktop_path_text,
    }
}
