import { checkDependencies, checkNotebookLMAuth, createCourseStructure, getDefaultCourseRoot, getCourseState, getSetupStatus, listAccountNotebooksMcp, listNotebooksMcp, openExternal, pickDirectory, runNotebookLMAuth, saveNotebooksConfig } from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, cx, projectColorMap } from "../uiClasses.js";
import { ic, brandIcon, refreshIcons } from "../icons.js";
import { APP_META } from "../appMeta.js";

let _filter = "";
let _statusFilter = "all";
let _sort = "recent";
let _modalStep = 0;
let _modalData = {};
let _modalDirty = false;
let _modalOpener = null;
let _folderBusy = new Set();
let _eventsBound = false;
let _defaultCourseRootPromise = null;
let _appearanceIndex = -1;
let _appearanceDraft = {};
let _appearanceOpener = null;
let _courseStates = new Map();
let _statesLoading = false;
let _statesLoaded = false;
let _aiCheckBusy = new Set();
let _deleteIndex = -1;
let _deleteOpener = null;
let _notebookConnectIndex = -1;
let _notebookConnectDraft = {};
let _notebookConnectOpener = null;
// Caché de sesión: la biblioteca de NotebookLM es la misma para todos los
// cursos, así que se consulta una vez y se reutiliza hasta que el usuario
// pide "Refrescar" (evita relanzar el proceso MCP en cada render).
let _notebookLibrary = { status: "idle", entries: [], message: "" };

const REQUIRED_WEEK_FIELDS = ["title", "unit", "topics", "outcomes", "bibliography", "graded_activity"];
// Project color palette: hex values are stored in the database for persistence,
// but CSS custom properties (styles.css) define the actual rendered colors,
// allowing theme changes without modifying stored data.
// Single source of truth: derived from projectColorMap (uiClasses.js) so this
// list can't drift out of sync with the documented design system palette.
const PROJECT_COLORS = Object.values(projectColorMap).map(({ hex, cssVar, label }) => ({ value: hex, cssVar, label }));
const PROJECT_ICONS = [
  { value: "folder", label: "Carpeta" },
  { value: "school", label: "Académico" },
  { value: "database", label: "Datos" },
  { value: "science", label: "Ciencia" },
  { value: "psychology", label: "Ideas" },
  { value: "palette", label: "Creativo" },
];
// Los valores de arriba se guardan tal cual (compatibilidad con datos existentes);
// este mapa solo traduce el valor guardado al nombre real del ícono Lucide.
const PROJECT_ICON_LUCIDE = { folder: "folder", school: "graduation-cap", database: "database", science: "flask-conical", psychology: "brain", palette: "palette" };

function projectColor(course) {
  // Returns the hex value stored in course.project_color for use in style attributes.
  // The actual rendered color is controlled by CSS custom properties in styles.css.
  return PROJECT_COLORS.some(option => option.value === course?.project_color) ? course.project_color : PROJECT_COLORS[0].value;
}

function projectIcon(course) {
  return PROJECT_ICONS.some(option => option.value === course?.project_icon) ? course.project_icon : PROJECT_ICONS[0].value;
}

function projectBadge(course, extraClass = "") {
  return `<span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${extraClass}" style="background:${projectColor(course)}18;color:${projectColor(course)}" aria-hidden="true">${ic(PROJECT_ICON_LUCIDE[projectIcon(course)] || "folder", 20)}</span>`;
}

function defaultCourseRoot() {
  if (!_defaultCourseRootPromise) {
    _defaultCourseRootPromise = getDefaultCourseRoot()
      .then(result => result?.success ? result.path || "" : "")
      .catch(() => "");
  }
  return _defaultCourseRootPromise;
}

function bindGlobalEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  document.addEventListener("jintia:new-course", event => openModal(event.detail?.opener));
}

bindGlobalEvents();

function courseProgress(course) {
  const total = Math.min(52, Math.max(1, Number(course.weeks) || 16));
  const trackedWeeks = _courseStates.get(course.project_path || "");
  if (trackedWeeks) {
    const statuses = Object.values(trackedWeeks);
    const complete = statuses.filter(item => ["compiled", "complete"].includes(item?.status)).length;
    const outdated = statuses.filter(item => item?.status === "outdated").length;
    const started = statuses.length > 0;
    const status = outdated ? "outdated" : complete === total ? "complete" : started ? "progress" : "pending";
    return { complete: Math.min(complete, total), total, pct: Math.round((Math.min(complete, total) / total) * 100), status, outdated };
  }
  const weeks = Array.isArray(course.weeks_data) ? course.weeks_data : [];
  const complete = Array.from({ length: total }, (_, index) => {
    const week = weeks[index];
    return week?.status === "complete" && REQUIRED_WEEK_FIELDS.every(key => String(week?.[key] || "").trim());
  }).filter(Boolean).length;
  const started = weeks.some(week => week && Object.values(week).some(value => value !== null && value !== "" && value !== undefined));
  const status = complete === total ? "complete" : started ? "progress" : "pending";
  return { complete, total, pct: Math.round((complete / total) * 100), status, outdated: 0 };
}

function statusView(progress) {
  return {
    complete: { label: "Lista", icon: "check-circle-2", classes: "border-green-200 bg-green-50 text-green-700" },
    progress: { label: "En progreso", icon: "loader-2", classes: "border-teal-200 bg-teal-50 text-teal-700" },
    outdated: { label: "Desactualizado", icon: "refresh-ccw-dot", classes: "border-amber-200 bg-amber-50 text-amber-700" },
    pending: { label: "Pendiente", icon: "circle", classes: "border-slate-200 bg-slate-50 text-slate-600" },
  }[progress.status];
}

function persistCourseList(nextCourses, successMessage) {
  const previous = state.courses;
  state.courses = nextCourses;
  _statesLoaded = false;
  _courseStates = new Map();
  try {
    saveCourses();
    syncNotebooksFromCourses();
    if (successMessage) toast(successMessage, "success", 3200);
    return true;
  } catch (error) {
    state.courses = previous;
    toast(`No se pudieron guardar los cambios. Libera espacio e inténtalo nuevamente. (${error})`, "error", 7000);
    return false;
  }
}

