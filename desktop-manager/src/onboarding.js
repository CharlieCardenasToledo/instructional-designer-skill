import {
  advanceOnboarding,
  applyInstitutionConfig,
  checkDependencies,
  checkNotebookLMAuth,
  configureMcp,
  completeOnboarding,
  exportSkillZip,
  getActiveTemplate,
  getOnboardingStatus,
  getSetupStatus,
  installDependency,
  installSkill,
  listTemplates,
  pickDirectory,
  runNotebookLMAuth,
  setActiveTemplate,
} from "./api.js";
import { escapeHtml } from "./dom.js";
import { state, saveConfig } from "./state.js";
import { toast } from "./toast.js";
import { ic, refreshIcons } from "./icons.js";
import { renderTemplatePreview } from "./templatePreview.js";

const TOTAL_STEPS = 7;
const LARGE_DEPENDENCIES = new Set(["WSL 2", "TeX Live (pdflatex)"]);
let runtime = { status: null, dependencies: [], auth: null, setup: null, templates: [], activeTemplate: "" };

export async function renderOnboarding() {
  const root = document.getElementById("onboarding-root");
  if (!root) return;
  root.className = "onboarding-overlay";
  root.innerHTML = `<div class="onboarding-shell"><div class="loading-row">${ic("loader-2")} Preparando el onboarding…</div></div>`;
  refreshIcons();

  try {
    runtime.status = await getOnboardingStatus();
    runtime.dependencies = await checkDependencies();
    runtime.templates = await listTemplates();
    runtime.activeTemplate = await getActiveTemplate();
    if (Number(runtime.status.currentStep) === 5) runtime.auth = await checkNotebookLMAuth();
    if (Number(runtime.status.currentStep) === 6) runtime.setup = await getSetupStatus();
    renderCurrentStep();
  } catch (error) {
    root.innerHTML = `<div class="onboarding-shell"><div class="onboarding-error"><h1>No se pudo iniciar el onboarding</h1><p>${escapeHtml(error)}</p><button class="btn btn-primary" data-onboarding-action="retry">Reintentar</button></div></div>`;
    root.querySelector("[data-onboarding-action=retry]").addEventListener("click", renderOnboarding);
  }
}

function stepNumber() {
  return Number(runtime.status?.currentStep || 1);
}

function renderCurrentStep() {
  const root = document.getElementById("onboarding-root");
  if (!root || !runtime.status) return;
  if (runtime.status.completed) {
    root.remove();
    return;
  }

  const current = stepNumber();
  const title = [
    "Verificación del entorno",
    "Qué vas a configurar",
    "Identidad institucional",
    "Plantilla de tus guías",
    "NotebookLM y evidencia",
    "Destino de instalación",
    "Revisión final",
  ][current - 1];
  const subtitle = `Paso ${current} de ${TOTAL_STEPS}`;
  root.innerHTML = `
    <div class="onboarding-shell" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <header class="onboarding-header">
        <div class="brand-mark">${ic("graduation-cap", 18)}</div>
        <div><div class="onboarding-kicker">Instructional Designer Manager</div><div class="onboarding-subtitle">Configuración guiada de instructional-designer-skill</div></div>
      </header>
      <div class="onboarding-progress" aria-label="Progreso de configuración">${progressDots(current)}</div>
      <main class="onboarding-content">
        <div class="onboarding-heading"><div class="onboarding-step-label">${escapeHtml(subtitle)}</div><h1 id="onboarding-title">${escapeHtml(title)}</h1></div>
        <div id="onboarding-step-content"></div>
      </main>
      <div class="onboarding-scrollbar" aria-hidden="true"><span class="onboarding-scrollbar-thumb"></span></div>
    </div>`;

  const content = document.getElementById("onboarding-step-content");
  if (current === 1) content.innerHTML = dependenciesStep();
  if (current === 2) content.innerHTML = explanationStep();
  if (current === 3) content.innerHTML = institutionStep();
  if (current === 4) content.innerHTML = templateStep();
  if (current === 5) content.innerHTML = notebookStep();
  if (current === 6) content.innerHTML = targetStep();
  if (current === 7) content.innerHTML = finalStep();
  bindStepEvents(current);
  bindVisualScrollbar();
  refreshIcons();
}

