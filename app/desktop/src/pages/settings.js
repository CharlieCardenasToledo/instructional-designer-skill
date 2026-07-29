import {
  applyInstitutionConfig, checkDependencies, getVisualInstallProfiles, installDependency,
  configureMcp, getSetupStatus, checkNotebookLMAuth, runNotebookLMAuth,
  installSkill, exportSkillZip, installOpenAIPlugin, exportOpenAIPluginZip,
  pickDirectory, saveNotebooksConfig,
  resetOnboarding, getSkillPath, extractSitePalette, runSkillTool, detectHarnesses, manageHarnesses
} from "../api.js";
import { state, getNotebooks, saveConfig, saveNotebooks } from "../state.js";
import { escapeHtml } from "../dom.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, cx, liquidForBackground } from "../uiClasses.js";

// "Instalar herramientas necesarias" solo cubre lo indispensable para
// producir el PDF; Git queda fuera aunque aparezca en la lista de abajo.
const BULK_INSTALL_TARGETS = new Set(["Node.js", "Python", "Compilador LaTeX"]);
let _settingsSection = "inst-profile";
const _busySettingsOps = new Set();

function sectionHidden(id) {
  return _settingsSection === id ? "" : " hidden";
}

async function runSettingsOperation(button, key, busyLabel, operation) {
  if (_busySettingsOps.has(key)) return;
  _busySettingsOps.add(key);
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="animate-spin">${ic("loader-2", 17)}</span>${escapeHtml(busyLabel)}`;
    refreshIcons();
  }
  try {
    return await operation();
  } finally {
    _busySettingsOps.delete(key);
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.innerHTML = original;
    }
  }
}

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
    <div class="flex min-w-0 flex-col gap-4 [&_button]:min-h-11">

      <!-- Left nav -->
      <div class="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <nav class="grid grid-cols-2 gap-2 p-1 sm:grid-cols-3 xl:grid-cols-5" aria-label="Secciones de configuración">
          <a class="${cx(ui.settingsNav.item, _settingsSection === "inst-profile" && ui.settingsNav.active)}" data-settings-nav data-section="inst-profile" href="#inst-profile" ${_settingsSection === "inst-profile" ? 'aria-current="page"' : ""}>
            ${ic("building-2", 18)} Perfil institucional
          </a>
          <a class="${cx(ui.settingsNav.item, _settingsSection === "mcp-config" && ui.settingsNav.active)}" data-settings-nav data-section="mcp-config" href="#mcp-config" ${_settingsSection === "mcp-config" ? 'aria-current="page"' : ""}>
            ${ic("share-2", 18)} Conexiones
          </a>
          <a class="${cx(ui.settingsNav.item, _settingsSection === "notebooks-section" && ui.settingsNav.active)}" data-settings-nav data-section="notebooks-section" href="#notebooks-section" ${_settingsSection === "notebooks-section" ? 'aria-current="page"' : ""}>
            ${ic("book-open", 18)} Notebooks
          </a>
          <a class="${cx(ui.settingsNav.item, _settingsSection === "environment" && ui.settingsNav.active)}" data-settings-nav data-section="environment" href="#environment" ${_settingsSection === "environment" ? 'aria-current="page"' : ""}>
            ${ic("terminal", 18)} Entorno
          </a>
          <a class="${cx(ui.settingsNav.item, _settingsSection === "app-prefs" && ui.settingsNav.active)}" data-settings-nav data-section="app-prefs" href="#app-prefs" ${_settingsSection === "app-prefs" ? 'aria-current="page"' : ""}>
            ${ic("sliders-horizontal", 18)} Preferencias
          </a>
        </nav>
      </div>

      <!-- Right panes -->
      <div class="min-w-0">


        <!-- ── Institutional Profile ── -->
        <section class="${cx(ui.surface.card, 'p-4 sm:p-5', sectionHidden("inst-profile"))}" id="inst-profile" data-settings-panel>
          <div class="mb-4 flex items-center gap-2.5 border-b border-slate-300/40 pb-3.5 text-[15px] font-bold text-app-text">
            <span class="text-teal-600">${ic("building-2", 20)}</span> Perfil institucional
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="cfg-author">Nombre completo *</label>
              <input id="cfg-author" placeholder="Ej: Charlie Cárdenas Toledo" autocomplete="name" required aria-describedby="cfg-author-error"
                value="${escapeHtml(state.config?.author || "")}">
              <p id="cfg-author-error" class="hidden text-xs font-semibold text-red-700"></p>
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
              <input id="cfg-institution" placeholder="Ej: Universidad Internacional del Ecuador" required aria-describedby="cfg-institution-error"
                value="${escapeHtml(state.config?.institution || "")}">
              <p id="cfg-institution-error" class="hidden text-xs font-semibold text-red-700"></p>
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
              <div class="mt-0.5 flex items-center gap-2.5">
                <input id="cfg-color" type="color" value="${escapeHtml(state.config?.color || "#00317e")}">
                <span class="inline-block h-5 w-5 shrink-0 rounded border border-black/20" id="cfg-color-preview" style="background:${escapeHtml(state.config?.color || "#00317e")}" aria-hidden="true"></span>
                <span class="font-mono text-[13px] font-semibold text-teal-700" id="cfg-color-label">${escapeHtml(state.config?.color || "#00317e")}</span>
              </div>
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="cfg-website">Sitio web institucional</label>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input id="cfg-website" type="url" placeholder="https://www.uide.edu.ec/"
                  value="${escapeHtml(state.config?.website || "")}">
                <button class="${cx(ui.button.base, ui.button.secondary)}" id="btn-extract-palette" type="button">
                  ${ic("palette", 15)}
                  Extraer paleta
                </button>
              </div>
              <div class="mt-1.5 text-[11.5px] text-app-muted">
                Analiza el HTML y las hojas de estilo públicas del sitio.
              </div>
            </div>
            <div id="institution-palette" class="hidden rounded-[10px] border border-slate-300/55 bg-white p-3 sm:col-span-2" aria-live="polite"></div>
          </div>
          <div class="flex flex-col gap-1.5 mb-4">
            <label for="cfg-ecosystem">Ecosistema digital <span class="text-app-muted">(uno por línea)</span></label>
            <textarea id="cfg-ecosystem" placeholder="Canvas LMS&#10;Sistema académico">${escapeHtml(ecosystemToStr(state.config?.ecosystem))}</textarea>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button class="${cx(ui.button.base, ui.button.primary)}" id="btn-save-institution">
              ${ic("save", 15)} Guardar perfil
            </button>
          </div>
            <div id="institution-inline-error" class="mt-2.5 rounded-[7px] border border-red-700/25 bg-red-700/[0.06] px-3 py-2 text-xs text-red-700" role="alert" hidden></div>
        </section>

        <!-- ── Conexiones ── -->
        <section class="${cx(ui.surface.card, 'p-4 sm:p-5', sectionHidden("mcp-config"))}" id="mcp-config" data-settings-panel>
          <div class="mb-4 flex items-center gap-2.5 border-b border-slate-300/40 pb-3.5 text-[15px] font-bold text-app-text">
            <span class="text-teal-600">${ic("share-2", 20)}</span> Conexiones
            <span id="mcp-status-badge" class="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-300/50 bg-slate-200/20 px-2.5 py-0.5 text-[11px] font-bold text-app-muted" role="status" aria-live="polite">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-current"></span> Verificando…
            </span>
          </div>
            <div class="flex flex-col gap-3.5">

            <!-- Target buttons -->
            <div>
              <div class="mb-2 text-[11.5px] font-semibold text-app-muted">Conectar con:</div>
              <div class="flex flex-wrap gap-2">
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} mcp-target" data-target="claude-code">
                  ${ic("terminal", 14)} Proyecto local
                </button>
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} mcp-target" data-target="desktop">
                  ${ic("users", 14)} App de Claude
                </button>
                <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)} mcp-target" data-target="both">
                  ${ic("share-2", 14)} Ambos
                </button>
              </div>
            </div>
            <div id="mcp-inline-error" class="mt-2.5 rounded-[7px] border border-red-700/25 bg-red-700/[0.06] px-3 py-2 text-xs text-red-700" role="alert" hidden></div>

            <div class="mb-3.5 flex items-start gap-2 rounded-app border border-teal-600/25 bg-teal-600/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-app-text-2">
              <span class="mt-px shrink-0">${ic("info", 15)}</span>
              <span>Combina la conexión de NotebookLM con tu configuración existente y guarda un respaldo automático.</span>
            </div>

            <!-- NotebookLM Auth row -->
            <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Sesión de Google</div>
                <div id="nlm-auth-status" class="mt-0.5 text-xs text-app-muted" role="status" aria-live="polite">Verificando…</div>
              </div>
              <div class="flex gap-2">
                <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="btn-verify-nlm">
                  ${ic("refresh-cw", 14)} Verificar
                </button>
                <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-auth-nlm">
                  ${ic("key", 14)} Iniciar sesión
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Notebooks ── -->
        <section class="${cx(ui.surface.card, 'p-4 sm:p-5', sectionHidden("notebooks-section"))}" id="notebooks-section" data-settings-panel>
          <div class="mb-4 flex items-center gap-2.5 border-b border-slate-300/40 pb-3.5 text-[15px] font-bold text-app-text">
            <span class="text-teal-600">${ic("book-open", 20)}</span> Notebooks de NotebookLM
            <span class="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700" id="notebooks-save-state" role="status" aria-live="polite">
              ${ic("cloud-check", 16)} Guardado automático
            </span>
          </div>

          <!-- Notebook list -->
          <div id="notebook-list" class="mb-3.5 flex flex-col gap-1.5"></div>

          <!-- Add notebook form -->
          <div class="rounded-app border border-slate-200 bg-white p-3.5">
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
                <label for="nb-id">Notebook ID <span class="text-app-muted">(opcional)</span></label>
                <input id="nb-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono">
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label for="nb-url">URL de compartir <span class="text-app-muted">(opcional)</span></label>
                <input id="nb-url" placeholder="https://notebooklm.google.com/notebook/…">
              </div>
            </div>
            <div class="flex items-center justify-end gap-2">
              <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-add-notebook">
                ${ic("plus", 14)} Registrar
              </button>
            </div>
          </div>

          <div class="mt-3 text-[11.5px] text-app-muted">
            El Notebook ID se encuentra en la URL: <code>notebooklm.google.com/notebook/<strong>ID</strong></code>
          </div>
          <div id="notebooks-inline-error" class="mt-2.5 rounded-[7px] border border-red-700/25 bg-red-700/[0.06] px-3 py-2 text-xs text-red-700" role="alert" hidden></div>
        </section>

        <!-- ── Environment ── -->
        <section class="${cx(ui.surface.card, 'p-4 sm:p-5', sectionHidden("environment"))}" id="environment" data-settings-panel>
          <div class="mb-4 flex items-center gap-2.5 border-b border-slate-300/40 pb-3.5 text-[15px] font-bold text-app-text">
            <span class="text-teal-600">${ic("terminal", 20)}</span> Entorno del sistema
            <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'ml-auto')}" id="btn-refresh-deps">
              ${ic("refresh-cw", 14)} Recargar
            </button>
          </div>

          <!-- Setup status summary -->
          <div id="setup-status-bar" class="mb-3" role="status" aria-live="polite"></div>

          <!-- Deps list -->
          <div id="deps-content" class="flex flex-col gap-2" aria-live="polite">
            <div class="p-6 text-center text-slate-400">Cargando…</div>
          </div>
          <div id="deps-inline-error" class="mt-2.5 rounded-[7px] border border-red-700/25 bg-red-700/[0.06] px-3 py-2 text-xs text-red-700" role="alert" hidden></div>

          <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <h3 class="text-sm font-bold text-app-text">Diagnóstico de la toolchain</h3>
                <p class="mt-1 text-xs text-app-muted">Ejecuta el mismo comando jintia doctor que usa la skill y conserva su reporte.</p>
              </div>
              <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'ml-auto')}" id="btn-run-toolchain-doctor">
                ${ic("shield-check", 14)} Ejecutar diagnóstico
              </button>
            </div>
            <pre id="toolchain-report" class="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100" aria-live="polite">Aún no se ha ejecutado.</pre>
            <div class="mt-4 grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
              <label class="text-xs font-semibold text-app-muted">Operación
                <select id="toolchain-operation" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-app-text">
                  <option value="audit">Auditar</option>
                  <option value="validate">Validar LaTeX</option>
                  <option value="compile">Compilar PDF</option>
                </select>
              </label>
              <label class="text-xs font-semibold text-app-muted">Archivo objetivo
                <input id="toolchain-target" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-app-text" placeholder="C:\\Cursos\\mi-curso\\README.md o guia.tex" autocomplete="off">
              </label>
              <label class="flex items-end gap-2 pb-2 text-xs font-semibold text-app-muted"><input id="toolchain-strict" type="checkbox" class="h-4 w-4 accent-teal-700"> Estricto</label>
            </div>
            <button class="${cx(ui.button.base, ui.button.primary, 'mt-3 min-h-11')}" id="btn-run-toolchain-operation">
              ${ic("play", 17)} Ejecutar operación
            </button>
          </div>

          <div class="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <h3 class="text-sm font-bold text-app-text">Entornos de agentes detectados</h3>
                <p class="mt-1 text-xs text-app-muted">Busca carpetas de Claude, Codex, Cursor y otros harnesses en el proyecto y en tu perfil.</p>
              </div>
              <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'ml-auto')}" id="btn-detect-harnesses">
                ${ic("radar", 14)} Detectar
              </button>
            </div>
            <label class="mt-3 block text-xs font-semibold text-app-muted">Proyecto a inspeccionar
              <input id="harness-project-path" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-app-text" placeholder="Dejar vacío para el proyecto actual" autocomplete="off">
            </label>
            <div class="mt-3 grid gap-2 md:grid-cols-[1fr_150px_auto]">
              <input id="harness-providers" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-app-text" value="claude,codex,cursor" aria-label="Proveedores separados por coma">
              <select id="harness-scope" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-app-text" aria-label="Alcance"><option value="project">Proyecto</option><option value="global">Global</option></select>
              <div class="flex gap-2"><button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-harness-operation="install">Instalar</button><button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-harness-operation="update">Actualizar</button><button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-harness-operation="repair">Reparar</button></div>
            </div>
            <div id="harness-detection-list" class="mt-3 space-y-2" aria-live="polite">
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Aún no se ha ejecutado la detección.</div>
            </div>
          </div>
        </section>

        <!-- ── Preferencias ── -->
        <section class="${cx(ui.surface.card, 'p-4 sm:p-5', sectionHidden("app-prefs"))}" id="app-prefs" data-settings-panel>
          <div class="mb-4 flex items-center gap-2.5 border-b border-slate-300/40 pb-3.5 text-[15px] font-bold text-app-text">
            <span class="text-teal-600">${ic("sliders-horizontal", 20)}</span> Preferencias
          </div>

          <!-- Skill path -->
          <div class="mb-3.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
            <div class="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-app-muted">Carpeta de instalación</div>
            <div id="skill-path-val" class="mono break-all text-[12.5px] text-brand">Cargando…</div>
          </div>

          <div class="flex flex-col gap-2.5">
            <label class="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <span>
                <span class="block text-[13px] font-semibold text-app-text">Incluir «Producido con Jintia» en los documentos</span>
                <span class="mt-0.5 block text-[11.5px] leading-5 text-app-muted">Añade un crédito discreto en el colofón o la última página. Nunca sustituye ni modifica la autoría académica.</span>
              </span>
              <input id="cfg-include-jintia-credit" class="mt-1 h-4 w-4 shrink-0 accent-teal-700" type="checkbox" ${state.config?.includeJintiaCredit !== false ? "checked" : ""}>
            </label>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Instalar para Claude Code</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Copia la skill a <code>~/.claude/skills/</code></div>
              </div>
              <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-install-skill">
                ${ic("download", 14)} Instalar
              </button>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Preparar para ChatGPT y Codex</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Registra el plugin universal en <code>~/.codex/plugins/</code></div>
              </div>
              <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="btn-install-openai-plugin">
                ${ic("puzzle", 14)} Preparar
              </button>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Exportar plugin universal</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Paquete para ChatGPT y Codex; la publicación web requiere revisión de OpenAI</div>
              </div>
              <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="btn-export-openai-plugin">
                ${ic("archive", 14)} Exportar
              </button>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <div>
                <div class="text-[13px] font-semibold text-app-text">Exportar configuración</div>
                <div class="mt-0.5 text-[11.5px] text-app-muted">Para instalar manualmente en la app de Claude</div>
              </div>
              <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="btn-export-skill">
                ${ic("archive", 14)} Exportar ZIP
              </button>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div class="mb-1.5 text-[13px] font-semibold text-app-text">Volver a mostrar el asistente inicial</div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="max-w-[62ch] text-xs leading-5 text-app-muted">No elimina el perfil, las asignaturas, los notebooks ni los archivos generados. Solo vuelve a abrir el recorrido inicial.</div>
                <button class="${cx(ui.button.base, ui.button.secondary, 'min-h-11')}" id="btn-reset-onboarding">
                  ${ic("rotate-ccw", 17)} Mostrar asistente
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>`;

  // ── Bind section nav ──────────────────────────────────────────────────────
  el.querySelectorAll("[data-settings-nav]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      _settingsSection = a.dataset.section;
      el.querySelectorAll("[data-settings-nav]").forEach(x => {
        x.className = ui.settingsNav.item;
        x.removeAttribute("aria-current");
      });
      a.className = cx(ui.settingsNav.item, ui.settingsNav.active);
      a.setAttribute("aria-current", "page");
      el.querySelectorAll("[data-settings-panel]").forEach(panel => {
        panel.classList.toggle("hidden", panel.id !== _settingsSection);
      });
      document.getElementById(_settingsSection)?.querySelector("input, select, textarea, button")?.focus();
    });
  });

  // ── Institution ───────────────────────────────────────────────────────────
  el.querySelector("#cfg-color")?.addEventListener("input", e => {
    document.getElementById("cfg-color-label").textContent = e.target.value;
    const preview = document.getElementById("cfg-color-preview");
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value) && preview) preview.style.background = e.target.value;
  });
  el.querySelector("#btn-save-institution")?.addEventListener("click", event => {
    runSettingsOperation(event.currentTarget, "institution", "Guardando…", saveInstitution);
  });
  el.querySelector("#btn-extract-palette")?.addEventListener("click", loadInstitutionPalette);

  // ── Conexiones ────────────────────────────────────────────────────────────
  el.querySelectorAll(".mcp-target").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (_busySettingsOps.has("mcp")) return;
      _busySettingsOps.add("mcp");
      const targets = [...el.querySelectorAll(".mcp-target")];
      targets.forEach(target => { target.disabled = true; target.setAttribute("aria-busy", "true"); });
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
      } catch (e) {
        setInlineError("mcp-inline-error", `No se pudo completar la conexión. (${e})`);
        toast("No se pudo completar la conexión", "error", 6000);
      } finally {
        _busySettingsOps.delete("mcp");
        targets.forEach(target => { target.disabled = false; target.removeAttribute("aria-busy"); });
        loadMcpStatus();
      }
    });
  });

  el.querySelector("#btn-verify-nlm")?.addEventListener("click", verifyNlmAuth);
  el.querySelector("#btn-auth-nlm")?.addEventListener("click", runNlmAuth);
  verifyNlmAuth();
  loadMcpStatus();

  // ── Notebooks ─────────────────────────────────────────────────────────────
  renderNotebookList();
  el.querySelector("#btn-add-notebook")?.addEventListener("click", addNotebook);

  // ── Environment ───────────────────────────────────────────────────────────
  el.querySelector("#btn-refresh-deps")?.addEventListener("click", loadDeps);
  el.querySelector("#btn-run-toolchain-doctor")?.addEventListener("click", runToolchainDoctor);
  el.querySelector("#btn-run-toolchain-operation")?.addEventListener("click", runToolchainOperation);
  el.querySelector("#btn-detect-harnesses")?.addEventListener("click", detectAgentHarnesses);
  el.querySelectorAll("[data-harness-operation]").forEach(button => button.addEventListener("click", event => manageAgentHarness(event.currentTarget.dataset.harnessOperation, event)));
  loadSetupStatus();
  loadDeps();
  detectAgentHarnesses();

  // ── App Preferences ───────────────────────────────────────────────────────
  loadSkillPath();
  el.querySelector("#cfg-include-jintia-credit")?.addEventListener("change", event => {
    const previous = state.config.includeJintiaCredit;
    state.config.includeJintiaCredit = event.target.checked;
    try {
      saveConfig();
      toast(event.target.checked ? "Crédito de Jintia activado." : "Crédito de Jintia desactivado.", "success", 2500);
    } catch (error) {
      state.config.includeJintiaCredit = previous;
      event.target.checked = previous !== false;
      toast(`No se pudo guardar la preferencia: ${error}`, "error", 6000);
    }
  });

  el.querySelector("#btn-install-skill")?.addEventListener("click", event => {
    runSettingsOperation(event.currentTarget, "install-skill", "Instalando…", async () => {
      toast("Instalando en tu proyecto local…", "loading", 20000);
      try {
        const r = await installSkill();
        toast(r.message, r.success ? "success" : "error", 6000);
        if (r.success) loadSkillPath();
      } catch (e) { toast(`No se pudo instalar: ${e}`, "error", 7000); }
    });
  });

  el.querySelector("#btn-export-skill")?.addEventListener("click", async event => {
    const dir = await pickDirectory("Selecciona el directorio de destino");
    if (!dir) return;
    await runSettingsOperation(event.currentTarget, "export-skill", "Exportando…", async () => {
      toast("Exportando ZIP…", "loading", 15000);
      try { const r = await exportSkillZip(dir); toast(r.message, r.success ? "success" : "error", 6000); }
      catch (e) { toast(`No se pudo exportar: ${e}`, "error", 7000); }
    });
  });

  el.querySelector("#btn-install-openai-plugin")?.addEventListener("click", event => {
    runSettingsOperation(event.currentTarget, "install-openai-plugin", "Instalando…", async () => {
      try {
        const result = await installOpenAIPlugin();
        toast(result.message, result.success ? "success" : "error", 10000);
        if (result.success) loadSetupStatus();
      } catch (error) {
        toast(`No se pudo instalar para ChatGPT/Codex: ${error}`, "error", 7000);
      }
    });
  });

  el.querySelector("#btn-export-openai-plugin")?.addEventListener("click", async event => {
    const dir = await pickDirectory("Selecciona dónde guardar el plugin universal");
    if (!dir) return;
    await runSettingsOperation(event.currentTarget, "export-openai-plugin", "Exportando…", async () => {
      try {
        const result = await exportOpenAIPluginZip(dir);
        toast(result.message, result.success ? "success" : "error", 8000);
      } catch (error) {
        toast(`No se pudo exportar el plugin: ${error}`, "error", 7000);
      }
    });
  });

  el.querySelector("#btn-reset-onboarding")?.addEventListener("click", async () => {
    if (!await confirm("¿Volver a mostrar el asistente inicial?\nNo se eliminarán tu perfil, asignaturas, notebooks ni archivos.")) return;
    await runSettingsOperation(document.getElementById("btn-reset-onboarding"), "reset-onboarding", "Preparando…", async () => {
      try {
        const r = await resetOnboarding();
        if (!r.success) {
          toast(r.message || "No se pudo reactivar el asistente inicial", "error", 7000);
          return;
        }
        toast("Abriendo el asistente inicial…", "info", 1500);
        window.location.reload();
      } catch (error) {
        toast(`No se pudo reactivar el asistente: ${error}`, "error", 7000);
      }
    });
  });

  refreshIcons();
}

