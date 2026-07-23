import { createCourseStructure, pickDirectory } from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";
import { navigate } from "../router.js";

export function renderCourses() {
  const container = document.getElementById("courses-list");
  if (!container) return;

  if (!state.courses.length) {
    container.innerHTML = `<div class="empty-state">${ic("book-open", 18)}<br>No hay asignaturas aún. Agrega la primera abajo.</div>`;
    refreshIcons();
    return;
  }

  container.innerHTML = state.courses.map((course, index) => `
    <div class="list-item">
      <div class="list-item-left">
        <div class="dot dot-ok"></div>
        <div>
          <div class="list-item-label">${escapeHtml(course.code)} — ${escapeHtml(course.name)}</div>
          <div class="list-item-sub">${Number(course.weeks) || 0} semanas · ${Number(course.credits) || 0} créditos · ${escapeHtml(course.semester || "—")}</div>
        </div>
      </div>
      <div class="list-item-right">
        <button class="btn btn-secondary btn-sm" data-course-action="folders" data-index="${index}" title="Crear estructura de carpetas">
          ${ic("folder-plus", 13)} Carpetas
        </button>
        <button class="btn btn-secondary btn-sm" data-course-action="edit" data-index="${index}" title="Editar sílabo">
          ${ic("pencil", 13)} Sílabo
        </button>
        <button class="btn btn-danger btn-xs" data-course-action="delete" data-index="${index}" title="Eliminar curso">
          ${ic("trash-2", 12)}
        </button>
      </div>
    </div>`).join("");

  container.querySelectorAll("[data-course-action]").forEach(button => {
    button.addEventListener("click", () => {
      const index = safeIndex(button.dataset.index, state.courses.length);
      if (index < 0) return;
      if (button.dataset.courseAction === "folders") generateFolders(index);
      if (button.dataset.courseAction === "edit") editCourse(index);
      if (button.dataset.courseAction === "delete") deleteCourse(index);
    });
  });
  refreshIcons();
}

window.addCourse = function addCourse() {
  const code = document.getElementById("new-code").value.trim();
  const name = document.getElementById("new-name").value.trim();
  const credits = Number.parseInt(document.getElementById("new-credits").value, 10) || 4;
  const weeks = Number.parseInt(document.getElementById("new-weeks").value, 10) || 16;
  const semester = document.getElementById("new-semester").value.trim();

  if (!code) {
    toast("El código del curso es obligatorio", "error");
    document.getElementById("new-code").focus();
    return;
  }
  if (!name) {
    toast("El nombre del curso es obligatorio", "error");
    document.getElementById("new-name").focus();
    return;
  }
  if (state.courses.some(course => course.code.toLowerCase() === code.toLowerCase())) {
    toast("Ya existe un curso con ese código", "error");
    return;
  }

  state.courses.push({
    code,
    name,
    credits: Math.min(20, Math.max(1, credits)),
    weeks: Math.min(52, Math.max(1, weeks)),
    semester,
    period: "",
    weeks_data: [],
    description: "",
  });
  saveCourses();
  renderCourses();
  toast(`Asignatura ${code} agregada`, "success");
  ["new-code", "new-name", "new-semester"].forEach(id => {
    document.getElementById(id).value = "";
  });
};

function deleteCourse(index) {
  const course = state.courses[index];
  if (!confirm(`¿Eliminar "${course.code} — ${course.name}" del registro local?\nNo se borrarán carpetas del disco.`)) return;
  state.courses.splice(index, 1);
  saveCourses();
  renderCourses();
  toast("Asignatura eliminada del registro", "info");
}

function editCourse(index) {
  state.editingCourse = index;
  navigate("syllabus");
}

async function generateFolders(index) {
  const course = state.courses[index];
  const rootPath = await pickDirectory(`Carpeta raíz para ${course.code} — ${course.name}`);
  if (!rootPath) return;

  toast("Creando estructura de carpetas…", "loading", 15000);
  try {
    const result = await createCourseStructure({
      rootPath,
      courseCode: course.code,
      courseName: course.name,
      weeks: course.weeks,
    });
    toast(result.message, result.success ? "success" : "error", 6000);
  } catch (error) {
    toast(`Error: ${error}`, "error");
  }
}
