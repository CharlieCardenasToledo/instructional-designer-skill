import {
  applyInstitutionConfig, checkDependencies, installDependency,
  configureMcp, getSetupStatus, checkNotebookLMAuth, runNotebookLMAuth,
  installSkill, exportSkillZip, pickDirectory, saveNotebooksConfig,
  resetOnboarding, getSkillPath, extractSitePalette
} from "../api.js";
import { state, getNotebooks, saveNotebooks } from "../state.js";
import { escapeHtml } from "../dom.js";
import { toast } from "../toast.js";
import { refreshIcons } from "../icons.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, cx } from "../uiClasses.js";

// "Instalar herramientas necesarias" solo cubre lo indispensable para
// producir el PDF; Git queda fuera aunque aparezca en la lista de abajo.
const BULK_INSTALL_TARGETS = new Set(["Node.js", "Python", "Compilador LaTeX"]);

// Convierte ecosystem a string independientemente de si es array o string
function ecosystemToStr(val) {
  if (Array.isArray(val)) return val.join("\n");
  if (typeof val === "string") return val;
  return "";
}

export async function renderSettings() {
  const el = document.getElementById("p-settings");
  if (!el) return;

  el.innerHTML = `
    <div class="mb-5">
      <h2 class="text-[22px] font-extrabold tracking-tight text-app-text">Configuración</h2>
      <p class="mt-1 text-[13px] text-app-muted">Ajustes institucionales, conexiones, notebooks, entorno y preferencias.</p>
    </div>
    <div class="settings-layout grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">

      <!-- Left nav -->
      <div class="sticky top-0 z-10 self-start">
        <div class="rounded-app border border-slate-900/10 bg-white/55 p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible backdrop-blur-xl">
          <a class="settings-nav-item active w-auto shrink-0 lg:w-full" data-section="inst-profile" href="#inst-profile">
            <span class="material-symbols-outlined">domain</span> Perfil institucional
          </a>
          <a class="settings-nav-item w-auto shrink-0 lg:w-full" data-section="mcp-config" href="#mcp-config">
            <span class="material-symbols-outlined">hub</span> Conexiones
          </a>
          <a class="settings-nav-item w-auto shrink-0 lg:w-full" data-section="notebooks-section" href="#notebooks-section">
            <span class="material-symbols-outlined">menu_book</span> Notebooks
          </a>
          <a class="settings-nav-item w-auto shrink-0 lg:w-full" data-section="environment" href="#environment">
            <span class="material-symbols-outlined">terminal</span> Entorno
          </a>
          <a class="settings-nav-item w-auto shrink-0 lg:w-full" data-section="app-prefs" href="#app-prefs">
            <span class="material-symbols-outlined">tune</span> Preferencias
          </a>
        </div>
      </div>

      <!-- Right panes -->
      <div class="settings-panes">


        <!-- ── Institutional Profile ── -->
        <section class="settings-pane" id="inst-profile">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">domain</span> Perfil institucional
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="cfg-author">Nombre completo *</label>
              <input id="cfg-author" placeholder="Ej: Charlie Cárdenas Toledo" autocomplete="name"
                value="${escapeHtml(state.config?.author || "")}">
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="cfg-degree">Grado académico</label>
              <select id="cfg-degree">
                ${["","Lic.","Ing.","Arq.","Mg.","M.Sc.","MBA","Esp.","Ph.D.","Dr.","Prof."]
                  .map(v => `<option value="${v}"${state.config?.degree === v ? " selected" : ""}>${v || "Seleccionar grado…"}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="cfg-institution">Institución *</label>
              <input id="cfg-institution" placeholder="Ej: Universidad Internacional del Ecuador"
                value="${escapeHtml(state.config?.institution || "")}">
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="cfg-faculty">Facultad</label>
              <input id="cfg-faculty" placeholder="Ej: Facultad de Ingeniería"
                value="${escapeHtml(state.config?.faculty || "")}">
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="cfg-career">Carrera</label>
              <input id="cfg-career" placeholder="Ej: Ingeniería en Sistemas"
                value="${escapeHtml(state.config?.career || "")}">
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="cfg-color">Color institucional</label>
              <div class="color-picker-row">
                <input id="cfg-color" type="color" value="${escapeHtml(state.config?.color || "#00317e")}">
                <span class="color-picker-preview" id="cfg-color-preview" style="background:${escapeHtml(state.config?.color || "#00317e")}" aria-hidden="true"></span>
                <span class="color-picker-label" id="cfg-color-label">${escapeHtml(state.config?.color || "#00317e")}</span>
              </div>
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="cfg-website">Sitio web institucional</label>
              <div class="palette-url-row">
                <input id="cfg-website" type="url" placeholder="https://www.uide.edu.ec/"
                  value="${escapeHtml(state.config?.website || "")}">
                <button class="${cx(ui.button.base, ui.button.secondary)}" id="btn-extract-palette" type="button">
                  <span class="material-symbols-outlined text-[15px]">palette</span>
                  Extraer paleta
                </button>
              </div>
              <div class="text-muted mt-1.5 text-[11.5px]">
                Analiza el HTML y las hojas de estilo públicas del sitio.
              </div>
            </div>
            <div id="institution-palette" class="institution-palette sm:col-span-2" aria-live="polite"></div>
          </div>
          <div class="flex flex-col gap-1.5 mb-4">
            <label for="cfg-ecosystem">Ecosistema digital <span class="text-muted">(uno por línea)</span></label>
            <textarea id="cfg-ecosystem" placeholder="Canvas LMS&#10;Sistema académico">${escapeHtml(ecosystemToStr(state.config?.ecosystem))}</textarea>
          </div>
          <div class="row-end">
            <button class="${cx(ui.button.base, ui.button.primary)}" id="btn-save-institution">
              <span class="material-symbols-outlined text-[15px]">save</span> Guardar perfil
            </button>
          </div>
          <div id="institution-inline-error" class="inline-error" role="alert" hidden></div>
        </section>

        <!-- ── Conexiones ── -->
        <section class="settings-pane" id="mcp-config">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">hub</span> Conexiones
            <span id="mcp-status-badge" class="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-300/50 bg-slate-200/20 px-2.5 py-0.5 text-[11px] font-bold text-app-muted">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-current"></span> Verificando…
            </span>
          </div>
            <div class="flex flex-col gap-3.5">

            <!-- Target buttons -->
            <div>
              <div class="mb-2 text-[11.5px] font-semibold text-app-muted">Conectar con:</div>
              <div class="flex flex-wrap gap-2">
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} mcp-target" data-target="claude-code">
                  <span class="material-symbols-outlined text-sm">terminal</span> Proyecto local
                </button>
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} mcp-target" data-target="desktop">
                  <span class="material-symbols-outlined text-sm">group</span> App de Claude
                </button>
                <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)} mcp-target" data-target="both">
                  <span class="material-symbols-outlined text-sm">hub</span> Ambos
                </button>
              </div>
            </div>
            <div id="mcp-inline-error" class="inline-error" role="alert" hidden></div>

            <div class="info-box flex items-start gap-2">
              <span class="material-symbols-outlined mt-px shrink-0 text-[15px]">info</span>
              <span>Combina la conexión de NotebookLM con tu configuración existente y guarda un respaldo automático.</span>
            </div>

            <!-- NotebookLM Auth row -->
            <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-300/50 bg-white/60 px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Sesión de Google</div>
                <div id="nlm-auth-status" class="mt-0.5 text-xs text-app-muted">Verificando…</div>
              </div>
              <div class="flex gap-2">
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="btn-verify-nlm">
                  <span class="material-symbols-outlined text-sm">refresh</span> Verificar
                </button>
                <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-auth-nlm">
                  <span class="material-symbols-outlined text-sm">key</span> Iniciar sesión
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Notebooks ── -->
        <section class="settings-pane" id="notebooks-section">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">menu_book</span> Notebooks de NotebookLM
            <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'ml-auto')}" id="btn-save-notebooks">
              <span class="material-symbols-outlined text-sm">save</span> Guardar registro
            </button>
          </div>

          <!-- Notebook list -->
          <div id="notebook-list" class="mb-3.5 flex flex-col gap-1.5"></div>

          <!-- Add notebook form -->
          <div class="rounded-app border border-slate-900/10 bg-white/55 p-3.5 backdrop-blur-xl">
            <div class="mb-2.5 text-xs font-bold uppercase tracking-wider text-app-muted">
              Registrar notebook
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              <div class="flex flex-col gap-1.5">
                <label for="nb-code">Código *</label>
                <input id="nb-code" placeholder="IFT200">
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="nb-course-name">Asignatura *</label>
                <input id="nb-course-name" placeholder="Interacción Persona Computador">
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="nb-root">Carpeta raíz *</label>
                <input id="nb-root" placeholder="01 IFT200">
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="nb-id">Notebook ID <span class="text-muted">(opcional)</span></label>
                <input id="nb-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono">
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label for="nb-url">URL de compartir <span class="text-muted">(opcional)</span></label>
                <input id="nb-url" placeholder="https://notebooklm.google.com/notebook/…">
              </div>
            </div>
            <div class="row-end">
              <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-add-notebook">
                <span class="material-symbols-outlined text-sm">add</span> Registrar
              </button>
            </div>
          </div>

          <div class="text-muted mt-3 text-[11.5px]">
            El Notebook ID se encuentra en la URL: <code>notebooklm.google.com/notebook/<strong>ID</strong></code>
          </div>
          <div id="notebooks-inline-error" class="inline-error" role="alert" hidden></div>
        </section>

        <!-- ── Environment ── -->
        <section class="settings-pane" id="environment">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">terminal</span> Entorno del sistema
            <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'ml-auto')}" id="btn-refresh-deps">
              <span class="material-symbols-outlined text-sm">refresh</span> Recargar
            </button>
          </div>

          <!-- Setup status summary -->
          <div id="setup-status-bar" class="mb-3"></div>

          <!-- Deps list -->
          <div id="deps-content" class="flex flex-col gap-2">
            <div class="p-6 text-center text-slate-400">Cargando…</div>
          </div>
          <div id="deps-inline-error" class="inline-error" role="alert" hidden></div>
        </section>

        <!-- ── Preferencias ── -->
        <section class="settings-pane" id="app-prefs">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">tune</span> Preferencias
          </div>

          <!-- Skill path -->
          <div class="mb-3.5 rounded-lg border border-slate-300/50 bg-white/60 px-3.5 py-3">
            <div class="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-app-muted">Carpeta de instalación</div>
            <div id="skill-path-val" class="mono break-all text-[12.5px] text-brand">Cargando…</div>
          </div>

          <div class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between rounded-lg border border-slate-300/50 bg-white/60 px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Instalar en el proyecto local</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Copia los archivos a <code>~/.claude/skills/</code></div>
              </div>
              <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-install-skill">
                <span class="material-symbols-outlined text-sm">download</span> Instalar
              </button>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-300/50 bg-white/60 px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Exportar configuración</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Para instalar manualmente en la app de Claude</div>
              </div>
              <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="btn-export-skill">
                <span class="material-symbols-outlined text-sm">archive</span> Exportar ZIP
              </button>
            </div>
            <div class="rounded-lg border border-red-200 bg-red-50/40 px-3.5 py-3">
              <div class="mb-1.5 text-[13px] font-semibold text-app-text">Reiniciar configuración</div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-xs text-app-muted">Perderás el progreso configurado y volverás a empezar desde el primer paso.</div>
                <button class="${cx(ui.button.base, ui.button.danger, ui.button.sm)}" id="btn-reset-onboarding">
                  <span class="material-symbols-outlined text-sm">restart_alt</span> Reiniciar
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>`;

  // ── Bind section nav ──────────────────────────────────────────────────────
  el.querySelectorAll(".settings-nav-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      el.querySelectorAll(".settings-nav-item").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
      document.getElementById(a.dataset.section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ── Institution ───────────────────────────────────────────────────────────
  el.querySelector("#cfg-color")?.addEventListener("input", e => {
    document.getElementById("cfg-color-label").textContent = e.target.value;
    const preview = document.getElementById("cfg-color-preview");
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value) && preview) preview.style.background = e.target.value;
  });
  el.querySelector("#btn-save-institution")?.addEventListener("click", saveInstitution);
  el.querySelector("#btn-extract-palette")?.addEventListener("click", loadInstitutionPalette);

  // ── Conexiones ────────────────────────────────────────────────────────────
  el.querySelectorAll(".mcp-target").forEach(btn => {
    btn.addEventListener("click", async () => {
      setInlineError("mcp-inline-error", "");
      toast("Conectando…", "loading", 8000);
      try {
        if (btn.dataset.target === "both") {
          const codeResult = await configureMcp("claude-code");
          const desktopResult = await configureMcp("desktop");
          const success = codeResult.success && desktopResult.success;
          if (!success) setInlineError("mcp-inline-error", `${codeResult.message} / ${desktopResult.message}`);
          toast(success ? "Conectado en proyecto local y app de Claude" : `${codeResult.message} / ${desktopResult.message}`, success ? "success" : "error", 6000);
        } else {
          const result = await configureMcp(btn.dataset.target);
          if (!result.success) setInlineError("mcp-inline-error", result.message);
          toast(result.message, result.success ? "success" : "error", 6000);
        }
      } catch (e) { toast(`Error: ${e}`, "error"); }
    });
  });

  el.querySelector("#btn-verify-nlm")?.addEventListener("click", verifyNlmAuth);
  el.querySelector("#btn-auth-nlm")?.addEventListener("click", runNlmAuth);
  verifyNlmAuth();
  loadMcpStatus();

  // ── Notebooks ─────────────────────────────────────────────────────────────
  renderNotebookList();
  el.querySelector("#btn-add-notebook")?.addEventListener("click", addNotebook);
  el.querySelector("#btn-save-notebooks")?.addEventListener("click", persistNotebooks);

  // ── Environment ───────────────────────────────────────────────────────────
  el.querySelector("#btn-refresh-deps")?.addEventListener("click", loadDeps);
  loadSetupStatus();
  loadDeps();

  // ── App Preferences ───────────────────────────────────────────────────────
  loadSkillPath();

  el.querySelector("#btn-install-skill")?.addEventListener("click", async () => {
    toast("Instalando en tu proyecto local…", "loading", 20000);
    try {
      const r = await installSkill();
      toast(r.message, r.success ? "success" : "error", 6000);
      if (r.success) loadSkillPath();
    } catch (e) { toast(`Error: ${e}`, "error"); }
  });

  el.querySelector("#btn-export-skill")?.addEventListener("click", async () => {
    const dir = await pickDirectory("Selecciona el directorio de destino");
    if (!dir) return;
    toast("Exportando ZIP…", "loading", 15000);
    try { const r = await exportSkillZip(dir); toast(r.message, r.success ? "success" : "error", 6000); }
    catch (e) { toast(`Error: ${e}`, "error"); }
  });

  el.querySelector("#btn-reset-onboarding")?.addEventListener("click", async () => {
    if (!await confirm("¿Reiniciar el onboarding? Perderás el progreso configurado.")) return;
    try {
      const r = await resetOnboarding();
      toast(r.message || "Onboarding reiniciado", "info", 4000);
    } catch (e) { toast(`Error: ${e}`, "error"); }
  });

  refreshIcons();
}

// ── Institution ───────────────────────────────────────────────────────────────
async function saveInstitution() {
  setInlineError("institution-inline-error", "");
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const author      = get("cfg-author");
  const institution = get("cfg-institution");
  if (!author)      { setInlineError("institution-inline-error", "Nombre completo obligatorio"); return; }
  if (!institution) { setInlineError("institution-inline-error", "Institución obligatoria"); return; }

  const color = document.getElementById("cfg-color")?.value || "#00317e";
  const { r, g, b } = hexToRgb(color);
  const config = {
    author,
    degree:      get("cfg-degree"),
    institution,
    faculty:     get("cfg-faculty"),
    career:      get("cfg-career"),
    color,
    website:     get("cfg-website"),
    ecosystem:   get("cfg-ecosystem").split("\n").map(s => s.trim()).filter(Boolean),
  };
  toast("Guardando configuración institucional…", "loading", 8000);
  try {
    const result = await applyInstitutionConfig({
      author: config.author,
      degree: config.degree,
      institution: config.institution,
      website: config.website,
      faculty: config.faculty,
      career: config.career,
      color_r: r,
      color_g: g,
      color_b: b,
      ecosystem: config.ecosystem.join("\n"),
    });
    if (result.success) {
      if (!state.config) state.config = {};
      Object.assign(state.config, config);
      toast("Configuración guardada", "success", 4000);
    } else {
      setInlineError("institution-inline-error", result.message);
      toast(result.message, "error");
    }
  } catch (e) { setInlineError("institution-inline-error", `Error: ${e}`); toast(`Error: ${e}`, "error"); }
}

function setInlineError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

async function loadInstitutionPalette() {
  const urlInput = document.getElementById("cfg-website");
  const container = document.getElementById("institution-palette");
  const button = document.getElementById("btn-extract-palette");
  if (!urlInput || !container || !button) return;

  const url = urlInput.value.trim();
  if (!url) {
    toast("Escribe la URL del sitio institucional", "error");
    urlInput.focus();
    return;
  }

  button.disabled = true;
  container.innerHTML = `<div class="palette-loading"><span class="material-symbols-outlined">progress_activity</span> Analizando sitio y hojas de estilo…</div>`;
  try {
    const result = await extractSitePalette(url);
    if (!state.config) state.config = {};
    state.config.website = url;
    saveLocalConfig();
    renderPalette(container, result.colors);
    if (result.site_name && !document.getElementById("cfg-institution")?.value.trim()) {
      document.getElementById("cfg-institution").value = result.site_name;
    }
    toast(`Paleta extraída: ${result.colors.length} colores`, "success", 3500);
  } catch (error) {
    container.innerHTML = `<div class="palette-error">${escapeHtml(String(error))}</div>`;
    toast(`No se pudo extraer la paleta: ${error}`, "error", 6000);
  } finally {
    button.disabled = false;
  }
}

function renderPalette(container, palette) {
  container.innerHTML = `
    <div class="palette-heading">
      <span>Colores encontrados</span>
      <span class="text-muted">Selecciona uno para usarlo como color institucional</span>
    </div>
    <div class="palette-grid">
      ${palette.map(({ color, occurrences }) => `
        <button class="palette-swatch" type="button" data-palette-color="${escapeHtml(color)}"
          title="Usar ${escapeHtml(color)}">
          <span class="palette-swatch-color" style="background:${escapeHtml(color)}"></span>
          <span class="palette-swatch-meta">
            <code>${escapeHtml(color)}</code>
            <small>${occurrences} ${occurrences === 1 ? "aparición" : "apariciones"}</small>
          </span>
        </button>`).join("")}
    </div>`;

  container.querySelectorAll("[data-palette-color]").forEach(button => {
    button.addEventListener("click", () => {
      const hex = cssColorToHex(button.dataset.paletteColor);
      if (!hex) {
        toast("El navegador no pudo convertir este color a RGB", "error");
        return;
      }
      const picker = document.getElementById("cfg-color");
      const label = document.getElementById("cfg-color-label");
      if (picker) picker.value = hex;
      if (label) label.textContent = hex;
      if (!state.config) state.config = {};
      state.config.color = hex;
      saveLocalConfig();
      container.querySelectorAll(".palette-swatch").forEach(item => item.classList.remove("selected"));
      button.classList.add("selected");
      toast(`Color institucional actualizado a ${hex}`, "success", 2500);
    });
  });
}

function cssColorToHex(color) {
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = color;
  if (!probe.style.color) return null;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = computed.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!match) return null;
  return `#${[match[1], match[2], match[3]]
    .map(value => Number(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex) {
  const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
    : { r: 0, g: 49, b: 126 };
}

function saveLocalConfig() {
  localStorage.setItem("ids_config", JSON.stringify(state.config));
}

// ── MCP ───────────────────────────────────────────────────────────────────────
async function loadMcpStatus() {
  const badge = document.getElementById("mcp-status-badge");
  if (!badge) return;
  try {
    const status = await getSetupStatus();
    const mcpOk = status.mcp_configured;
    badge.style.background = mcpOk ? "rgba(26,127,75,0.08)" : "rgba(186,26,26,0.08)";
    badge.style.color      = mcpOk ? "var(--green)"          : "var(--red)";
    badge.style.border     = mcpOk ? "1px solid rgba(26,127,75,0.20)" : "1px solid rgba(186,26,26,0.20)";
    badge.innerHTML = `<span class="inline-block h-1.5 w-1.5 rounded-full bg-current"></span> ${mcpOk ? "Configurado" : "Sin configurar"}`;
  } catch {
    badge.textContent = "—";
  }
}

async function verifyNlmAuth() {
  const statusEl = document.getElementById("nlm-auth-status");
  if (statusEl) statusEl.textContent = "Verificando…";
  try {
    const status = await checkNotebookLMAuth();
    if (statusEl) {
      statusEl.textContent = status.authenticated
        ? `✓ Sesión activa — ${status.email || "cuenta Google"}`
        : "⚠ Sin sesión activa. El skill no podrá consultar NotebookLM.";
      statusEl.style.color = status.authenticated ? "var(--green)" : "var(--yellow)";
    }
  } catch {
    if (statusEl) { statusEl.textContent = "Error al verificar sesión"; statusEl.style.color = "var(--red)"; }
  }
}

async function runNlmAuth() {
  toast("Abriendo Chrome para autenticación…", "loading", 30000);
  try {
    const r = await runNotebookLMAuth();
    toast(r.message, r.success ? "success" : "error", 6000);
    if (r.success) verifyNlmAuth();
  } catch (e) { toast(`Error: ${e}`, "error"); }
}

// ── Notebooks ─────────────────────────────────────────────────────────────────
function renderNotebookList() {
  const list = document.getElementById("notebook-list");
  if (!list) return;
  const notebooks = getNotebooks();
  if (!notebooks.length) {
    list.innerHTML = `<div class="empty-state py-4">Sin notebooks registrados aún.</div>`;
    return;
  }
  list.innerHTML = notebooks.map((nb, i) => `
    <div class="${ui.list.item}">
      <div class="${ui.list.left}">
        <span class="material-symbols-outlined text-lg text-brand">menu_book</span>
        <div>
          <div class="${ui.list.label}">${escapeHtml(nb.code)} — ${escapeHtml(nb.courseName)}</div>
          <div class="${ui.list.sub}">${escapeHtml(nb.root)}${nb.notebookId ? ` · ID: ${escapeHtml(nb.notebookId.slice(0,8))}…` : ""}</div>
        </div>
      </div>
      <div class="${ui.list.right}">
        <button class="${cx(ui.button.base, ui.button.danger, ui.button.xs)}" data-nb-delete="${i}" title="Eliminar notebook">
          <span class="material-symbols-outlined text-[13px]">delete</span>
        </button>
      </div>
    </div>`).join("");

  list.querySelectorAll("[data-nb-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const nbs = getNotebooks();
      nbs.splice(Number(btn.dataset.nbDelete), 1);
      saveNotebooks(nbs);
      renderNotebookList();
    });
  });
}