export function renderCourses() {
  const el = document.getElementById("p-courses");
  if (!el) return;

  if (!_statesLoaded && !_statesLoading && state.courses.some(course => course.project_path)) {
    _statesLoading = true;
    Promise.all(state.courses.filter(course => course.project_path).map(async course => [course.project_path, await getCourseState(course.project_path).catch(() => null)]))
      .then(entries => {
        _courseStates = new Map(entries.filter(([, result]) => result?.success && result.exists).map(([projectPath, result]) => [projectPath, result.state?.weeks || {}]));
        _statesLoaded = true;
        _statesLoading = false;
        renderCourses();
      })
      .catch(() => { _statesLoaded = true; _statesLoading = false; });
  }

  const summaries = state.courses.map(courseProgress);
  const total = state.courses.length;
  const inProgress = summaries.filter(item => item.status === "progress").length;
  const ready = summaries.filter(item => item.status === "complete").length;

  el.innerHTML = `
    <div class="${ui.layout.stack}">
      <section class="${cx(ui.surface.cardGlass, 'p-4')}" aria-labelledby="courses-summary-title">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="courses-summary-title" class="text-xl font-bold leading-7 text-brand-950">Tus caminos de aprendizaje</h2>
            <p class="mt-1 text-sm leading-5 text-slate-500">Organiza asignaturas, sílabos, semanas y materiales.</p>
            <p class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
              ${ic("sparkles", 15)}
              Usa tu skill con Claude, ChatGPT y Codex
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
            ${summaryMetric(total, "Asignaturas", "graduation-cap")}
            ${summaryMetric(inProgress, "En progreso", "notebook-pen")}
            ${summaryMetric(ready, "Listas", "check-circle-2")}
          </div>
        </div>
      </section>

      <section class="${cx(ui.surface.cardGlass, 'flex flex-col gap-3 p-3 sm:flex-row sm:items-center')}" aria-label="Buscar y filtrar asignaturas">
        <div class="relative min-w-0 flex-1">
          <label for="courses-search-input" class="sr-only">Buscar asignaturas</label>
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden="true">${ic("search", 18)}</span>
          <input class="h-11 pl-10 pr-10" id="courses-search-input" type="search" placeholder="Buscar por código, nombre o período" value="${escapeHtml(_filter)}">
          <button type="button" class="${_filter ? "flex" : "hidden"} absolute inset-y-0 right-1 h-11 w-11 items-center justify-center rounded-full border-transparent bg-transparent text-app-muted hover:text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" id="courses-clear-search" aria-label="Limpiar búsqueda">
            <span class="text-[18px]">${ic("x", 18)}</span>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex">
          <label for="courses-status-filter" class="sr-only">Filtrar por estado</label>
          <select id="courses-status-filter" class="h-11 min-w-0 sm:w-[150px]">
            <option value="all" ${_statusFilter === "all" ? "selected" : ""}>Todos los estados</option>
            <option value="pending" ${_statusFilter === "pending" ? "selected" : ""}>Pendientes</option>
            <option value="progress" ${_statusFilter === "progress" ? "selected" : ""}>En progreso</option>
            <option value="complete" ${_statusFilter === "complete" ? "selected" : ""}>Listas</option>
          </select>
          <label for="courses-sort" class="sr-only">Ordenar asignaturas</label>
          <select id="courses-sort" class="h-11 min-w-0 sm:w-[145px]">
            <option value="recent" ${_sort === "recent" ? "selected" : ""}>Más recientes</option>
            <option value="name" ${_sort === "name" ? "selected" : ""}>Nombre A–Z</option>
            <option value="progress" ${_sort === "progress" ? "selected" : ""}>Mayor avance</option>
          </select>
        </div>
        <button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11 shrink-0')}" id="btn-new-course">
          ${ic("plus", 17)}
          Nueva asignatura
        </button>
      </section>

      <section class="min-h-0 flex-1" id="courses-results" aria-live="polite">
        ${renderCourseResults()}
      </section>
    </div>

    <div class="fixed inset-0 z-[5000] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="course-modal">
      <div class="max-h-[calc(100vh-24px)] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]"
        id="course-modal-box" role="dialog" aria-modal="true" aria-labelledby="course-modal-title"></div>
    </div>
    <div class="fixed inset-0 z-[5100] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="project-appearance-modal">
      <div class="max-h-[calc(100vh-24px)] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]" id="project-appearance-box"
        role="dialog" aria-modal="true" aria-labelledby="project-appearance-title"></div>
    </div>
    <div class="fixed inset-0 z-[5150] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="course-delete-modal">
      <div class="w-full max-w-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" id="course-delete-box"
        role="dialog" aria-modal="true" aria-labelledby="course-delete-title"></div>
    </div>
    <div class="fixed inset-0 z-[5150] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="notebook-connect-modal">
      <div class="w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" id="notebook-connect-box"
        role="dialog" aria-modal="true" aria-labelledby="notebook-connect-title"></div>
    </div>`;

  refreshIcons();
  bindPageEvents();
}

function summaryMetric(value, label, icon) {
  return `
    <div class="min-w-0 rounded-lg bg-slate-50 px-2 py-2">
      <div class="flex items-center justify-center gap-1 text-app-text">
        <span class="text-brand-600">${ic(icon, 16)}</span>
        <strong class="text-base">${value}</strong>
      </div>
      <span class="block truncate text-[11px] text-app-muted">${label}</span>
    </div>`;
}

function filteredCourses() {
  const query = _filter.trim().toLocaleLowerCase("es");
  const rows = state.courses
    .map((course, index) => ({ course, index, progress: courseProgress(course) }))
    .filter(({ course, progress }) => {
      const textMatch = !query || [course.code, course.name, course.period, course.semester]
        .some(value => String(value || "").toLocaleLowerCase("es").includes(query));
      return textMatch && (_statusFilter === "all" || progress.status === _statusFilter);
    });

  return rows.sort((a, b) => {
    if (_sort === "name") return String(a.course.name).localeCompare(String(b.course.name), "es");
    if (_sort === "progress") return b.progress.pct - a.progress.pct;
    return b.index - a.index;
  });
}

function renderCourseResults() {
  if (state.courses.length === 0) return renderEmptyState();
  const rows = filteredCourses();
  if (rows.length === 0) return renderNoResults();

  return `
    <div class="${cx(ui.surface.cardGlass, 'relative hidden min-h-0 overflow-visible lg:block')}">
      <table class="${ui.table.base}">
        <caption class="sr-only">Asignaturas registradas y avance del sílabo</caption>
        <thead>
          <tr class="${ui.table.headRow}">
            <th class="${ui.table.th}">Asignatura</th>
            <th class="${ui.table.th}">Período</th>
            <th class="${ui.table.th}">Avance</th>
            <th class="${ui.table.th}">Proyecto</th>
            <th class="${cx(ui.table.th, 'w-[228px] text-right')}">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows.map(renderDesktopRow).join("")}</tbody>
      </table>
      <div class="border-t border-slate-200 px-4 py-3 text-xs text-app-muted">${rows.length} de ${state.courses.length} asignaturas</div>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
      ${rows.map(renderCourseCard).join("")}
    </div>`;
}

function renderDesktopRow({ course, index, progress }) {
  const status = statusView(progress);
  const prepared = course.project_status === "ready";
  return `
    <tr class="${ui.table.row}">
      <td class="${ui.table.td}">
        <div class="flex min-w-0 items-center gap-3">
          ${projectBadge(course)}
          <button type="button" class="group/course min-w-0 border-transparent bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="edit" data-index="${index}">
            <span class="block font-bold text-app-text group-hover/course:text-brand">${escapeHtml(course.name)}</span>
            <span class="mt-0.5 block text-xs font-semibold text-brand">${escapeHtml(course.code)}</span>
          </button>
        </div>
      </td>
      <td class="${ui.table.td}">
        <span class="block text-app-text">${escapeHtml(course.period || "Sin período")}</span>
        <span class="mt-0.5 block text-xs text-app-muted">${escapeHtml(course.semester || "Sin semestre")} · ${Number(course.credits) || 0} créditos</span>
      </td>
      <td class="${ui.table.td}">
        <div class="flex items-center gap-2">
          <div class="h-2 w-20 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Avance de ${escapeHtml(course.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.pct}">
            <div class="h-full rounded-full bg-path-500" style="width:${progress.pct}%"></div>
          </div>
          <span class="text-xs font-semibold text-app-text">${progress.complete}/${progress.total}</span>
        </div>
        <span class="mt-1 inline-flex items-center gap-1 text-xs font-semibold ${status.classes.split(" ").at(-1)}">
          ${ic(status.icon, 15)}${status.label}
        </span>
      </td>
      <td class="${ui.table.td}">
        <span class="inline-flex items-center gap-1.5 text-xs ${prepared ? "text-green-700" : "text-app-muted"}">
          <span style="color:${projectColor(course)}">${ic(prepared ? (PROJECT_ICON_LUCIDE[projectIcon(course)] || "folder") : "folder-x", 16)}</span>
          ${prepared ? "Preparado" : course.project_status === "error" ? "Error al crear" : "Carpeta no creada"}
        </span>
      </td>
      <td class="${ui.table.td}">
        <div class="flex justify-end gap-1.5">
          ${renderAiButtons(index, course)}
          <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'min-h-11 px-3')}" data-course-action="edit" data-index="${index}">
            Editar
          </button>
          ${renderMoreMenu(index, course)}
        </div>
      </td>
    </tr>`;
}

