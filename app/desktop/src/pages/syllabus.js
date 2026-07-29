import { generateSyllabus, pickDirectory } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { ui, cx } from "../uiClasses.js";
import { ic } from "../icons.js";
import { PathStepper } from "../components/PathStepper.js";
import { ProgressPath } from "../components/ProgressPath.js";

const REQUIRED_FIELDS = [
  ["title", "Título de la semana"],
  ["unit", "Unidad cubierta"],
  ["topics", "Contenido / Temas"],
  ["outcomes", "Resultados de aprendizaje"],
  ["bibliography", "Bibliografía / Recursos"],
  ["graded_activity", "Actividad calificada"],
];

const AUTOSAVE_DELAY = 700;
let _activeWeek = 0;
let _activeCourseKey = "";
let _dirty = false;
let _autosaveTimer = null;
let _isGenerating = false;
let _guardsBound = false;

function courseKey(course, index) {
  return `${index}:${course?.code || ""}:${course?.name || ""}`;
}

function currentCourse() {
  return state.editingCourse !== undefined ? state.courses[state.editingCourse] : null;
}

function parentDirectory(path) {
  const normalized = String(path || "").replace(/[\\/]+$/, "");
  const separator = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  return separator > 0 ? normalized.slice(0, separator) : "";
}

function weekCountFor(course) {
  return Math.min(52, Math.max(1, Number(course?.weeks) || 16));
}

function clampWeek(value, count) {
  return Math.min(Math.max(0, Number(value) || 0), Math.max(0, count - 1));
}

function missingRequired(week) {
  return REQUIRED_FIELDS.filter(([key]) => !String(week?.[key] || "").trim());
}

function weekStatus(week) {
  if (!week || !Object.values(week).some(value => value !== null && value !== "" && value !== undefined)) return "pending";
  if (week.status === "complete" && missingRequired(week).length === 0) return "complete";
  return "draft";
}

function statusPresentation(status) {
  return {
    complete: { icon: "check", label: "Completa", classes: "border-green-200 bg-green-50 text-green-700" },
    draft: { icon: "pencil", label: "Borrador", classes: "border-teal-200 bg-teal-50 text-teal-700" },
    pending: { icon: "circle", label: "Pendiente", classes: "border-slate-200 bg-slate-50 text-slate-500" },
  }[status];
}

function setSaveState(label, tone = "muted") {
  const badge = document.getElementById("syl-save-state");
  if (!badge) return;
  const toneClass = tone === "success"
    ? "border-green-200 bg-green-50 text-green-700"
    : tone === "working"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  badge.className = `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${toneClass}`;
  badge.innerHTML = `${ic(tone === "working" ? "refresh-cw" : "cloud-check", 16)}${escapeHtml(label)}`;
}

function announce(message) {
  const live = document.getElementById("syl-live");
  if (live) live.textContent = message;
}

function ensureGlobalGuards() {
  if (_guardsBound) return;
  _guardsBound = true;
  document.addEventListener("click", event => {
    if (!_dirty || state.page !== "syllabus") return;
    if (event.target.closest("[data-page]")) persistCurrentWeek("draft", { silent: true });
  }, true);
  window.addEventListener("beforeunload", () => {
    if (_dirty) persistCurrentWeek("draft", { silent: true });
  });
}

