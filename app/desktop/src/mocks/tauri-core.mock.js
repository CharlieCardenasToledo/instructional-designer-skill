/**
 * tauri-core.mock.js — Reemplazo de "@tauri-apps/api/core" para correr la app
 * en un navegador normal (sin Tauri) durante desarrollo/QA visual.
 *
 * Solo se usa cuando Vite corre en modo "mock" (ver vite.config.js). Simula
 * el backend Rust con un estado en memoria para poder navegar el onboarding
 * y las páginas principales de punta a punta.
 *
 * BYPASS: añade ?bypass=1 a la URL para saltar el onboarding directamente al
 * dashboard, útil para auditorías UX/QA visual.
 * Ejemplo: http://localhost:1421/?bypass=1
 */

function delay(ms = 250) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Si la URL contiene ?bypass=1, arranca con onboarding completado y
// todos los datos pre-configurados para acceder directo al dashboard.
const BYPASS = new URLSearchParams(location.search).get("bypass") === "1";

const state = {
  onboarding: {
    version: 3,
    completed: BYPASS,
    currentStep: BYPASS ? 5 : 1,
    maxCompletedStep: BYPASS ? 5 : 0,
    selectedTarget: "claude-code",
    lastUpdated: Date.now(),
    regressionReason: null,
  },
  dependencies: [
    { name: "Node.js", installed: true, version: "v20.11.0", required: true, note: "", command: "node -v" },
    { name: "Git", installed: true, version: "2.43.0", required: false, note: "", command: "git --version" },
    { name: "Python", installed: true, version: "3.11.4", required: true, note: "", command: "python --version" },
    { name: "Compilador LaTeX", installed: BYPASS, version: BYPASS ? "2024.1 (mock)" : null, required: true, note: "", command: "pdflatex --version" },
  ],
  setup: {
    skill_installed: BYPASS,
    mcp_configured: BYPASS,
    mcp_desktop_configured: BYPASS,
    mcp_claude_code_configured: BYPASS,
    institution_configured: BYPASS,
    skill_path: BYPASS ? "/mock/home/.claude/skills/instructional-designer-skill" : "",
    mcp_config_path: BYPASS ? "/mock/home/.config/claude/claude_desktop_config.json" : "",
  },
  auth: BYPASS
    ? { authenticated: true, message: "Sesión activa — demo@uide.edu.ec" }
    : { authenticated: false, message: "Sin sesión activa. El skill no podrá consultar NotebookLM." },
  lastSkillZip: BYPASS ? "/mock/exports/instructional-designer-skill.zip" : null,
  templates: [
    { id: "elegantbook-clasico", name: "ElegantBook Clásico", description: "Portada institucional con bloques pedagógicos numerados y bibliografía APA.", tags: ["Institucional", "Formal"], previewType: "elegantbook-clasico", featured: true, documentClass: "elegantbook" },
    { id: "minimal-mono", name: "Minimalista", description: "Tipografía sobria de una sola columna, ideal para guías breves.", tags: ["Personal", "Simple"], previewType: "minimal", featured: false, documentClass: "minimal" },
    { id: "ieee-tecnico", name: "IEEE Técnico", description: "Formato de dos columnas para asignaturas técnicas.", tags: ["Institucional", "Técnico"], previewType: "ieee", featured: true, documentClass: "IEEEtran" },
    { id: "cuaderno-taller", name: "Cuaderno de Taller", description: "Bloques de actividad destacados para materias prácticas.", tags: ["Personal"], previewType: "cuaderno", featured: false, documentClass: "article" },
  ],
  activeTemplateId: "elegantbook-clasico",
  institutionConfigured: BYPASS,
};

function actionResult(success, message, extra = {}) {
  return { success, message, ...extra };
}

function onboardingResult(success, message) {
  return { success, message, status: { ...state.onboarding } };
}

function targetReady(target) {
  if (target === "claude-cowork") return Boolean(state.lastSkillZip) && state.setup.mcp_desktop_configured;
  if (target === "claude-code") return state.setup.skill_installed && state.setup.mcp_claude_code_configured;
  if (target === "both") {
    return Boolean(state.lastSkillZip) && state.setup.skill_installed &&
      state.setup.mcp_desktop_configured && state.setup.mcp_claude_code_configured;
  }
  return false;
}

async function advanceOnboarding({ step, selectedTarget }) {
  if (step !== state.onboarding.currentStep) {
    return onboardingResult(false, "El estado del onboarding cambió. Vuelve a verificar el paso.");
  }
  if (step === 2) {
    const missing = state.dependencies.filter(d => d.required && !d.installed);
    if (missing.length > 0) {
      return onboardingResult(false, `Falta instalar: ${missing.map(d => d.name).join(", ")}.`);
    }
  }
  if (step === 3) {
    if (!state.institutionConfigured) return onboardingResult(false, "Completa los datos de tu institución y tu perfil antes de continuar.");
  }
  if (step === 4) {
    if (!state.auth.authenticated) return onboardingResult(false, state.auth.message);
    const target = selectedTarget || state.onboarding.selectedTarget;
    if (!targetReady(target)) return onboardingResult(false, "El destino seleccionado todavía no tiene skill y MCP completamente configurados.");
    state.onboarding.selectedTarget = target;
  }
  state.onboarding.maxCompletedStep = Math.max(state.onboarding.maxCompletedStep, step);
  state.onboarding.currentStep = Math.min(5, step + 1);
  return onboardingResult(true, "Paso completado.");
}