function renderCourseCard({ course, index, progress }) {
  const status = statusView(progress);
  return `
    <article class="${cx(ui.surface.cardGlass, 'flex min-w-0 flex-col p-4')}">
      <div class="flex min-w-0 items-center gap-3">
        ${projectBadge(course)}
        <button type="button" class="min-w-0 flex-1 border-transparent bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="edit" data-index="${index}">
          <span class="block truncate text-sm font-extrabold text-app-text">${escapeHtml(course.name)}</span>
          <span class="mt-1 block text-xs font-semibold text-brand">${escapeHtml(course.code)}</span>
        </button>
      </div>
      <p class="mt-2 text-xs text-app-muted">${escapeHtml(course.period || "Sin período")} · ${escapeHtml(course.semester || "Sin semestre")}</p>
      <div class="mt-4">
        <div class="mb-1.5 flex items-center justify-between text-xs">
          <span class="font-semibold ${status.classes.split(" ").at(-1)}">${status.label}</span>
          <span class="text-app-muted">${progress.complete} de ${progress.total} semanas</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-200"><div class="h-full rounded-full bg-brand" style="width:${progress.pct}%"></div></div>
      </div>
      <div class="mt-4 flex gap-1.5">
        <button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11 flex-1')}" data-course-action="edit" data-index="${index}">Continuar</button>
        ${renderAiButtons(index, course)}
        ${renderMoreMenu(index, course)}
      </div>
    </article>`;
}

function renderAiButtons(index, course) {
  const prepared = Boolean(String(course.project_path || "").trim());
  return `
    <button type="button" class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 p-0')}" data-course-action="ai" data-ai-provider="chatgpt" data-index="${index}" aria-label="Abrir ${escapeHtml(course.name)} con ChatGPT" title="Abrir con ChatGPT">
      ${brandIcon("openai", 18)}
    </button>
    <button type="button" class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 p-0')}" data-course-action="ai" data-ai-provider="claude" data-index="${index}" aria-label="Abrir ${escapeHtml(course.name)} con Claude Code" title="${prepared ? "Abrir con Claude Code" : "Primero prepara la carpeta del proyecto"}" ${prepared ? "" : "disabled"}>
      ${brandIcon("claude", 18)}
    </button>`;
}

function renderMoreMenu(index, course) {
  const busy = _folderBusy.has(index);
  return `
    <details class="relative">
      <summary class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 cursor-pointer list-none p-0')}" aria-label="Más acciones para ${escapeHtml(course.name)}">
        ${ic("more-horizontal", 20)}
      </summary>
      <div class="absolute right-0 top-12 z-50 min-w-[205px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg border-transparent bg-transparent px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="folders" data-index="${index}" ${busy ? "disabled aria-busy=\"true\"" : ""}>
          ${ic(busy ? "loader-2" : "folder-plus", 17)}
          ${busy ? "Preparando…" : course.project_status === "ready" ? "Recrear estructura" : "Crear carpeta del proyecto"}
        </button>
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg border-transparent bg-transparent px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="appearance" data-index="${index}">
          ${ic("palette", 17)}
          Personalizar en Jintia
        </button>
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg border-transparent bg-transparent px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="notebook" data-index="${index}">
          ${ic("book-open", 17)}
          ${course.notebook_id ? "Cambiar NotebookLM" : "Conectar NotebookLM"}
        </button>
        <div class="my-1 border-t border-slate-100"></div>
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg border-transparent bg-transparent px-3 text-left text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600" data-course-action="delete" data-index="${index}">
          ${ic("trash-2", 17)}
          Eliminar del registro
        </button>
      </div>
    </details>`;
}

function renderEmptyState() {
  return `
    <div class="${cx(ui.surface.cardGlass, 'flex min-h-[360px] flex-col items-center justify-center p-8 text-center')}">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-brand">
        ${ic("graduation-cap", 32)}
      </div>
      <h3 class="title-medium text-app-text">Crea tu primera asignatura</h3>
      <p class="mt-3 max-w-[420px] text-sm leading-6 text-app-muted">Registra la información académica, prepara la estructura del proyecto y comienza el sílabo semanal con guías validadas pedagógicamente.</p>
      <button type="button" class="${cx(ui.button.base, ui.button.primary, 'mt-5 min-h-11')}" id="btn-empty-new-course">
        ${ic("plus", 17)}Nueva asignatura
      </button>
    </div>`;
}

function renderNoResults() {
  return `
    <div class="${cx(ui.surface.cardGlass, 'flex min-h-[300px] flex-col items-center justify-center p-8 text-center')}">
      <span class="text-slate-400">${ic("search-x", 38)}</span>
      <h3 class="title-medium mt-3 text-app-text">No encontramos asignaturas</h3>
      <p class="mt-2 text-sm text-app-muted">Prueba con otro término de búsqueda o elimina los filtros actuales.</p>
      <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'mt-4 min-h-11')}" id="courses-clear-filters">Limpiar búsqueda y filtros</button>
    </div>`;
}

function bindPageEvents() {
  const input = document.getElementById("courses-search-input");
  input?.addEventListener("input", event => {
    _filter = event.target.value;
    updateResults();
    const clear = document.getElementById("courses-clear-search");
    clear?.classList.toggle("hidden", !_filter);
    clear?.classList.toggle("flex", Boolean(_filter));
  });
  document.getElementById("courses-clear-search")?.addEventListener("click", () => {
    _filter = "";
    if (input) input.value = "";
    updateResults();
    input?.focus();
  });
  document.getElementById("courses-status-filter")?.addEventListener("change", event => {
    _statusFilter = event.target.value;
    updateResults();
  });
  document.getElementById("courses-sort")?.addEventListener("change", event => {
    _sort = event.target.value;
    updateResults();
  });
  document.getElementById("btn-new-course")?.addEventListener("click", event => openModal(event.currentTarget));
  document.getElementById("btn-empty-new-course")?.addEventListener("click", event => openModal(event.currentTarget));
  bindResultEvents();

  const overlay = document.getElementById("course-modal");
  overlay?.addEventListener("mousedown", event => {
    if (event.target === overlay) requestCloseModal();
  });
  overlay?.addEventListener("keydown", handleModalKeydown);
  const appearanceOverlay = document.getElementById("project-appearance-modal");
  appearanceOverlay?.addEventListener("mousedown", event => {
    if (event.target === appearanceOverlay) closeAppearanceModal();
  });
  appearanceOverlay?.addEventListener("keydown", handleAppearanceKeydown);

  const deleteOverlay = document.getElementById("course-delete-modal");
  deleteOverlay?.addEventListener("mousedown", event => {
    if (event.target === deleteOverlay) closeDeleteModal();
  });
  deleteOverlay?.addEventListener("keydown", handleDeleteKeydown);

  const notebookOverlay = document.getElementById("notebook-connect-modal");
  notebookOverlay?.addEventListener("mousedown", event => {
    if (event.target === notebookOverlay) closeNotebookConnectModal();
  });
  notebookOverlay?.addEventListener("keydown", handleNotebookConnectKeydown);
}

function updateResults() {
  const results = document.getElementById("courses-results");
  if (!results) return;
  results.innerHTML = renderCourseResults();
  refreshIcons();
  bindResultEvents();
  document.getElementById("courses-clear-filters")?.addEventListener("click", () => {
    _filter = "";
    _statusFilter = "all";
    _sort = "recent";
    renderCourses();
    document.getElementById("courses-search-input")?.focus();
  });
}

function bindResultEvents() {
  document.querySelectorAll("[data-course-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      const index = safeIndex(button.dataset.index, state.courses.length);
      if (index < 0) return;
      if (button.dataset.courseAction === "edit") editCourse(index);
      if (button.dataset.courseAction === "folders") generateFolders(index, button);
      if (button.dataset.courseAction === "appearance") openAppearanceModal(index, button);
      if (button.dataset.courseAction === "notebook") openNotebookConnectModal(index, button);
      if (button.dataset.courseAction === "ai") openCourseWithAi(index, button.dataset.aiProvider);
      if (button.dataset.courseAction === "delete") openDeleteModal(index, button);
    });
  });
}