export function renderSyllabus() {
  const el = document.getElementById("p-syllabus");
  if (!el) return;
  ensureGlobalGuards();

  const course = currentCourse();
  if (!course) {
    el.innerHTML = `
      <div class="rounded-app-lg border border-slate-200 bg-white p-10 text-center text-app-muted shadow-sm">
        <span class="material-symbols-outlined mb-3 block text-[40px]" aria-hidden="true">description</span>
        <div class="mb-1.5 text-base font-bold text-slate-700">Sin asignatura seleccionada</div>
        <div class="text-sm">Selecciona una asignatura en Cursos para editar su sílabo.</div>
      </div>`;
    return;
  }

  const count = weekCountFor(course);
  const key = courseKey(course, state.editingCourse);
  if (key !== _activeCourseKey) {
    clearTimeout(_autosaveTimer);
    _activeCourseKey = key;
    _activeWeek = 0;
    _dirty = false;
  }
  _activeWeek = clampWeek(_activeWeek, count);

  const weeksData = Array.isArray(course.weeks_data) ? course.weeks_data : [];
  const statuses = Array.from({ length: count }, (_, index) => weekStatus(weeksData[index]));
  const complete = statuses.filter(status => status === "complete").length;
  const drafts = statuses.filter(status => status === "draft").length;
  const pending = count - complete - drafts;
  const pct = Math.round((complete / count) * 100);
  const activeStatus = statusPresentation(statuses[_activeWeek]);

  el.innerHTML = `
    <div class="grid min-h-full min-w-0 grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="flex min-h-0 min-w-0 flex-col gap-3">
        <header class="flex flex-col gap-3 rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="mb-1 text-xs font-bold text-brand">Editor de sílabo</div>
            <h3 class="truncate text-lg font-extrabold tracking-tight text-app-text">${escapeHtml(course.name)} <span class="font-semibold text-app-muted">(${escapeHtml(course.code)})</span></h3>
            <p class="mt-1 text-xs text-app-muted">${escapeHtml(course.semester || "Sin semestre")} · ${escapeHtml(course.period || "Sin período")} · ${Number(course.credits) || 0} créditos</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span id="syl-save-state" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">cloud_done</span>
              Guardado
            </span>
            <span class="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${activeStatus.classes}">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">${activeStatus.icon}</span>
              ${activeStatus.label}
            </span>
          </div>
        </header>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" aria-label="Etapas del editor">
          ${PathStepper(["Datos generales", "Resultados", "Semanas", "Evaluación"], 2)}
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="syl-week-heading">
          <div class="border-b border-slate-200 bg-slate-50/80 p-3 sm:p-4">
            <div class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
              <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'h-11 w-11 p-0')}" id="syl-prev" ${_activeWeek === 0 ? "disabled" : ""} aria-label="Semana anterior">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              </button>
              <div class="min-w-0">
                <label for="syl-week-select" class="sr-only">Seleccionar semana</label>
                <select id="syl-week-select" class="h-11 text-center font-bold" aria-label="Seleccionar semana">
                  ${Array.from({ length: count }, (_, index) => {
                    const status = statusPresentation(statuses[index]);
                    const title = weeksData[index]?.title ? ` — ${weeksData[index].title}` : "";
                    return `<option value="${index}" ${index === _activeWeek ? "selected" : ""}>Semana ${index + 1} de ${count} · ${status.label}${escapeHtml(title)}</option>`;
                  }).join("")}
                </select>
              </div>
              <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'h-11 w-11 p-0')}" id="syl-next" ${_activeWeek === count - 1 ? "disabled" : ""} aria-label="Semana siguiente">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              </button>
            </div>
          </div>

          <form id="syl-week-form" class="p-4 sm:p-5" novalidate>
            ${renderWeekForm(weeksData[_activeWeek], _activeWeek)}
          </form>

          <div class="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <button type="button" class="${cx(ui.button.base, ui.button.ghost, 'min-h-11')}" id="syl-discard">
              Descartar cambios
            </button>
            <div class="flex flex-col gap-2 sm:flex-row">
              <button type="button" class="${cx(ui.button.base, ui.button.secondary, 'min-h-11')}" id="syl-save-draft">
                <span class="material-symbols-outlined text-[17px]" aria-hidden="true">save</span>
                Guardar borrador
              </button>
              <button type="button" class="${cx(ui.button.base, ui.button.primary, 'min-h-11')}" id="syl-mark-complete">
                <span class="material-symbols-outlined text-[17px]" aria-hidden="true">check_circle</span>
                Marcar como completa
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside class="flex min-w-0 flex-col gap-3 2xl:sticky 2xl:top-0" aria-label="Progreso y acciones del sílabo">
        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="syl-progress-heading">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 id="syl-progress-heading" class="text-sm font-bold text-app-text">Progreso del sílabo</h3>
              <p class="mt-0.5 text-xs text-app-muted">${complete} de ${count} semanas completas</p>
            </div>
            <strong class="text-xl text-brand">${pct}%</strong>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progreso del sílabo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <div class="h-full rounded-full bg-brand transition-[width] duration-300" style="width:${pct}%"></div>
          </div>
          <div class="mt-5 border-t border-slate-100 pt-4">${ProgressPath({ items: ["Contenido", "Estructura", "Validación", "Publicación"], completed: pct === 100 ? 3 : 1, active: pct === 100 ? -1 : 2 })}</div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-green-50 px-2 py-2"><strong class="block text-sm text-green-700">${complete}</strong><span class="text-[11px] text-green-700">Completas</span></div>
            <div class="rounded-lg bg-teal-50 px-2 py-2"><strong class="block text-sm text-teal-700">${drafts}</strong><span class="text-[11px] text-teal-700">Borradores</span></div>
            <div class="rounded-lg bg-slate-100 px-2 py-2"><strong class="block text-sm text-slate-700">${pending}</strong><span class="text-[11px] text-slate-600">Pendientes</span></div>
          </div>

          <details class="mt-3">
            <summary class="cursor-pointer rounded-lg px-1 py-2 text-xs font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Ver todas las semanas</summary>
            <div class="mt-1 max-h-[320px] space-y-1 overflow-y-auto pr-1">
              ${Array.from({ length: count }, (_, index) => {
                const status = statusPresentation(statuses[index]);
                const title = weeksData[index]?.title || `Semana ${index + 1}`;
                return `<button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-lg border border-transparent px-2.5 text-left text-xs transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" data-week-jump="${index}" ${index === _activeWeek ? 'aria-current="step"' : ""}>
                  <span class="${status.classes.split(" ").at(-1)}" aria-hidden="true">${ic(status.icon, 17)}</span>
                  <span class="min-w-0 flex-1 truncate">${escapeHtml(title)}</span>
                  <span class="font-semibold">${status.label}</span>
                </button>`;
              }).join("")}
            </div>
          </details>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-bold text-app-text">Documento del curso</h3>
          <p class="mt-1 text-xs leading-5 text-app-muted">${pct < 100 ? "Puedes generar un borrador ahora. Completa todas las semanas para obtener la versión final." : "El sílabo está completo y listo para generar."}</p>
          <button type="button" class="${cx(ui.button.base, pct === 100 ? ui.button.primary : ui.button.secondary, 'mt-3 min-h-11 w-full')}" id="syl-generate">
            <span class="material-symbols-outlined text-[17px]" aria-hidden="true">markdown</span>
            ${pct === 100 ? "Generar README.md final" : "Generar borrador README.md"}
          </button>
        </section>
      </aside>
      <div id="syl-live" class="sr-only" role="status" aria-live="polite"></div>
    </div>`;

  bindEditorEvents(count);
}

