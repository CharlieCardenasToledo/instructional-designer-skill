import { generateSyllabus, pickDirectory } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { ui, cx } from "../uiClasses.js";

let _activeWeek = 0;

export function renderSyllabus() {
  const el = document.getElementById("p-syllabus");
  if (!el) return;

  const course = state.editingCourse !== undefined ? state.courses[state.editingCourse] : null;
  if (!course) {
    el.innerHTML = `
      <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-10 text-center text-app-muted shadow-glass backdrop-blur-xl">
        <span class="material-symbols-outlined mb-3 block text-[40px]">description</span>
        <div class="mb-1.5 text-base font-bold text-slate-700">Sin asignatura seleccionada</div>
        <div class="text-[13px]">Selecciona una asignatura en la página de Cursos para editar su sílabo.</div>
      </div>`;
    return;
  }

  _activeWeek = _activeWeek || 0;
  const weeksData = course.weeks_data || [];
  const weekCount = Math.min(52, Math.max(1, Number(course.weeks) || 16));

  // Build completion summary
  const statuses = Array.from({ length: weekCount }, (_, i) => {
    const w = weeksData[i];
    if (!w || !w.title) return "missing";
    if (w.title && w.unit && w.topics && w.outcomes) return "complete";
    return "draft";
  });
  const complete = statuses.filter(s => s === "complete").length;
  const pct = weekCount > 0 ? Math.round((complete / weekCount) * 100) : 0;

  el.innerHTML = `
    <div class="syllabus-layout grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3.5 items-start">

      <!-- Left column -->
      <div class="syllabus-left">

        <!-- Course metadata -->
        <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-4 flex items-center justify-between shadow-glass backdrop-blur-xl">
          <div>
            <div class="mb-0.5 text-[10.5px] font-bold uppercase tracking-wider text-brand">Editando sílabo</div>
            <div class="text-[17px] font-extrabold tracking-tight text-app-text">${escapeHtml(course.name)} (${escapeHtml(course.code)})</div>
            <div class="mt-0.5 text-xs text-app-muted">
              ${escapeHtml(course.semester || "—")} · ${escapeHtml(course.period || "—")} · ${Number(course.credits) || 0} créditos
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-slate-300/50 bg-slate-200/25 px-2.5 py-1 text-[11px] text-app-muted">
              Guardado manual
            </span>
          </div>
        </div>

        <!-- Week editor pane -->
        <div class="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-900/10 bg-white/55 backdrop-blur-xl">

          <!-- Week tabs -->
          <div class="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-300/40 bg-slate-50/60 px-3 py-2.5">
            ${Array.from({ length: weekCount }, (_, i) => {
              const st = statuses[i];
              const w = weeksData[i];
              const label = w?.title ? escapeHtml(w.title.slice(0, 16) + (w.title.length > 16 ? "…" : "")) : `Semana ${i + 1}`;
              const dotClass = st === "complete" ? "bg-green-500" : (st === "draft" ? "bg-teal-600" : "bg-red-600/50");
              const tabClass = i === _activeWeek
                ? "border-brand/25 bg-brand/10 font-semibold text-teal-700"
                : (st === "complete" ? "text-green-600" : (st === "missing" ? "text-red-600" : "text-app-muted"));
              const icon = i === _activeWeek ? `<span class="material-symbols-outlined text-[15px]">edit</span>` :
                           (st === "complete" ? `<span class="material-symbols-outlined text-[15px] text-green-500">check_circle</span>` : "");
              return `<button class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:border-slate-300/40 hover:bg-slate-300/20 hover:text-slate-700 ${tabClass}" data-week="${i}">
                <span class="h-[7px] w-[7px] shrink-0 rounded-full ${dotClass}"></span>
                Sem ${i + 1}: ${label}
                ${icon}
              </button>`;
            }).join("")}
          </div>

          <!-- Active week form -->
          <div class="flex-1 overflow-y-auto bg-white/60 p-[18px]" id="syl-week-form">
            ${renderWeekForm(weeksData[_activeWeek], _activeWeek)}
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-300/30 bg-slate-50/50 px-4 py-3">
            <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="syl-discard">Descartar cambios</button>
            <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)}" id="syl-save-draft">
              <span class="material-symbols-outlined text-sm">save</span> Guardar borrador
            </button>
            <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" id="syl-mark-complete">
              <span class="material-symbols-outlined text-sm">check_circle</span> Marcar como completa
            </button>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="syllabus-right">

        <!-- Validation panel -->
        <div class="overflow-hidden rounded-xl border border-slate-900/10 bg-white/55 backdrop-blur-xl">
          <div class="border-b border-slate-300/30 px-4 py-3.5">
            <div class="flex items-center gap-2 text-sm font-bold text-app-text">
              <span class="material-symbols-outlined text-lg text-brand">checklist</span>
              Validación del sílabo
            </div>
          </div>
          <div class="flex flex-col gap-2 p-3.5">
            <div class="mb-1 h-1 w-full overflow-hidden rounded-full bg-slate-300/30">
              <div class="h-full bg-brand transition-[width] duration-500" style="width:${pct}%"></div>
            </div>
            <div class="mb-2 text-right text-[11.5px] text-app-muted">${pct}% completo (${complete}/${weekCount} semanas)</div>
            ${Array.from({ length: weekCount }, (_, i) => {
              const st = statuses[i];
              const w = weeksData[i];
              const name = w?.title ? escapeHtml(w.title.slice(0, 20)) : `Semana ${i + 1}`;
              const iconMap = { complete: "check_circle", draft: "pending", missing: "error" };
              const labelMap = { complete: "Válida", draft: "Borrador", missing: "Vacía" };
              const stateClass = st === "complete"
                ? "border-green-700/25 bg-green-700/[0.04] text-green-700"
                : (st === "draft" ? "border-brand/20 bg-brand/[0.04] text-teal-700" : "border-red-700/25 bg-red-700/[0.04] text-red-700");
              return `<div class="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] ${stateClass}" data-week-jump="${i}">
              <span class="material-symbols-outlined text-lg">${iconMap[st]}</span>
                <span class="flex-1 font-medium text-app-text">${name}</span>
                <span class="text-[11px] font-bold">${labelMap[st]}</span>
              </div>`;
            }).join("")}
          </div>
        </div>

        <!-- Action panel -->
        <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-4 flex flex-col gap-3 shadow-glass backdrop-blur-xl">
          <div class="text-center text-[12.5px] text-app-muted">
            ${pct < 100 ? "Completa todas las semanas para generar el documento final." : "¡Sílabo completo! Puedes generar el README."}
          </div>
          <button class="${cx(ui.button.base, pct === 100 ? ui.button.primary : ui.button.secondary, 'w-full')}" id="syl-generate" ${pct < 100 ? "disabled" : ""}>
            <span class="material-symbols-outlined text-[15px]">markdown</span>
            Generar README.md
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind week tab clicks
  el.querySelectorAll("[data-week]").forEach(btn => {
    btn.addEventListener("click", () => {
      _activeWeek = Number(btn.dataset.week);
      renderSyllabus();
    });
  });

  // Bind validation item clicks
  el.querySelectorAll("[data-week-jump]").forEach(item => {
    item.addEventListener("click", () => {
      _activeWeek = Number(item.dataset.weekJump);
      renderSyllabus();
    });
  });

  // Bind save/discard/generate
  el.querySelector("#syl-discard")?.addEventListener("click", () => { renderSyllabus(); });
  el.querySelector("#syl-save-draft")?.addEventListener("click", () => saveCurrentWeek(false));
  el.querySelector("#syl-mark-complete")?.addEventListener("click", () => saveCurrentWeek(true));
  el.querySelector("#syl-generate")?.addEventListener("click", generateReadme);
}

function renderWeekForm(weekData, weekIndex) {
  const w = weekData || {};
  return `
    <div class="mb-4 flex items-center justify-between border-b border-slate-300/30 pb-3">
      <div class="flex items-center gap-2 text-[15px] font-bold text-app-text">
        <span class="material-symbols-outlined">edit_document</span>
        Editando: Semana ${weekIndex + 1}
      </div>
    </div>
    <div class="flex flex-col gap-3.5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <label>Título de la semana</label>
          <input id="wf-title" placeholder="Ej: Límites y Continuidad" value="${escapeHtml(w.title || "")}">
        </div>
        <div class="flex flex-col gap-1.5">
          <label>Unidad cubierta</label>
          <input id="wf-unit" placeholder="Ej: Unidad 2" value="${escapeHtml(w.unit || "")}">
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <label>Contenido / Temas <span class="text-muted">(uno por línea)</span></label>
        <textarea id="wf-topics" class="h-20" placeholder="Tema 1&#10;Tema 2">${escapeHtml(w.topics || "")}</textarea>
      </div>
      <div class="flex flex-col gap-1.5">
        <label>Resultados de aprendizaje</label>
        <textarea id="wf-outcomes" class="h-[70px]" placeholder="Docencia: Analizar…&#10;Práctica: Aplicar…">${escapeHtml(w.outcomes || "")}</textarea>
      </div>
      <div class="flex flex-col gap-1.5">
        <label>Bibliografía / Recursos</label>
        <input id="wf-bibliography" placeholder="Autor (año). Obra. Capítulo." value="${escapeHtml(w.bibliography || "")}">
      </div>
      <div class="flex flex-col gap-1.5">
        <label>Horas: docencia / práctica / autónomo</label>
        <div class="row">
          <input id="wf-teaching" class="w-[70px]" type="number" min="0" max="40" value="${Number(w.teaching_hours ?? 2)}">
          <span class="text-muted">/</span>
          <input id="wf-practice" class="w-[70px]" type="number" min="0" max="40" value="${Number(w.practice_hours ?? 1)}">
          <span class="text-muted">/</span>
          <input id="wf-autonomous" class="w-[70px]" type="number" min="0" max="40" value="${Number(w.autonomous_hours ?? 4)}">
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <label>Actividad calificada <span class="text-muted">(opcional)</span></label>
        <input id="wf-activity" placeholder="AC-01 — Taller — 10 puntos" value="${escapeHtml(w.graded_activity || "")}">
      </div>
    </div>`;
}

function collectWeekFormData(weekIndex) {
  const get = id => document.getElementById(id)?.value?.trim() || "";
  const num = id => Math.max(0, Number.parseInt(get(id) || "0", 10));
  return {
    number: weekIndex + 1,
    title: get("wf-title"),
    unit: get("wf-unit"),
    topics: get("wf-topics"),
    outcomes: get("wf-outcomes"),
    bibliography: get("wf-bibliography"),
    teaching_hours: num("wf-teaching"),
    practice_hours: num("wf-practice"),
    autonomous_hours: num("wf-autonomous"),
    graded_activity: get("wf-activity") || null,
  };
}

function saveCurrentWeek(requireComplete) {
  const index = state.editingCourse;
  const course = state.courses[index];
  if (!course) { toast("Selecciona una asignatura primero", "error"); return; }

  const week = collectWeekFormData(_activeWeek);
  if (requireComplete && (!week.title || !week.unit || !week.topics || !week.outcomes)) {
    toast("Completa título, unidad, temas y resultados de aprendizaje", "error", 5000);
    return;
  }
  if (!week.title) { toast("Título de la semana obligatorio", "error"); return; }

  if (!Array.isArray(course.weeks_data)) course.weeks_data = [];
  course.weeks_data[_activeWeek] = week;
  course.weeks = Math.max(Number(course.weeks || 0), _activeWeek + 1);
  saveCourses();
  toast(`Semana ${_activeWeek + 1} guardada`, "success", 3000);

  // Move to next week if marking complete
  if (requireComplete && _activeWeek < (course.weeks - 1)) {
    _activeWeek++;
  }
  renderSyllabus();
}

async function generateReadme() {
  const index = state.editingCourse;
  const course = state.courses[index];
  if (!course) { toast("Sin asignatura seleccionada", "error"); return; }

  const coursePath = await pickDirectory("Selecciona la carpeta raíz del curso");
  if (!coursePath) return;

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
    toast(result.message, result.success ? "success" : "error", 7000);
  } catch (e) {
    toast(`Error: ${e}`, "error");
  }
}