// ── Institution ───────────────────────────────────────────────────────────────
async function saveInstitution() {
  setInlineError("institution-inline-error", "");
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const author      = get("cfg-author");
  const institution = get("cfg-institution");
  clearSettingsFieldError("cfg-author");
  clearSettingsFieldError("cfg-institution");
  if (!author) {
    showSettingsFieldError("cfg-author", "Escribe tu nombre completo.");
    document.getElementById("cfg-author")?.focus();
    return;
  }
  if (!institution) {
    showSettingsFieldError("cfg-institution", "Escribe el nombre de la institución.");
    document.getElementById("cfg-institution")?.focus();
    return;
  }

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
      const previous = { ...state.config };
      Object.assign(state.config, config);
      try {
        saveConfig();
      } catch (error) {
        state.config = previous;
        setInlineError("institution-inline-error", `La configuración se aplicó, pero no pudo guardarse localmente. (${error})`);
        toast("No se pudo completar el guardado local", "error", 6000);
        return;
      }
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

function showSettingsFieldError(id, message) {
  const field = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  field?.setAttribute("aria-invalid", "true");
  field?.classList.add("border-red-500");
  if (error) {
    error.textContent = message;
    error.classList.remove("hidden");
  }
}

function clearSettingsFieldError(id) {
  const field = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  field?.removeAttribute("aria-invalid");
  field?.classList.remove("border-red-500");
  if (error) {
    error.textContent = "";
    error.classList.add("hidden");
  }
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
  container.classList.remove("hidden");
  container.innerHTML = `<div class="flex items-center gap-1.5 text-xs text-app-muted">${ic("loader-2", 16)} Analizando sitio y hojas de estilo…</div>`;
  refreshIcons();
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
    container.innerHTML = `<div class="flex items-center gap-1.5 text-xs text-red-700">${escapeHtml(String(error))}</div>`;
    toast(`No se pudo extraer la paleta: ${error}`, "error", 6000);
  } finally {
    button.disabled = false;
  }
}