function courseAiPrompt(course, provider) {
  const folder = String(course.project_path || "").trim();
  const base = `Trabaja con la asignatura ${course.code} — ${course.name}. Carpeta local: ${folder}.`;
  return provider === "claude"
    ? `${base} Revisa primero la estructura del proyecto y ayúdame con la tarea que te indicaré.`
    : `${base} Revisa el contenido de la carpeta y ayúdame con la tarea que te indicaré.`;
}

async function openCourseWithAi(index, provider) {
  if (_aiCheckBusy.has(index)) return;
  const course = state.courses[index];
  if (!course) return;
  const folder = String(course.project_path || "").trim();
  _aiCheckBusy.add(index);
  toast("Verificando skill, conexión y entorno…", "loading", 30000);
  try {
    const readiness = await validateAiReadiness(course, provider);
    if (!readiness.ready) {
      toast(`${readiness.title} ${readiness.missing.join(" ")}`, "error", 9000);
      if (readiness.settingsSection) {
        navigate("settings");
        queueMicrotask(() => document.querySelector(`[data-settings-nav][data-section="${readiness.settingsSection}"]`)?.click());
      }
      return;
    }
    const prompt = courseAiPrompt(course, provider);
    const deepLink = provider === "claude"
      ? `claude-cli://open?cwd=${encodeURIComponent(folder)}&q=${encodeURIComponent(prompt)}`
      : `codex://threads/new?path=${encodeURIComponent(folder)}&prompt=${encodeURIComponent(prompt)}`;
    await openExternal(deepLink);
    toast(
      provider === "claude"
        ? "Claude Code se abrirá y solicitará confirmar la carpeta del proyecto."
        : "ChatGPT se abrirá con la carpeta del proyecto cargada; confirma el mensaje para enviarlo.",
      "success",
      6000,
    );
  } catch (error) {
    toast(`No se pudo abrir ${provider === "claude" ? "Claude Code" : "la aplicación de ChatGPT"}. (${error})`, "error", 7000);
  } finally {
    _aiCheckBusy.delete(index);
  }
}

async function validateAiReadiness(course, provider) {
  const missing = [];
  const folder = String(course.project_path || "").trim();
  if (!folder) {
    missing.push("Prepara primero la carpeta del proyecto desde el menú de la asignatura.");
    return { ready: false, title: "No se puede abrir la IA.", missing, settingsSection: null };
  }

  const [setup, dependencies] = await Promise.all([getSetupStatus(), checkDependencies()]);
  const requiredMissing = (dependencies || [])
    .filter(dependency => dependency.required && !dependency.installed)
    .map(dependency => dependency.name);
  if (requiredMissing.length) {
    missing.push(`Faltan herramientas requeridas: ${requiredMissing.join(", ")}.`);
    return { ready: false, title: "El entorno todavía no está listo.", missing, settingsSection: "environment" };
  }

  if (provider === "claude") {
    if (!setup?.skill_installed || !setup?.skill_current) missing.push("Instala o actualiza jintia-skill.");
    if (!setup?.mcp_claude_code_configured) missing.push("Configura la conexión de Claude Code.");
    return {
      ready: missing.length === 0,
      title: "Claude Code todavía no está listo.",
      missing,
      settingsSection: missing.some(item => item.includes("conexión")) ? "mcp-config" : "app-prefs",
    };
  }

  if (!setup?.openai_plugin_installed || !setup?.openai_plugin_current) {
    missing.push("Instala o actualiza el plugin de Jintia para ChatGPT y Codex.");
  }
  return {
    ready: missing.length === 0,
    title: "ChatGPT todavía no está listo.",
    missing,
    settingsSection: "app-prefs",
  };
}

function openDeleteModal(index, opener) {
  const course = state.courses[index];
  if (!course) return;
  _deleteIndex = index;
  _deleteOpener = opener || document.activeElement;
  const overlay = document.getElementById("course-delete-modal");
  const box = document.getElementById("course-delete-box");
  if (!overlay || !box) return;
  box.innerHTML = `
    <div class="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
      <span class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden="true">${ic("trash-2", 20)}</span>
      <div>
        <h2 id="course-delete-title" class="text-base font-bold text-app-text">Eliminar del registro</h2>
        <p class="mt-1 text-sm text-app-muted">¿Eliminar <strong class="font-semibold text-app-text">"${escapeHtml(course.code)} — ${escapeHtml(course.name)}"</strong> del registro? Las carpetas y archivos del disco se conservarán.</p>
      </div>
    </div>
    <div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
      <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="delete-cancel">Cancelar</button>
      <button type="button" class="${cx(ui.button.base, ui.button.danger, "min-h-11")}" id="delete-confirm">${ic("trash-2", 17)}Eliminar del registro</button>
    </div>`;
  refreshIcons();
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
  box.querySelector("#delete-cancel")?.addEventListener("click", () => closeDeleteModal());
  box.querySelector("#delete-confirm")?.addEventListener("click", () => confirmDelete());
  queueMicrotask(() => box.querySelector("#delete-cancel")?.focus());
}

function closeDeleteModal(restoreFocus = true) {
  const overlay = document.getElementById("course-delete-modal");
  overlay?.classList.add("hidden");
  overlay?.classList.remove("flex");
  if (restoreFocus) _deleteOpener?.focus?.();
  _deleteIndex = -1;
}

function handleDeleteKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDeleteModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...document.querySelectorAll("#course-delete-box button:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function confirmDelete() {
  const index = _deleteIndex;
  const course = state.courses[index];
  closeDeleteModal(false);
  if (!course) return;
  const next = state.courses.filter((_, courseIndex) => courseIndex !== index);
  if (persistCourseList(next)) {
    if (state.editingCourse === index) state.editingCourse = undefined;
    else if (state.editingCourse > index) state.editingCourse -= 1;
    renderCourses();
    toast("Asignatura eliminada del registro. Los archivos permanecen en el disco.", "info", 4500);
  }
}

function identityPickerMarkup(color, icon, prefix) {
  return `
    <fieldset class="mt-3 rounded-xl border border-slate-200 p-4">
      <legend class="px-1 text-sm font-bold text-app-text">Identidad visual en Jintia</legend>
      <p class="mb-3 text-xs leading-5 text-app-muted">Ayuda a reconocer el proyecto rápidamente. No modifica el icono de la carpeta de Windows.</p>
      <div class="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <span class="inline-flex h-12 w-12 items-center justify-center rounded-xl" style="background:${color}18;color:${color}" aria-hidden="true">
          ${ic(PROJECT_ICON_LUCIDE[icon] || "folder", 25)}
        </span>
        <div>
          <strong class="block text-sm text-app-text">Vista del proyecto</strong>
          <span class="text-xs text-app-muted">Visible en Cursos y PDFs</span>
        </div>
      </div>
      <span class="mt-4 block text-xs font-bold text-slate-700" id="${prefix}-icon-label">Icono</span>
      <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-labelledby="${prefix}-icon-label">
        ${PROJECT_ICONS.map(option => `
          <button type="button" class="flex min-h-11 items-center justify-center rounded-xl border ${option.value === icon ? "border-brand bg-brand-soft text-brand ring-2 ring-brand/20" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}" data-project-icon="${option.value}" aria-pressed="${option.value === icon}" title="${option.label}" aria-label="${option.label}">
            ${ic(PROJECT_ICON_LUCIDE[option.value] || "folder", 20)}
          </button>`).join("")}
      </div>
      <span class="mt-4 block text-xs font-bold text-slate-700" id="${prefix}-color-label">Color</span>
      <div class="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="${prefix}-color-label">
        ${PROJECT_COLORS.map(option => `
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white shadow-sm ${option.value === color ? "ring-2 ring-slate-800 ring-offset-1" : "ring-1 ring-slate-200"}" style="background:${option.value}" data-project-color="${option.value}" aria-pressed="${option.value === color}" title="${option.label}" aria-label="${option.label}">
            ${option.value === color ? `<span class="text-white">${ic("check", 18)}</span>` : ""}
          </button>`).join("")}
      </div>
    </fieldset>`;
}

