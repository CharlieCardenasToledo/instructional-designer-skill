use crate::config;
use crate::course;
use crate::mcp;
use crate::models::{OnboardingResult, OnboardingStatus};
use crate::paths::{app_config_dir, atomic_write, timestamp};
use crate::payload;
use std::fs;
use std::path::PathBuf;

const LAST_STEP: u8 = 9;

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

fn compilation_ready() -> bool {
    course::check_dependencies()
        .into_iter()
        .any(|dependency| matches!(dependency.name.as_str(), "Docker" | "TeX Live (pdflatex)") && dependency.installed)
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

fn first_invalid_step(status: &OnboardingStatus) -> Option<(u8, &'static str)> {
    if !node_ready() {
        return Some((4, "Detectamos que falta un componente necesario para que la app funcione."));
    }
    if !compilation_ready() {
        return Some((
            4,
            "Ya no encontramos Docker ni TeX Live instalados. Necesitas uno de los dos \
             para poder generar el PDF de tu guía.",
        ));
    }
    if !config::institution_is_configured() {
        return Some((5, "Los datos de tu institución ya no están guardados o se borraron."));
    }
    if !config::template_exists(&config::get_active_template()) {
        return Some((6, "La plantilla que tenías elegida ya no está disponible."));
    }
    if !target_ready(&status.selected_target) {
        return Some((8, "El destino que elegiste dejó de estar completamente configurado."));
    }
    None
}

pub fn get_status() -> OnboardingStatus {
    let mut status = load();
    if status.completed {
        if let Some((step, reason)) = first_invalid_step(&status) {
            status.completed = false;
            status.current_step = step;
            status.max_completed_step = step.saturating_sub(1);
            status.regression_reason = Some(format!(
                "Te devolvimos al paso {step}: {reason}"
            ));
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
        1 => Ok(()),
        2 => Ok(()),
        3 => Ok(()),
        4 if !node_ready() => Err(
            "Falta instalar un componente necesario. Instálalo y pulsa “Verificar de nuevo”.".to_string(),
        ),
        4 if !compilation_ready() => Err(
            "Instala Docker o TeX Live para poder generar el PDF de tu guía.".to_string(),
        ),
        5 if !config::institution_is_configured() => {
            Err("Completa los datos de tu institución antes de continuar.".to_string())
        }
        6 if !config::template_exists(&config::get_active_template()) => {
            Err("Elige una plantilla para continuar.".to_string())
        }
        7 => {
            let auth = mcp::check_auth();
            auth.authenticated.then_some(()).ok_or(auth.message)
        }
        8 => {
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
        9 => Err("Usa el botón “Finalizar configuración”.".to_string()),
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
    if let Some((step, reason)) = first_invalid_step(&status) {
        status.current_step = step;
        let _ = save(&mut status);
        return result(false, format!("Te devolvimos al paso {step}: {reason}"), status);
    }
    let auth = mcp::check_auth();
    if !auth.authenticated {
        status.current_step = 7;
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
