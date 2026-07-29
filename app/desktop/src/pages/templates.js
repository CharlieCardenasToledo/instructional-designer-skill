import {
  compileSyllabusPdf,
  createCourseStructure,
  listTemplates,
  getActiveTemplate,
  setActiveTemplate,
} from "../api.js";
import { toast } from "../toast.js";
import { escapeHtml } from "../dom.js";
import { state } from "../state.js";
import { ui, cx } from "../uiClasses.js";
import { appLocalDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { buildSampleGuideData } from "../sampleGuide.js";

let _templates = [];
let _activeId = "";
let _selectedId = "";
let _filter = "all";
let _activatingId = "";
let _activationError = "";
let _previewCompilingId = "";
let _previewProgress = "";
const _pdfPreviews = new Map();
const _previewErrors = new Map();

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "institutional", label: "Institucionales" },
  { id: "personal", label: "Personales" },
];

export async function renderTemplates() {
  const el = document.getElementById("p-templates");
  if (!el) return;

  el.innerHTML = pageShell();
  bindPageEvents(el);
  await loadTemplates();
}

function pageShell() {
  return `
    <div class="flex min-h-full min-w-0 flex-col gap-4">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold leading-[30px] text-brand-950">Plantillas de publicación</h1>
          <p class="mt-1 max-w-[68ch] text-[13px] leading-5 text-app-muted">
            Compara el resultado antes de elegir el formato de tus próximas guías.
          </p>
        </div>
        <div class="${cx(ui.liquid.group, "flex w-fit max-w-full flex-wrap gap-1")}" id="tpl-filter-btns" role="group" aria-label="Filtrar plantillas">
          ${FILTERS.map(filter => filterButton(filter)).join("")}
        </div>
      </header>

      <div id="tpl-status" class="sr-only" role="status" aria-live="polite"></div>
      <div id="tpl-workspace" class="min-h-0 min-w-0 flex-1" aria-busy="true">
        ${loadingState()}
      </div>
    </div>`;
}

function filterButton(filter) {
  const selected = _filter === filter.id;
  return `
    <button class="${cx(ui.button.base, selected ? ui.button.primary : ui.button.secondary, "min-h-11 px-3 text-xs tpl-filter-btn")}"
      type="button" data-filter="${filter.id}" aria-pressed="${selected}">
      ${filter.label}
    </button>`;
}

function bindPageEvents(el) {
  el.querySelector("#tpl-filter-btns")?.addEventListener("click", event => {
    const button = event.target.closest(".tpl-filter-btn");
    if (!button || button.dataset.filter === _filter) return;
    _filter = button.dataset.filter;
    updateFilterButtons();
    renderWorkspace();
    void ensurePdfPreview(_selectedId);
  });

  el.querySelector("#tpl-workspace")?.addEventListener("click", event => {
    const filterButton = event.target.closest(".tpl-filter-btn");
    if (filterButton) {
      _filter = filterButton.dataset.filter;
      updateFilterButtons();
      renderWorkspace();
      void ensurePdfPreview(_selectedId);
      return;
    }
    const selectButton = event.target.closest("[data-select-template]");
    if (selectButton) {
      selectTemplate(selectButton.dataset.selectTemplate);
      return;
    }
    if (event.target.closest("#btn-activate-template")) activateSelectedTemplate();
    if (event.target.closest("#btn-retry-templates")) loadTemplates();
    if (event.target.closest("#btn-retry-template-preview")) {
      _previewErrors.delete(_selectedId);
      void ensurePdfPreview(_selectedId, true);
    }
    if (event.target.closest("#btn-copy-template-diagnostic")) {
      const diagnostic = _previewErrors.get(_selectedId);
      if (diagnostic) {
        navigator.clipboard.writeText(diagnostic)
          .then(() => toast("Diagnóstico copiado", "success"))
          .catch(() => toast("No se pudo copiar el diagnóstico", "error"));
      }
    }
  });
}

async function loadTemplates() {
  const workspace = document.getElementById("tpl-workspace");
  if (!workspace) return;
  workspace.setAttribute("aria-busy", "true");
  workspace.innerHTML = loadingState();
  announce("Cargando plantillas…");

  try {
    [_templates, _activeId] = await Promise.all([listTemplates(), getActiveTemplate()]);
    _selectedId = _templates.some(template => template.id === _activeId)
      ? _activeId
      : _templates[0]?.id || "";
    renderWorkspace();
    announce(`${_templates.length} ${_templates.length === 1 ? "plantilla disponible" : "plantillas disponibles"}.`);
    void ensurePdfPreview(_selectedId);
  } catch {
    workspace.innerHTML = errorState();
    announce("No se pudieron cargar las plantillas.");
  } finally {
    workspace.removeAttribute("aria-busy");
  }
}

