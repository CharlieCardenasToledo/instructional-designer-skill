import { createCourseStructure, pickDirectory } from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { state, saveCourses } from "../state.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { confirm } from "@tauri-apps/plugin-dialog";

let _filter = "";
let _modalStep = 0;
let _modalData = {};

export function renderCourses() {
  const el = document.getElementById("p-courses");
  if (!el) return;

  const total   = state.courses.length;
  const active  = state.courses.filter(c => (c.weeks_data || []).some(w => w.title)).length;
  const pending = total - active;
  const credits = state.courses.reduce((s, c) => s + (Number(c.credits) || 0), 0);

  el.innerHTML = `
    <div class="courses-layout">

      <!-- Stats -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card-label">Asignaturas</div>
          <div class="stat-card-value">${total}</div>
          <div class="stat-card-sub">Total registradas</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Con contenido</div>
          <div class="stat-card-value">${active}</div>
          <div class="stat-card-sub">Con al menos 1 semana</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Pendientes</div>
          <div class="stat-card-value">${pending}</div>
          <div class="stat-card-sub">Sin contenido aún</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Total créditos</div>
          <div class="stat-card-value">${credits}</div>
          <div class="stat-card-sub">Suma de créditos</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="courses-toolbar">
        <div class="courses-search">
          <span class="material-symbols-outlined">search</span>
          <input id="courses-search-input" placeholder="Buscar por código o nombre…" value="${escapeHtml(_filter)}">
        </div>
        <button class="btn btn-primary" id="btn-new-course">
          <span class="material-symbols-outlined" style="font-size:15px">add</span>
          Nueva asignatura
        </button>
      </div>

      <!-- Table -->
      <div class="courses-table-wrap">
        <table class="courses-table">
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
        ${state.courses.length === 0 ? `
          <div class="table-empty">
            <span class="material-symbols-outlined">school</span>
            No hay asignaturas aún. Haz clic en "Nueva asignatura" para comenzar.
          </div>` : ""}
        <div class="pagination">
          <span>${filteredCourses().length} de ${total} asignaturas</span>
          <div class="pagination-btns"></div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay hidden" id="course-modal">
      <div class="modal-box" id="course-modal-box"></div>
    </div>
  `;

  document.getElementById("courses-search-input")?.addEventListener("input", e => {
    _filter = e.target.value;
    document.getElementById("courses-tbody").innerHTML = renderTableRows();
    bindRowActions();
  });

  document.getElementById("btn-new-course")?.addEventListener("click", openModal);

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
    return `<tr><td colspan="8" class="table-empty" style="text-align:center;color:var(--dim);padding:30px">Sin resultados</td></tr>`;
  }
  return rows.map((course, i) => {
    const realIndex = state.courses.indexOf(course);
    const hasContent = (course.weeks_data || []).some(w => w.title);
    return `
    <tr>
      <td><span style="font-family:monospace;font-weight:700;color:var(--teal)">${escapeHtml(course.code)}</span></td>
      <td style="font-weight:600;color:var(--text)">${escapeHtml(course.name)}</td>
      <td style="color:var(--muted)">${escapeHtml(course.period || "—")}</td>
      <td style="color:var(--muted)">${escapeHtml(course.semester || "—")}</td>
      <td style="text-align:center">${Number(course.credits) || 0}</td>
      <td style="text-align:center">${Number(course.weeks) || 0}</td>
      <td>
        <span class="status-pill ${hasContent ? "status-active" : "status-draft"}">
          <span style="width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;display:inline-block"></span>
          ${hasContent ? "Con contenido" : "Borrador"}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="row-action-edit" data-course-action="edit" data-index="${realIndex}">
            <span class="material-symbols-outlined" style="font-size:14px">edit_document</span> Sílabo
          </button>
          <button class="row-action-folders" data-course-action="folders" data-index="${realIndex}">
            <span class="material-symbols-outlined" style="font-size:14px">create_new_folder</span> Carpetas
          </button>
          <button class="row-action-delete" data-course-action="delete" data-index="${realIndex}">
            <span class="material-symbols-outlined" style="font-size:14px">delete</span>
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
      <div class="modal-header">
        <div>
          <div class="modal-title">Nueva asignatura</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Paso 1 de 2 — Información general</div>
        </div>
        <div class="modal-steps">
          <div class="modal-step active">1</div>
          <div class="modal-step-line"></div>
          <div class="modal-step">2</div>
        </div>
      </div>
      <div class="modal-body">
        <div class="form-grid" style="gap:14px">
          <div class="form-group" style="grid-column:1/-1">
            <label for="m-name">Nombre de la asignatura *</label>
            <input id="m-name" placeholder="Ej: Bases de Datos" value="${escapeHtml(_modalData.name)}">
          </div>
          <div class="form-group">
            <label for="m-code">Código único *</label>
            <input id="m-code" placeholder="Ej: IFT200" value="${escapeHtml(_modalData.code)}" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label for="m-period">Periodo académico</label>
            <input id="m-period" placeholder="Ej: Abril–Agosto 2026" value="${escapeHtml(_modalData.period)}">
          </div>
          <div class="form-group">
            <label for="m-semester">Semestre / Nivel</label>
            <input id="m-semester" placeholder="Ej: Tercero" value="${escapeHtml(_modalData.semester)}">
          </div>
          <div class="form-group">
            <label for="m-credits">Créditos *</label>
            <input id="m-credits" type="number" min="1" max="20" value="${_modalData.credits}">
          </div>
          <div class="form-group">
            <label for="m-weeks">N.º de semanas</label>
            <input id="m-weeks" type="number" min="1" max="52" value="${_modalData.weeks}">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label for="m-desc">Descripción (opcional)</label>
            <textarea id="m-desc" placeholder="Breve descripción del curso…" style="height:70px">${escapeHtml(_modalData.description)}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="m-cancel">Cancelar</button>
        <button class="btn btn-primary" id="m-next">
          Siguiente <span class="material-symbols-outlined" style="font-size:15px">arrow_forward</span>
        </button>
      </div>`;

    box.querySelector("#m-cancel").onclick = closeModal;
    box.querySelector("#m-next").onclick = () => {
      const code = box.querySelector("#m-code").value.trim().toUpperCase();
      const name = box.querySelector("#m-name").value.trim();
      if (!code) { toast("El código es obligatorio", "error"); return; }
      if (!name) { toast("El nombre es obligatorio", "error"); return; }
      if (state.courses.some(c => c.code.toLowerCase() === code.toLowerCase())) {
        toast("Ya existe un curso con ese código", "error"); return;
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
      <div class="modal-header">
        <div>
          <div class="modal-title">Nueva asignatura</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Paso 2 de 2 — Estructura de carpetas</div>
        </div>
        <div class="modal-steps">
          <div class="modal-step done">
            <span class="material-symbols-outlined" style="font-size:13px">check</span>
          </div>
          <div class="modal-step-line" style="background:var(--teal)"></div>
          <div class="modal-step active">2</div>
        </div>
      </div>
      <div class="modal-body">
        <div class="glass-pane" style="padding:14px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px">Vista previa de carpetas</div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);font-weight:600">
              <span class="material-symbols-outlined" style="font-size:17px;color:var(--teal)">folder_open</span>
              /${escapeHtml(_modalData.code)} ${escapeHtml(_modalData.name)}/
            </div>
            ${weekFolders.map(f => `
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);padding-left:20px">
                <span class="material-symbols-outlined" style="font-size:16px">folder</span> ${escapeHtml(f)}
              </div>`).join("")}
            ${weeks > 6 ? `<div style="padding-left:20px;font-size:11.5px;color:var(--dim)">… y ${weeks - 6} carpetas más</div>` : ""}
          </div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
          <input type="checkbox" id="m-init-readme" ${_modalData.initReadme ? "checked" : ""} style="width:auto;margin-top:2px;accent-color:var(--teal)">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">Inicializar con plantilla README canónica</div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:2px">Pre-popula el README.md raíz con la estructura del sílabo y rúbricas.</div>
          </div>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="m-back">
          <span class="material-symbols-outlined" style="font-size:15px">arrow_back</span> Atrás
        </button>
        <button class="btn btn-primary" id="m-create">
          <span class="material-symbols-outlined" style="font-size:15px">create_new_folder</span>
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
