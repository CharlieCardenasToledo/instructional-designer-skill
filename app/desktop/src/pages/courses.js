import { createCourseStructure, getDefaultCourseRoot, pickDirectory } from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, cx } from "../uiClasses.js";

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

const REQUIRED_WEEK_FIELDS = ["title", "unit", "topics", "outcomes", "bibliography", "graded_activity"];
const PROJECT_COLORS = [
  { value: "#0f766e", label: "Verde Jintia" },
  { value: "#2563eb", label: "Azul" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#c2410c", label: "Naranja" },
  { value: "#be123c", label: "Rosa" },
  { value: "#475569", label: "Grafito" },
];
const PROJECT_ICONS = [
  { value: "folder", label: "Carpeta" },
  { value: "school", label: "Académico" },
  { value: "database", label: "Datos" },
  { value: "science", label: "Ciencia" },
  { value: "psychology", label: "Ideas" },
  { value: "palette", label: "Creativo" },
];

function projectColor(course) {
  return PROJECT_COLORS.some(option => option.value === course?.project_color) ? course.project_color : PROJECT_COLORS[0].value;
}

function projectIcon(course) {
  return PROJECT_ICONS.some(option => option.value === course?.project_icon) ? course.project_icon : PROJECT_ICONS[0].value;
}

function projectBadge(course, extraClass = "") {
  return `<span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${extraClass}" style="background:${projectColor(course)}18;color:${projectColor(course)}" aria-hidden="true"><span class="material-symbols-outlined text-[20px]">${projectIcon(course)}</span></span>`;
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
  const weeks = Array.isArray(course.weeks_data) ? course.weeks_data : [];
  const complete = Array.from({ length: total }, (_, index) => {
    const week = weeks[index];
    return week?.status === "complete" && REQUIRED_WEEK_FIELDS.every(key => String(week?.[key] || "").trim());
  }).filter(Boolean).length;
  const started = weeks.some(week => week && Object.values(week).some(value => value !== null && value !== "" && value !== undefined));
  const status = complete === total ? "complete" : started ? "progress" : "pending";
  return { complete, total, pct: Math.round((complete / total) * 100), status };
}

function statusView(progress) {
  return {
    complete: { label: "Lista", icon: "check_circle", classes: "border-green-200 bg-green-50 text-green-700" },
    progress: { label: "En progreso", icon: "pending", classes: "border-teal-200 bg-teal-50 text-teal-700" },
    pending: { label: "Pendiente", icon: "radio_button_unchecked", classes: "border-slate-200 bg-slate-50 text-slate-600" },
  }[progress.status];
}

function persistCourseList(nextCourses, successMessage) {
  const previous = state.courses;
  state.courses = nextCourses;
  try {
    saveCourses();
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

  const summaries = state.courses.map(courseProgress);
  const total = state.courses.length;
  const inProgress = summaries.filter(item => item.status === "progress").length;
  const ready = summaries.filter(item => item.status === "complete").length;

  el.innerHTML = `
    <div class="${ui.layout.stack}">
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="courses-summary-title">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="courses-summary-title" class="text-base font-extrabold text-app-text">Tus proyectos académicos</h2>
            <p class="mt-1 text-xs text-app-muted">Continúa el sílabo, prepara archivos o crea una nueva asignatura.</p>
            <p class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
              <span class="material-symbols-outlined text-[15px]" aria-hidden="true">auto_awesome</span>
              Usa tu skill con Claude, ChatGPT y Codex
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
            ${summaryMetric(total, "Asignaturas", "school")}
            ${summaryMetric(inProgress, "En progreso", "edit_note")}
            ${summaryMetric(ready, "Listas", "check_circle")}
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center" aria-label="Buscar y filtrar asignaturas">
        <div class="relative min-w-0 flex-1">
          <label for="courses-search-input" class="sr-only">Buscar asignaturas</label>
          <span class="material-symbols-outlined pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg text-app-muted" aria-hidden="true">search</span>
          <input class="h-11 pl-10 pr-10" id="courses-search-input" type="search" placeholder="Buscar por código, nombre o período" value="${escapeHtml(_filter)}">
          <button type="button" class="${_filter ? "flex" : "hidden"} absolute inset-y-0 right-1 h-11 w-11 items-center justify-center rounded-full text-app-muted hover:text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" id="courses-clear-search" aria-label="Limpiar búsqueda">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
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
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">add</span>
          Nueva asignatura
        </button>
      </section>

      <section class="min-h-0 flex-1" id="courses-results" aria-live="polite">
        ${renderCourseResults()}
      </section>
    </div>

    <div class="fixed inset-0 z-[5000] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="course-modal">
      <div class="max-h-[calc(100vh-24px)] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]"
        id="course-modal-box" role="dialog" aria-modal="true" aria-labelledby="course-modal-title" aria-describedby="course-modal-description"></div>
    </div>
    <div class="fixed inset-0 z-[5100] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6" id="project-appearance-modal">
      <div class="max-h-[calc(100vh-24px)] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]" id="project-appearance-box"
        role="dialog" aria-modal="true" aria-labelledby="project-appearance-title"></div>
    </div>`;

  bindPageEvents();
}

function summaryMetric(value, label, icon) {
  return `
    <div class="min-w-0 rounded-lg bg-slate-50 px-2 py-2">
      <div class="flex items-center justify-center gap-1 text-app-text">
        <span class="material-symbols-outlined text-[16px] text-brand" aria-hidden="true">${icon}</span>
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
    <div class="${cx(ui.surface.card, 'relative hidden min-h-0 overflow-visible lg:block')}">
      <table class="${ui.table.base}">
        <caption class="sr-only">Asignaturas registradas y avance del sílabo</caption>
        <thead>
          <tr class="${ui.table.headRow}">
            <th class="${ui.table.th}">Asignatura</th>
            <th class="${ui.table.th}">Período</th>
            <th class="${ui.table.th}">Avance</th>
            <th class="${ui.table.th}">Proyecto</th>
            <th class="${cx(ui.table.th, 'w-[164px] text-right')}">Acciones</th>
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
          <button type="button" class="group/course min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="edit" data-index="${index}">
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
            <div class="h-full rounded-full bg-brand" style="width:${progress.pct}%"></div>
          </div>
          <span class="text-xs font-semibold text-app-text">${progress.complete}/${progress.total}</span>
        </div>
        <span class="mt-1 inline-flex items-center gap-1 text-xs font-semibold ${status.classes.split(" ").at(-1)}">
          <span class="material-symbols-outlined text-[15px]" aria-hidden="true">${status.icon}</span>${status.label}
        </span>
      </td>
      <td class="${ui.table.td}">
        <span class="inline-flex items-center gap-1.5 text-xs ${prepared ? "text-green-700" : "text-app-muted"}">
          <span class="material-symbols-outlined text-[16px]" style="color:${projectColor(course)}" aria-hidden="true">${prepared ? projectIcon(course) : "folder_off"}</span>
          ${prepared ? "Preparado" : course.project_status === "error" ? "Error al crear" : "Carpeta no creada"}
        </span>
      </td>
      <td class="${ui.table.td}">
        <div class="flex justify-end gap-2">
          <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'min-h-11 px-3')}" data-course-action="edit" data-index="${index}">
            Editar sílabo
          </button>
          ${renderMoreMenu(index, course)}
        </div>
      </td>
    </tr>`;
}

function renderCourseCard({ course, index, progress }) {
  const status = statusView(progress);
  return `
    <article class="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex min-w-0 items-center gap-3">
        ${projectBadge(course)}
        <button type="button" class="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="edit" data-index="${index}">
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
      <div class="mt-4 flex gap-2">
        <button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11 flex-1')}" data-course-action="edit" data-index="${index}">Continuar</button>
        ${renderMoreMenu(index, course)}
      </div>
    </article>`;
}

function renderMoreMenu(index, course) {
  const busy = _folderBusy.has(index);
  return `
    <details class="relative">
      <summary class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 cursor-pointer list-none p-0')}" aria-label="Más acciones para ${escapeHtml(course.name)}">
        <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
      </summary>
      <div class="absolute right-0 top-12 z-50 min-w-[205px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="folders" data-index="${index}" ${busy ? "disabled aria-busy=\"true\"" : ""}>
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">${busy ? "progress_activity" : "create_new_folder"}</span>
          ${busy ? "Preparando…" : course.project_status === "ready" ? "Recrear estructura" : "Crear carpeta del proyecto"}
        </button>
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-course-action="appearance" data-index="${index}">
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">palette</span>
          Personalizar en Jintia
        </button>
        <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600" data-course-action="delete" data-index="${index}">
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">delete</span>
          Eliminar del registro
        </button>
      </div>
    </details>`;
}

function renderEmptyState() {
  return `
    <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-brand">
        <span class="material-symbols-outlined text-[32px]" aria-hidden="true">school</span>
      </div>
      <h3 class="text-base font-bold text-app-text">Crea tu primera asignatura</h3>
      <p class="mt-2 max-w-[420px] text-sm leading-6 text-app-muted">Registra la información académica, prepara la estructura del proyecto y comienza el sílabo semanal.</p>
      <button type="button" class="${cx(ui.button.base, ui.button.primary, 'mt-5 min-h-11')}" id="btn-empty-new-course">
        <span class="material-symbols-outlined text-[17px]" aria-hidden="true">add</span>Nueva asignatura
      </button>
    </div>`;
}

function renderNoResults() {
  return `
    <div class="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span class="material-symbols-outlined text-[38px] text-slate-400" aria-hidden="true">search_off</span>
      <h3 class="mt-3 text-base font-bold text-app-text">No encontramos asignaturas</h3>
      <p class="mt-1 text-sm text-app-muted">Prueba con otro término o elimina los filtros actuales.</p>
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
}

function updateResults() {
  const results = document.getElementById("courses-results");
  if (!results) return;
  results.innerHTML = renderCourseResults();
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
      if (button.dataset.courseAction === "delete") deleteCourse(index);
    });
  });
}

async function deleteCourse(index) {
  const course = state.courses[index];
  if (!course) return;
  if (!await confirm(`¿Eliminar “${course.code} — ${course.name}” del registro?\nLas carpetas y archivos del disco se conservarán.`)) return;
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
          <span class="material-symbols-outlined text-[25px]">${icon}</span>
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
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${option.value}</span>
          </button>`).join("")}
      </div>
      <span class="mt-4 block text-xs font-bold text-slate-700" id="${prefix}-color-label">Color</span>
      <div class="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="${prefix}-color-label">
        ${PROJECT_COLORS.map(option => `
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white shadow-sm ${option.value === color ? "ring-2 ring-slate-800 ring-offset-1" : "ring-1 ring-slate-200"}" style="background:${option.value}" data-project-color="${option.value}" aria-pressed="${option.value === color}" title="${option.label}" aria-label="${option.label}">
            ${option.value === color ? '<span class="material-symbols-outlined text-[18px] text-white" aria-hidden="true">check</span>' : ""}
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
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, "h-11 w-11 p-0")}" id="appearance-close" aria-label="Cerrar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
    </div>
    <div class="px-5 pb-5">${identityPickerMarkup(_appearanceDraft.color, _appearanceDraft.icon, "appearance")}</div>
    <div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
      <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="appearance-cancel">Cancelar</button>
      <button type="button" class="${cx(ui.button.base, ui.button.primary, "min-h-11")}" id="appearance-save">Guardar apariencia</button>
    </div>`;
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
  button.innerHTML = `<span class="material-symbols-outlined animate-spin text-[17px]" aria-hidden="true">progress_activity</span>Preparando proyecto…`;
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

function openModal(opener) {
  _modalOpener = opener || document.activeElement;
  _modalStep = 1;
  _modalDirty = false;
  _modalData = {
    code: "", name: "", period: "", semester: "", credits: 4, weeks: 16,
    description: "", initializeReadme: true,
    rootPath: "", rootPathLoading: true, rootPathCustomized: false,
    projectColor: PROJECT_COLORS[0].value, projectIcon: PROJECT_ICONS[0].value,
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
  bindModalEvents();
}

function renderCourseDetailsStep() {
  return `
    ${modalHeader("Nueva asignatura", "Datos académicos", 1)}
    <form id="course-details-form" class="p-5 sm:px-6" novalidate>
      <p id="course-modal-description" class="mb-4 text-sm text-app-muted">Completa la información básica. Podrás editar el contenido semanal después.</p>
      <div id="course-modal-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" tabindex="-1"></div>
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
      `<button type="submit" form="course-details-form" class="${cx(ui.button.base, ui.button.primary, 'min-h-11')}" id="m-next">Revisar y continuar<span class="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span></button>`)} `;
}

function renderCoursePreparationStep() {
  return `
    ${modalHeader("Nueva asignatura", "Preparar proyecto", 2)}
    <div class="p-5 sm:px-6">
      <p id="course-modal-description" class="text-sm text-app-muted">La asignatura se registrará en Jintia. También puedes crear ahora su estructura real en el disco.</p>
      <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <strong class="block truncate text-sm text-app-text">${escapeHtml(_modalData.name)}</strong>
            <span class="mt-1 block text-xs font-semibold text-brand">${escapeHtml(_modalData.code)} · ${_modalData.weeks} semanas · ${_modalData.credits} créditos</span>
          </div>
          <span class="material-symbols-outlined text-brand" aria-hidden="true">school</span>
        </div>
      </div>
      <div class="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined mt-0.5 text-[18px] text-teal-700" aria-hidden="true">folder_check</span>
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
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">folder_open</span>
            Cambiar
          </button>
        </div>
      </div>
      ${identityPickerMarkup(_modalData.projectColor, _modalData.projectIcon, "m")}
      <div id="course-modal-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" tabindex="-1"></div>
    </div>
    ${modalFooter(`<button type="button" class="${cx(ui.button.base, ui.button.secondary, 'min-h-11')}" id="m-back"><span class="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_back</span>Atrás</button>`,
      `<button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11')}" id="m-create"><span class="material-symbols-outlined text-[17px]" aria-hidden="true">check</span>Crear asignatura y proyecto</button>`)} `;
}

function modalHeader(title, subtitle, step) {
  return `
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
      <div>
        <h2 id="course-modal-title" class="text-base font-bold text-app-text">${title}</h2>
        <p class="mt-0.5 text-xs text-app-muted">Paso ${step} de 2 · ${subtitle}</p>
      </div>
      <button type="button" class="${cx(ui.button.base, ui.button.ghost, 'h-11 w-11 p-0')}" id="m-close" aria-label="Cerrar asistente"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
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
  button.innerHTML = `<span class="material-symbols-outlined animate-spin text-[17px]" aria-hidden="true">progress_activity</span>Preparando proyecto…`;

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
  button.innerHTML = `<span class="material-symbols-outlined text-[17px]" aria-hidden="true">check</span>Crear asignatura y proyecto`;
}

function showModalSummaryError(message) {
  const error = document.getElementById("course-modal-error");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
  error.focus();
}