function fieldMarkup({ id, label, value = "", placeholder = "", hint = "", textarea = false, rows = 3, required = true }) {
  const control = textarea
    ? `<textarea id="${id}" rows="${rows}" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""} aria-describedby="${id}-hint ${id}-error">${escapeHtml(value)}</textarea>`
    : `<input id="${id}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" ${required ? "required" : ""} aria-describedby="${id}-hint ${id}-error">`;
  return `
    <div class="flex min-w-0 flex-col gap-1.5">
      <label for="${id}" class="text-[13px] font-semibold text-app-text">${label} ${required ? '<span class="text-red-600">(obligatorio)</span>' : '<span class="font-normal text-app-muted">(opcional)</span>'}</label>
      ${control}
      <p id="${id}-hint" class="text-xs leading-5 text-app-muted">${hint}</p>
      <p id="${id}-error" class="hidden text-xs font-semibold text-red-700"></p>
    </div>`;
}

function renderWeekForm(weekData, weekIndex) {
  const week = weekData || {};
  const totalHours = ["teaching_hours", "practice_hours", "autonomous_hours"]
    .reduce((sum, key) => sum + Math.max(0, Number(week[key] ?? ({ teaching_hours: 2, practice_hours: 1, autonomous_hours: 4 }[key])) || 0), 0);

  return `
    <div class="mb-5 flex flex-col gap-1 border-b border-slate-200 pb-4">
      <h2 id="syl-week-heading" class="text-base font-extrabold text-app-text">Semana ${weekIndex + 1}</h2>
      <p class="text-xs text-app-muted">Los campos marcados como obligatorios son necesarios para completar la semana.</p>
    </div>
    <div id="syl-error-summary" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" tabindex="-1"></div>
    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${fieldMarkup({ id: "wf-title", label: "Título de la semana", value: week.title, placeholder: "Límites y continuidad", hint: "Una frase breve que identifique el foco de la semana." })}
        ${fieldMarkup({ id: "wf-unit", label: "Unidad cubierta", value: week.unit, placeholder: "Unidad 2", hint: "Indica la unidad del programa a la que pertenece." })}
      </div>
      ${fieldMarkup({ id: "wf-topics", label: "Contenido / Temas", value: week.topics, placeholder: "Tema 1\nTema 2", hint: "Escribe un tema por línea.", textarea: true, rows: 4 })}
      ${fieldMarkup({ id: "wf-outcomes", label: "Resultados de aprendizaje", value: week.outcomes, placeholder: "Analizar los principios de…\nAplicar el procedimiento para…", hint: "Usa verbos observables y escribe un resultado por línea.", textarea: true, rows: 4 })}
      ${fieldMarkup({ id: "wf-bibliography", label: "Bibliografía / Recursos", value: week.bibliography, placeholder: "Autor (año). Obra. Capítulo o enlace.", hint: "Añade una referencia o recurso por línea.", textarea: true, rows: 3 })}

      <fieldset class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <legend class="px-1 text-[13px] font-semibold text-app-text">Horas de dedicación</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          ${hourField("wf-teaching", "Docencia", week.teaching_hours ?? 2)}
          ${hourField("wf-practice", "Práctica", week.practice_hours ?? 1)}
          ${hourField("wf-autonomous", "Trabajo autónomo", week.autonomous_hours ?? 4)}
        </div>
        <p class="mt-3 text-xs text-app-muted">Total semanal: <strong id="wf-hours-total" class="text-app-text">${totalHours} horas</strong></p>
      </fieldset>

      ${fieldMarkup({ id: "wf-activity", label: "Actividad calificada", value: week.graded_activity, placeholder: "AC-01 — Taller de aplicación — 10 puntos", hint: "Incluye código, tipo de actividad y ponderación." })}
    </div>`;
}