function filteredTemplates() {
  if (_filter === "institutional") return _templates.filter(template => template.featured);
  if (_filter === "personal") return _templates.filter(template => !template.featured);
  return _templates;
}

function renderWorkspace() {
  const workspace = document.getElementById("tpl-workspace");
  if (!workspace) return;
  const templates = filteredTemplates();

  if (!_templates.length) {
    workspace.innerHTML = emptyState(
      "Aún no hay plantillas disponibles",
      "Cuando se incorpore una plantilla compatible aparecerá aquí."
    );
    return;
  }

  if (!templates.length) {
    workspace.innerHTML = emptyState(
      "No hay plantillas en esta categoría",
      "Elige otro filtro para continuar comparando.",
      true
    );
    return;
  }

  if (!templates.some(template => template.id === _selectedId)) {
    _selectedId = templates.find(template => template.id === _activeId)?.id || templates[0].id;
  }

  workspace.innerHTML = `
    <div class="grid min-h-0 min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
      <section class="min-w-0" aria-labelledby="tpl-catalog-title">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 id="tpl-catalog-title" class="text-sm font-bold text-app-text">Catálogo</h2>
          <span class="text-xs text-app-muted">${templates.length} ${templates.length === 1 ? "resultado" : "resultados"}</span>
        </div>
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          ${templates.map(templateCard).join("")}
        </div>
      </section>
      <aside id="tpl-detail" class="min-w-0 xl:sticky xl:top-0" aria-label="Vista previa de la plantilla seleccionada">
        ${detailPanel(selectedTemplate())}
      </aside>
    </div>`;
}

