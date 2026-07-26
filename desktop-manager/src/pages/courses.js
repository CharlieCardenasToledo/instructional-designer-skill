import { createCourseStructure, pickDirectory } from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, cx } from "../uiClasses.js";

let _filter = "";
let _modalStep = 0;
let _modalData = {};

export function renderCourses() {
  const el = document.getElementById("p-courses");
  if (!el) return;

  const total   = state.courses.length;
  const active  = state.courses.filter(c => (c.weeks_data || []).some(w => w.title)).length;
  const pending = total - active;

  el.innerHTML = `
    <div class="courses-layout">

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border border-slate-300/50 bg-white/70 p-4 shadow-[0_2px_8px_rgba(0,49,126,0.05)]">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-app-muted">Asignaturas</div>
          <div class="my-1 text-[26px] font-extrabold tracking-tight text-teal-700">${total}</div>
          <div class="text-[11px] text-app-muted">Total registradas</div>
        </div>
        <div class="rounded-xl border border-slate-300/50 bg-white/70 p-4 shadow-[0_2px_8px_rgba(0,49,126,0.05)]">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-app-muted">Pendientes</div>
          <div class="my-1 text-[26px] font-extrabold tracking-tight text-teal-700">${pending}</div>
          <div class="text-[11px] text-app-muted">Sin contenido aún</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="courses-toolbar flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div class="courses-search">
          <span class="material-symbols-outlined">search</span>
          <input id="courses-search-input" placeholder="Buscar por código o nombre…" value="${escapeHtml(_filter)}">
        </div>
        <button class="${cx(ui.button.base, ui.button.primary, 'sm:shrink-0')}" id="btn-new-course">
          <span class="material-symbols-outlined text-[15px]">add</span>
          Nueva asignatura
        </button>
      </div>

      <!-- Table -->
      <div class="courses-table-wrap">
        <div class="overflow-x-auto">
        <table class="courses-table min-w-[760px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Asignatura</th>
              <th>Periodo</th>
              <th>Semestre</th>
              <th>Créditos</th>
              <th>Semanas</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="courses-tbody">
            ${renderTableRows()}
          </tbody>
        </table>
        </div>
        ${state.courses.length === 0 ? `
          <div class="flex flex-col items-center justify-center p-12 text-center text-app-muted">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-brand">
              <span class="material-symbols-outlined text-[32px]">school</span>
            </div>
            <h3 class="mb-1.5 text-base font-bold text-app-text">Aún no tienes asignaturas</h3>
            <p class="mb-5 max-w-[380px] text-[13px] leading-normal text-app-muted">
              Crea tu primera asignatura para estructurar sílabos, contenidos semanales y guías instruccionales en PDF.
            </p>
            <button class="${cx(ui.button.base, ui.button.primary)}" id="btn-empty-new-course">
              <span class="material-symbols-outlined text-base">add</span>
              Nueva asignatura
            </button>
          </div>` : ""}
        <div class="flex items-center justify-between border-t border-slate-300/30 px-4 py-2.5 text-[12.5px] text-app-muted">
          <span>${filteredCourses().length} de ${total} asignaturas</span>
          <div class="flex gap-1"></div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div class="fixed inset-0 z-[5000] hidden items-center justify-center bg-slate-900/45 p-6 backdrop-blur-[6px]" id="course-modal">
      <div class="max-h-[calc(100vh-48px)] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-slate-300/60 bg-white/95 shadow-2xl backdrop-blur-2xl" id="course-modal-box"></div>
    </div>
  `;

  document.getElementById("courses-search-input")?.addEventListener("input", e => {
    _filter = e.target.value;
    document.getElementById("courses-tbody").innerHTML = renderTableRows();
    bindRowActions();
  });

  document.getElementById("btn-new-course")?.addEventListener("click", openModal);
  document.getElementById("btn-empty-new-course")?.addEventListener("click", openModal);

  document.getElementById("course-modal")?.addEventListener("click", e => {
    if (e.target.id === "course-modal") closeModal();
  });

  bindRowActions();
}

function filteredCourses() {
  if (!_filter) return state.courses;
  const q = _filter.toLowerCase();
  return state.courses.filter(c =>
    c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );
}