function addNotebook() {
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const code       = get("nb-code");
  const courseName = get("nb-course-name");
  const root       = get("nb-root");
  if (!code || !courseName || !root) {
    toast("Código, asignatura y carpeta raíz son obligatorios", "error"); return;
  }
  const nbs = getNotebooks();
  nbs.push({ code, courseName, root, notebookId: get("nb-id"), url: get("nb-url") });
  saveNotebooks(nbs);
  ["nb-code","nb-course-name","nb-root","nb-id","nb-url"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderNotebookList();
  toast(`Notebook ${code} registrado`, "success");
}

async function persistNotebooks() {
  const nbs = getNotebooks();
  toast("Guardando notebooks en el backend…", "loading", 8000);
  try {
    const result = await saveNotebooksConfig(nbs);
    toast(result.message, result.success ? "success" : "error", 5000);
  } catch (e) { toast(`Error: ${e}`, "error"); }
}

// ── Environment ───────────────────────────────────────────────────────────────
async function loadSetupStatus() {
  const bar = document.getElementById("setup-status-bar");
  if (!bar) return;
  try {
    const status = await getSetupStatus();
    const items = [
      { label: "Instalado localmente", ok: status.skill_installed },
      { label: "Conexión lista",       ok: status.mcp_configured },
      { label: "Institución guardada", ok: status.institution_configured },
      { label: "Sesión de Google",     ok: status.notebooklm_authenticated },
    ].filter(i => i.label);

    bar.innerHTML = `
      <div class="mb-3 flex flex-wrap gap-2">
        ${items.map(({ label, ok }) => `
          <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${ok ? "border-green-200 bg-green-50 text-green-600" : "border-red-200 bg-red-50 text-red-500"}">
            <span class="material-symbols-outlined text-sm">${ok ? "check_circle" : "cancel"}</span>
            ${escapeHtml(label)}
          </span>`).join("")}
      </div>`;
  } catch {
    bar.innerHTML = "";
  }
}

async function loadDeps() {
  const container = document.getElementById("deps-content");
  if (!container) return;
  container.innerHTML = `<div class="p-6 text-center text-slate-400">Cargando…</div>`;

  try {
    const deps  = await checkDependencies();
    const ok    = deps.filter(d => d.installed).length;
    const total = deps.length;
    const pct   = total > 0 ? Math.round((ok / total) * 100) : 0;

    container.innerHTML = `
      <div class="mb-3 flex items-center gap-3">
        <span class="text-2xl font-extrabold text-brand">${ok}</span>
        <div>
          <div class="text-[13px] font-semibold text-app-text">de ${total} dependencias instaladas</div>
          <div class="progress-track mt-1 w-[180px]">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm, 'ml-auto')}" id="btn-install-all-deps">
            <span class="material-symbols-outlined text-sm">download</span> Instalar herramientas necesarias
        </button>
      </div>
      ${deps.map(dep => `
        <div class="${ui.list.item} mb-1.5">
          <div class="${ui.list.left}">
            <div class="dot ${dep.installed ? "dot-ok" : "dot-err"}"></div>
            <div>
              <div class="${ui.list.label}">${escapeHtml(dep.name)}</div>
              <div class="${ui.list.sub}">${escapeHtml(dep.version || (dep.installed ? "Instalado" : "No instalado"))}</div>
            </div>
          </div>
          <div class="${ui.list.right}">
            ${!dep.installed
              ? `<button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-dep-name="${escapeHtml(dep.name)}">Instalar</button>`
              : `<span class="${ui.badge.success}">OK</span>`}
          </div>
        </div>`).join("")}`;

    container.querySelectorAll("[data-dep-name]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.depName;
        if (!await confirm(`Vamos a instalar ${name} en tu sistema. ¿Continuar?`)) return;
        toast(`Instalando ${name}…`, "loading", 30000);
        try {
          const r = await installDependency(name, true);
          toast(r.message, r.success ? "success" : "error", 6000);
          if (r.success) { loadDeps(); loadSetupStatus(); }
        } catch (e) { toast(`Error: ${e}`, "error"); }
      });
    });

    container.querySelector("#btn-install-all-deps")?.addEventListener("click", async () => {
      // Solo las herramientas necesarias para producir el PDF: nunca instala
      // Git aunque falte (es opcional, no lo pide este flujo simplificado).
      const targets = deps.filter(d => !d.installed && BULK_INSTALL_TARGETS.has(d.name));
      if (targets.length === 0) {
        toast("Las herramientas necesarias ya están instaladas.", "info", 3500);
        return;
      }
      const names = targets.map(d => d.name).join(", ");
      if (!await confirm(`Se instalarán las herramientas necesarias para generar tus guías: ${names}. Esto puede tardar varios minutos. ¿Continuar?`)) return;
      for (const dep of targets) {
        toast(`Instalando ${dep.name}…`, "loading", 30000);
        try {
          const r = await installDependency(dep.name, true);
          toast(r.message, r.success ? "success" : "error", 4000);
        } catch (e) { toast(`Error en ${dep.name}: ${e}`, "error"); }
      }
      loadDeps(); loadSetupStatus();
    });

  } catch (e) {
    container.innerHTML = `<div class="p-5 text-red-500">Error al cargar: ${escapeHtml(String(e))}</div>`;
  }
}

// ── App Preferences ───────────────────────────────────────────────────────────
async function loadSkillPath() {
  const el = document.getElementById("skill-path-val");
  if (!el) return;
  try {
    const path = await getSkillPath();
    el.textContent = path || "No instalado";
    el.style.color = path ? "var(--teal)" : "var(--red)";
  } catch {
    el.textContent = "No disponible";
    el.style.color = "var(--muted)";
  }
}