function openAppearanceModal(index, opener) {
  const course = state.courses[index];
  if (!course) return;
  _appearanceIndex = index;
  _appearanceOpener = opener || document.activeElement;
  _appearanceDraft = { color: projectColor(course), icon: projectIcon(course) };
  const overlay = document.getElementById("project-appearance-modal");
  overlay?.classList.remove("hidden");
  overlay?.classList.add("flex");
  renderAppearanceModal();
}

function renderAppearanceModal() {
  const course = state.courses[_appearanceIndex];
  const box = document.getElementById("project-appearance-box");
  if (!course || !box) return;
  box.innerHTML = `
    <div class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
      <div>
        <h2 id="project-appearance-title" class="text-base font-bold text-app-text">Personalizar proyecto</h2>
        <p class="mt-1 text-xs text-app-muted">${escapeHtml(course.code)} · ${escapeHtml(course.name)}</p>
      </div>
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, "h-11 w-11 p-0")}" id="appearance-close" aria-label="Cerrar">${ic("x", 20)}</button>
    </div>
    <div class="px-5 pb-5">${identityPickerMarkup(_appearanceDraft.color, _appearanceDraft.icon, "appearance")}</div>
    <div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
      <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="appearance-cancel">Cancelar</button>
      <button type="button" class="${cx(ui.button.base, ui.button.primary, "min-h-11")}" id="appearance-save">Guardar apariencia</button>
    </div>`;
  refreshIcons();
  box.querySelector("#appearance-close")?.addEventListener("click", closeAppearanceModal);
  box.querySelector("#appearance-cancel")?.addEventListener("click", closeAppearanceModal);
  box.querySelectorAll("[data-project-color]").forEach(button => button.addEventListener("click", () => {
    _appearanceDraft.color = button.dataset.projectColor;
    renderAppearanceModal();
    queueMicrotask(() => box.querySelector(`[data-project-color="${_appearanceDraft.color}"]`)?.focus());
  }));
  box.querySelectorAll("[data-project-icon]").forEach(button => button.addEventListener("click", () => {
    _appearanceDraft.icon = button.dataset.projectIcon;
    renderAppearanceModal();
    queueMicrotask(() => box.querySelector(`[data-project-icon="${_appearanceDraft.icon}"]`)?.focus());
  }));
  box.querySelector("#appearance-save")?.addEventListener("click", saveAppearance);
  queueMicrotask(() => box.querySelector("[data-project-icon][aria-pressed='true']")?.focus());
}

function saveAppearance() {
  const next = state.courses.map((course, index) => index === _appearanceIndex
    ? { ...course, project_color: _appearanceDraft.color, project_icon: _appearanceDraft.icon }
    : course);
  if (!persistCourseList(next, "Apariencia del proyecto actualizada")) return;
  closeAppearanceModal(false);
  renderCourses();
}

function closeAppearanceModal(restoreFocus = true) {
  const overlay = document.getElementById("project-appearance-modal");
  overlay?.classList.add("hidden");
  overlay?.classList.remove("flex");
  if (restoreFocus) _appearanceOpener?.focus?.();
  _appearanceIndex = -1;
}

function handleAppearanceKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeAppearanceModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...document.querySelectorAll("#project-appearance-box button:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openNotebookConnectModal(index, opener) {
  const course = state.courses[index];
  if (!course) return;
  _notebookConnectIndex = index;
  _notebookConnectOpener = opener || document.activeElement;
  _notebookConnectDraft = {
    notebook_id: course.notebook_id || "",
    notebook_name: course.notebook_name || "",
    notebook_url: course.notebook_url || "",
  };
  const overlay = document.getElementById("notebook-connect-modal");
  overlay?.classList.remove("hidden");
  overlay?.classList.add("flex");
  renderNotebookConnectModal();
}

function renderNotebookConnectModal() {
  const course = state.courses[_notebookConnectIndex];
  const box = document.getElementById("notebook-connect-box");
  if (!course || !box) return;
  box.innerHTML = `
    <div class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
      <div>
        <h2 id="notebook-connect-title" class="text-base font-bold text-app-text">Conectar NotebookLM</h2>
        <p class="mt-1 text-xs text-app-muted">${escapeHtml(course.code)} · ${escapeHtml(course.name)}</p>
      </div>
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, "h-11 w-11 p-0")}" id="notebook-connect-close" aria-label="Cerrar">${ic("x", 20)}</button>
    </div>
    <div class="px-5 pb-5">${notebookPickerMarkup(_notebookConnectDraft)}</div>
    <div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
      <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="notebook-connect-cancel">Cancelar</button>
      <button type="button" class="${cx(ui.button.base, ui.button.primary, "min-h-11")}" id="notebook-connect-save">Guardar</button>
    </div>`;
  refreshIcons();
  box.querySelector("#notebook-connect-close")?.addEventListener("click", () => closeNotebookConnectModal());
  box.querySelector("#notebook-connect-cancel")?.addEventListener("click", () => closeNotebookConnectModal());
  box.querySelector("#notebook-connect-save")?.addEventListener("click", saveNotebookConnection);
  bindNotebookPickerEvents(box, _notebookConnectDraft, renderNotebookConnectModal);
  ensureNotebookLibrary(false, renderNotebookConnectModal);
  queueMicrotask(() => box.querySelector("#notebook-connect-close")?.focus());
}

function saveNotebookConnection() {
  const next = state.courses.map((course, index) => index === _notebookConnectIndex
    ? { ...course, notebook_id: _notebookConnectDraft.notebook_id, notebook_name: _notebookConnectDraft.notebook_name, notebook_url: _notebookConnectDraft.notebook_url }
    : course);
  if (!persistCourseList(next, _notebookConnectDraft.notebook_id ? "NotebookLM conectado" : "NotebookLM desconectado")) return;
  closeNotebookConnectModal(false);
  renderCourses();
}

function closeNotebookConnectModal(restoreFocus = true) {
  const overlay = document.getElementById("notebook-connect-modal");
  overlay?.classList.add("hidden");
  overlay?.classList.remove("flex");
  if (restoreFocus) _notebookConnectOpener?.focus?.();
  _notebookConnectIndex = -1;
}

function handleNotebookConnectKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeNotebookConnectModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...document.querySelectorAll("#notebook-connect-box button:not([disabled]), #notebook-connect-box select:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function editCourse(index) {
  state.editingCourse = index;
  navigate("syllabus");
}