function hourField(id, label, value) {
  return `
    <div class="flex flex-col gap-1.5">
      <label for="${id}">${label}</label>
      <div class="relative">
        <input id="${id}" class="pr-14" type="number" inputmode="numeric" min="0" max="40" step="1" value="${Math.min(40, Math.max(0, Number(value) || 0))}" aria-describedby="${id}-hint">
        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-app-muted">horas</span>
      </div>
      <span id="${id}-hint" class="sr-only">Valor entre 0 y 40 horas</span>
    </div>`;
}

function bindEditorEvents(count) {
  const form = document.getElementById("syl-week-form");
  form?.querySelectorAll("textarea").forEach(autoGrow);
  form?.addEventListener("input", event => {
    clearFieldError(event.target);
    if (event.target.matches("textarea")) autoGrow(event.target);
    if (event.target.matches("[id^='wf-'][type='number']")) updateHoursTotal();
    _dirty = true;
    setSaveState("Cambios sin guardar", "working");
    clearTimeout(_autosaveTimer);
    _autosaveTimer = setTimeout(() => persistCurrentWeek("draft", { silent: true }), AUTOSAVE_DELAY);
  });
  form?.addEventListener("change", event => {
    if (event.target.matches("[type='number']")) {
      event.target.value = String(Math.min(40, Math.max(0, Number(event.target.value) || 0)));
      updateHoursTotal();
    }
  });

  document.getElementById("syl-prev")?.addEventListener("click", () => navigateWeek(_activeWeek - 1, count));
  document.getElementById("syl-next")?.addEventListener("click", () => navigateWeek(_activeWeek + 1, count));
  document.getElementById("syl-week-select")?.addEventListener("change", event => navigateWeek(Number(event.target.value), count));
  document.querySelectorAll("[data-week-jump]").forEach(button => {
    button.addEventListener("click", () => navigateWeek(Number(button.dataset.weekJump), count));
  });
  document.getElementById("syl-discard")?.addEventListener("click", discardChanges);
  document.getElementById("syl-save-draft")?.addEventListener("click", () => persistCurrentWeek("draft"));
  document.getElementById("syl-mark-complete")?.addEventListener("click", completeCurrentWeek);
  document.getElementById("syl-generate")?.addEventListener("click", generateReadme);
}

