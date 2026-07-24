mod config;
mod course;
mod mcp;
mod models;
mod onboarding;
mod palette;
mod paths;
mod payload;

use models::{
    ActionResult, DependencyStatus, InstitutionConfig, NotebookEntry, NotebookLmAuthStatus,
    SetupStatus, TemplateMeta, WeekData,
};

#[tauri::command]
async fn check_dependencies() -> Vec<DependencyStatus> {
    tauri::async_runtime::spawn_blocking(course::check_dependencies)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn install_dependency(name: String, confirmed: Option<bool>) -> ActionResult {
    tauri::async_runtime::spawn_blocking(move || course::install_dependency(name, confirmed.unwrap_or(false)))
        .await
        .unwrap_or_else(|error| ActionResult::error(format!("No se pudo ejecutar la instalación: {error}")))
}

#[tauri::command]
async fn get_onboarding_status() -> models::OnboardingStatus {
    onboarding::get_status()
}

#[tauri::command]
async fn advance_onboarding(step: u8, selected_target: Option<String>) -> models::OnboardingResult {
    tauri::async_runtime::spawn_blocking(move || onboarding::advance(step, selected_target))
        .await
        .unwrap_or_else(|error| models::OnboardingResult {
            success: false,
            message: format!("No se pudo avanzar el onboarding: {error}"),
            status: onboarding::get_status(),
        })
}

#[tauri::command]
async fn go_to_onboarding_step(step: u8) -> models::OnboardingResult {
    onboarding::go_to_step(step)
}

#[tauri::command]
async fn complete_onboarding() -> models::OnboardingResult {
    tauri::async_runtime::spawn_blocking(onboarding::complete)
        .await
        .unwrap_or_else(|error| models::OnboardingResult {
            success: false,
            message: format!("No se pudo finalizar el onboarding: {error}"),
            status: onboarding::get_status(),
        })
}

#[tauri::command]
async fn reset_onboarding() -> models::OnboardingResult {
    onboarding::reset()
}

#[tauri::command]
async fn get_skill_path() -> String {
    payload::installed_skill_path()
}

#[tauri::command]
async fn install_skill() -> ActionResult {
    payload::install_local_skill()
}

#[tauri::command]
async fn export_skill_zip(destination_dir: String) -> ActionResult {
    payload::export_skill_zip(destination_dir)
}

#[tauri::command]
async fn configure_mcp(target: String) -> ActionResult {
    mcp::configure_mcp(target)
}

#[tauri::command]
async fn apply_institution_config(config: InstitutionConfig) -> ActionResult {
    config::apply_institution(config)
}

#[tauri::command]
async fn extract_site_palette(url: String) -> Result<models::SitePalette, String> {
    palette::extract_site_palette(url).await
}

#[tauri::command]
async fn save_notebooks_config(entries: Vec<NotebookEntry>) -> ActionResult {
    config::save_notebooks(entries)
}

#[tauri::command]
async fn get_setup_status() -> SetupStatus {
    config::setup_status()
}

#[tauri::command]
async fn check_notebooklm_auth() -> NotebookLmAuthStatus {
    tauri::async_runtime::spawn_blocking(mcp::check_auth)
        .await
        .unwrap_or_else(|error| NotebookLmAuthStatus {
            authenticated: false,
            message: format!("No se pudo verificar NotebookLM: {error}"),
        })
}

#[tauri::command]
async fn run_notebooklm_auth() -> ActionResult {
    tauri::async_runtime::spawn_blocking(mcp::start_auth)
        .await
        .unwrap_or_else(|error| ActionResult::error(format!("No se pudo iniciar la autenticación: {error}")))
}

#[tauri::command]
async fn create_course_structure(
    root_path: String,
    course_code: String,
    course_name: String,
    weeks: u32,
) -> ActionResult {
    course::create_course_structure(root_path, course_code, course_name, weeks)
}

#[tauri::command]
async fn generate_syllabus(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    academic_period: String,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult {
    course::generate_syllabus(
        course_path,
        course_code,
        course_name,
        credits,
        academic_period,
        semester,
        description,
        weeks_data,
    )
}

#[tauri::command]
async fn compile_syllabus_pdf(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    academic_period: String,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult {
    tauri::async_runtime::spawn_blocking(move || {
        course::compile_syllabus_pdf(
            course_path,
            course_code,
            course_name,
            credits,
            academic_period,
            semester,
            description,
            weeks_data,
        )
    })
    .await
    .unwrap_or_else(|e| ActionResult::error(format!("Error interno: {e}")))
}

#[tauri::command]
async fn list_templates() -> Vec<TemplateMeta> {
    config::list_templates()
}

#[tauri::command]
async fn get_active_template() -> String {
    config::get_active_template()
}

#[tauri::command]
async fn set_active_template(template_id: String) -> ActionResult {
    config::set_active_template(template_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            install_dependency,
            get_onboarding_status,
            advance_onboarding,
            go_to_onboarding_step,
            complete_onboarding,
            reset_onboarding,
            get_skill_path,
            install_skill,
            export_skill_zip,
            configure_mcp,
            apply_institution_config,
            extract_site_palette,
            save_notebooks_config,
            get_setup_status,
            check_notebooklm_auth,
            run_notebooklm_auth,
            create_course_structure,
            generate_syllabus,
            compile_syllabus_pdf,
            list_templates,
            get_active_template,
            set_active_template,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