async function generateFolders(index, button) {
  if (_folderBusy.has(index)) return;
  const course = state.courses[index];
  if (!course) return;
  const suggestedRoot = course.project_root || await defaultCourseRoot();
  const rootPath = await pickDirectory(
    `Selecciona dónde preparar ${course.code} — ${course.name}`,
    suggestedRoot || undefined,
  );
  if (!rootPath) return;

  const originalHtml = button.innerHTML;
  _folderBusy.add(index);
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span class="animate-spin">${ic("loader-2", 17)}</span>Preparando proyecto…`;
  refreshIcons();
  toast("Preparando carpetas y README del proyecto…", "loading", 30000);
  try {
    const result = await createCourseStructure({
      rootPath,
      courseCode: course.code,
      courseName: course.name,
      weeks: Math.trunc(Number(course.weeks)),
      initializeReadme: true,
    });
    if (!result.success) throw new Error(result.message);
    const next = state.courses.map((item, courseIndex) => courseIndex === index
      ? { ...item, project_status: "ready", project_root: rootPath, project_path: result.path || "", project_updated_at: new Date().toISOString() }
      : item);
    if (persistCourseList(next)) {
      toast(result.message, "success", 7000);
      renderCourses();
    }
  } catch (error) {
    toast(`No se pudo preparar el proyecto. Revisa la carpeta elegida y vuelve a intentarlo. (${error})`, "error", 8000);
  } finally {
    _folderBusy.delete(index);
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = originalHtml;
  }
}

// ── Selector de NotebookLM (compartido entre el asistente de creación y el
// modal "Conectar NotebookLM" de un curso existente) ────────────────────────
async function ensureNotebookLibrary(force, rerender) {
  if (_notebookLibrary.status !== "idle" && !force) return;
  _notebookLibrary = { status: "checking", entries: [], message: "" };
  rerender();
  try {
    const auth = await checkNotebookLMAuth();
    if (!auth.authenticated) {
      _notebookLibrary = { status: "no-auth", entries: [], message: auth.message };
      rerender();
      return;
    }
    const entries = await listNotebooksMcp();
    _notebookLibrary = { status: entries.length ? "ready" : "empty", entries, message: "" };
  } catch (error) {
    _notebookLibrary = { status: "error", entries: [], message: String(error) };
  }
  rerender();
}

function notebookPickerMarkup(draft) {
  const connected = Boolean(draft.notebook_id);
  return `
    <div class="mt-4 rounded-xl border border-slate-200 p-4" id="notebook-picker">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <strong class="block text-sm text-app-text">NotebookLM <span class="font-normal text-app-muted">(opcional)</span></strong>
          <span class="mt-1 block text-xs leading-5 text-app-muted">Vincula un notebook para que la skill investigue fuentes reales al generar las guías.</span>
        </div>
        <span class="mt-0.5 shrink-0 text-teal-600">${ic("book-open", 20)}</span>
      </div>
      <div class="mt-3">${notebookPickerBody(draft, connected)}</div>
    </div>`;
}

function notebookPickerBody(draft, connected) {
  if (connected) {
    return `
      <div class="flex items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-teal-900">${escapeHtml(draft.notebook_name || draft.notebook_id)}</div>
          ${draft.notebook_url ? `<div class="mt-0.5 truncate text-xs text-teal-700">${escapeHtml(draft.notebook_url)}</div>` : ""}
        </div>
        <button type="button" class="${cx(ui.button.base, ui.button.ghost, ui.button.sm, "shrink-0")}" data-notebook-action="disconnect">${ic("x", 14)}Quitar</button>
      </div>`;
  }
  const lib = _notebookLibrary;
  if (lib.status === "idle" || lib.status === "checking") {
    return `<div class="flex items-center gap-2 text-xs text-app-muted"><span class="animate-spin">${ic("loader-2", 14)}</span>Verificando conexión con NotebookLM…</div>`;
  }
  if (lib.status === "no-auth") {
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span class="text-xs text-app-muted">Inicia sesión con NotebookLM para ver tus notebooks.</span>
        <button type="button" class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-notebook-action="auth">${ic("key", 14)}Conectar sesión</button>
      </div>`;
  }
  if (lib.status === "error") {
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
        <span class="text-xs text-red-700">${escapeHtml(lib.message || "No se pudo consultar NotebookLM.")}</span>
        <button type="button" class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-notebook-action="refresh">${ic("refresh-cw", 14)}Reintentar</button>
      </div>`;
  }
  if (lib.status === "scanning-account") {
    return `<div class="flex items-center gap-2 text-xs text-app-muted"><span class="animate-spin">${ic("loader-2", 14)}</span>Abriendo cada notebook de tu cuenta para leer su id real (puede tardar 1–2 minutos)…</div>`;
  }
  if (lib.status === "empty") {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p class="text-xs text-app-muted">No tienes notebooks en NotebookLM todavía.</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" data-notebook-action="create">${ic("external-link", 14)}Crear notebook</button>
          <button type="button" class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" data-notebook-action="refresh">${ic("refresh-cw", 14)}Refrescar lista</button>
        </div>
        <button type="button" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" data-notebook-action="scan-account">${ic("search", 12)}Buscar en toda mi cuenta de NotebookLM</button>
      </div>`;
  }
  return `
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label class="sr-only" for="notebook-select">Seleccionar notebook</label>
      <select id="notebook-select" class="min-h-11 flex-1">
        <option value="">Seleccionar notebook…</option>
        ${lib.entries.map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`).join("")}
      </select>
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-notebook-action="refresh" title="Refrescar biblioteca local" aria-label="Refrescar biblioteca local de notebooks">${ic("refresh-cw", 14)}</button>
    </div>
    <div class="mt-2 flex flex-wrap gap-3">
      <button type="button" class="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" data-notebook-action="create">${ic("external-link", 12)}Crear uno nuevo</button>
      <button type="button" class="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" data-notebook-action="scan-account">${ic("search", 12)}¿No está en la lista? Buscar en toda mi cuenta</button>
    </div>`;
}

function bindNotebookPickerEvents(scope, draft, rerender) {
  const picker = scope?.querySelector("#notebook-picker");
  if (!picker) return;
  picker.querySelector("#notebook-select")?.addEventListener("change", event => {
    const entry = _notebookLibrary.entries.find(item => item.id === event.target.value);
    draft.notebook_id = entry?.id || "";
    draft.notebook_name = entry?.name || "";
    draft.notebook_url = entry?.url || "";
    rerender();
  });
  picker.querySelector('[data-notebook-action="disconnect"]')?.addEventListener("click", () => {
    draft.notebook_id = "";
    draft.notebook_name = "";
    draft.notebook_url = "";
    rerender();
  });
  picker.querySelector('[data-notebook-action="refresh"]')?.addEventListener("click", () => ensureNotebookLibrary(true, rerender));
  picker.querySelector('[data-notebook-action="create"]')?.addEventListener("click", async () => {
    try { await openExternal(APP_META.notebookLmUrl); }
    catch (error) { toast(`No se pudo abrir NotebookLM: ${error}`, "error", 6000); }
  });
  picker.querySelector('[data-notebook-action="auth"]')?.addEventListener("click", async () => {
    toast("Abriendo Chrome para autenticación…", "loading", 30000);
    try {
      const result = await runNotebookLMAuth();
      toast(result.message, result.success ? "success" : "error", 6000);
    } catch (error) {
      toast(`No se pudo iniciar la autenticación: ${error}`, "error", 7000);
    }
    await ensureNotebookLibrary(true, rerender);
  });
  picker.querySelector('[data-notebook-action="scan-account"]')?.addEventListener("click", () => scanAccountNotebooks(rerender));
}

// Busca en todo notebooklm.google.com, no solo en la biblioteca local del MCP
// (que solo conoce lo que se registró antes con add_notebook). Es lenta a
// propósito: abre cada notebook para leer su id real en la URL en vez de
// adivinarlo del HTML de la tarjeta.
async function scanAccountNotebooks(rerender) {
  const previousEntries = _notebookLibrary.entries;
  _notebookLibrary = { status: "scanning-account", entries: previousEntries, message: "" };
  rerender();
  try {
    const accountEntries = await listAccountNotebooksMcp();
    const merged = new Map(previousEntries.map(entry => [entry.id, entry]));
    accountEntries.forEach(entry => merged.set(entry.id, entry));
    const entries = [...merged.values()];
    _notebookLibrary = { status: entries.length ? "ready" : "empty", entries, message: "" };
  } catch (error) {
    _notebookLibrary = { status: previousEntries.length ? "ready" : "error", entries: previousEntries, message: String(error) };
    toast(`No se pudo buscar en tu cuenta de NotebookLM: ${error}`, "error", 7000);
  }
  rerender();
}

// Deriva config/notebooks.json a partir de state.courses: el curso es la
// única fuente de verdad, así que este archivo nunca se edita a mano y no
// puede desincronizarse del registro real de asignaturas.
async function syncNotebooksFromCourses() {
  const entries = state.courses
    .filter(course => String(course.notebook_id || "").trim() && String(course.project_path || "").trim())
    .map(course => ({
      courseCode: course.code,
      courseName: course.name,
      rootPath: course.project_path,
      notebookId: course.notebook_id,
      notebookUrl: course.notebook_url || "",
    }));
  try {
    await saveNotebooksConfig(entries);
  } catch {
    // Sincronización best-effort: un fallo aquí no debe interrumpir el guardado del curso.
  }
}

function openModal(opener) {
  _modalOpener = opener || document.activeElement;
  _modalStep = 1;
  _modalDirty = false;
  _modalData = {
    code: "", name: "", period: "", semester: "", credits: 4, weeks: 16,
    description: "", initializeReadme: true,
    rootPath: "", rootPathLoading: true, rootPathCustomized: false,
    projectColor: PROJECT_COLORS[0].value, projectIcon: PROJECT_ICONS[0].value,
    notebook_id: "", notebook_name: "", notebook_url: "",
  };
  const overlay = document.getElementById("course-modal");
  overlay?.classList.remove("hidden");
  overlay?.classList.add("flex");
  renderModal();
  queueMicrotask(() => document.getElementById("m-name")?.focus());
  defaultCourseRoot().then(rootPath => {
    if (_modalData.rootPathCustomized) return;
    _modalData.rootPath = rootPath;
    _modalData.rootPathLoading = false;
    if (_modalStep === 2) renderModal();
  });
}

async function requestCloseModal(force = false) {
  if (!force && _modalDirty && !await confirm("¿Cerrar el asistente y descartar la información escrita?")) return;
  const overlay = document.getElementById("course-modal");
  overlay?.classList.add("hidden");
  overlay?.classList.remove("flex");
  _modalDirty = false;
  _modalOpener?.focus?.();
}

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    requestCloseModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...document.querySelectorAll("#course-modal-box button:not([disabled]), #course-modal-box input:not([disabled]), #course-modal-box textarea:not([disabled]), #course-modal-box select:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderModal() {
  const box = document.getElementById("course-modal-box");
  if (!box) return;
  box.innerHTML = _modalStep === 1 ? renderCourseDetailsStep() : renderCoursePreparationStep();
  refreshIcons();
  bindModalEvents();
}

function renderCourseDetailsStep() {
  return `
    ${modalHeader("Nueva asignatura", "Datos académicos", 1)}
    <form id="course-details-form" class="p-5 sm:px-6" novalidate>
      <p id="course-modal-description" class="mb-4 text-sm text-app-muted">Completa la información básica. Podrás editar el contenido semanal después.</p>
      <div id="course-modal-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" aria-live="assertive" aria-atomic="true" tabindex="-1"></div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${modalField("m-name", "Nombre de la asignatura", _modalData.name, "Bases de Datos", "sm:col-span-2")}
        ${modalField("m-code", "Código único", _modalData.code, "IFT200", "", "text")}
        ${modalField("m-period", "Período académico", _modalData.period, "Abril–Agosto 2026", "", "text", false)}
        ${modalField("m-semester", "Semestre / Nivel", _modalData.semester, "Tercero", "", "text", false)}
        ${modalField("m-credits", "Créditos", _modalData.credits, "", "", "number")}
        ${modalField("m-weeks", "Número de semanas", _modalData.weeks, "", "", "number")}
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label for="m-desc">Descripción <span class="font-normal text-app-muted">(opcional)</span></label>
          <textarea id="m-desc" rows="3" placeholder="Breve descripción del curso">${escapeHtml(_modalData.description)}</textarea>
        </div>
      </div>
    </form>
    ${modalFooter(`<button type="button" class="${cx(ui.button.base, ui.button.ghost, 'min-h-11')}" id="m-cancel">Cancelar</button>`,
      `<button type="submit" form="course-details-form" class="${cx(ui.button.base, ui.button.primary, 'min-h-11')}" id="m-next">Revisar y continuar${ic("arrow-right", 17)}</button>`)} `;
}

function renderCoursePreparationStep() {
  return `
    ${modalHeader("Nueva asignatura", "Preparar proyecto", 2)}
    <div class="p-5 sm:px-6">
      <p id="course-modal-description-2" class="text-sm text-app-muted">La asignatura se registrará en Jintia. También puedes crear ahora su estructura real en el disco.</p>
      <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <strong class="block truncate text-sm text-app-text">${escapeHtml(_modalData.name)}</strong>
            <span class="mt-1 block text-xs font-semibold text-brand">${escapeHtml(_modalData.code)} · ${_modalData.weeks} semanas · ${_modalData.credits} créditos</span>
          </div>
          <span class="text-brand-600">${ic("graduation-cap", 20)}</span>
        </div>
      </div>
      <div class="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 text-teal-700">${ic("folder-check", 18)}</span>
          <span>
            <strong class="block text-sm text-teal-900">El proyecto se preparará automáticamente</strong>
            <span class="mt-1 block text-xs leading-5 text-teal-800">Jintia creará la estructura de ${_modalData.weeks} semanas al registrar la asignatura.</span>
          </span>
        </div>
      </div>
      <label class="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4" id="m-readme-option">
        <input type="checkbox" id="m-init-readme" ${_modalData.initializeReadme ? "checked" : ""} class="mt-1">
        <span>
          <strong class="block text-sm text-app-text">Crear README inicial</strong>
          <span class="mt-1 block text-xs leading-5 text-app-muted">Crea una introducción segura sin sobrescribir un README que ya exista.</span>
        </span>
      </label>
      <div class="mt-2 rounded-xl border border-slate-200 p-4" id="m-project-location">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <strong class="block text-sm text-app-text">Ubicación del proyecto</strong>
            <span class="mt-1 block break-all text-xs leading-5 text-app-muted" id="m-project-root">
              ${_modalData.rootPathLoading ? "Localizando tu carpeta Documentos…" : escapeHtml(_modalData.rootPath || "Selecciona una carpeta")}
            </span>
            <span class="mt-1 block text-[11px] text-app-muted">Por defecto: <code>Documentos/Jintia/codigo_nombre</code>. Puedes cambiar la raíz.</span>
          </div>
          <button type="button" class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'shrink-0')}" id="m-change-root" ${_modalData.rootPathLoading ? "disabled" : ""}>
            ${ic("folder-open", 16)}
            Cambiar
          </button>
        </div>
      </div>
      ${identityPickerMarkup(_modalData.projectColor, _modalData.projectIcon, "m")}
      ${notebookPickerMarkup(_modalData)}
      <div id="course-modal-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" aria-live="assertive" aria-atomic="true" tabindex="-1"></div>
    </div>
    ${modalFooter(`<button type="button" class="${cx(ui.button.base, ui.button.secondary, 'min-h-11')}" id="m-back">${ic("arrow-left", 17)}Atrás</button>`,
      `<button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11')}" id="m-create">${ic("check", 17)}Crear asignatura y proyecto</button>`)} `;
}

function modalHeader(title, subtitle, step) {
  return `
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
      <div>
        <h2 id="course-modal-title" class="text-base font-bold text-app-text">${title}</h2>
        <p class="mt-0.5 text-xs text-app-muted">Paso ${step} de 2 · ${subtitle}</p>
      </div>
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 p-0')}" id="m-close" aria-label="Cerrar asistente">${ic("x", 20)}</button>
    </div>`;
}

function modalFooter(left, right) {
  return `<div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">${left}<div class="flex flex-col gap-2 sm:flex-row">${right}</div></div>`;
}

