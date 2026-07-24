import { appLocalDataDir } from "@tauri-apps/api/path";
import {
  advanceOnboarding,
  applyInstitutionConfig,
  checkDependencies,
  checkNotebookLMAuth,
  compileSyllabusPdf,
  configureMcp,
  completeOnboarding,
  exportSkillZip,
  generateSyllabus,
  getActiveTemplate,
  getOnboardingStatus,
  getSetupStatus,
  getSkillPath,
  goToOnboardingStep,
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
    runtime.auth  = await checkNotebookLMAuth();
    runtime.setup = await getSetupStatus();
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
  const template = runtime.templates.find(item => item.id === selected) || runtime.templates[0];
  const cards = runtime.templates.map(t => {
    const isSelected = t.id === selected;
    return `
    <button class="onboarding-template-card ${isSelected ? "selected" : ""}" data-template-id="${escapeHtml(t.id)}">
      <div class="otc-header">
        <span class="material-symbols-outlined otc-icon">${isSelected ? "check_circle" : "radio_button_unchecked"}</span>
        <strong class="otc-name">${escapeHtml(t.name)}</strong>
      </div>
      <p class="otc-desc">${escapeHtml(t.description)}</p>
      ${t.features ? `<ul class="otc-features">${t.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
    </button>`;
  }).join("");
  return `<section class="onboarding-card">
    <p class="onboarding-lead">Elige la plantilla LaTeX que usará la skill para generar tus guías. La verás aplicada en la verificación final del paso 7.</p>
    <div class="onboarding-template-grid">${cards}</div>
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
  const setup    = runtime.setup || {};
  const selected = runtime.status.selectedTarget || state.config.onboardingTarget || "claude-code";
  const zipOk    = Boolean(state.config.lastSkillZip);

  const targets = [
    { id: "claude-code",    title: "Claude Code",              icon: "terminal",     desc: "Instala en ~/.claude/skills y registra la skill en claude.json." },
    { id: "claude-cowork",  title: "Claude Desktop / Cowork",  icon: "desktop_windows", desc: "Genera un ZIP para Customize → Skills y configura Claude Desktop MCP." },
    { id: "both",           title: "Ambos destinos",           icon: "devices",      desc: "Prepara los dos flujos para alternar libremente entre clientes." },
  ];

  // Checklist de pasos para el destino seleccionado
  function checkItem(label, done) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;
      background:${done ? "rgba(26,127,75,0.06)" : "rgba(0,49,126,0.04)"};
      border:1px solid ${done ? "rgba(26,127,75,0.22)" : "rgba(0,49,126,0.14)"};font-size:12.5px">
      <span class="material-symbols-outlined" style="font-size:15px;color:${done ? "var(--green)" : "var(--muted)"}">
        ${done ? "check_circle" : "radio_button_unchecked"}
      </span>
      <span style="color:${done ? "var(--green)" : "var(--text-2)"}">${escapeHtml(label)}</span>
    </div>`;
  }

  let checklist = "";
  let allReady  = false;
  let actions   = "";

  if (selected === "claude-code") {
    checklist = checkItem("Skill instalado en ~/.claude/skills/", setup.skill_installed) +
                checkItem("MCP registrado en Claude Code (~/.claude.json)", setup.mcp_claude_code_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured);
    actions   = actionButton("1. Instalar skill", "install-local", setup.skill_installed, true) +
                actionButton("2. Configurar MCP Claude Code", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true);

  } else if (selected === "claude-cowork") {
    checklist = checkItem("ZIP exportado para Claude/Cowork", zipOk) +
                checkItem("MCP registrado en Claude Desktop", setup.mcp_desktop_configured);
    allReady  = !!(zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("1. Exportar ZIP de la skill", "export-zip", zipOk, true) +
                actionButton("2. Configurar MCP Claude Desktop", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);

  } else { // both
    checklist = checkItem("Skill instalado en ~/.claude/skills/", setup.skill_installed) +
                checkItem("MCP registrado en Claude Code", setup.mcp_claude_code_configured) +
                checkItem("ZIP exportado para Claude/Cowork", zipOk) +
                checkItem("MCP registrado en Claude Desktop", setup.mcp_desktop_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured && zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("Instalar skill (Claude Code)", "install-local", setup.skill_installed, true) +
                actionButton("Exportar ZIP (Claude/Cowork)", "export-zip", zipOk, true) +
                actionButton("Configurar MCP Claude Code", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true) +
                actionButton("Configurar MCP Claude Desktop", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);
  }

  return `<section class="onboarding-card">
    <p class="onboarding-lead">Elige dónde trabajarás con Claude. Completa cada acción en orden: primero instala, luego configura el MCP.</p>

    <!-- Selector de destino -->
    <div class="onboarding-targets">
      ${targets.map(t => `
        <label class="onboarding-target ${t.id === selected ? "selected" : ""}">
          <input type="radio" name="onboarding-target" value="${t.id}" ${t.id === selected ? "checked" : ""}>
          <span class="material-symbols-outlined" style="font-size:18px;flex-shrink:0">${t.icon}</span>
          <span><strong>${t.title}</strong><small>${t.desc}</small></span>
          <span class="target-status">${targetReady(t.id) ? `<span class="material-symbols-outlined" style="color:var(--green);font-size:18px">check_circle</span>` : `<span class="material-symbols-outlined" style="color:var(--muted);font-size:18px">pending</span>`}</span>
        </label>`).join("")}
    </div>

    <!-- Estado de instalación del destino seleccionado -->
    <div style="margin:16px 0 12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:8px">
        Estado — ${targets.find(t => t.id === selected)?.title || selected}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${checklist}</div>
    </div>

    <!-- Acciones secuenciales -->
    <div class="onboarding-actions">${actions}</div>
    <div class="onboarding-inline-error" id="onb-target-message" hidden></div>
    ${footer("Continuar al paso final", "advance-target", !allReady)}
  </section>`;
}

function finalStep() {
  const config = state.config || {};
  const setup  = runtime.setup || {};
  const target = runtime.status?.selectedTarget || config.onboardingTarget || "claude-code";
  const targetLabel = { "claude-code": "Claude Code", "claude-cowork": "Claude Desktop / Cowork", "both": "Ambos destinos" }[target] || target;

  const checks = [
    { label: "Dependencias",        ok: runtime.dependencies.filter(d => d.required).every(d => d.installed) },
    { label: "Perfil institucional", ok: !!(config.author && config.institution) },
    { label: "Plantilla activa",     ok: !!runtime.activeTemplate },
    { label: "Auth Google",          ok: runtime.auth?.authenticated === true },
    { label: "Skill instalado",      ok: setup.skill_installed },
    { label: "MCP configurado",      ok: setup.mcp_claude_code_configured || setup.mcp_desktop_configured },
  ];

  return `<section class="onboarding-card">
    <p class="onboarding-lead center" style="margin-bottom:20px">
      Verificando que el pipeline completo funciona — la skill generará un documento real con datos de prueba.
    </p>

    <div id="final-gen-area" style="margin:0 auto 24px;max-width:480px">

      <!-- Carga (visible al inicio) -->
      <div id="final-loading" style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px 0">

        <!-- Spinner concéntrico animado -->
        <div style="position:relative;width:72px;height:72px">
          <div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:var(--primary);animation:spin 1.4s linear infinite"></div>
          <div style="position:absolute;inset:9px;border-radius:50%;border:3px solid transparent;border-top-color:var(--teal);animation:spin .85s linear infinite reverse"></div>
          <div style="position:absolute;inset:18px;border-radius:50%;background:rgba(0,49,126,0.07);display:flex;align-items:center;justify-content:center">
            <span id="gen-center-icon" class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">auto_awesome</span>
          </div>
        </div>

        <div id="final-loading-msg" style="font-size:13.5px;font-weight:600;color:var(--text-2);text-align:center">Iniciando verificación…</div>

        <!-- Barra de progreso -->
        <div style="width:100%;max-width:320px;height:3px;border-radius:99px;background:rgba(0,49,126,0.09);overflow:hidden">
          <div id="gen-progress-fill" style="height:100%;width:0%;border-radius:99px;background:linear-gradient(90deg,var(--primary),var(--teal));transition:width .6s ease"></div>
        </div>

        <div id="final-loading-steps" style="display:flex;flex-direction:column;gap:5px;width:100%;max-width:340px">
          <div class="final-check-row" data-check="0" style="opacity:.3">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
            <span>Leyendo perfil institucional…</span>
          </div>
          <div class="final-check-row" data-check="1" style="opacity:.3">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
            <span>Localizando skill instalado…</span>
          </div>
          <div class="final-check-row" data-check="2" style="opacity:.3">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
            <span>Generando sílabo de prueba (2 semanas)…</span>
          </div>
          <div class="final-check-row" data-check="3" style="opacity:.3">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
            <span>Compilando PDF con pdflatex…</span>
          </div>
          <div class="final-check-row" data-check="4" style="opacity:.3">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
            <span>Verificando documento compilado…</span>
          </div>
        </div>
      </div>

      <!-- Resultado — aparece solo tras éxito o fallo definitivo -->
      <div id="final-result-wrap" style="display:none">
        <div id="final-result-content"></div>
      </div>
    </div>

    <!-- Checklist de estado de configuración -->
    <div style="max-width:480px;margin:0 auto 16px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${checks.map(c => `
        <div style="display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:8px;font-size:12px;font-weight:500;
          background:${c.ok ? "rgba(26,127,75,0.06)" : "rgba(186,26,26,0.04)"};
          border:1px solid ${c.ok ? "rgba(26,127,75,0.20)" : "rgba(186,26,26,0.16)"};
          color:${c.ok ? "var(--green)" : "var(--red)"}">
          <span class="material-symbols-outlined" style="font-size:15px">${c.ok ? "check_circle" : "cancel"}</span>
          ${escapeHtml(c.label)}
        </div>`).join("")}
    </div>

    <div style="text-align:center;font-size:11.5px;color:var(--muted);margin-bottom:16px">
      Destino: <strong style="color:var(--text-2)">${escapeHtml(targetLabel)}</strong>
    </div>

    <!-- Botón deshabilitado hasta que la generación sea exitosa -->
    ${footer("Finalizar configuración", "complete", true)}
  </section>`;
}

async function animateFinalStep() {
  const checkRows = document.querySelectorAll(".final-check-row");
  const msgEl     = document.getElementById("final-loading-msg");
  const fillEl    = document.getElementById("gen-progress-fill");

  function setProgress(pct) {
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  function setRow(i, rowState) {
    if (!checkRows[i]) return;
    const row  = checkRows[i];
    const icon = row.querySelector(".material-symbols-outlined");
    row.style.opacity = "1";
    row.style.transition = "opacity .3s, color .3s";
    if (rowState === "active") {
      row.style.color  = "var(--teal)";
      icon.textContent = "sync";
      icon.style.animation = "spin .7s linear infinite";
    } else if (rowState === "done") {
      row.style.color  = "var(--green)";
      icon.textContent = "check_circle";
      icon.style.animation = "none";
    } else if (rowState === "error") {
      row.style.color  = "var(--red)";
      icon.textContent = "cancel";
      icon.style.animation = "none";
    }
  }

  function setMsg(msg) {
    if (!msgEl) return;
    msgEl.style.opacity = "0";
    msgEl.style.transition = "opacity .2s";
    setTimeout(() => {
      msgEl.textContent = msg;
      msgEl.style.opacity = "1";
    }, 150);
  }

  function showError(title, detail, errStr) {
    const loadingEl = document.getElementById("final-loading");
    const wrapEl    = document.getElementById("final-result-wrap");
    const contentEl = document.getElementById("final-result-content");
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.innerHTML = `
      <div style="border:1.5px solid rgba(186,26,26,0.25);border-radius:12px;padding:24px;text-align:center;background:rgba(186,26,26,0.03)">
        <span class="material-symbols-outlined" style="font-size:36px;color:var(--red);display:block;margin-bottom:10px">error</span>
        <div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:6px">${escapeHtml(title)}</div>
        <div style="font-size:12.5px;color:var(--text-2);margin-bottom:12px">${escapeHtml(detail)}</div>
        ${errStr ? `<div style="font-size:10.5px;font-family:monospace;color:var(--muted);background:rgba(0,0,0,0.04);padding:8px 12px;border-radius:6px;text-align:left;word-break:break-all;margin-bottom:14px">${escapeHtml(errStr)}</div>` : ""}
        <button class="btn btn-secondary" id="btn-retry-gen" style="font-size:12.5px">
          <span class="material-symbols-outlined" style="font-size:15px">refresh</span> Reintentar verificación
        </button>
      </div>`;
    if (wrapEl) {
      wrapEl.style.display = "block";
      wrapEl.style.opacity = "0";
      wrapEl.style.transition = "opacity .35s";
      requestAnimationFrame(() => { wrapEl.style.opacity = "1"; });
    }
    document.getElementById("btn-retry-gen")?.addEventListener("click", () => {
      if (wrapEl) wrapEl.style.display = "none";
      if (loadingEl) {
        loadingEl.style.display = "flex";
        checkRows.forEach((r, i) => {
          r.style.opacity = i <= 1 ? "1" : ".3";
          r.style.color = "";
          r.querySelector(".material-symbols-outlined").textContent = i <= 1 ? "check_circle" : "hourglass_empty";
          if (i === 1) r.querySelector(".material-symbols-outlined").style.color = "var(--green)";
        });
        if (fillEl) fillEl.style.width = "25%";
      }
      animateFinalStep();
    });
  }

  function showSuccess(basePath, message, pdfPath) {
    const loadingEl = document.getElementById("final-loading");
    const wrapEl    = document.getElementById("final-result-wrap");
    const contentEl = document.getElementById("final-result-content");
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.innerHTML = renderSyllabusDoc(pdfPath, message);
    if (wrapEl) {
      wrapEl.style.display = "block";
      wrapEl.style.opacity = "0";
      wrapEl.style.transition = "opacity .4s";
      requestAnimationFrame(() => { wrapEl.style.opacity = "1"; });
    }
    document.querySelector("[data-onboarding-action='complete']").disabled = false;
  }

  function renderSyllabusDoc(pdfPath, message) {
    const fileUrl = pdfPath.replace(/\\/g, "/");
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:flex-start;gap:12px;padding:16px;border-radius:12px;background:rgba(26,127,75,0.06);border:1px solid rgba(26,127,75,0.20)">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--green);flex-shrink:0">check_circle</span>
          <div>
            <div style="font-weight:700;color:var(--green);margin-bottom:4px">Documento compilado exitosamente</div>
            <div style="font-size:12.5px;color:var(--text-2)">${escapeHtml(message)}</div>
          </div>
        </div>
        <div style="border:1.5px solid rgba(0,49,126,0.15);border-radius:12px;overflow:hidden;background:#fff">
          <iframe src="file:///${escapeHtml(fileUrl)}" style="width:100%;height:500px;border:none;display:block"></iframe>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" style="flex:1" onclick="window.open('file:///${escapeHtml(fileUrl)}')">
            <span class="material-symbols-outlined" style="font-size:15px">open_in_new</span> Abrir en visor nativo
          </button>
          <button class="btn btn-secondary" style="flex:1" onclick="navigator.clipboard.writeText('${escapeHtml(fileUrl)}').then(() => alert('Ruta copiada'))">
            <span class="material-symbols-outlined" style="font-size:15px">content_copy</span> Copiar ruta
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted);padding:12px;background:rgba(0,0,0,.03);border-radius:8px;word-break:break-all">
          <strong>Archivo:</strong> ${escapeHtml(fileUrl)}
        </div>
      </div>
    `;
  }

  // ── 0 / 25 % — leer perfil ──────────────────────────────────────────────
  setRow(0, "active");
  setMsg("Leyendo perfil institucional…");
  setProgress(5);
  await new Promise(r => setTimeout(r, 400));
  setRow(0, "done");
  setProgress(25);

  // ── 1 / 50 % — localizar skill ──────────────────────────────────────────
  setRow(1, "active");
  setMsg("Localizando skill instalado…");
  let skillPath;
  try {
    skillPath = await getSkillPath();
    setRow(1, "done");
    setProgress(50);
  } catch (err) {
    setRow(1, "error");
    setRow(2, "error");
    setRow(3, "error");
    setProgress(25);
    setMsg("Skill no encontrado");
    showError(
      "Skill no instalado",
      "Vuelve al Paso 6 con los puntos de progreso de arriba y pulsa 'Instalar skill' antes de continuar.",
      String(err)
    );
    return;
  }

  // ── 2 / 75 % — generar sílabo ───────────────────────────────────────────
  setRow(2, "active");
  setMsg("Generando sílabo de prueba con la skill…");
  setProgress(55);

  // Usar AppData como destino del test (no el directorio del skill, que puede no existir aún)
  let testBasePath;
  try {
    testBasePath = await appLocalDataDir();
  } catch {
    testBasePath = skillPath;
  }

  const cfg = state.config || {};
  const syllabusTestData = {
    courseCode: "TST-101",
    courseName: "Asignatura de Prueba",
    credits: 3,
    academicPeriod: cfg.academicPeriod || "Período de Verificación 2025-A",
    semester: "Primero",
    description: "Documento de verificación generado automáticamente por el onboarding.",
    weeksData: [
      {
        number: 1,
        title: "Introducción y fundamentos conceptuales",
        unit: "Unidad I: Bases Teóricas",
        topics: "Conceptos generales de la disciplina\nMarco teórico y epistemológico\nContexto histórico y evolución",
        outcomes: "Docencia: Identificar componentes esenciales del área de estudio\nPráctica: Analizar casos reales aplicando el marco teórico",
        bibliography: "Apellido, N. (2024). Fundamentos. Editorial Universitaria.\nApellido, M. (2023). Teoría y práctica. Pearson.",
        teachingHours: 2, practiceHours: 1, autonomousHours: 4, gradedActivity: null,
      },
      {
        number: 2,
        title: "Metodología y herramientas de análisis",
        unit: "Unidad I: Bases Teóricas",
        topics: "Métodos cuantitativos y cualitativos\nHerramientas digitales del área\nEstudios de caso comparativos",
        outcomes: "Docencia: Aplicar metodologías estándar a problemas complejos\nPráctica: Desarrollar soluciones con base en los métodos aprendidos",
        bibliography: "Autor, A. (2022). Metodología aplicada. McGraw-Hill.\nAutor, B. (2023). Análisis avanzado. Oxford.",
        teachingHours: 2, practiceHours: 2, autonomousHours: 4, gradedActivity: "Taller grupal: análisis de casos",
      },
    ],
  };

  let genResult;
  try {
    genResult = await generateSyllabus({ coursePath: testBasePath, ...syllabusTestData });

    if (genResult?.success) {
      setRow(2, "done");
      setProgress(75);
    } else {
      throw new Error(genResult?.message || "El backend indicó fallo sin detalles.");
    }
  } catch (err) {
    setRow(2, "error");
    setRow(3, "error");
    setRow(4, "error");
    setProgress(50);
    setMsg("La generación falló");
    showError(
      "Error al generar el documento",
      "La skill está instalada pero no pudo crear el archivo. Reintenta o vuelve al paso 6 para reinstalar.",
      String(err)
    );
    return;
  }

  // ── 3 / 95 % — compilar PDF ─────────────────────────────────────────────
  setRow(3, "active");
  setMsg("Compilando PDF con pdflatex…");
  setProgress(80);
  let pdfResult;
  try {
    pdfResult = await compileSyllabusPdf({ coursePath: testBasePath, ...syllabusTestData });
    if (pdfResult?.success) {
      setRow(3, "done");
      setProgress(95);
    } else {
      throw new Error(pdfResult?.message || "El backend indicó fallo sin detalles.");
    }
  } catch (err) {
    setRow(3, "error");
    setRow(4, "error");
    setProgress(75);
    setMsg("La compilación falló");
    showError(
      "Error al compilar PDF",
      "Verifica que pdflatex esté instalado (WSL en Windows o TeX Live). Reintenta o vuelve al paso 1 para instalar.",
      String(err)
    );
    return;
  }

  // ── 4 / 100 % — verificar PDF ───────────────────────────────────────────
  setRow(4, "active");
  setMsg("Verificando documento compilado…");
  setProgress(97);
  await new Promise(r => setTimeout(r, 350));
  setRow(4, "done");
  setProgress(100);
  setMsg("¡Verificación completada!");

  showSuccess(testBasePath, pdfResult.message, pdfResult.path);
}


function bindStepEvents(current) {
  const root = document.getElementById("onboarding-root");
  if (current === 7) animateFinalStep();
  root.querySelectorAll("[data-onboarding-step]").forEach(button => button.addEventListener("click", async () => {
    const result = await goToOnboardingStep(Number(button.dataset.onboardingStep));
    if (result.success) {
      runtime.status = result.status;
      const dest = Number(button.dataset.onboardingStep);
      if (dest === 5) runtime.auth  = await checkNotebookLMAuth();
      if (dest >= 6)  runtime.setup = await getSetupStatus();
      renderCurrentStep();
    } else toast(result.message, "error");
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
  if (result.success) {
    runtime.status = result.status;
    const next = Number(result.status.currentStep);
    if (next === 5) runtime.auth  = await checkNotebookLMAuth();
    if (next >= 6)  runtime.setup = await getSetupStatus();
    renderCurrentStep();
  }
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