function progressDots(current) {
  return Array.from({ length: TOTAL_STEPS }, (_, index) => {
    const step = index + 1;
    const completed = step <= Number(runtime.status.maxCompletedStep || 0);
    const active = step === current;
    const available = step <= Number(runtime.status.maxCompletedStep || 0) + 1;
    return `<button class="onboarding-dot ${completed ? "completed" : ""} ${active ? "active" : ""}" ${available ? `data-onboarding-step="${step}"` : "disabled"} aria-label="Ir al paso ${step}">${completed ? ic("check", 13) : step}</button>${step < TOTAL_STEPS ? `<span class="onboarding-connector ${completed ? "completed" : ""}"></span>` : ""}`;
  }).join("");
}

function actionButton(label, action, disabled = false, secondary = false) {
  return `<button class="btn ${secondary ? "btn-secondary" : "btn-primary"}" data-onboarding-action="${action}" ${disabled ? "disabled" : ""}><span>${escapeHtml(label)}</span></button>`;
}

function footer(nextLabel, action = "advance", disabled = false) {
  const back = stepNumber() > 1 ? actionButton("Atrás", "back", false, true) : "";
  return `<div class="onboarding-footer">${back}<span></span>${actionButton(nextLabel, action, disabled)}</div>`;
}

function bindVisualScrollbar() {
  const shell = document.querySelector(".onboarding-shell");
  const thumb = shell?.querySelector(".onboarding-scrollbar-thumb");
  if (!shell || !thumb) return;
  const update = () => {
    const max = shell.scrollHeight - shell.clientHeight;
    const ratio = max > 0 ? shell.clientHeight / shell.scrollHeight : 1;
    thumb.style.height = `${Math.max(18, ratio * 100)}%`;
    thumb.style.transform = `translateY(${max > 0 ? (shell.scrollTop / max) * (100 - Math.max(18, ratio * 100)) : 0}%)`;
  };
  shell.addEventListener("scroll", update, { passive: true });
  requestAnimationFrame(update);
}

function dependenciesStep() {
  const node = runtime.dependencies.find(dep => dep.name === "Node.js");
  const missing = runtime.dependencies.filter(dep => dep.required && !dep.installed);
  const rows = runtime.dependencies.map(dep => `
    <div class="onboarding-dependency ${dep.installed ? "ready" : "missing"}">
      <div class="dependency-status">${dep.installed ? ic("check-circle-2", 17) : ic("alert-circle", 17)}</div>
      <div class="dependency-copy"><strong>${escapeHtml(dep.name)}</strong><span>${escapeHtml(dep.note || (dep.installed ? dep.version || "Disponible" : "No encontrado"))}</span></div>
      ${dep.installed ? `<span class="badge badge-green">Listo</span>` : `<button class="btn btn-secondary btn-sm" data-install-dependency="${escapeHtml(dep.name)}">Instalar</button>`}
    </div>`).join("");
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Antes de configurar la skill verificaremos el entorno. Node.js y npx son obligatorios para ejecutar el servidor oficial de NotebookLM.</p>
    <div class="onboarding-dependencies">${rows}</div>
    <div class="onboarding-callout">${ic("info", 16)} <span>Python, WSL y TeX Live son opcionales para redactar. Se necesitan si quieres recortar PDFs o compilar LaTeX localmente. Podrás instalarlos después.</span></div>
    ${footer("Verificar y continuar", "advance", !node?.installed || missing.length > 0)}
  </section>`;
}

function explanationStep() {
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Esta aplicación prepara una skill para diseñar guías autoinstruccionales con evidencia, plantillas LaTeX y trazabilidad bibliográfica.</p>
    <div class="onboarding-feature-grid">
      <article><div class="feature-icon">${ic("book-open", 18)}</div><h3>Del sílabo a la guía</h3><p>Lee el README canónico del curso, organiza semanas y genera secciones coherentes.</p></article>
      <article><div class="feature-icon">${ic("quote", 18)}</div><h3>Evidencia verificable</h3><p>Contrasta fuentes locales y NotebookLM MCP 2.0. No inventa referencias.</p></article>
      <article><div class="feature-icon">${ic("layout-template", 18)}</div><h3>Diseño reproducible</h3><p>Usa una plantilla activa, bloques semánticos y reglas de accesibilidad.</p></article>
    </div>
    <div class="onboarding-callout">${ic("shield-check", 16)} <span>La app guarda configuración local. NotebookLM recibe las consultas que tú autorizas mediante su servidor MCP.</span></div>
    ${footer("Entendido, continuar")}
  </section>`;
}

