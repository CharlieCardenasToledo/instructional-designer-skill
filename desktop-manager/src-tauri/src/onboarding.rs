use crate::config;
use crate::course;
use crate::mcp;
use crate::models::{OnboardingResult, OnboardingStatus};
use crate::paths::{app_config_dir, atomic_write, timestamp};
use crate::payload;
use std::fs;
use std::path::PathBuf;

const LAST_STEP: u8 = 7;

fn status_path() -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join("onboarding.json"))
}

fn load() -> OnboardingStatus {
    status_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<OnboardingStatus>(&bytes).ok())
        .map(|mut status| {
            status.current_step = status.current_step.clamp(1, LAST_STEP);
            status.max_completed_step = status.max_completed_step.min(LAST_STEP);
            status
        })
        .unwrap_or_default()
}

fn save(status: &mut OnboardingStatus) -> Result<(), String> {
    status.last_updated = timestamp();
    let bytes = serde_json::to_vec_pretty(status).map_err(|error| error.to_string())?;
    atomic_write(&status_path()?, &bytes)
}

fn node_ready() -> bool {
    course::check_dependencies()
        .into_iter()
        .find(|dependency| dependency.name == "Node.js")
        .is_some_and(|dependency| dependency.installed)
}

fn target_ready(target: &str) -> bool {
    let setup = config::setup_status();
    match target {
        "claude-cowork" => payload::last_export_path().is_some() && setup.mcp_desktop_configured,
        "claude-code" => setup.skill_installed && setup.mcp_claude_code_configured,
        "both" => {
            payload::last_export_path().is_some()
                && setup.skill_installed
                && setup.mcp_desktop_configured
                && setup.mcp_claude_code_configured
        }
        _ => false,
    }
}

fn first_invalid_step(status: &OnboardingStatus) -> Option<u8> {
    if !node_ready() {
        return Some(1);
    }
    if !config::institution_is_configured() {
        return Some(3);
    }
    if !config::template_exists(&config::get_active_template()) {
        return Some(4);
    }
    if !target_ready(&status.selected_target) {
        return Some(6);
    }
    None
}

pub fn get_status() -> OnboardingStatus {
    let mut status = load();
    if status.completed {
        if let Some(step) = first_invalid_step(&status) {
            status.completed = false;
            status.current_step = step;
            status.max_completed_step = step.saturating_sub(1);
            let _ = save(&mut status);
        }
    }
    status
}

fn result(success: bool, message: impl Into<String>, status: OnboardingStatus) -> OnboardingResult {
    OnboardingResult { success, message: message.into(), status }
}

pub fn go_to_step(step: u8) -> OnboardingResult {
    let mut status = get_status();
    let highest_open = (status.max_completed_step + 1).min(LAST_STEP);
    if step < 1 || step > highest_open {
        return result(false, "Completa los pasos anteriores antes de continuar.", status);
    }
    status.current_step = step;
    if let Err(error) = save(&mut status) {
        return result(false, error, status);
    }
    result(true, "Paso actualizado.", status)
}

pub fn advance(step: u8, selected_target: Option<String>) -> OnboardingResult {
    let mut status = get_status();
    if step != status.current_step {
        return result(false, "El estado del onboarding cambió. Vuelve a verificar el paso.", status);
    }

    let validation = match step {
        1 if !node_ready() => Err(
            "Node.js y npx son obligatorios para NotebookLM. Instálalos y pulsa “Verificar de nuevo”.".to_string(),
        ),
        2 => Ok(()),
        3 if !config::institution_is_configured() => {
            Err("Guarda una configuración institucional completa.".to_string())
        }
        4 if !config::template_exists(&config::get_active_template()) => {
            Err("Selecciona y confirma una plantilla válida.".to_string())
        }
        5 => {
            let auth = mcp::check_auth();
            auth.authenticated.then_some(()).ok_or(auth.message)
        }
        6 => {
            let target = selected_target.unwrap_or_else(|| status.selected_target.clone());
            if !matches!(target.as_str(), "claude-cowork" | "claude-code" | "both") {
                Err("Selecciona dónde usarás la skill.".to_string())
            } else if !target_ready(&target) {
                Err("El destino seleccionado todavía no tiene skill y MCP completamente configurados.".to_string())
            } else {
                status.selected_target = target;
                Ok(())
            }
        }
        7 => Err("Usa el botón “Finalizar configuración”.".to_string()),
        _ => Ok(()),
    };

    if let Err(message) = validation {
        return result(false, message, status);
    }
    status.max_completed_step = status.max_completed_step.max(step);
    status.current_step = (step + 1).min(LAST_STEP);
    if let Err(error) = save(&mut status) {
        return result(false, error, status);
    }
    result(true, "Paso completado.", status)
}

pub fn complete() -> OnboardingResult {
    let mut status = get_status();
    if status.current_step != LAST_STEP {
        return result(false, "Completa todos los pasos antes de finalizar.", status);
    }
    if let Some(step) = first_invalid_step(&status) {
        status.current_step = step;
        let _ = save(&mut status);
        return result(false, "Una configuración requerida dejó de estar disponible.", status);
    }
    let auth = mcp::check_auth();
    if !auth.authenticated {
        status.current_step = 5;
        let _ = save(&mut status);
        return result(false, auth.message, status);
    }

    status.completed = true;
    status.max_completed_step = LAST_STEP;
    if let Err(error) = save(&mut status) {
        return result(false, error, status);
    }
    result(true, "Onboarding completado.", status)
}

pub fn reset() -> OnboardingResult {
    let mut status = OnboardingStatus::default();
    if let Err(error) = save(&mut status) {
        return result(false, error, status);
    }
    result(true, "Onboarding reiniciado.", status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_names_are_explicit() {
        assert!(!target_ready("unknown"));
    }
}
