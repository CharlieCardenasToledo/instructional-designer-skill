use crate::config;
use crate::course;
use crate::mcp;
use crate::models::{OnboardingResult, OnboardingStatus};
use crate::paths::{app_config_dir, atomic_write, timestamp};
use crate::payload;
use std::fs;
use std::path::PathBuf;

const ONBOARDING_VERSION: u32 = 2;
const LAST_STEP: u8 = 10;

fn status_path() -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join("onboarding.json"))
}

fn load() -> OnboardingStatus {
    status_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<OnboardingStatus>(&bytes).ok())
        .map(|status| {
            let mut status = migrate_status(status);
            status.current_step = status.current_step.clamp(1, LAST_STEP);
            status.max_completed_step = status.max_completed_step.min(LAST_STEP);
            status
        })
        .unwrap_or_default()
}

fn migrate_status(mut status: OnboardingStatus) -> OnboardingStatus {
    if status.version < ONBOARDING_VERSION {
        // La versión 2 separa la antigua identidad institucional (paso 5)
        // en institución (5) y perfil académico (6). Los pasos posteriores
        // se desplazan una posición sin perder el progreso ya completado.
        if status.current_step >= 6 {
            status.current_step = status.current_step.saturating_add(1);
        }
        if status.max_completed_step >= 5 {
            status.max_completed_step = status.max_completed_step.saturating_add(1);
        }
        status.version = ONBOARDING_VERSION;
    }
    status
}

fn save(status: &mut OnboardingStatus) -> Result<(), String> {
    status.last_updated = timestamp();
    let bytes = serde_json::to_vec_pretty(status).map_err(|error| error.to_string())?;
    atomic_write(&status_path()?, &bytes)
}

fn validate_environment(dependencies: &[crate::models::DependencyStatus]) -> Result<(), String> {
    let node_ready = dependencies
        .iter()
        .find(|dependency| dependency.name == "Node.js")
        .is_some_and(|dependency| dependency.installed);
    if !node_ready {
        return Err(
            "Falta instalar un componente necesario. Instálalo y pulsa “Verificar de nuevo”."
                .to_string(),
        );
    }

    let compilation_ready = dependencies.iter().any(|dependency| {
        matches!(dependency.name.as_str(), "Docker" | "TeX Live (pdflatex)")
            && dependency.installed
    });
    if !compilation_ready {
        return Err("Instala TeX Live (o Docker) para poder generar el PDF de tu guía.".to_string());
    }
    Ok(())
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

fn first_invalid_step(
    status: &OnboardingStatus,
    refresh_environment: bool,
) -> Option<(u8, &'static str)> {
    let dependencies = if refresh_environment {
        course::check_dependencies()
    } else {
        course::check_dependencies_cached()
    };
    if let Err(message) = validate_environment(&dependencies) {
        let reason = if message.starts_with("Falta instalar") {
            "Detectamos que falta un componente necesario para que la app funcione."
        } else {
            "Ya no encontramos Docker ni TeX Live instalados. Necesitas uno de los dos para poder generar el PDF de tu guía."
        };
        return Some((4, reason));
    }
    if !config::institution_is_configured() {
        return Some((6, "Los datos de tu institución o perfil académico ya no están guardados."));
    }
    if !config::template_exists(&config::get_active_template()) {
        return Some((7, "La plantilla que tenías elegida ya no está disponible."));
    }
    if !target_ready(&status.selected_target) {
        return Some((9, "El destino que elegiste dejó de estar completamente configurado."));
    }
    None
}

pub fn get_status() -> OnboardingStatus {
    let mut status = load();
    if status.completed {
        if let Some((step, reason)) = first_invalid_step(&status, true) {
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
        4 => validate_environment(&course::check_dependencies_cached()),
        5 => Ok(()),
        6 if !config::institution_is_configured() => {
            Err("Completa los datos de tu institución antes de continuar.".to_string())
        }
        7 if !config::template_exists(&config::get_active_template()) => {
            Err("Elige una plantilla para continuar.".to_string())
        }
        8 => {
            let auth = mcp::check_auth();
            auth.authenticated.then_some(()).ok_or(auth.message)
        }
        9 => {
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
        10 => Err("Usa el botón “Finalizar configuración”.".to_string()),
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
    if let Some((step, reason)) = first_invalid_step(&status, false) {
        status.current_step = step;
        let _ = save(&mut status);
        return result(false, format!("Te devolvimos al paso {step}: {reason}"), status);
    }
    let auth = mcp::check_auth();
    if !auth.authenticated {
        status.current_step = 8;
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

    #[test]
    fn environment_validation_reports_node_before_pdf_compiler() {
        let dependencies = vec![
            crate::models::DependencyStatus {
                name: "Node.js".to_string(),
                installed: false,
                version: None,
                required: true,
                note: String::new(),
                command: String::new(),
            },
            crate::models::DependencyStatus {
                name: "Docker".to_string(),
                installed: false,
                version: None,
                required: false,
                note: String::new(),
                command: String::new(),
            },
        ];
        assert!(validate_environment(&dependencies)
            .unwrap_err()
            .starts_with("Falta instalar"));
    }

    #[test]
    fn migrates_progress_after_splitting_institution_step() {
        let legacy = OnboardingStatus {
            version: 1,
            current_step: 8,
            max_completed_step: 7,
            ..OnboardingStatus::default()
        };
        let migrated = migrate_status(legacy);
        assert_eq!(migrated.version, 2);
        assert_eq!(migrated.current_step, 9);
        assert_eq!(migrated.max_completed_step, 8);
    }
}
