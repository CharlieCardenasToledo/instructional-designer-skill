/**
 * api.js — Capa de abstracción sobre Tauri (Dependency Inversion Principle)
 * Las páginas dependen de este módulo, nunca de `invoke` directamente.
 * Esto permite sustituir la implementación (mock, test, etc.) sin tocar las páginas.
 */
import { invoke } from "@tauri-apps/api/core";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";

// ── Dependencias del sistema ─────────────────────────────────────────────
export async function checkDependencies() {
  return invoke("check_dependencies");
}

export async function getOnboardingStatus() {
  return invoke("get_onboarding_status");
}

export async function advanceOnboarding(step, selectedTarget) {
  return invoke("advance_onboarding", { step, selectedTarget });
}

export async function goToOnboardingStep(step) {
  return invoke("go_to_onboarding_step", { step });
}

export async function completeOnboarding() {
  return invoke("complete_onboarding");
}

export async function installDependency(name, confirmed = false) {
  return invoke("install_dependency", { name, confirmed });
}

export async function resetOnboarding() {
  return invoke("reset_onboarding");
}

// ── Skill y MCP ──────────────────────────────────────────────────────────
export async function getSkillPath() {
  return invoke("get_skill_path");
}

export async function installSkill() {
  return invoke("install_skill");
}

export async function exportSkillZip(destinationDir) {
  return invoke("export_skill_zip", { destinationDir });
}

export async function configureMcp(target) {
  return invoke("configure_mcp", { target });
}

export async function getSetupStatus() {
  return invoke("get_setup_status");
}

export async function applyInstitutionConfig(config) {
  return invoke("apply_institution_config", { config });
}

export async function extractSitePalette(url) {
  return invoke("extract_site_palette", { url });
}

// ── NotebookLM MCP ───────────────────────────────────────────────────────
export async function checkNotebookLMAuth() {
  return invoke("check_notebooklm_auth");
}

export async function runNotebookLMAuth() {
  return invoke("run_notebooklm_auth");
}

export async function saveNotebooksConfig(entries) {
  return invoke("save_notebooks_config", { entries });
}

// ── Estructura de carpetas y sílabo ──────────────────────────────────────
export async function createCourseStructure({ rootPath, courseCode, courseName, weeks }) {
  return invoke("create_course_structure", { rootPath, courseCode, courseName, weeks });
}

export async function generateSyllabus(payload) {
  return invoke("generate_syllabus", payload);
}

export async function compileSyllabusPdf(payload) {
  return invoke("compile_syllabus_pdf", payload);
}

// ── Sistema de plantillas LaTeX ───────────────────────────────────────────
export async function listTemplates() {
  return invoke("list_templates");
}

export async function getActiveTemplate() {
  return invoke("get_active_template");
}

export async function setActiveTemplate(templateId) {
  return invoke("set_active_template", { templateId });
}

// ── Preview LaTeX local ──────────────────────────────────────────────────
// ── Diálogos ─────────────────────────────────────────────────────────────
export async function pickDirectory(title) {
  try {
    return await dialogOpen({ directory: true, title });
  } catch {
    return prompt(`${title} (escribe la ruta):`);
  }
}
