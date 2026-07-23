import { generateSyllabus, pickDirectory } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";

export function renderSyllabus() {
  const course = state.editingCourse !== undefined ? state.courses[state.editingCourse] : null;
  if (course) {
    document.getElementById("syl-code").value = course.code || "";
    document.getElementById("syl-name").value = course.name || "";
    document.getElementById("syl-period").value = course.period || "";
    document.getElementById("syl-semester").value = course.semester || "";
    document.getElementById("syl-credits").value = course.credits || 4;
    document.getElementById("syl-weeks").value = course.weeks || 16;
    document.getElementById("syl-desc").value = course.description || "";
  }
  buildWeeksAccordion(course?.weeks_data || []);
}

function buildWeeksAccordion(existing = collectWeeksData()) {
  const count = Math.min(52, Math.max(1, Number.parseInt(document.getElementById("syl-weeks")?.value || "16", 10)));
  const container = document.getElementById("syl-weeks-container");
  if (!container) return;

  container.replaceChildren();
  for (let number = 1; number <= count; number += 1) {
    const week = existing[number - 1] || {};
    const item = document.createElement("div");
    item.className = "week-item";
    item.innerHTML = `
      <button class="week-header" type="button" aria-expanded="false">
        <span>Semana ${String(number).padStart(2, "0")} — ${escapeHtml(week.title || "Sin título aún")}</span>
        <span class="chevron">${ic("chevron-down", 14)}</span>
      </button>
      <div class="week-body">
        <div class="form-grid mb-3">
          <div class="form-group">
            <label>Título de la semana</label>
            <input placeholder="Ej: Normalización de bases de datos" data-field="title" value="${escapeHtml(week.title || "")}">
          </div>
          <div class="form-group">
            <label>Unidad</label>
            <input placeholder="Ej: Unidad 2 — Diseño relacional" data-field="unit" value="${escapeHtml(week.unit || "")}">
          </div>
        </div>
        <div class="form-group mb-3">
          <label>Horas: docencia / práctica / autónomo</label>
          <div class="row">
            <input type="number" min="0" max="40" aria-label="Horas de docencia" data-field="teaching_hours" value="${Number(week.teaching_hours ?? 2)}" class="hours-input">
            <span class="text-muted">/</span>
            <input type="number" min="0" max="40" aria-label="Horas de práctica" data-field="practice_hours" value="${Number(week.practice_hours ?? 1)}" class="hours-input">
            <span class="text-muted">/</span>
            <input type="number" min="0" max="40" aria-label="Horas de trabajo autónomo" data-field="autonomous_hours" value="${Number(week.autonomous_hours ?? 4)}" class="hours-input">
          </div>
        </div>
        <div class="form-group mb-3">
          <label>Temas / contenido semanal <span class="text-muted">(uno por línea)</span></label>
          <textarea data-field="topics" placeholder="Primera forma normal&#10;Segunda forma normal">${escapeHtml(week.topics || "")}</textarea>
        </div>
        <div class="form-group mb-3">
          <label>Resultado de aprendizaje <span class="text-muted">(Docencia, Práctica y Autónomo)</span></label>
          <textarea data-field="outcomes" placeholder="Docencia: Analizar…&#10;Práctica: Aplicar…&#10;Autónomo: Justificar…">${escapeHtml(week.outcomes || "")}</textarea>
        </div>
        <div class="form-group mb-3">
          <label>Herramientas de aprendizaje <span class="text-muted">(fuentes y recursos, uno por línea)</span></label>
          <textarea data-field="bibliography" placeholder="Silberschatz (2020). Capítulo 8.">${escapeHtml(week.bibliography || "")}</textarea>
        </div>
        <div class="form-group">
          <label>Actividades calificadas <span class="text-muted">(código — nombre — puntaje; una por línea)</span></label>
          <textarea data-field="graded_activity" placeholder="AC-01 — Taller de normalización — 10 puntos">${escapeHtml(week.graded_activity || "")}</textarea>
        </div>
      </div>`;

    item.querySelector(".week-header").addEventListener("click", event => {
      const header = event.currentTarget;
      const open = !header.classList.contains("open");
      header.classList.toggle("open", open);
      header.nextElementSibling.classList.toggle("open", open);
      header.setAttribute("aria-expanded", String(open));
    });
    container.appendChild(item);
  }
  refreshIcons();
}

window.initSyllabus = function initSyllabus() {
  buildWeeksAccordion();
};

window.saveSyllabus = async function saveSyllabus() {
  const code = document.getElementById("syl-code").value.trim();
  const name = document.getElementById("syl-name").value.trim();
  const academicPeriod = document.getElementById("syl-period").value.trim();
  const semester = document.getElementById("syl-semester").value.trim();
  const credits = Number.parseInt(document.getElementById("syl-credits").value || "4", 10);
  const description = document.getElementById("syl-desc").value.trim();
  const weeksData = collectWeeksData();

  if (!code || !name || !academicPeriod || !semester) {
    toast("Completa código, nombre, periodo académico y semestre", "error");
    return;
  }
  if (weeksData.some(week => !week.title || !week.unit || !week.topics || !week.outcomes)) {
    toast("Cada semana requiere título, unidad, temas y resultado de aprendizaje", "error");
    return;
  }

  const index = state.editingCourse;
  if (index !== undefined && state.courses[index]) {
    Object.assign(state.courses[index], {
      code,
      name,
      period: academicPeriod,
      semester,
      credits,
      description,
      weeks: weeksData.length,
      weeks_data: weeksData,
    });
    saveCourses();
  }

  const coursePath = await pickDirectory("Selecciona la carpeta raíz del curso");
  if (!coursePath) return;
  toast("Generando el sílabo canónico…", "loading", 15000);
  try {
    const result = await generateSyllabus({
      coursePath,
      courseCode: code,
      courseName: name,
      credits,
      academicPeriod,
      semester,
      description,
      weeksData,
    });
    toast(result.message, result.success ? "success" : "error", 7000);
  } catch (error) {
    toast(`Error: ${error}`, "error");
  }
};

function collectWeeksData() {
  return Array.from(document.querySelectorAll(".week-item")).map((item, index) => {
    const value = field => item.querySelector(`[data-field="${field}"]`)?.value?.trim() || "";
    const hours = field => Math.max(0, Number.parseInt(value(field) || "0", 10));
    return {
      number: index + 1,
      title: value("title"),
      unit: value("unit"),
      topics: value("topics"),
      outcomes: value("outcomes"),
      bibliography: value("bibliography"),
      graded_activity: value("graded_activity") || null,
      teaching_hours: hours("teaching_hours"),
      practice_hours: hours("practice_hours"),
      autonomous_hours: hours("autonomous_hours"),
    };
  });
}