function renderTableRows() {
  const rows = filteredCourses();
  if (!rows.length) {
    return `<tr><td colspan="8" class="p-8 text-center text-slate-400">Sin resultados</td></tr>`;
  }
  return rows.map((course, i) => {
    const realIndex = state.courses.indexOf(course);
    const hasContent = (course.weeks_data || []).some(w => w.title);
    return `
    <tr>
      <td><span class="font-mono font-bold text-brand">${escapeHtml(course.code)}</span></td>
      <td class="font-semibold text-app-text">${escapeHtml(course.name)}</td>
      <td class="text-app-muted">${escapeHtml(course.period || "—")}</td>
      <td class="text-app-muted">${escapeHtml(course.semester || "—")}</td>
      <td class="text-center">${Number(course.credits) || 0}</td>
      <td class="text-center">${Number(course.weeks) || 0}</td>
      <td>
        <span class="status-pill ${hasContent ? "status-active" : "status-draft"}">
          <span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"></span>
          ${hasContent ? "Con contenido" : "Borrador"}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="row-action-edit" data-course-action="edit" data-index="${realIndex}">
            <span class="material-symbols-outlined text-sm">edit_document</span> Sílabo
          </button>
          <button class="row-action-folders" data-course-action="folders" data-index="${realIndex}">
            <span class="material-symbols-outlined text-sm">create_new_folder</span> Carpetas
          </button>
          <button class="row-action-delete" data-course-action="delete" data-index="${realIndex}">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function bindRowActions() {
  document.querySelectorAll("[data-course-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (btn.dataset.courseAction === "edit")    editCourse(index);
      if (btn.dataset.courseAction === "folders") generateFolders(index);
      if (btn.dataset.courseAction === "delete")  deleteCourse(index);
    });
  });
}

async function deleteCourse(index) {
  const course = state.courses[index];
  if (!await confirm(`¿Eliminar "${course.code} — ${course.name}"?\nNo se borrarán carpetas del disco.`)) return;
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
    const result = await createCourseStructure({ rootPath, courseCode: course.code, courseName: course.name, weeks: course.weeks });
    toast(result.message, result.success ? "success" : "error", 6000);
  } catch (e) {
    toast(`Error: ${e}`, "error");
  }
}

// ── Modal new course ──────────────────────────────────────────────────────────

function openModal() {
  _modalStep = 1;
  _modalData = { code: "", name: "", period: "", semester: "", credits: 4, weeks: 16, description: "", initReadme: true };
  renderModal();
  document.getElementById("course-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("course-modal").classList.add("hidden");
}

function renderModal() {
  const box = document.getElementById("course-modal-box");
  if (!box) return;

  if (_modalStep === 1) {
    box.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-300/40 px-6 pb-3.5 pt-[18px]">
        <div>
          <div class="text-base font-bold text-app-text">Nueva asignatura</div>
          <div class="mt-0.5 text-[11px] text-app-muted">Paso 1 de 2 — Información general</div>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-brand bg-brand text-[11px] font-bold text-white">1</div>
          <div class="h-px w-6 bg-slate-300/50"></div>
          <div class="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-slate-300/60 text-[11px] font-bold text-app-muted">2</div>
        </div>
      </div>
      <div class="p-5 px-6">
        <div id="course-modal-error" class="mt-2.5 rounded-[7px] border border-red-700/25 bg-red-700/[0.06] px-3 py-2 text-xs text-red-700" role="alert" hidden></div>
        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label for="m-name">Nombre de la asignatura *</label>
            <input id="m-name" placeholder="Ej: Bases de Datos" value="${escapeHtml(_modalData.name)}">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="m-code">Código único *</label>
            <input id="m-code" class="uppercase" placeholder="Ej: IFT200" value="${escapeHtml(_modalData.code)}">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="m-period">Periodo académico</label>
            <input id="m-period" placeholder="Ej: Abril–Agosto 2026" value="${escapeHtml(_modalData.period)}">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="m-semester">Semestre / Nivel</label>
            <input id="m-semester" placeholder="Ej: Tercero" value="${escapeHtml(_modalData.semester)}">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="m-credits">Créditos *</label>
            <input id="m-credits" type="number" min="1" max="20" value="${_modalData.credits}">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="m-weeks">N.º de semanas</label>
            <input id="m-weeks" type="number" min="1" max="52" value="${_modalData.weeks}">
          </div>
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label for="m-desc">Descripción (opcional)</label>
            <textarea id="m-desc" class="h-[70px]" placeholder="Breve descripción del curso…">${escapeHtml(_modalData.description)}</textarea>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between rounded-b-2xl border-t border-slate-300/40 bg-slate-100/50 px-6 py-3.5">
        <button class="${cx(ui.button.base, ui.button.secondary)}" id="m-cancel">Cancelar</button>
        <button class="${cx(ui.button.base, ui.button.primary)}" id="m-next">
          Siguiente <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
        </button>
      </div>`;

    box.querySelector("#m-cancel").onclick = closeModal;
    box.querySelector("#m-next").onclick = () => {
      const code = box.querySelector("#m-code").value.trim().toUpperCase();
      const name = box.querySelector("#m-name").value.trim();
      if (!code) { showModalError("El código es obligatorio"); return; }
      if (!name) { showModalError("El nombre es obligatorio"); return; }
      if (state.courses.some(c => c.code.toLowerCase() === code.toLowerCase())) {
        showModalError("Ya existe un curso con ese código"); return;
      }
      _modalData.code     = code;
      _modalData.name     = name;
      _modalData.period   = box.querySelector("#m-period").value.trim();
      _modalData.semester = box.querySelector("#m-semester").value.trim();
      _modalData.credits  = Math.min(20, Math.max(1, Number(box.querySelector("#m-credits").value) || 4));
      _modalData.weeks    = Math.min(52, Math.max(1, Number(box.querySelector("#m-weeks").value) || 16));
      _modalData.description = box.querySelector("#m-desc").value.trim();
      _modalStep = 2;
      renderModal();
    };
  } else {
    const weeks = _modalData.weeks;
    const weekFolders = Array.from({ length: Math.min(weeks, 6) }, (_, i) => `/week-${String(i + 1).padStart(2, "0")}/`);
    box.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-300/40 px-6 pb-3.5 pt-[18px]">
        <div>
          <div class="text-base font-bold text-app-text">Nueva asignatura</div>
          <div class="mt-0.5 text-[11px] text-app-muted">Paso 2 de 2 — Estructura de carpetas</div>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-green-500 bg-green-500 text-[11px] font-bold text-white">
            <span class="material-symbols-outlined text-[13px]">check</span>
          </div>
          <div class="h-px w-6 bg-brand"></div>
          <div class="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-brand bg-brand text-[11px] font-bold text-white">2</div>
        </div>
      </div>
      <div class="p-5 px-6">
        <div class="rounded-app border border-slate-900/10 bg-white/55 p-3.5 mb-4 backdrop-blur-xl">
          <div class="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-app-muted">Vista previa de carpetas</div>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
              <span class="material-symbols-outlined text-[17px] text-brand">folder_open</span>
              /${escapeHtml(_modalData.code)} ${escapeHtml(_modalData.name)}/
            </div>
            ${weekFolders.map(f => `
              <div class="flex items-center gap-2 pl-5 text-xs text-app-muted">
                <span class="material-symbols-outlined text-base">folder</span> ${escapeHtml(f)}
              </div>`).join("")}
            ${weeks > 6 ? `<div class="pl-5 text-[11.5px] text-slate-400">… y ${weeks - 6} carpetas más</div>` : ""}
          </div>
        </div>
        <label class="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" id="m-init-readme" ${_modalData.initReadme ? "checked" : ""} class="mt-0.5 w-auto accent-brand">
          <div>
            <div class="text-[13px] font-semibold text-app-text">Inicializar con plantilla README canónica</div>
            <div class="mt-0.5 text-[11.5px] text-app-muted">Pre-popula el README.md raíz con la estructura del sílabo y rúbricas.</div>
          </div>
        </label>
      </div>
      <div class="flex items-center justify-between rounded-b-2xl border-t border-slate-300/40 bg-slate-100/50 px-6 py-3.5">
        <button class="${cx(ui.button.base, ui.button.secondary)}" id="m-back">
          <span class="material-symbols-outlined text-[15px]">arrow_back</span> Atrás
        </button>
        <button class="${cx(ui.button.base, ui.button.primary)}" id="m-create">
          <span class="material-symbols-outlined text-[15px]">create_new_folder</span>
          Crear asignatura
        </button>
      </div>`;

    box.querySelector("#m-back").onclick = () => { _modalStep = 1; renderModal(); };
    box.querySelector("#m-create").onclick = () => {
      _modalData.initReadme = box.querySelector("#m-init-readme").checked;
      saveCourse();
    };
  }
}

function showModalError(message) {
  const error = document.getElementById("course-modal-error");
  if (error) { error.textContent = message; error.hidden = false; }
  toast(message, "error");
}

async function saveCourse() {
  state.courses.push({
    code: _modalData.code,
    name: _modalData.name,
    period: _modalData.period,
    semester: _modalData.semester,
    credits: _modalData.credits,
    weeks: _modalData.weeks,
    description: _modalData.description,
    weeks_data: [],
  });
  saveCourses();
  closeModal();
  renderCourses();
  toast(`Asignatura ${_modalData.code} creada`, "success");
}