function goToOnboardingStep({ step }) {
  const highestOpen = Math.min(5, state.onboarding.maxCompletedStep + 1);
  if (step < 1 || step > highestOpen) return onboardingResult(false, "Completa los pasos anteriores antes de continuar.");
  state.onboarding.currentStep = step;
  return onboardingResult(true, "Paso actualizado.");
}

function completeOnboarding() {
  if (state.onboarding.currentStep !== 5) return onboardingResult(false, "Completa todos los pasos antes de finalizar.");
  state.onboarding.completed = true;
  state.onboarding.maxCompletedStep = 5;
  return onboardingResult(true, "Onboarding completado.");
}

const handlers = {
  check_dependencies: () => state.dependencies.map(d => ({ ...d })),
  get_onboarding_status: () => ({ ...state.onboarding }),
  advance_onboarding: advanceOnboarding,
  go_to_onboarding_step: goToOnboardingStep,
  complete_onboarding: completeOnboarding,
  install_dependency: ({ name }) => {
    const dep = state.dependencies.find(d => d.name === name);
    if (dep) { dep.installed = true; dep.version = dep.version || "mock-1.0.0"; }
    return actionResult(true, `${name} instalado correctamente (mock).`);
  },
  reset_onboarding: () => {
    Object.assign(state.onboarding, {
      version: 3, completed: false, currentStep: 1, maxCompletedStep: 0,
      selectedTarget: "claude-code", lastUpdated: Date.now(), regressionReason: null,
    });
    return onboardingResult(true, "Onboarding reiniciado.");
  },
  get_skill_path: () => (state.setup.skill_installed ? "/mock/home/.claude/skills/instructional-designer-skill" : ""),
  install_skill: () => {
    state.setup.skill_installed = true;
    return actionResult(true, "Skill instalado en tu proyecto local (mock).");
  },
  export_skill_zip: ({ destinationDir }) => {
    const path = `${destinationDir || "/mock/exports"}/instructional-designer-skill.zip`;
    state.lastSkillZip = path;
    return actionResult(true, "Archivo exportado (mock).", { path });
  },
  configure_mcp: ({ target }) => {
    if (target === "claude-code") {
      state.setup.mcp_claude_code_configured = true;
      state.setup.mcp_configured = true;
      return actionResult(true, "Proyecto local conectado (mock).");
    }
    if (target === "desktop") {
      state.setup.mcp_desktop_configured = true;
      state.setup.mcp_configured = true;
      return actionResult(true, "App de Claude conectada (mock).");
    }
    return actionResult(false, "Destino MCP no reconocido.");
  },
  get_setup_status: () => ({ ...state.setup }),
  apply_institution_config: ({ config }) => {
    state.institutionConfigured = Boolean(config?.author && config?.institution);
    state.setup.institution_configured = state.institutionConfigured;
    return actionResult(true, "Configuración guardada (mock).");
  },
  extract_site_palette: () => ({
    site_name: "Universidad Ejemplo",
    colors: [
      { color: "#00317e", occurrences: 34 },
      { color: "#ffffff", occurrences: 21 },
      { color: "#f2a900", occurrences: 9 },
      { color: "#1a1a1a", occurrences: 6 },
    ],
  }),
  check_notebooklm_auth: () => ({ ...state.auth }),
  run_notebooklm_auth: () => {
    state.auth = { authenticated: true, message: "Sesión activa — demo@example.com" };
    return actionResult(true, "Sesión iniciada (mock).");
  },
  save_notebooks_config: () => actionResult(true, "Notebooks guardados (mock)."),
  create_course_structure: () => actionResult(true, "Estructura de carpetas creada (mock)."),
  generate_syllabus: () => actionResult(true, "Sílabo generado (mock)."),
  compile_syllabus_pdf: () => actionResult(true, "PDF compilado (mock)."),
  list_templates: () => state.templates.map(t => ({ ...t })),
  get_active_template: () => state.activeTemplateId,
  set_active_template: ({ templateId }) => {
    state.activeTemplateId = templateId;
    return actionResult(true, "Plantilla activada (mock).");
  },
};

export async function invoke(cmd, args = {}) {
  const handler = handlers[cmd];
  await delay();
  if (!handler) {
    console.warn(`[tauri-mock] comando no simulado: ${cmd}`, args);
    return actionResult(false, `Comando no simulado: ${cmd}`);
  }
  return handler(args);
}

export function convertFileSrc(path) {
  return path;
}