function renderPalette(container, palette) {
  container.innerHTML = `
    <div class="mb-2.5 flex items-baseline justify-between gap-3 text-xs font-bold">
      <span>Colores encontrados</span>
      <span class="text-app-muted">Selecciona uno para usarlo como color institucional</span>
    </div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
      ${palette.map(({ color, occurrences }) => `
        <button class="${cx(liquidForBackground(color), 'palette-swatch flex min-w-0 cursor-pointer items-center gap-2 p-1.5 text-left transition-colors hover:border-teal-400 [&_code]:text-inherit [&_small]:text-inherit')}" style="background-color:color-mix(in srgb, ${escapeHtml(color)} 32%, transparent)" type="button" data-palette-color="${escapeHtml(color)}"
          title="Usar ${escapeHtml(color)}">
          <span class="inline-block h-[31px] w-[31px] shrink-0 rounded-[7px] border border-black/15" style="background:${escapeHtml(color)}"></span>
          <span class="flex min-w-0 flex-col">
            <code class="overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px]">${escapeHtml(color)}</code>
            <small class="text-[10px] text-app-muted">${occurrences} ${occurrences === 1 ? "aparición" : "apariciones"}</small>
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
      container.querySelectorAll(".palette-swatch").forEach(item => item.classList.remove("selected", "border-teal-600", "shadow-[0_0_0_2px_rgba(0,121,107,0.1)]"));
      button.classList.add("selected", "border-teal-600", "shadow-[0_0_0_2px_rgba(0,121,107,0.1)]");
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
    list.innerHTML = `<div class="py-4 text-center text-[13px] text-slate-400">Sin notebooks registrados aún.</div>`;
    return;
  }
  list.innerHTML = notebooks.map((nb, i) => `
    <div class="${ui.list.item}">
      <div class="${ui.list.left}">
        <span class="text-brand-600">${ic("book-open", 18)}</span>
        <div>
          <div class="${ui.list.label}">${escapeHtml(nb.code)} — ${escapeHtml(nb.courseName)}</div>
          <div class="${ui.list.sub}">${escapeHtml(nb.root)}${nb.notebookId ? ` · ID: ${escapeHtml(nb.notebookId.slice(0,8))}…` : ""}</div>
        </div>
      </div>
      <div class="${ui.list.right}">
        <button class="${cx(ui.button.base, ui.button.danger, 'h-11 w-11 p-0')}" data-nb-delete="${i}" aria-label="Eliminar notebook ${escapeHtml(nb.code)}" title="Eliminar notebook">
          ${ic("trash-2", 13)}
        </button>
      </div>
    </div>`).join("");
  refreshIcons();

  list.querySelectorAll("[data-nb-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nbs = getNotebooks();
      const index = Number(btn.dataset.nbDelete);
      const notebook = nbs[index];
      if (!notebook || !await confirm(`¿Eliminar el notebook ${notebook.code} — ${notebook.courseName}?`)) return;
      await syncNotebooks(
        nbs.filter((_, notebookIndex) => notebookIndex !== index),
        btn,
        `Notebook ${notebook.code} eliminado`,
      );
    });
  });
}