function modalField(id, label, value, placeholder, extraClass = "", type = "text", required = true) {
  const numberAttrs = id === "m-credits" ? 'min="1" max="20" step="1" inputmode="numeric"' : id === "m-weeks" ? 'min="1" max="52" step="1" inputmode="numeric"' : "";
  return `
    <div class="flex flex-col gap-1.5 ${extraClass}">
      <label for="${id}">${label} ${required ? '<span class="text-red-600">(obligatorio)</span>' : '<span class="font-normal text-app-muted">(opcional)</span>'}</label>
      <input id="${id}" type="${type}" ${numberAttrs} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" ${required ? "required" : ""} aria-describedby="${id}-error">
      <p id="${id}-error" class="hidden text-xs font-semibold text-red-700"></p>
    </div>`;
}

function bindModalEvents() {
  const box = document.getElementById("course-modal-box");
  box?.querySelectorAll("input, textarea").forEach(control => {
    control.addEventListener("input", () => {
      _modalDirty = true;
      clearModalFieldError(control);
    });
  });
  box?.querySelector("#m-close")?.addEventListener("click", () => requestCloseModal());
  box?.querySelector("#m-cancel")?.addEventListener("click", () => requestCloseModal());
  box?.querySelector("#course-details-form")?.addEventListener("submit", event => {
    event.preventDefault();
    if (!captureAndValidateStepOne()) return;
    _modalStep = 2;
    renderModal();
    queueMicrotask(() => document.getElementById("m-init-readme")?.focus());
  });
  box?.querySelector("#m-back")?.addEventListener("click", () => {
    _modalStep = 1;
    renderModal();
    queueMicrotask(() => document.getElementById("m-name")?.focus());
  });
  box?.querySelector("#m-change-root")?.addEventListener("click", async () => {
    const rootPath = await pickDirectory("Selecciona dónde crear la asignatura", _modalData.rootPath || undefined);
    if (!rootPath) return;
    _modalData.rootPath = rootPath;
    _modalData.rootPathCustomized = true;
    _modalData.rootPathLoading = false;
    renderModal();
    queueMicrotask(() => document.getElementById("m-change-root")?.focus());
  });
  box?.querySelector("#m-init-readme")?.addEventListener("change", event => {
    _modalData.initializeReadme = event.target.checked;
  });
  box?.querySelectorAll("[data-project-color]").forEach(button => button.addEventListener("click", () => {
    _modalData.projectColor = button.dataset.projectColor;
    renderModal();
    queueMicrotask(() => document.querySelector(`[data-project-color="${_modalData.projectColor}"]`)?.focus());
  }));
  box?.querySelectorAll("[data-project-icon]").forEach(button => button.addEventListener("click", () => {
    _modalData.projectIcon = button.dataset.projectIcon;
    renderModal();
    queueMicrotask(() => document.querySelector(`[data-project-icon="${_modalData.projectIcon}"]`)?.focus());
  }));
  box?.querySelector("#m-create")?.addEventListener("click", event => createCourse(event.currentTarget));
  if (_modalStep === 2) {
    bindNotebookPickerEvents(box, _modalData, renderModal);
    ensureNotebookLibrary(false, renderModal);
  }
}