function autoGrow(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(96, Math.min(textarea.scrollHeight, 280))}px`;
}

function updateHoursTotal() {
  const total = ["wf-teaching", "wf-practice", "wf-autonomous"]
    .reduce((sum, id) => sum + Math.min(40, Math.max(0, Number(document.getElementById(id)?.value) || 0)), 0);
  const el = document.getElementById("wf-hours-total");
  if (el) el.textContent = `${total} horas`;
}

function navigateWeek(nextWeek, count) {
  if (_dirty) persistCurrentWeek("draft", { silent: true });
  _activeWeek = clampWeek(nextWeek, count);
  renderSyllabus();
  queueMicrotask(() => document.getElementById("wf-title")?.focus());
}

function discardChanges() {
  if (_dirty && !window.confirm("¿Descartar los cambios no guardados de esta semana?")) return;
  clearTimeout(_autosaveTimer);
  _dirty = false;
  renderSyllabus();
  announce("Cambios descartados");
}

function collectWeekFormData(weekIndex, status = "draft") {
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const number = id => Math.min(40, Math.max(0, Number.parseInt(get(id) || "0", 10) || 0));
  return {
    number: weekIndex + 1,
    title: get("wf-title"),
    unit: get("wf-unit"),
    topics: get("wf-topics"),
    outcomes: get("wf-outcomes"),
    bibliography: get("wf-bibliography"),
    teaching_hours: number("wf-teaching"),
    practice_hours: number("wf-practice"),
    autonomous_hours: number("wf-autonomous"),
    graded_activity: get("wf-activity") || null,
    status,
    updated_at: new Date().toISOString(),
  };
}

function persistCurrentWeek(status = "draft", { silent = false } = {}) {
  clearTimeout(_autosaveTimer);
  const course = currentCourse();
  if (!course || !document.getElementById("syl-week-form")) return false;
  const count = weekCountFor(course);
  _activeWeek = clampWeek(_activeWeek, count);
  const week = collectWeekFormData(_activeWeek, status);
  if (!Array.isArray(course.weeks_data)) course.weeks_data = [];
  course.weeks_data[_activeWeek] = week;
  saveCourses();
  _dirty = false;
  setSaveState(silent ? "Guardado automáticamente" : "Borrador guardado", "success");
  announce(`Semana ${_activeWeek + 1} guardada como borrador`);
  if (!silent) toast(`Borrador de la semana ${_activeWeek + 1} guardado`, "success", 2600);
  return true;
}

function validateWeek(week) {
  const missing = missingRequired(week);
  document.querySelectorAll("[aria-invalid='true']").forEach(field => clearFieldError(field));
  if (missing.length === 0) return true;

  missing.forEach(([key, label]) => {
    const id = {
      title: "wf-title",
      unit: "wf-unit",
      topics: "wf-topics",
      outcomes: "wf-outcomes",
      bibliography: "wf-bibliography",
      graded_activity: "wf-activity",
    }[key];
    const field = document.getElementById(id);
    const error = document.getElementById(`${id}-error`);
    field?.setAttribute("aria-invalid", "true");
    field?.classList.add("border-red-500");
    if (error) {
      error.textContent = `${label} es obligatorio para completar la semana.`;
      error.classList.remove("hidden");
    }
  });

  const summary = document.getElementById("syl-error-summary");
  if (summary) {
    summary.innerHTML = `<strong>Faltan ${missing.length} campos para completar esta semana.</strong><p class="mt-1">Revisa: ${missing.map(([, label]) => escapeHtml(label)).join(", ")}.</p>`;
    summary.classList.remove("hidden");
    summary.focus();
  }
  document.getElementById({
    title: "wf-title", unit: "wf-unit", topics: "wf-topics", outcomes: "wf-outcomes",
    bibliography: "wf-bibliography", graded_activity: "wf-activity",
  }[missing[0][0]])?.focus();
  return false;
}

function clearFieldError(field) {
  if (!field?.id) return;
  field.removeAttribute("aria-invalid");
  field.classList.remove("border-red-500");
  const error = document.getElementById(`${field.id}-error`);
  if (error) {
    error.textContent = "";
    error.classList.add("hidden");
  }
}

function completeCurrentWeek() {
  const course = currentCourse();
  if (!course) return;
  const week = collectWeekFormData(_activeWeek, "complete");
  if (!validateWeek(week)) {
    toast("Revisa los campos obligatorios señalados", "error", 4500);
    return;
  }
  if (!Array.isArray(course.weeks_data)) course.weeks_data = [];
  course.weeks_data[_activeWeek] = week;
  saveCourses();
  _dirty = false;
  toast(`Semana ${_activeWeek + 1} marcada como completa`, "success", 3000);
  const count = weekCountFor(course);
  if (_activeWeek < count - 1) _activeWeek += 1;
  renderSyllabus();
  announce(`Semana guardada como completa. Editando semana ${_activeWeek + 1}`);
  queueMicrotask(() => document.getElementById("wf-title")?.focus());
}

async function generateReadme() {
  if (_isGenerating) return;
  const course = currentCourse();
  if (!course) {
    toast("Sin asignatura seleccionada", "error");
    return;
  }
  if (_dirty) persistCurrentWeek("draft", { silent: true });

  let coursePath = course.project_root || parentDirectory(course.project_path);
  if (!coursePath) {
    coursePath = await pickDirectory("Selecciona la carpeta raíz donde está la asignatura");
  }
  if (!coursePath) return;

  const button = document.getElementById("syl-generate");
  _isGenerating = true;
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="material-symbols-outlined animate-spin text-[17px]" aria-hidden="true">progress_activity</span>Generando documento…`;
  }
  announce("Generando el documento del sílabo");
  toast("Generando el sílabo canónico…", "loading", 15000);
  try {
    const result = await generateSyllabus({
      coursePath,
      courseCode: course.code,
      courseName: course.name,
      credits: Number(course.credits) || 4,
      academicPeriod: course.period || "",
      semester: course.semester || "",
      description: course.description || "",
      weeksData: course.weeks_data || [],
    });
    if (result.success && course.project_root !== coursePath) {
      course.project_root = coursePath;
      course.project_path ||= result.path ? parentDirectory(result.path) : "";
      saveCourses();
    }
    toast(result.message, result.success ? "success" : "error", 7000);
    announce(result.success ? "Documento generado correctamente" : `No se pudo generar el documento: ${result.message}`);
  } catch (error) {
    toast(`No se pudo generar el documento: ${error}`, "error", 7000);
    announce("La generación del documento falló");
  } finally {
    _isGenerating = false;
    renderSyllabus();
  }
}