// ── Notebook registry ─────────────────────────────────────────────────────────
async function addNotebook() {
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const code = get("nb-code").toUpperCase();
  const courseName = get("nb-course-name");
  const root = get("nb-root");
  let notebookId = get("nb-id");
  const url = get("nb-url");
  setInlineError("notebooks-inline-error", "");

  if (!code || !courseName || !root) {
    setInlineError("notebooks-inline-error", "Completa código, asignatura y carpeta raíz.");
    document.getElementById(!code ? "nb-code" : !courseName ? "nb-course-name" : "nb-root")?.focus();
    return;
  }
  if (!notebookId && url) notebookId = notebookIdFromUrl(url);
  if (!notebookId && !url) {
    setInlineError("notebooks-inline-error", "Añade el Notebook ID o la URL de compartir.");
    document.getElementById("nb-id")?.focus();
    return;
  }
  if (url && !/^https:\/\/notebooklm\.google\.com\/notebook\//i.test(url)) {
    setInlineError("notebooks-inline-error", "La URL debe pertenecer a notebooklm.google.com/notebook/.");
    document.getElementById("nb-url")?.focus();
    return;
  }

  const notebooks = getNotebooks();
  if (notebooks.some(notebook => String(notebook.code).toLowerCase() === code.toLowerCase())) {
    setInlineError("notebooks-inline-error", "Ya existe un notebook con este código.");
    document.getElementById("nb-code")?.focus();
    return;
  }
  const saved = await syncNotebooks(
    [...notebooks, { code, courseName, root, notebookId, url }],
    document.getElementById("btn-add-notebook"),
    `Notebook ${code} registrado`,
  );
  if (!saved) return;
  ["nb-code", "nb-course-name", "nb-root", "nb-id", "nb-url"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
}

function notebookIdFromUrl(url) {
  return String(url || "").match(/notebooklm\.google\.com\/notebook\/([^/?#]+)/i)?.[1] || "";
}

async function syncNotebooks(next, button, successMessage) {
  setInlineError("notebooks-inline-error", "");
  const status = document.getElementById("notebooks-save-state");
  if (status) status.textContent = "Sincronizando…";
  try {
    return await runSettingsOperation(button, "notebooks", "Guardando…", async () => {
      const result = await saveNotebooksConfig(next);
      if (!result.success) throw new Error(result.message);
      saveNotebooks(next);
      renderNotebookList();
      if (status) { status.innerHTML = `${ic("cloud-check", 16)} Guardado automático`; refreshIcons(); }
      toast(successMessage, "success", 3200);
      return true;
    });
  } catch (error) {
    if (status) status.textContent = "No se pudo sincronizar";
    setInlineError("notebooks-inline-error", `No se guardaron los cambios. Vuelve a intentarlo. (${error})`);
    toast("No se pudieron sincronizar los notebooks", "error", 6000);
    return false;
  }
}

// ── Environment ───────────────────────────────────────────────────────────────
async function runToolchainDoctor(event) {
  const button = event?.currentTarget;
  const output = document.getElementById("toolchain-report");
  if (!output) return;
  await runSettingsOperation(button, "toolchain-doctor", "Diagnosticando…", async () => {
    output.textContent = "Ejecutando jintia doctor…";
    try {
      const result = await runSkillTool("doctor");
      const report = result.report || result.stdout || result.message;
      output.textContent = typeof report === "string" ? report : JSON.stringify(report, null, 2);
      toast(result.success ? "Diagnóstico completado" : "El diagnóstico encontró problemas", result.success ? "success" : "error", 5000);
    } catch (error) {
      output.textContent = `No se pudo ejecutar el diagnóstico: ${error}`;
      toast("No se pudo ejecutar el diagnóstico", "error", 5000);
    }
  });
}

async function runToolchainOperation(event) {
  const button = event?.currentTarget;
  const operation = document.getElementById("toolchain-operation")?.value || "audit";
  const target = document.getElementById("toolchain-target")?.value.trim();
  const strict = Boolean(document.getElementById("toolchain-strict")?.checked);
  const output = document.getElementById("toolchain-report");
  if (!target) {
    output.textContent = "Escribe la ruta del README.md o de la guía .tex.";
    toast("Falta el archivo objetivo", "error", 4000);
    document.getElementById("toolchain-target")?.focus();
    return;
  }
  await runSettingsOperation(button, "toolchain-operation", "Ejecutando…", async () => {
    output.textContent = `Ejecutando ${operation}…`;
    try {
      const result = await runSkillTool(operation, target, strict);
      const report = result.report || result.stdout || result.message;
      output.textContent = typeof report === "string" ? report : JSON.stringify(report, null, 2);
      toast(result.success ? "Operación completada" : "La operación encontró problemas", result.success ? "success" : "error", 5000);
    } catch (error) {
      output.textContent = `No se pudo ejecutar ${operation}: ${error}`;
      toast("No se pudo ejecutar la operación", "error", 5000);
    }
  });
}

async function detectAgentHarnesses(event) {
  const button = event?.currentTarget;
  const list = document.getElementById("harness-detection-list");
  if (!list) return;
  const projectPath = document.getElementById("harness-project-path")?.value.trim() || state.courses.find(course => course.project_path)?.project_path || ".";
  await runSettingsOperation(button, "harness-detection", "Detectando…", async () => {
    list.innerHTML = `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Buscando entornos…</div>`;
    try {
      const result = await detectHarnesses(projectPath);
      const providers = result.providers || [];
      list.innerHTML = providers.map(provider => {
        const ok = provider.status === "installed";
        const detected = provider.status !== "not-detected";
        const label = ok ? "Instalada" : detected ? "Detectado" : "No detectado";
        const classes = ok ? "border-green-200 bg-green-50 text-green-700" : detected ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-700";
        return `<div class="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${classes}"><span class="font-semibold">${escapeHtml(provider.name)}</span><span class="ml-auto text-[11px] font-bold uppercase tracking-wide">${label}</span><span class="basis-full text-[11px] opacity-80">${escapeHtml(provider.foundPath || "No se encontró la carpeta de configuración")}</span></div>`;
      }).join("") || `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No se encontraron entornos.</div>`;
    } catch (error) {
      list.innerHTML = `<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">No se pudo detectar: ${escapeHtml(String(error))}</div>`;
    }
  });
}

async function manageAgentHarness(operation, event) {
  const button = event?.currentTarget || event;
  const projectPath = document.getElementById("harness-project-path")?.value.trim() || state.courses.find(course => course.project_path)?.project_path || ".";
  const providers = (document.getElementById("harness-providers")?.value || "claude,codex,cursor").split(",").map(value => value.trim()).filter(Boolean);
  const scope = document.getElementById("harness-scope")?.value || "project";
  await runSettingsOperation(button, `harness-${operation}`, `${operation}…`, async () => {
    const result = await manageHarnesses(operation, projectPath, providers, scope, true);
    toast(result.message || `${operation} completado.`, result.success ? "success" : "error", 8000);
    await detectAgentHarnesses();
  });
}

async function loadSetupStatus() {
  const bar = document.getElementById("setup-status-bar");
  if (!bar) return;
  try {
    const status = await getSetupStatus();
    const items = [
      {
        label: status.skill_current
          ? `Skill ${status.skill_version || status.available_skill_version} actualizada`
          : status.skill_installed
            ? `Skill desactualizada · disponible ${status.available_skill_version}`
            : `Skill ${status.available_skill_version} sin instalar`,
        ok: status.skill_current
      },
      {
        label: status.openai_plugin_current
          ? `ChatGPT/Codex ${status.available_skill_version} preparado`
          : status.openai_plugin_installed
            ? "Plugin ChatGPT/Codex desactualizado"
            : "Plugin ChatGPT/Codex sin instalar",
        ok: status.openai_plugin_current
      },
      { label: "Conexión lista",       ok: status.mcp_configured },
      { label: "Institución guardada", ok: status.institution_configured },
      { label: "Sesión de Google",     ok: status.notebooklm_authenticated },
    ].filter(i => i.label);

    bar.innerHTML = `
      <div class="mb-3 flex flex-wrap gap-2">
        ${items.map(({ label, ok }) => `
          <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${ok ? "border-green-200 bg-green-50 text-green-600" : "border-red-200 bg-red-50 text-red-500"}">
            ${ic(ok ? "check-circle-2" : "circle-x", 14)}
            ${escapeHtml(label)}
          </span>`).join("")}
      </div>`;
    refreshIcons();
  } catch {
    bar.innerHTML = "";
  }
}

async function loadDeps() {
  const container = document.getElementById("deps-content");
  if (!container) return;
  container.innerHTML = `<div class="p-6 text-center text-slate-400">Cargando…</div>`;

  try {
    const [deps, visualProfiles] = await Promise.all([
      checkDependencies(),
      getVisualInstallProfiles()
    ]);
    const ok    = deps.filter(d => d.installed).length;
    const total = deps.length;
    const pct   = total > 0 ? Math.round((ok / total) * 100) : 0;

    const selectedProfile = localStorage.getItem("jintia.visualProfile") || "minimum";
    const profiles = visualProfiles?.profiles || [];
    const profile = profiles.find(item => item.id === selectedProfile) || profiles[0];
    const dependencyByName = new Map(deps.map(dep => [dep.name, dep]));
    const unavailable = (profile?.tools || []).filter(tool => !dependencyByName.get(tool.desktopName)?.installed);

    container.innerHTML = `
      <div class="mb-4 rounded-xl border border-slate-900/10 bg-slate-900/[0.025] p-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-semibold text-app-text">Perfil de capacidades visuales</div>
            <div class="${ui.list.sub}">${escapeHtml(profile?.description || "")}</div>
          </div>
          <select id="visual-install-profile" class="${ui.input}" aria-label="Perfil de capacidades visuales">
            ${profiles.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === profile?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="mt-3 text-xs ${unavailable.length ? "text-amber-700" : "text-green-700"}">
          ${unavailable.length
            ? `Capacidades deshabilitadas: ${unavailable.map(tool => `${escapeHtml(tool.desktopName)} (${escapeHtml(tool.version)})`).join(", ")}. La instalación es manual y siempre requiere tu confirmación.`
            : "Todas las capacidades del perfil están disponibles."}
        </div>
      </div>
      <div class="mb-3 flex items-center gap-3">
        <span class="text-2xl font-extrabold text-path-600">${ok}</span>
        <div>
          <div class="text-[13px] font-semibold text-app-text">de ${total} dependencias instaladas</div>
          <div class="mt-1 h-1.5 w-[180px] overflow-hidden rounded-full border border-slate-900/10 bg-slate-900/[0.06]">
            <div class="h-full rounded-full bg-path-500 shadow-[0_0_10px_rgba(52,195,122,.35)] transition-[width] duration-500" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm, 'ml-auto')}" id="btn-install-all-deps">
            ${ic("download", 14)} Instalar herramientas necesarias
        </button>
      </div>
      ${deps.map(dep => `
        <div class="${ui.list.item} mb-1.5">
          <div class="${ui.list.left}">
            <div class="h-2 w-2 shrink-0 rounded-full ${dep.installed ? "bg-green-500 shadow-[0_0_0_3px_var(--green-bg),0_0_8px_rgba(74,222,128,0.4)]" : "bg-red-500 shadow-[0_0_0_3px_var(--red-bg),0_0_8px_rgba(248,113,113,0.4)]"}"></div>
            <div>
              <div class="${ui.list.label}">${escapeHtml(dep.name)}</div>
              <div class="${ui.list.sub}">${escapeHtml(dep.version || (dep.installed ? "Instalado" : "No instalado"))}</div>
            </div>
          </div>
          <div class="${ui.list.right}">
            ${!dep.installed && dep.installable !== false
              ? `<button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-dep-name="${escapeHtml(dep.name)}">Instalar</button>`
              : dep.installed
                ? `<span class="${ui.badge.success}">OK</span>`
                : `<span class="${ui.badge.muted}">Instalación manual</span>`}
          </div>
        </div>`).join("")}`;
    refreshIcons();

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

    container.querySelector("#visual-install-profile")?.addEventListener("change", event => {
      localStorage.setItem("jintia.visualProfile", event.target.value);
      loadDeps();
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