function institutionStep() {
  const config = state.config;
  const value = key => escapeHtml(config[key] || "");
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Estos datos se guardan en JSON y se inyectan en la skill instalada o en el ZIP que subirás a Claude.</p>
    <div class="onboarding-form-grid">
      <label>Nombre completo<input id="onb-author" value="${value("author")}" placeholder="Mgtr. Ana López"></label>
      <label>Grado académico<input id="onb-degree" value="${value("degree")}" placeholder="Mgtr."></label>
      <label>Institución<input id="onb-institution" value="${value("institution")}" placeholder="Universidad Ejemplo"></label>
      <label>Facultad<input id="onb-faculty" value="${value("faculty")}" placeholder="Facultad de Ingeniería"></label>
      <label>Carrera<input id="onb-career" value="${value("career")}" placeholder="Ingeniería de Software"></label>
      <label>Color institucional<input id="onb-color" type="color" value="${escapeHtml(config.colorHex || "#00796b")}"></label>
      <label class="full-width">Ecosistema digital <span class="field-help">uno por línea</span><textarea id="onb-ecosystem" placeholder="Canvas LMS&#10;Sistema académico">${value("ecosystem")}</textarea></label>
    </div>
    <div class="onboarding-inline-error" id="onb-form-error" hidden></div>
    ${footer("Guardar y continuar", "save-institution")}
  </section>`;
}

function templateStep() {
  const selected = runtime.activeTemplate;
  const cards = runtime.templates.map(template => `
    <button class="onboarding-template ${template.id === selected ? "selected" : ""}" data-template-id="${escapeHtml(template.id)}">
      <span class="template-check">${template.id === selected ? ic("check", 13) : ""}</span><strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.description)}</span>
    </button>`).join("");
  const template = runtime.templates.find(item => item.id === selected) || runtime.templates[0];
  const preview = template ? renderTemplatePreview(template.previewType || template.id, state.config, selected) : `<div class="empty-state">No hay plantillas.</div>`;
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Selecciona la plantilla que usará la skill. La vista previa usa contenido de ejemplo para mostrar la jerarquía real de la guía.</p>
    <div class="onboarding-template-layout"><div class="onboarding-template-list">${cards}</div><div class="onboarding-template-preview">${preview}</div></div>
    ${footer("Confirmar plantilla", "save-template", !template)}
  </section>`;
}

function notebookStep() {
  const authenticated = runtime.auth?.authenticated === true;
  return `<section class="onboarding-card">
    <p class="onboarding-lead">NotebookLM permite contrastar capítulos, conceptos y fuentes del curso. Necesitas una cuenta de Google con acceso a <strong>NotebookLM</strong>.</p>
    <ol class="onboarding-instructions"><li>Abre NotebookLM y crea un notebook por asignatura.</li><li>Sube los libros, artículos o documentación que usarás.</li><li>En el paso siguiente registrarás el ID o la URL de compartir.</li><li>La app abrirá Chrome mediante el perfil local de <code>notebooklm-mcp</code>.</li></ol>
    <div class="onboarding-auth-status ${authenticated ? "success" : "pending"}">${authenticated ? ic("check-circle-2", 18) : ic("lock-keyhole", 18)}<div><strong>${authenticated ? "Sesión verificada" : "Sesión pendiente"}</strong><span>${escapeHtml(runtime.auth?.message || "Pulsa iniciar sesión para abrir Chrome.")}</span></div></div>
    <div class="onboarding-actions">${actionButton("Iniciar sesión en NotebookLM", "start-auth", false, true)}${actionButton("Verificar sesión", "verify-auth", false, true)}</div>
    ${footer("Continuar", "advance", !authenticated)}
  </section>`;
}