function templateCard(template) {
  const selected = template.id === _selectedId;
  const active = template.id === _activeId;
  return `
    <article class="${cx(
      "flex min-w-0 flex-col rounded-xl border bg-white p-3.5 shadow-sm transition-colors",
      selected ? "border-brand ring-2 ring-brand/15" : "border-slate-200 hover:border-slate-300"
    )}">
      <button class="flex min-h-11 min-w-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        type="button" data-select-template="${escapeHtml(template.id)}" aria-pressed="${selected}" aria-label="Ver vista previa de ${escapeHtml(template.name)}">
        <div class="mb-3 aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3" aria-hidden="true">
          <div class="h-full overflow-hidden bg-white p-3 shadow-sm">
            <div class="mb-2 h-2 w-2/5 rounded-full bg-brand/70"></div>
            <div class="mb-3 h-1.5 w-4/5 rounded-full bg-slate-200"></div>
            <div class="grid grid-cols-[1fr_32%] gap-2">
              <div class="space-y-2">
                <div class="h-1.5 rounded-full bg-slate-300"></div>
                <div class="h-8 rounded bg-brand-soft"></div>
                <div class="h-1.5 rounded-full bg-slate-200"></div>
                <div class="h-1.5 w-4/5 rounded-full bg-slate-200"></div>
              </div>
              <div class="space-y-2 border-l border-slate-200 pl-2">
                <div class="h-6 rounded bg-slate-100"></div>
                <div class="h-1.5 rounded-full bg-slate-200"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex w-full min-w-0 items-start gap-2">
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-[14px] font-bold text-app-text">${escapeHtml(template.name)}</h3>
            <p class="mt-1 line-clamp-2 text-xs leading-[1.55] text-app-muted">${escapeHtml(template.description || "Sin descripción disponible.")}</p>
          </div>
          ${active ? `<span class="${ui.badge.success} shrink-0"><span class="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>Activa</span>` : ""}
        </div>
        <div class="mt-3 flex min-h-6 flex-wrap gap-1.5">
          ${(template.tags || []).slice(0, 3).map(tag => `<span class="${ui.badge.muted}">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </button>
    </article>`;
}

function selectedTemplate() {
  return _templates.find(template => template.id === _selectedId) || _templates[0];
}

function detailPanel(template) {
  if (!template) return "";
  const active = template.id === _activeId;
  const activating = template.id === _activatingId;
  const pdfPath = _pdfPreviews.get(template.id);
  const previewError = _previewErrors.get(template.id);
  const compiling = template.id === _previewCompilingId;
  return `
    <div class="${cx(ui.surface.card, "overflow-hidden")}">
      <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-[15px] font-bold text-app-text">${escapeHtml(template.name)}</h2>
            ${active ? `<span class="${ui.badge.success}">Plantilla activa</span>` : ""}
          </div>
          <p class="mt-1 text-xs leading-5 text-app-muted">
            ${active ? "Este formato se usará en las nuevas guías." : "Revisa el formato antes de aplicarlo a nuevas guías."}
          </p>
        </div>
      </div>
      <div class="min-h-[420px] bg-slate-700">
        ${pdfPath ? pdfPreviewFrame(pdfPath, template.name) : compiling ? previewLoadingState() : previewError ? previewErrorState(previewError) : previewWaitingState()}
      </div>
      <div class="border-t border-slate-200 p-4">
        <p class="mb-3 text-xs leading-5 text-app-muted">${escapeHtml(template.description || "")}</p>
        <button class="${cx(ui.button.base, active ? ui.button.secondary : ui.button.primary, "min-h-11 w-full")}"
          id="btn-activate-template" type="button" ${active || activating ? "disabled" : ""} aria-busy="${activating}">
          <span class="material-symbols-outlined text-[18px] ${activating ? "animate-spin" : ""}" aria-hidden="true">${activating ? "progress_activity" : active ? "check_circle" : "check"}</span>
          ${activating ? "Aplicando plantilla…" : active ? "Plantilla activa" : "Usar esta plantilla"}
        </button>
        <div id="tpl-activation-error" class="${_activationError ? "" : "hidden "}mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700" role="alert">${escapeHtml(_activationError)}</div>
      </div>
    </div>`;
}

function selectTemplate(id) {
  if (!id || id === _selectedId || _activatingId) return;
  _selectedId = id;
  renderWorkspace();
  document.getElementById("tpl-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  announce(`Vista previa de ${selectedTemplate()?.name || "la plantilla"} seleccionada.`);
  void ensurePdfPreview(id);
}

async function ensurePdfPreview(templateId, force = false) {
  if (!templateId || _previewCompilingId) return;
  if (!force && _pdfPreviews.has(templateId)) return;
  const template = _templates.find(item => item.id === templateId);
  if (!template) return;

  _previewCompilingId = templateId;
  _previewProgress = "Preparando los datos preliminares…";
  _previewErrors.delete(templateId);
  renderWorkspace();
  announce(`Compilando la vista previa PDF de ${template.name}.`);

  let stopProgress = null;
  try {
    stopProgress = await listen("jintia://compile-progress", ({ payload }) => {
      if (_previewCompilingId !== templateId) return;
      _previewProgress = payload?.message || "Compilando el PDF…";
      const progress = document.getElementById("tpl-preview-progress");
      if (progress) progress.textContent = _previewProgress;
    });

    const rootPath = await appLocalDataDir();
    const previewData = templatePreviewData(template);
    const structure = await createCourseStructure({
      rootPath,
      courseCode: previewData.courseCode,
      courseName: previewData.courseName,
      weeks: previewData.weeksData.length,
      initializeReadme: false,
    });
    if (!structure?.success) {
      throw new Error(structure?.message || "No se pudo preparar la carpeta temporal.");
    }

    const result = await compileSyllabusPdf({
      coursePath: rootPath,
      ...previewData,
      includeJintiaCredit: state.config?.includeJintiaCredit !== false,
      reuseIfValid: !force,
      previewTemplateId: templateId,
    });
    if (!result?.success || !result?.path) {
      throw new Error(result?.message || "El compilador no devolvió un PDF válido.");
    }
    _pdfPreviews.set(templateId, result.path);
    announce(`Vista previa PDF de ${template.name} lista.`);
  } catch (error) {
    _previewErrors.set(templateId, String(error));
    announce(`No se pudo compilar la vista previa de ${template.name}.`);
  } finally {
    if (stopProgress) stopProgress();
    _previewCompilingId = "";
    _previewProgress = "";
    renderWorkspace();
    if (_selectedId !== templateId && !_pdfPreviews.has(_selectedId)) {
      void ensurePdfPreview(_selectedId);
    }
  }
}

function templatePreviewData(template) {
  return buildSampleGuideData(state.config || {});
}

function pdfPreviewFrame(pdfPath, templateName) {
  const assetUrl = convertFileSrc(pdfPath);
  return `
    <iframe class="h-[min(62vh,680px)] min-h-[420px] w-full border-0 bg-slate-700"
      src="${escapeHtml(assetUrl)}#view=FitH&toolbar=0"
      title="PDF de prueba compilado con ${escapeHtml(templateName)}"></iframe>`;
}

function previewLoadingState() {
  return `
    <div class="grid min-h-[420px] place-items-center p-6 text-center text-white" role="status">
      <div class="max-w-[34ch]">
        <span class="material-symbols-outlined mb-3 block animate-spin text-[38px]" aria-hidden="true">progress_activity</span>
        <p class="font-semibold">Compilando un PDF real…</p>
        <p id="tpl-preview-progress" class="mt-2 text-xs leading-5 text-slate-200">${escapeHtml(_previewProgress || "Preparando LaTeX…")}</p>
        <p class="mt-3 text-[11px] leading-5 text-slate-300">La primera compilación puede tardar mientras se preparan los componentes de la plantilla.</p>
      </div>
    </div>`;
}

function previewWaitingState() {
  return `
    <div class="grid min-h-[420px] place-items-center p-6 text-center text-white">
      <div>
        <span class="material-symbols-outlined mb-3 block text-[38px] text-slate-300" aria-hidden="true">picture_as_pdf</span>
        <p class="text-sm font-semibold">Preparando la vista previa PDF…</p>
      </div>
    </div>`;
}

function previewErrorState(diagnostic) {
  return `
    <div class="grid min-h-[420px] place-items-center p-5 text-center text-white">
      <div class="max-w-[48ch]">
        <span class="material-symbols-outlined mb-3 block text-[38px] text-red-300" aria-hidden="true">error</span>
        <h3 class="font-bold">No pudimos compilar esta vista previa</h3>
        <p class="mt-2 text-xs leading-5 text-slate-200">Verifica el compilador LaTeX en Configuración → Entorno y vuelve a intentarlo.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="btn-retry-template-preview" type="button">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span> Reintentar
          </button>
          <button class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="btn-copy-template-diagnostic" type="button">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span> Copiar diagnóstico
          </button>
        </div>
        <details class="mt-4 text-left">
          <summary class="cursor-pointer text-xs font-semibold text-slate-200">Detalles técnicos</summary>
          <pre class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-[10px] leading-5 text-slate-200">${escapeHtml(diagnostic)}</pre>
        </details>
      </div>
    </div>`;
}

async function activateSelectedTemplate() {
  const template = selectedTemplate();
  if (!template || template.id === _activeId || _activatingId) return;
  _activatingId = template.id;
  _activationError = "";
  renderWorkspace();
  announce(`Aplicando ${template.name}…`);

  try {
    const result = await setActiveTemplate(template.id);
    if (!result?.success) throw new Error(result?.message || "No se pudo guardar la selección.");
    _activeId = template.id;
    toast(`"${template.name}" es ahora la plantilla activa`, "success");
    announce(`${template.name} es ahora la plantilla activa.`);
  } catch {
    _activationError = "No pudimos activar la plantilla. Comprueba la conexión y vuelve a intentarlo.";
    announce("No se pudo activar la plantilla.");
  } finally {
    _activatingId = "";
    renderWorkspace();
  }
}

function updateFilterButtons() {
  document.querySelectorAll(".tpl-filter-btn").forEach(button => {
    const selected = button.dataset.filter === _filter;
    button.setAttribute("aria-pressed", String(selected));
    button.className = cx(
      ui.button.base,
      selected ? ui.button.primary : ui.button.secondary,
      "min-h-11 px-3 text-xs tpl-filter-btn"
    );
  });
}

function loadingState() {
  return `
    <div class="grid min-h-[320px] place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center" role="status">
      <div>
        <span class="material-symbols-outlined mb-3 block animate-spin text-[34px] text-brand" aria-hidden="true">progress_activity</span>
        <p class="text-sm font-semibold text-app-text">Preparando las vistas previas…</p>
        <p class="mt-1 text-xs text-app-muted">Esto puede tardar unos segundos.</p>
      </div>
    </div>`;
}

function errorState() {
  return `
    <div class="grid min-h-[320px] place-items-center rounded-xl border border-red-200 bg-white p-8 text-center">
      <div class="max-w-[48ch]">
        <span class="material-symbols-outlined mb-3 block text-[34px] text-red-600" aria-hidden="true">error</span>
        <h2 class="text-base font-bold text-app-text">No pudimos cargar las plantillas</h2>
        <p class="mt-2 text-sm leading-6 text-app-muted">Comprueba la conexión con Jintia y vuelve a intentarlo.</p>
        <button class="${cx(ui.button.base, ui.button.secondary, "mt-4 min-h-11")}" id="btn-retry-templates" type="button">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span> Reintentar
        </button>
      </div>
    </div>`;
}

function emptyState(title, description, showAll = false) {
  return `
    <div class="grid min-h-[280px] place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div class="max-w-[48ch]">
        <span class="material-symbols-outlined mb-3 block text-[34px] text-slate-400" aria-hidden="true">description</span>
        <h2 class="text-base font-bold text-app-text">${escapeHtml(title)}</h2>
        <p class="mt-2 text-sm leading-6 text-app-muted">${escapeHtml(description)}</p>
        ${showAll ? `<button class="${cx(ui.button.base, ui.button.secondary, "mt-4 min-h-11 tpl-filter-btn")}" type="button" data-filter="all">Ver todas</button>` : ""}
      </div>
    </div>`;
}

function announce(message) {
  const status = document.getElementById("tpl-status");
  if (status) status.textContent = message;
}