function captureAndValidateStepOne() {
  const read = id => document.getElementById(id)?.value?.trim() || "";
  const code = read("m-code").toUpperCase();
  const name = read("m-name");
  const creditsRaw = read("m-credits");
  const weeksRaw = read("m-weeks");
  const credits = Number(creditsRaw);
  const weeks = Number(weeksRaw);
  const errors = [];
  if (!name) errors.push(["m-name", "Escribe el nombre de la asignatura."]);
  if (!code) errors.push(["m-code", "Escribe un código único."]);
  else if (state.courses.some(course => String(course.code).toLowerCase() === code.toLowerCase())) errors.push(["m-code", "Ya existe una asignatura con este código."]);
  if (!Number.isInteger(credits) || credits < 1 || credits > 20) errors.push(["m-credits", "Usa un número entero entre 1 y 20."]);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) errors.push(["m-weeks", "Usa un número entero entre 1 y 52."]);
  if (errors.length) {
    errors.forEach(([id, message]) => showModalFieldError(id, message));
    const summary = document.getElementById("course-modal-error");
    if (summary) {
      summary.textContent = `Revisa ${errors.length} ${errors.length === 1 ? "campo señalado" : "campos señalados"} antes de continuar.`;
      summary.classList.remove("hidden");
      summary.focus();
    }
    document.getElementById(errors[0][0])?.focus();
    return false;
  }
  _modalData = {
    ..._modalData,
    code,
    name,
    period: read("m-period"),
    semester: read("m-semester"),
    credits: Math.trunc(credits),
    weeks: Math.trunc(weeks),
    description: read("m-desc"),
  };
  return true;
}

function showModalFieldError(id, message) {
  const field = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  field?.setAttribute("aria-invalid", "true");
  field?.classList.add("border-red-500");
  if (error) {
    error.textContent = message;
    error.classList.remove("hidden");
  }
}

function clearModalFieldError(field) {
  field.removeAttribute("aria-invalid");
  field.classList.remove("border-red-500");
  const error = document.getElementById(`${field.id}-error`);
  if (error) {
    error.textContent = "";
    error.classList.add("hidden");
  }
}

async function createCourse(button) {
  if (button.disabled) return;
  _modalData.initializeReadme = document.getElementById("m-init-readme")?.checked ?? false;
  if (state.courses.some(course => String(course.code).toLowerCase() === _modalData.code.toLowerCase())) {
    showModalSummaryError("Otra asignatura utilizó este código mientras completabas el asistente. Regresa y elige uno diferente.");
    return;
  }

  let rootPath = _modalData.rootPath || await defaultCourseRoot();
  if (!rootPath) {
    rootPath = await pickDirectory(`Selecciona dónde preparar ${_modalData.code} — ${_modalData.name}`);
  }
  if (!rootPath) {
    showModalSummaryError("No se encontró la carpeta Documentos ni se eligió otra ubicación. Selecciona una carpeta para continuar.");
    return;
  }

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span class="animate-spin">${ic("loader-2", 17)}</span>Preparando proyecto…`;
  refreshIcons();

  const course = {
    code: _modalData.code,
    name: _modalData.name,
    period: _modalData.period,
    semester: _modalData.semester,
    credits: _modalData.credits,
    weeks: _modalData.weeks,
    description: _modalData.description,
    weeks_data: [],
    project_status: "preparing",
    project_color: _modalData.projectColor,
    project_icon: _modalData.projectIcon,
    notebook_id: _modalData.notebook_id || "",
    notebook_name: _modalData.notebook_name || "",
    notebook_url: _modalData.notebook_url || "",
    created_at: new Date().toISOString(),
  };
  if (!persistCourseList([...state.courses, course])) {
    restoreCreateButton(button);
    return;
  }
  const index = state.courses.length - 1;

  try {
    const result = await createCourseStructure({
      rootPath,
      courseCode: course.code,
      courseName: course.name,
      weeks: course.weeks,
      initializeReadme: _modalData.initializeReadme,
    });
    if (!result.success) throw new Error(result.message);
    const next = state.courses.map((item, courseIndex) => courseIndex === index
      ? { ...item, project_status: "ready", project_root: rootPath, project_path: result.path || "", project_updated_at: new Date().toISOString() }
      : item);
    if (!persistCourseList(next)) throw new Error("La estructura se creó, pero no se pudo guardar su estado en Jintia.");
    _modalDirty = false;
    await requestCloseModal(true);
    renderCourses();
    toast(`Asignatura ${course.code} creada y proyecto preparado`, "success", 5000);
  } catch (error) {
    const next = state.courses.map((item, courseIndex) => courseIndex === index
      ? { ...item, project_status: "error", project_error: String(error) }
      : item);
    persistCourseList(next);
    _modalDirty = false;
    await requestCloseModal(true);
    renderCourses();
    toast(`La asignatura se registró, pero el proyecto no pudo prepararse. Puedes reintentarlo desde Más acciones. (${error})`, "error", 9000);
  }
}

function restoreCreateButton(button) {
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.innerHTML = `${ic("check", 17)}Crear asignatura y proyecto`;
  refreshIcons();
}

function showModalSummaryError(message) {
  const error = document.getElementById("course-modal-error");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
  error.focus();
}