function targetStep() {
  const setup = runtime.setup || {};
  const selected = runtime.status.selectedTarget || state.config.onboardingTarget || "claude-code";
  const cards = [
    { id: "claude-code", title: "Claude Code", desc: "Instala la skill en ~/.claude/skills y configura ~/.claude.json.", ready: setup.skill_installed && setup.mcp_claude_code_configured, actions: ["install-local", "configure-code"] },
    { id: "claude-cowork", title: "Claude Desktop / Cowork", desc: "Genera un ZIP para Customize → Skills y configura Claude Desktop MCP.", ready: Boolean(state.config.lastSkillZip) && setup.mcp_desktop_configured, actions: ["export-zip", "configure-desktop"] },
    { id: "both", title: "Ambos destinos", desc: "Prepara los dos flujos para alternar entre Claude Code y Claude/Cowork.", ready: Boolean(state.config.lastSkillZip) && setup.skill_installed && setup.mcp_desktop_configured && setup.mcp_claude_code_configured, actions: ["export-zip", "install-local", "configure-desktop", "configure-code"] },
  ];
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Elige dónde trabajarás. La app no marca este paso como listo hasta que el destino seleccionado tenga skill y MCP verificables.</p>
    <div class="onboarding-targets">${cards.map(card => `<label class="onboarding-target ${card.id === selected ? "selected" : ""}"><input type="radio" name="onboarding-target" value="${card.id}" ${card.id === selected ? "checked" : ""}><span><strong>${card.title}</strong><small>${card.desc}</small></span><span class="target-status">${card.ready ? ic("check-circle-2", 17) : ic("circle", 17)}</span></label>`).join("")}</div>
    <div class="onboarding-actions">${selected === "claude-code" || selected === "both" ? actionButton("Instalar para Claude Code", "install-local", false, true) : ""}${selected === "claude-cowork" || selected === "both" ? actionButton("Generar ZIP para Claude/Cowork", "export-zip", false, true) : ""}${selected === "claude-code" || selected === "both" ? actionButton("Configurar MCP de Claude Code", "configure-code", false, true) : ""}${selected === "claude-cowork" || selected === "both" ? actionButton("Configurar MCP de Claude Desktop", "configure-desktop", false, true) : ""}</div>
    <div class="onboarding-inline-error" id="onb-target-message" hidden></div>
    ${footer("Verificar destino y continuar", "advance-target", !cards.find(card => card.id === selected)?.ready)}
  </section>`;
}

function finalStep() {
  return `<section class="onboarding-card"><div class="onboarding-final-icon">${ic("check-circle-2", 30)}</div><p class="onboarding-lead center">La configuración técnica está preparada. Al finalizar, Rust volverá a validar Node.js, la institución, la plantilla, NotebookLM y el destino seleccionado.</p><div class="onboarding-callout">${ic("info", 16)} <span>Si una cookie expira o se elimina una configuración, el onboarding volverá al paso que necesita atención.</span></div>${footer("Finalizar configuración", "complete")}</section>`;
}

function bindStepEvents(current) {
  const root = document.getElementById("onboarding-root");
  root.querySelectorAll("[data-onboarding-step]").forEach(button => button.addEventListener("click", async () => {
    const result = await goToOnboardingStep(Number(button.dataset.onboardingStep));
    if (result.success) { runtime.status = result.status; renderCurrentStep(); }
    else toast(result.message, "error");
  }));
  root.querySelectorAll("[data-install-dependency]").forEach(button => button.addEventListener("click", () => installDependencyStep(button.dataset.installDependency)));
  root.querySelectorAll("[data-template-id]").forEach(button => button.addEventListener("click", () => {
    runtime.activeTemplate = button.dataset.templateId;
    renderCurrentStep();
  }));
  root.querySelectorAll("input[name=onboarding-target]").forEach(input => input.addEventListener("change", event => {
    state.config.onboardingTarget = event.target.value;
    saveConfig();
    renderCurrentStep();
  }));
  root.querySelectorAll("[data-onboarding-action]").forEach(button => button.addEventListener("click", () => handleAction(button.dataset.onboardingAction, current)));
}

async function installDependencyStep(name) {
  const confirmed = !LARGE_DEPENDENCIES.has(name) || confirm(`${name} puede descargar componentes grandes y requiere permisos del sistema. ¿Continuar?`);
  if (!confirmed) return;
  toast(`Instalando ${name}…`, "loading", 120000);
  const result = await installDependency(name, confirmed);
  toast(result.message, result.success ? "success" : "error", 9000);
  runtime.dependencies = await checkDependencies();
  renderCurrentStep();
}

async function handleAction(action, current) {
  if (["retry", "back"].includes(action)) return performAction(action, current);
  const buttons = [...document.querySelectorAll(`[data-onboarding-action="${action}"]`)].filter(button => !button.disabled);
  buttons.forEach(button => { button.dataset.originalLabel = button.querySelector("span")?.textContent || "Procesar"; setBusyState(button, true, "Procesando…"); });
  try { return await performAction(action, current); }
  finally { buttons.forEach(button => setBusyState(button, false)); }
}

function setBusyState(button, busy, label = "") {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const text = button.querySelector("span");
  if (text && busy) text.textContent = label;
  if (text && !busy) text.textContent = button.dataset.originalLabel || text.textContent;
}

async function performAction(action, current) {
  if (action === "retry") return renderOnboarding();
  if (action === "back") {
    const result = await goToOnboardingStep(Math.max(1, current - 1));
    if (result.success) { runtime.status = result.status; renderCurrentStep(); }
    else toast(result.message, "error");
    return;
  }
  if (action === "start-auth") {
    toast("Abriendo Chrome…", "loading", 90000);
    const result = await runNotebookLMAuth();
    toast(result.message, result.success ? "success" : "error", 10000);
    return;
  }
  if (action === "verify-auth") {
    runtime.auth = await checkNotebookLMAuth();
    renderCurrentStep();
    return;
  }
  if (action === "save-institution") {
    const color = document.getElementById("onb-color").value;
    const rgb = hexToRgb(color);
    const config = {
      author: document.getElementById("onb-author").value.trim(), degree: document.getElementById("onb-degree").value.trim(), institution: document.getElementById("onb-institution").value.trim(), faculty: document.getElementById("onb-faculty").value.trim(), career: document.getElementById("onb-career").value.trim(), ecosystem: document.getElementById("onb-ecosystem").value.trim(), colorR: rgb.r, colorG: rgb.g, colorB: rgb.b, colorHex: color,
    };
    state.config = { ...state.config, ...config }; saveConfig();
    const result = await applyInstitutionConfig({ author: config.author, degree: config.degree, institution: config.institution, faculty: config.faculty, career: config.career, ecosystem: config.ecosystem, color_r: rgb.r, color_g: rgb.g, color_b: rgb.b });
    toast(result.message, result.success ? "success" : "error", 8000);
    if (!result.success) return;
    return advance(current);
  }
  if (action === "save-template") {
    const result = await setActiveTemplate(runtime.activeTemplate);
    toast(result.message, result.success ? "success" : "error", 7000);
    if (result.success) return advance(current);
    return;
  }
  if (action === "export-zip") {
    const destination = await pickDirectory("Carpeta para guardar el ZIP de Claude/Cowork");
    if (!destination) return;
    const result = await exportSkillZip(destination);
    toast(result.message, result.success ? "success" : "error", 9000);
    if (result.success && result.path) { state.config.lastSkillZip = result.path; saveConfig(); }
    await refreshTarget();
    renderCurrentStep();
    return;
  }
  if (action === "install-local") {
    const result = await installSkill(); toast(result.message, result.success ? "success" : "error", 9000); await refreshTarget(); renderCurrentStep(); return;
  }
  if (action === "configure-code" || action === "configure-desktop") {
    const result = await configureMcp(action === "configure-code" ? "claude-code" : "desktop"); toast(result.message, result.success ? "success" : "error", 9000); await refreshTarget(); renderCurrentStep(); return;
  }
  if (action === "advance-target") {
    await refreshTarget();
    const target = document.querySelector("input[name=onboarding-target]:checked")?.value;
    if (!target) return toast("Selecciona un destino", "error");
    const ready = targetReady(target);
    if (!ready) { document.getElementById("onb-target-message").hidden = false; document.getElementById("onb-target-message").textContent = "Completa las acciones del destino y vuelve a verificar."; return; }
    return advance(current, target);
  }
  if (action === "complete") {
    const result = await completeOnboarding();
    toast(result.message, result.success ? "success" : "error", 10000);
    if (result.success) { runtime.status = result.status; document.getElementById("onboarding-root")?.remove(); window.location.reload(); }
    else { runtime.status = result.status; renderCurrentStep(); }
    return;
  }
  if (action === "advance") return advance(current);
}

async function advance(step, selectedTarget) {
  const result = await advanceOnboarding(step, selectedTarget);
  toast(result.message, result.success ? "success" : "error", 7000);
  if (result.success) { runtime.status = result.status; if (step === 5) runtime.setup = await getSetupStatus(); renderCurrentStep(); }
}

async function refreshTarget() {
  runtime.setup = await getSetupStatus();
}

function targetReady(target) {
  const setup = runtime.setup || {};
  if (target === "claude-code") return setup.skill_installed && setup.mcp_claude_code_configured;
  if (target === "claude-cowork") return Boolean(state.config.lastSkillZip) && setup.mcp_desktop_configured;
  return Boolean(state.config.lastSkillZip) && setup.skill_installed && setup.mcp_desktop_configured && setup.mcp_claude_code_configured;
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return match ? { r: Number.parseInt(match[1], 16), g: Number.parseInt(match[2], 16), b: Number.parseInt(match[3], 16) } : { r: 0, g: 121, b: 107 };
}
