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
    <div style="margin-bottom:20px">
      <h2 style="font-size:22px;font-weight:800;color:var(--text);letter-spacing:-0.03em">Configuración</h2>
      <p style="font-size:13px;color:var(--muted);margin-top:4px">Ajustes institucionales, MCP, notebooks, entorno y preferencias.</p>
    </div>
    <div class="settings-layout">

      <!-- Left nav -->
      <div>
        <div class="glass-pane" style="padding:8px;position:sticky;top:0">
          <a class="settings-nav-item active" data-section="inst-profile" href="#inst-profile">
            <span class="material-symbols-outlined">domain</span> Perfil institucional
          </a>
          <a class="settings-nav-item" data-section="mcp-config" href="#mcp-config">
            <span class="material-symbols-outlined">hub</span> Configuración MCP
          </a>
          <a class="settings-nav-item" data-section="notebooks-section" href="#notebooks-section">
            <span class="material-symbols-outlined">menu_book</span> Notebooks
          </a>
          <a class="settings-nav-item" data-section="environment" href="#environment">
            <span class="material-symbols-outlined">terminal</span> Entorno
          </a>
          <a class="settings-nav-item" data-section="app-prefs" href="#app-prefs">
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
          <div class="form-grid" style="margin-bottom:16px">
            <div class="form-group" style="grid-column:1/-1">
              <label for="cfg-author">Nombre completo *</label>
              <input id="cfg-author" placeholder="Ej: Charlie Cárdenas Toledo" autocomplete="name"
                value="${escapeHtml(state.config?.author || "")}">
            </div>
            <div class="form-group">
              <label for="cfg-degree">Grado académico</label>
              <select id="cfg-degree">
                ${["","Lic.","Ing.","Arq.","Mg.","M.Sc.","MBA","Esp.","Ph.D.","Dr.","Prof."]
                  .map(v => `<option value="${v}"${state.config?.degree === v ? " selected" : ""}>${v || "Seleccionar grado…"}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="form-group">
              <label for="cfg-institution">Institución *</label>
              <input id="cfg-institution" placeholder="Ej: Universidad Internacional del Ecuador"
                value="${escapeHtml(state.config?.institution || "")}">
            </div>
            <div class="form-group">
              <label for="cfg-faculty">Facultad</label>
              <input id="cfg-faculty" placeholder="Ej: Facultad de Ingeniería"
                value="${escapeHtml(state.config?.faculty || "")}">
            </div>
            <div class="form-group">
              <label for="cfg-career">Carrera</label>
              <input id="cfg-career" placeholder="Ej: Ingeniería en Sistemas"
                value="${escapeHtml(state.config?.career || "")}">
            </div>
            <div class="form-group">
              <label for="cfg-color">Color institucional</label>
              <div class="color-picker-row">
                <input id="cfg-color" type="color" value="${escapeHtml(state.config?.color || "#00317e")}">
                <span class="color-picker-label" id="cfg-color-label">${escapeHtml(state.config?.color || "#00317e")}</span>
              </div>
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label for="cfg-website">Sitio web institucional</label>
              <div class="palette-url-row">
                <input id="cfg-website" type="url" placeholder="https://www.uide.edu.ec/"
                  value="${escapeHtml(state.config?.website || "")}">
                <button class="btn btn-secondary" id="btn-extract-palette" type="button">
                  <span class="material-symbols-outlined" style="font-size:15px">palette</span>
                  Extraer paleta
                </button>
              </div>
              <div class="text-muted" style="font-size:11.5px;margin-top:6px">
                Analiza el HTML y las hojas de estilo públicas del sitio.
              </div>
            </div>
            <div id="institution-palette" class="institution-palette" style="grid-column:1/-1" aria-live="polite"></div>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label for="cfg-ecosystem">Ecosistema digital <span class="text-muted">(uno por línea)</span></label>
            <textarea id="cfg-ecosystem" placeholder="Canvas LMS&#10;Sistema académico">${escapeHtml(ecosystemToStr(state.config?.ecosystem))}</textarea>
          </div>
          <div class="row-end">
            <button class="btn btn-primary" id="btn-save-institution">
              <span class="material-symbols-outlined" style="font-size:15px">save</span> Guardar perfil
            </button>
          </div>
        </section>

        <!-- ── MCP Configuration ── -->
        <section class="settings-pane" id="mcp-config">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">hub</span> Configuración MCP
            <span id="mcp-status-badge" style="margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:rgba(195,198,213,0.20);color:var(--muted);border:1px solid rgba(195,198,213,0.40)">
              <span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span> Verificando…
            </span>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">

            <!-- Target buttons -->
            <div>
              <div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;font-weight:600">Configurar MCP para:</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm mcp-target" data-target="claude_code">
                  <span class="material-symbols-outlined" style="font-size:14px">terminal</span> Claude Code
                </button>
                <button class="btn btn-secondary btn-sm mcp-target" data-target="cowork">
                  <span class="material-symbols-outlined" style="font-size:14px">group</span> Cowork
                </button>
                <button class="btn btn-primary btn-sm mcp-target" data-target="all">
                  <span class="material-symbols-outlined" style="font-size:14px">hub</span> Ambos
                </button>
              </div>
            </div>

            <div class="info-box" style="display:flex;gap:8px;align-items:flex-start">
              <span class="material-symbols-outlined" style="font-size:15px;flex-shrink:0;margin-top:1px">info</span>
              <span>Combina la entrada oficial de NotebookLM MCP con tu configuración existente y guarda un respaldo automático.</span>
            </div>

            <!-- NotebookLM Auth row -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 14px;border:1px solid rgba(195,198,213,0.50);border-radius:9px;background:rgba(255,255,255,0.60)">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">Sesión Google (NotebookLM)</div>
                <div id="nlm-auth-status" style="font-size:12px;color:var(--muted);margin-top:3px">Verificando…</div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary btn-sm" id="btn-verify-nlm">
                  <span class="material-symbols-outlined" style="font-size:14px">refresh</span> Verificar
                </button>
                <button class="btn btn-primary btn-sm" id="btn-auth-nlm">
                  <span class="material-symbols-outlined" style="font-size:14px">key</span> Iniciar sesión
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Notebooks ── -->
        <section class="settings-pane" id="notebooks-section">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">menu_book</span> Notebooks de NotebookLM
            <button class="btn btn-secondary btn-sm" id="btn-save-notebooks" style="margin-left:auto">
              <span class="material-symbols-outlined" style="font-size:14px">save</span> Guardar registro
            </button>
          </div>

          <!-- Notebook list -->
          <div id="notebook-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>

          <!-- Add notebook form -->
          <div class="glass-pane" style="padding:14px">
            <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
              Registrar notebook
            </div>
            <div class="form-grid" style="margin-bottom:12px">
              <div class="form-group">
                <label for="nb-code">Código *</label>
                <input id="nb-code" placeholder="IFT200">
              </div>
              <div class="form-group">
                <label for="nb-course-name">Asignatura *</label>
                <input id="nb-course-name" placeholder="Interacción Persona Computador">
              </div>
              <div class="form-group">
                <label for="nb-root">Carpeta raíz *</label>
                <input id="nb-root" placeholder="01 IFT200">
              </div>
              <div class="form-group">
                <label for="nb-id">Notebook ID <span class="text-muted">(opcional)</span></label>
                <input id="nb-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono">
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label for="nb-url">URL de compartir <span class="text-muted">(opcional)</span></label>
                <input id="nb-url" placeholder="https://notebooklm.google.com/notebook/…">
              </div>
            </div>
            <div class="row-end">
              <button class="btn btn-primary btn-sm" id="btn-add-notebook">
                <span class="material-symbols-outlined" style="font-size:14px">add</span> Registrar
              </button>
            </div>
          </div>

          <div class="text-muted" style="margin-top:12px;font-size:11.5px">
            El Notebook ID se encuentra en la URL: <code>notebooklm.google.com/notebook/<strong>ID</strong></code>
          </div>
        </section>

        <!-- ── Environment ── -->
        <section class="settings-pane" id="environment">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">terminal</span> Entorno del sistema
            <button class="btn btn-secondary btn-sm" id="btn-refresh-deps" style="margin-left:auto">
              <span class="material-symbols-outlined" style="font-size:14px">refresh</span> Recargar
            </button>
          </div>

          <!-- Setup status summary -->
          <div id="setup-status-bar" style="margin-bottom:12px"></div>

          <!-- Deps list -->
          <div id="deps-content" style="display:flex;flex-direction:column;gap:8px">
            <div style="text-align:center;padding:24px;color:var(--dim)">Cargando…</div>
          </div>
        </section>

        <!-- ── App Preferences ── -->
        <section class="settings-pane" id="app-prefs">
          <div class="settings-pane-title">
            <span class="material-symbols-outlined">tune</span> Preferencias y skill
          </div>

          <!-- Skill path -->
          <div style="margin-bottom:14px;padding:12px 14px;border:1px solid rgba(195,198,213,0.50);border-radius:9px;background:rgba(255,255,255,0.60)">
            <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px">Ruta del skill</div>
            <div id="skill-path-val" class="mono" style="font-size:12.5px;color:var(--teal);word-break:break-all">Cargando…</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid rgba(195,198,213,0.50);border-radius:9px;background:rgba(255,255,255,0.60)">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">Instalar skill local (Claude Code)</div>
                <div style="font-size:11.5px;color:var(--muted);margin-top:2px">Copia el skill a <code>~/.claude/skills/</code></div>
              </div>
              <button class="btn btn-primary btn-sm" id="btn-install-skill">
                <span class="material-symbols-outlined" style="font-size:14px">download</span> Instalar
              </button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid rgba(195,198,213,0.50);border-radius:9px;background:rgba(255,255,255,0.60)">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">Exportar skill como ZIP</div>
                <div style="font-size:11.5px;color:var(--muted);margin-top:2px">Para subir en Customize → Skills</div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-export-skill">
                <span class="material-symbols-outlined" style="font-size:14px">archive</span> Exportar ZIP
              </button>
            </div>
            <div style="padding:12px 14px;border:1px solid rgba(186,26,26,0.20);border-radius:9px;background:rgba(186,26,26,0.04)">
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">Zona peligrosa</div>
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <div style="font-size:12px;color:var(--muted)">Reinicia el proceso de onboarding desde el principio.</div>
                <button class="btn btn-danger btn-sm" id="btn-reset-onboarding">
                  <span class="material-symbols-outlined" style="font-size:14px">restart_alt</span> Reiniciar onboarding
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
  });
  el.querySelector("#btn-save-institution")?.addEventListener("click", saveInstitution);
  el.querySelector("#btn-extract-palette")?.addEventListener("click", loadInstitutionPalette);

  // ── MCP ───────────────────────────────────────────────────────────────────
  el.querySelectorAll(".mcp-target").forEach(btn => {
    btn.addEventListener("click", async () => {
      toast("Configurando MCP…", "loading", 8000);
      try {
        const result = await configureMcp(btn.dataset.target);
        toast(result.message, result.success ? "success" : "error", 6000);
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
    toast("Instalando skill…", "loading", 20000);
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
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const author      = get("cfg-author");
  const institution = get("cfg-institution");
  if (!author)      { toast("Nombre completo obligatorio", "error"); return; }
  if (!institution) { toast("Institución obligatoria", "error"); return; }

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
      toast(result.message, "error");
    }
  } catch (e) { toast(`Error: ${e}`, "error"); }
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
    badge.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span> ${mcpOk ? "Configurado" : "Sin configurar"}`;
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
    list.innerHTML = `<div class="empty-state" style="padding:16px 0">Sin notebooks registrados aún.</div>`;
    return;
  }
  list.innerHTML = notebooks.map((nb, i) => `
    <div class="list-item">
      <div class="list-item-left">
        <span class="material-symbols-outlined" style="font-size:18px;color:var(--teal)">menu_book</span>
        <div>
          <div class="list-item-label">${escapeHtml(nb.code)} — ${escapeHtml(nb.courseName)}</div>
          <div class="list-item-sub">${escapeHtml(nb.root)}${nb.notebookId ? ` · ID: ${escapeHtml(nb.notebookId.slice(0,8))}…` : ""}</div>
        </div>
      </div>
      <div class="list-item-right">
        <button class="btn btn-danger btn-xs" data-nb-delete="${i}" title="Eliminar notebook">
          <span class="material-symbols-outlined" style="font-size:13px">delete</span>
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
      { label: "Skill instalado",    ok: status.skill_installed },
      { label: "MCP configurado",    ok: status.mcp_configured },
      { label: "Institución guardada", ok: status.institution_configured },
      { label: "Autenticación Google", ok: status.notebooklm_authenticated },
    ].filter(i => i.label);

    bar.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${items.map(({ label, ok }) => `
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:11.5px;font-weight:600;
            background:${ok ? "rgba(26,127,75,0.08)" : "rgba(186,26,26,0.06)"};
            color:${ok ? "var(--green)" : "var(--red)"};
            border:1px solid ${ok ? "rgba(26,127,75,0.20)" : "rgba(186,26,26,0.18)"}">
            <span class="material-symbols-outlined" style="font-size:14px">${ok ? "check_circle" : "cancel"}</span>
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
  container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--dim)">Cargando…</div>`;

  try {
    const deps  = await checkDependencies();
    const ok    = deps.filter(d => d.installed).length;
    const total = deps.length;
    const pct   = total > 0 ? Math.round((ok / total) * 100) : 0;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:var(--teal)">${ok}</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">de ${total} dependencias instaladas</div>
          <div class="progress-track" style="width:180px;margin-top:5px">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-install-all-deps" style="margin-left:auto">
          <span class="material-symbols-outlined" style="font-size:14px">download</span> Instalar todo
        </button>
      </div>
      ${deps.map(dep => `
        <div class="list-item" style="margin-bottom:6px">
          <div class="list-item-left">
            <div class="dot ${dep.installed ? "dot-ok" : "dot-err"}"></div>
            <div>
              <div class="list-item-label">${escapeHtml(dep.name)}</div>
              <div class="list-item-sub">${escapeHtml(dep.version || (dep.installed ? "Instalado" : "No instalado"))}</div>
            </div>
          </div>
          <div class="list-item-right">
            ${!dep.installed
              ? `<button class="btn btn-secondary btn-sm" data-dep-name="${escapeHtml(dep.name)}">Instalar</button>`
              : `<span class="badge badge-success">OK</span>`}
          </div>
        </div>`).join("")}`;

    container.querySelectorAll("[data-dep-name]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.depName;
        toast(`Instalando ${name}…`, "loading", 30000);
        try {
          const r = await installDependency(name, true);
          toast(r.message, r.success ? "success" : "error", 6000);
          if (r.success) { loadDeps(); loadSetupStatus(); }
        } catch (e) { toast(`Error: ${e}`, "error"); }
      });
    });

    container.querySelector("#btn-install-all-deps")?.addEventListener("click", async () => {
      for (const dep of deps.filter(d => !d.installed)) {
        toast(`Instalando ${dep.name}…`, "loading", 30000);
        try {
          const r = await installDependency(dep.name, true);
          toast(r.message, r.success ? "success" : "error", 4000);
        } catch (e) { toast(`Error en ${dep.name}: ${e}`, "error"); }
      }
      loadDeps(); loadSetupStatus();
    });

  } catch (e) {
    container.innerHTML = `<div style="color:var(--red);padding:20px">Error al cargar: ${escapeHtml(String(e))}</div>`;
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
