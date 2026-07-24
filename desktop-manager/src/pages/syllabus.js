import { generateSyllabus, pickDirectory } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";

let _activeWeek = 0;

export function renderSyllabus() {
  const el = document.getElementById("p-syllabus");
  if (!el) return;

  const course = state.editingCourse !== undefined ? state.courses[state.editingCourse] : null;
  if (!course) {
    el.innerHTML = `
      <div class="glass-card" style="padding:40px;text-align:center;color:var(--dim)">
        <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px">description</span>
        <div style="font-size:16px;font-weight:700;color:var(--text-2);margin-bottom:6px">Sin asignatura seleccionada</div>
        <div style="font-size:13px">Selecciona una asignatura en la página de Cursos para editar su sílabo.</div>
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
    <div class="syllabus-layout">

      <!-- Left column -->
      <div class="syllabus-left">

        <!-- Course metadata -->
        <div class="glass-card" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--teal);margin-bottom:3px">Editando sílabo</div>
            <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-0.02em">${escapeHtml(course.name)} (${escapeHtml(course.code)})</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">
              ${escapeHtml(course.semester || "—")} · ${escapeHtml(course.period || "—")} · ${Number(course.credits) || 0} créditos
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:11px;color:var(--muted);background:rgba(195,198,213,0.25);padding:4px 10px;border-radius:99px;border:1px solid rgba(195,198,213,0.50)">
              Autoguardado
            </span>
          </div>
        </div>

        <!-- Week editor pane -->
        <div class="glass-panel" style="flex:1;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">

          <!-- Week tabs -->
          <div class="week-tabs-bar">
            ${Array.from({ length: weekCount }, (_, i) => {
              const st = statuses[i];
              const w = weeksData[i];
              const label = w?.title ? escapeHtml(w.title.slice(0, 16) + (w.title.length > 16 ? "…" : "")) : `Semana ${i + 1}`;
              const dotClass = st === "complete" ? "week-tab-dot-ok" : (st === "draft" ? "week-tab-dot-active" : "week-tab-dot-miss");
              const tabClass = i === _activeWeek ? "active" : (st === "complete" ? "complete" : (st === "missing" ? "missing" : ""));
              const icon = i === _activeWeek ? `<span class="material-symbols-outlined" style="font-size:15px">edit</span>` :
                           (st === "complete" ? `<span class="material-symbols-outlined" style="font-size:15px;color:var(--green)">check_circle</span>` : "");
              return `<button class="week-tab ${tabClass}" data-week="${i}">
                <span class="week-tab-dot ${dotClass}"></span>
                Sem ${i + 1}: ${label}
                ${icon}
              </button>`;
            }).join("")}
          </div>

          <!-- Active week form -->
          <div class="week-form-panel" id="syl-week-form">
            ${renderWeekForm(weeksData[_activeWeek], _activeWeek)}
          </div>

          <div class="week-form-footer">
            <button class="btn btn-secondary btn-sm" id="syl-discard">Descartar cambios</button>
            <button class="btn btn-secondary btn-sm" id="syl-save-draft">
              <span class="material-symbols-outlined" style="font-size:14px">save</span> Guardar borrador
            </button>
            <button class="btn btn-primary btn-sm" id="syl-mark-complete">
              <span class="material-symbols-outlined" style="font-size:14px">check_circle</span> Marcar como completa
            </button>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="syllabus-right">

        <!-- Validation panel -->
        <div class="glass-panel" style="border-radius:12px;overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid rgba(195,198,213,0.30)">
            <div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:var(--text)">
              <span class="material-symbols-outlined" style="font-size:18px;color:var(--teal)">checklist</span>
              Validación del sílabo
            </div>
          </div>
          <div class="validation-panel">
            <div style="width:100%;height:4px;background:rgba(195,198,213,0.30);border-radius:99px;overflow:hidden;margin-bottom:4px">
              <div style="height:100%;background:var(--teal);width:${pct}%;transition:width 0.4s"></div>
            </div>
            <div style="font-size:11.5px;color:var(--muted);text-align:right;margin-bottom:8px">${pct}% completo (${complete}/${weekCount} semanas)</div>
            ${Array.from({ length: weekCount }, (_, i) => {
              const st = statuses[i];
              const w = weeksData[i];
              const name = w?.title ? escapeHtml(w.title.slice(0, 20)) : `Semana ${i + 1}`;
              const iconMap = { complete: "check_circle", draft: "pending", missing: "error" };
              const colorMap = { complete: "var(--green)", draft: "var(--teal)", missing: "var(--red)" };
              const labelMap = { complete: "Válida", draft: "Borrador", missing: "Vacía" };
              return `<div class="validation-item ${st}" data-week-jump="${i}" style="cursor:pointer">
                <span class="material-symbols-outlined" style="font-size:18px;color:${colorMap[st]}">${iconMap[st]}</span>
                <span class="validation-label">${name}</span>
                <span class="validation-state" style="color:${colorMap[st]}">${labelMap[st]}</span>
              </div>`;
            }).join("")}
          </div>
        </div>

        <!-- Action panel -->
        <div class="glass-card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:12.5px;color:var(--muted);text-align:center">
            ${pct < 100 ? "Completa todas las semanas para generar el documento final." : "¡Sílabo completo! Puedes generar el README."}
          </div>
          <button class="btn ${pct === 100 ? "btn-primary" : "btn-secondary"}" id="syl-generate" ${pct < 100 ? "disabled" : ""} style="width:100%;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:15px">markdown</span>
            Generar README.md
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind week tab clicks
  el.querySelectorAll(".week-tab").forEach(btn => {
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
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(195,198,213,0.30)">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:var(--text)">
        <span class="material-symbols-outlined">edit_document</span>
        Editando: Semana ${weekIndex + 1}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-grid">
        <div class="form-group">
          <label>Título de la semana</label>
          <input id="wf-title" placeholder="Ej: Límites y Continuidad" value="${escapeHtml(w.title || "")}">
        </div>
        <div class="form-group">
          <label>Unidad cubierta</label>
          <input id="wf-unit" placeholder="Ej: Unidad 2" value="${escapeHtml(w.unit || "")}">
        </div>
      </div>
      <div class="form-group">
        <label>Contenido / Temas <span class="text-muted">(uno por línea)</span></label>
        <textarea id="wf-topics" style="height:80px" placeholder="Tema 1&#10;Tema 2">${escapeHtml(w.topics || "")}</textarea>
      </div>
      <div class="form-group">
        <label>Resultados de aprendizaje</label>
        <textarea id="wf-outcomes" style="height:70px" placeholder="Docencia: Analizar…&#10;Práctica: Aplicar…">${escapeHtml(w.outcomes || "")}</textarea>
      </div>
      <div class="form-group">
        <label>Bibliografía / Recursos</label>
        <input id="wf-bibliography" placeholder="Autor (año). Obra. Capítulo." value="${escapeHtml(w.bibliography || "")}">
      </div>
      <div class="form-group">
        <label>Horas: docencia / práctica / autónomo</label>
        <div class="row">
          <input id="wf-teaching" type="number" min="0" max="40" value="${Number(w.teaching_hours ?? 2)}" style="width:70px">
          <span class="text-muted">/</span>
          <input id="wf-practice" type="number" min="0" max="40" value="${Number(w.practice_hours ?? 1)}" style="width:70px">
          <span class="text-muted">/</span>
          <input id="wf-autonomous" type="number" min="0" max="40" value="${Number(w.autonomous_hours ?? 4)}" style="width:70px">
        </div>
      </div>
      <div class="form-group">
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
