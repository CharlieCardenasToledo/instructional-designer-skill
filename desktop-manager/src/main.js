import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// ── Estado global ──────────────────────────────────────────────────────────
const state = {
  currentPage: "setup",
  deps: [],
  config: JSON.parse(localStorage.getItem("ids_config") || "{}"),
  courses: JSON.parse(localStorage.getItem("ids_courses") || "[]"),
  weeks: [],
};

function saveConfig() { localStorage.setItem("ids_config", JSON.stringify(state.config)); }
function saveCourses() { localStorage.setItem("ids_courses", JSON.stringify(state.courses)); }

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = "info", duration = 3500) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ""; }, duration);
}

// ── Navegación ─────────────────────────────────────────────────────────────
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach(el => {
    el.classList.toggle("active", el.id === `page-${page}`);
  });
  const titles = {
    setup: ["Configuración de Dependencias", "Verifica e instala los requisitos del sistema"],
    institution: ["Datos Institucionales", "Configura tu institución, autor y colores"],
    courses: ["Mis Cursos", "Gestiona tus cursos y genera la estructura de carpetas"],
    syllabus: ["Crear Sílabo", "Genera el README.md del curso para el skill"],
    notebooklm: ["NotebookLM", "Registra tus notebooks para validación bibliográfica"],
  };
  const [title, sub] = titles[page] || ["", ""];
  document.querySelector(".topbar h2").textContent = title;
  document.querySelector(".topbar-sub").textContent = sub;

  if (page === "setup") renderSetup();
  if (page === "courses") renderCourses();
  if (page === "notebooklm") renderNotebookLM();
}

// ── PAGE: SETUP ────────────────────────────────────────────────────────────
async function renderSetup() {
  const container = document.getElementById("dep-list");
  container.innerHTML = '<div class="text-muted">Verificando dependencias...</div>';

  try {
    state.deps = await invoke("check_dependencies");
  } catch {
    // fallback si no está en Tauri (desarrollo web)
    state.deps = [
      { name: "Git", installed: false, version: null },
      { name: "Node.js", installed: false, version: null },
      { name: "Python", installed: false, version: null },
      { name: "WSL 2", installed: false, version: null },
      { name: "TeX Live (pdflatex)", installed: false, version: null },
    ];
  }

  const total = state.deps.length;
  const ok = state.deps.filter(d => d.installed).length;
  const pct = Math.round((ok / total) * 100);

  document.getElementById("dep-progress").style.width = `${pct}%`;
  document.getElementById("dep-summary").textContent = `${ok}/${total} dependencias listas`;

  container.innerHTML = state.deps.map(d => `
    <div class="dep-item">
      <div class="dep-info">
        <div class="status-dot ${d.installed ? "ok" : "err"}"></div>
        <div>
          <div class="dep-name">${d.name}</div>
          <div class="dep-version">${d.version || (d.installed ? "instalado" : "no encontrado")}</div>
        </div>
      </div>
      ${d.installed
        ? '<span class="badge badge-green">✓ Listo</span>'
        : `<button class="btn btn-sm btn-primary" onclick="installDep('${d.name}')">Instalar</button>`
      }
    </div>
  `).join("");
}

window.installDep = async function(name) {
  toast(`Instalando ${name}... esto puede tardar varios minutos.`, "info", 60000);
  try {
    const result = await invoke("install_dependency", { name });
    toast(result.message, result.success ? "success" : "error");
    if (result.success) renderSetup();
  } catch (e) {
    toast(`Error: ${e}`, "error");
  }
};

window.installAll = async function() {
  const missing = state.deps.filter(d => !d.installed);
  if (!missing.length) { toast("Todo ya está instalado", "success"); return; }
  for (const d of missing) { await window.installDep(d.name); }
};

// ── PAGE: INSTITUTION ──────────────────────────────────────────────────────
function initInstitution() {
  const fields = ["author", "degree", "career", "faculty", "institution", "colorR", "colorG", "colorB", "ecosystem"];
  fields.forEach(f => {
    const el = document.getElementById(`cfg-${f}`);
    if (el) {
      el.value = state.config[f] || "";
      el.addEventListener("input", () => {
        state.config[f] = el.value;
        saveConfig();
        updateColorPreview();
      });
    }
  });
  updateColorPreview();

  document.getElementById("btn-copy-latex")?.addEventListener("click", copyLatexConfig);
}

function updateColorPreview() {
  const r = state.config.colorR || 0;
  const g = state.config.colorG || 121;
  const b = state.config.colorB || 107;
  const el = document.getElementById("color-preview");
  if (el) el.style.background = `rgb(${r},${g},${b})`;
}

function copyLatexConfig() {
  const c = state.config;
  const latex = `\\author{${c.author || "Tu nombre"}, ${c.degree || "Ph.D."}}
\\institute{Carrera de\\\\${c.career || "Tu Carrera"}}
\\extrainfo{${c.faculty || "Facultad"}\\\\${c.institution || "Institución"}}

\\definecolor{weekaccent}{RGB}{${c.colorR || 0},${c.colorG || 121},${c.colorB || 107}}
\\definecolor{structurecolor}{RGB}{${c.colorR || 0},${c.colorG || 121},${c.colorB || 107}}
\\definecolor{main}{RGB}{${c.colorR || 0},${c.colorG || 121},${c.colorB || 107}}`;
  navigator.clipboard.writeText(latex);
  toast("Configuración LaTeX copiada al portapapeles", "success");
}

// ── PAGE: COURSES ──────────────────────────────────────────────────────────
function renderCourses() {
  const container = document.getElementById("courses-list");
  if (!state.courses.length) {
    container.innerHTML = '<div class="text-muted" style="padding:20px 0">No hay cursos creados todavía. Usa el formulario de abajo para agregar uno.</div>';
    return;
  }
  container.innerHTML = state.courses.map((c, i) => `
    <div class="dep-item">
      <div class="dep-info">
        <div>
          <div class="dep-name">${c.code} — ${c.name}</div>
          <div class="dep-version">${c.weeks} semanas · ${c.credits} créditos · ${c.semester}</div>
        </div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm btn-secondary" onclick="generateFolders(${i})">📁 Crear carpetas</button>
        <button class="btn btn-sm btn-secondary" onclick="editCourse(${i})">Editar sílabo</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCourse(${i})">✕</button>
      </div>
    </div>
  `).join("");
}

window.addCourse = async function() {
  const code = document.getElementById("new-code").value.trim();
  const name = document.getElementById("new-name").value.trim();
  const credits = parseInt(document.getElementById("new-credits").value) || 4;
  const weeks = parseInt(document.getElementById("new-weeks").value) || 16;
  const semester = document.getElementById("new-semester").value.trim();

  if (!code || !name) { toast("Código y nombre son obligatorios", "error"); return; }

  const course = { code, name, credits, weeks, semester, weeks_data: [] };
  state.courses.push(course);
  saveCourses();
  renderCourses();
  toast(`Curso ${code} agregado`, "success");

  // Limpiar formulario
  ["new-code","new-name","new-semester"].forEach(id => document.getElementById(id).value = "");
};

window.generateFolders = async function(idx) {
  const course = state.courses[idx];
  let rootPath;

  try {
    rootPath = await open({ directory: true, title: "Selecciona la carpeta raíz de tus cursos" });
  } catch {
    rootPath = prompt("Ruta raíz de tus cursos (ej: C:/Usuarios/yo/Cursos):");
  }

  if (!rootPath) return;

  try {
    const result = await invoke("create_course_structure", {
      rootPath, courseCode: course.code, courseName: course.name, weeks: course.weeks
    });
    toast(result.message, result.success ? "success" : "error", 6000);
  } catch (e) {
    toast(`Error: ${e}`, "error");
  }
};

window.deleteCourse = function(idx) {
  if (!confirm(`¿Eliminar el curso ${state.courses[idx].code}?`)) return;
  state.courses.splice(idx, 1);
  saveCourses();
  renderCourses();
};

window.editCourse = function(idx) {
  state.editingCourse = idx;
  navigate("syllabus");
  initSyllabus(idx);
};

// ── PAGE: SYLLABUS ─────────────────────────────────────────────────────────
function initSyllabus(courseIdx) {
  const course = courseIdx !== undefined ? state.courses[courseIdx] : null;
  const weeksCount = course ? course.weeks : parseInt(document.getElementById("syl-weeks")?.value || 16);

  const container = document.getElementById("syl-weeks-container");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 1; i <= weeksCount; i++) {
    const existing = course?.weeks_data?.[i-1] || {};
    const div = document.createElement("div");
    div.className = "week-item";
    div.innerHTML = `
      <div class="week-header" onclick="toggleWeek(this)">
        <span>Semana ${String(i).padStart(2,"0")} — ${existing.unit || "Sin título"}</span>
        <span>▾</span>
      </div>
      <div class="week-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Unidad temática</label>
            <input type="text" placeholder="Ej: Normalización de bases de datos" data-field="unit" value="${existing.unit || ""}">
          </div>
          <div class="form-group">
            <label>Horas docencia / autónomo</label>
            <div class="row">
              <input type="number" placeholder="Doc." data-field="teaching_hours" value="${existing.teaching_hours || 2}" style="width:80px">
              <span class="text-muted">/</span>
              <input type="number" placeholder="Aut." data-field="autonomous_hours" value="${existing.autonomous_hours || 4}" style="width:80px">
            </div>
          </div>
        </div>
        <div class="form-group mt-12">
          <label>Temas / contenido semanal (uno por línea)</label>
          <textarea placeholder="Formas normales 1NF, 2NF, 3NF&#10;Dependencias funcionales" data-field="topics">${existing.topics || ""}</textarea>
        </div>
        <div class="form-group mt-12">
          <label>Resultados de aprendizaje (uno por línea)</label>
          <textarea placeholder="El estudiante aplicará las formas normales..." data-field="outcomes">${existing.outcomes || ""}</textarea>
        </div>
        <div class="form-group mt-12">
          <label>Bibliografía (uno por línea)</label>
          <textarea placeholder="Silberschatz (2020), Cap. 8" data-field="bibliography">${existing.bibliography || ""}</textarea>
        </div>
        <div class="form-group mt-12">
          <label>Actividad calificada (opcional)</label>
          <input type="text" placeholder="Ej: Taller de normalización (20%)" data-field="graded_activity" value="${existing.graded_activity || ""}">
        </div>
      </div>
    `;
    container.appendChild(div);
  }
}

window.toggleWeek = function(header) {
  header.nextElementSibling.classList.toggle("open");
};

window.saveSyllabus = async function() {
  const courseIdx = state.editingCourse;
  const weekItems = document.querySelectorAll(".week-item");
  const weeks_data = [];

  weekItems.forEach((item, i) => {
    const get = (field) => item.querySelector(`[data-field="${field}"]`)?.value?.trim() || "";
    weeks_data.push({
      number: i + 1,
      unit: get("unit"),
      topics: get("topics"),
      outcomes: get("outcomes"),
      bibliography: get("bibliography"),
      graded_activity: get("graded_activity") || null,
      teaching_hours: parseInt(item.querySelector('[data-field="teaching_hours"]')?.value || 2),
      autonomous_hours: parseInt(item.querySelector('[data-field="autonomous_hours"]')?.value || 4),
    });
  });

  if (courseIdx !== undefined) {
    state.courses[courseIdx].weeks_data = weeks_data;
    saveCourses();
  }

  // Generar el markdown
  let rootPath;
  try {
    rootPath = await open({ directory: true, title: "Selecciona la carpeta del curso donde guardar README.md" });
  } catch {
    rootPath = prompt("Ruta de la carpeta del curso:");
  }
  if (!rootPath) return;

  const course = courseIdx !== undefined ? state.courses[courseIdx] : {
    code: document.getElementById("syl-code")?.value || "CURSO",
    name: document.getElementById("syl-name")?.value || "Nombre",
    credits: 4,
    semester: document.getElementById("syl-semester")?.value || "2026-I",
    description: document.getElementById("syl-desc")?.value || "",
  };

  try {
    const result = await invoke("generate_syllabus", {
      coursePath: rootPath,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      semester: course.semester,
      description: course.description || "",
      weeksData: weeks_data,
    });
    toast(result.message, result.success ? "success" : "error", 5000);
  } catch (e) {
    toast(`Error: ${e}`, "error");
  }
};

// ── PAGE: NOTEBOOKLM ───────────────────────────────────────────────────────
function renderNotebookLM() {
  const notebooks = JSON.parse(localStorage.getItem("ids_notebooks") || "[]");
  const container = document.getElementById("notebook-list");

  if (!notebooks.length) {
    container.innerHTML = '<div class="text-muted" style="padding:16px 0">No hay notebooks registrados.</div>';
  } else {
    container.innerHTML = notebooks.map((n, i) => `
      <div class="dep-item">
        <div class="dep-info">
          <div>
            <div class="dep-name">${n.course}</div>
            <div class="dep-version">ID: ${n.id} · ${n.url ? '<a href="#" style="color:var(--teal-light)">Abrir</a>' : 'Sin URL'}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="deleteNotebook(${i})">✕</button>
      </div>
    `).join("");
  }
}

window.addNotebook = function() {
  const course = document.getElementById("nb-course").value.trim();
  const id = document.getElementById("nb-id").value.trim();
  const url = document.getElementById("nb-url").value.trim();
  if (!course || !id) { toast("Curso e ID son obligatorios", "error"); return; }

  const notebooks = JSON.parse(localStorage.getItem("ids_notebooks") || "[]");
  notebooks.push({ course, id, url });
  localStorage.setItem("ids_notebooks", JSON.stringify(notebooks));
  renderNotebookLM();
  toast("Notebook registrado", "success");
  ["nb-course","nb-id","nb-url"].forEach(id => document.getElementById(id).value = "");
};

window.deleteNotebook = function(idx) {
  const notebooks = JSON.parse(localStorage.getItem("ids_notebooks") || "[]");
  notebooks.splice(idx, 1);
  localStorage.setItem("ids_notebooks", JSON.stringify(notebooks));
  renderNotebookLM();
};

window.copyNotebookConfig = function() {
  const notebooks = JSON.parse(localStorage.getItem("ids_notebooks") || "[]");
  if (!notebooks.length) { toast("No hay notebooks para copiar", "error"); return; }

  const table = "| Asignatura | Carpeta raíz | notebook_id | URL |\n|---|---|---|---|\n" +
    notebooks.map(n => `| ${n.course} | \`01 ${n.course}/\` | \`${n.id}\` | ${n.url || "-"} |`).join("\n");

  navigator.clipboard.writeText(table);
  toast("Tabla Markdown copiada al portapapeles", "success");
};

// ── App render ─────────────────────────────────────────────────────────────
function render() {
  document.getElementById("app").innerHTML = `
    <div class="sidebar">
      <div class="sidebar-logo">
        <h1>Instructional Designer</h1>
        <span>Manager v0.1</span>
      </div>
      <nav class="sidebar-nav">
        ${[
          ["setup",       "⚙", "Dependencias"],
          ["institution", "🏛", "Institución"],
          ["courses",     "📚", "Cursos"],
          ["syllabus",    "📄", "Crear Sílabo"],
          ["notebooklm",  "🔗", "NotebookLM"],
        ].map(([page, icon, label]) => `
          <div class="nav-item ${state.currentPage === page ? "active" : ""}" data-page="${page}" onclick="navigate('${page}')">
            <span>${icon}</span> ${label}
          </div>
        `).join("")}
      </nav>
      <div class="sidebar-footer">
        instructional-designer-skill v10.3
      </div>
    </div>

    <div class="main">
      <div class="topbar">
        <div>
          <h2>Configuración de Dependencias</h2>
          <div class="topbar-sub">Verifica e instala los requisitos del sistema</div>
        </div>
      </div>
      <div class="content">

        <!-- PAGE: SETUP -->
        <div id="page-setup" class="page active">
          <div class="card">
            <div class="card-title">Estado del entorno</div>
            <div class="row mb-12">
              <span id="dep-summary" class="text-muted">Verificando...</span>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-sm" onclick="renderSetup()">↻ Recargar</button>
              <button class="btn btn-primary btn-sm" onclick="installAll()">Instalar todo</button>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="dep-progress" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-title">Dependencias requeridas</div>
            <div class="dep-list" id="dep-list">Cargando...</div>
          </div>
          <div class="card">
            <div class="card-title">ℹ️ Acerca de las dependencias</div>
            <p class="text-muted">
              <strong style="color:var(--text)">Git</strong> — para clonar y actualizar el skill.<br>
              <strong style="color:var(--text)">Node.js</strong> — para ejecutar el linter y el validador LaTeX.<br>
              <strong style="color:var(--text)">Python</strong> — para el extractor de recortes PDF (PyMuPDF).<br>
              <strong style="color:var(--text)">WSL 2</strong> — Windows Subsystem for Linux, necesario para compilar LaTeX en Windows.<br>
              <strong style="color:var(--text)">TeX Live</strong> — el compilador LaTeX (se instala dentro de WSL). Tarda 15–40 min.
            </p>
          </div>
        </div>

        <!-- PAGE: INSTITUTION -->
        <div id="page-institution" class="page">
          <div class="card">
            <div class="card-title">Datos del autor</div>
            <div class="form-grid">
              <div class="form-group">
                <label>Nombre completo</label>
                <input id="cfg-author" placeholder="Charlie Cárdenas Toledo">
              </div>
              <div class="form-group">
                <label>Grado académico</label>
                <input id="cfg-degree" placeholder="Mg. / Ph.D. / Lic.">
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Datos institucionales</div>
            <div class="form-grid">
              <div class="form-group">
                <label>Carrera</label>
                <input id="cfg-career" placeholder="Ingeniería en Sistemas">
              </div>
              <div class="form-group">
                <label>Facultad</label>
                <input id="cfg-faculty" placeholder="Facultad de Ingeniería">
              </div>
              <div class="form-group">
                <label>Institución</label>
                <input id="cfg-institution" placeholder="Universidad ...">
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Color institucional (RGB)</div>
            <div class="form-grid">
              <div class="form-group">
                <label>R (0–255)</label>
                <input id="cfg-colorR" type="number" min="0" max="255" placeholder="0">
              </div>
              <div class="form-group">
                <label>G (0–255)</label>
                <input id="cfg-colorG" type="number" min="0" max="255" placeholder="121">
              </div>
              <div class="form-group">
                <label>B (0–255)</label>
                <input id="cfg-colorB" type="number" min="0" max="255" placeholder="107">
              </div>
            </div>
            <div class="row mt-12">
              <div id="color-preview" class="color-preview"></div>
              <span class="text-muted">Vista previa del color institucional</span>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Ecosistema digital institucional</div>
            <div class="form-group">
              <label>LMS, plataformas y sistemas (uno por línea)</label>
              <textarea id="cfg-ecosystem" placeholder="Moodle&#10;Microsoft Teams&#10;Sistema de notas institucional"></textarea>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn-secondary" id="btn-copy-latex">📋 Copiar configuración LaTeX</button>
            <button class="btn btn-primary" onclick="toast('Configuración guardada automáticamente', 'success')">Guardar</button>
          </div>
        </div>

        <!-- PAGE: COURSES -->
        <div id="page-courses" class="page">
          <div class="card">
            <div class="card-title">Mis cursos</div>
            <div id="courses-list"></div>
          </div>
          <div class="card">
            <div class="card-title">Agregar nuevo curso</div>
            <div class="form-grid">
              <div class="form-group">
                <label>Código del curso</label>
                <input id="new-code" placeholder="IFT200">
              </div>
              <div class="form-group">
                <label>Nombre del curso</label>
                <input id="new-name" placeholder="Bases de Datos">
              </div>
              <div class="form-group">
                <label>Créditos</label>
                <input id="new-credits" type="number" value="4" min="1" max="10">
              </div>
              <div class="form-group">
                <label>Número de semanas</label>
                <input id="new-weeks" type="number" value="16" min="1" max="32">
              </div>
              <div class="form-group">
                <label>Semestre</label>
                <input id="new-semester" placeholder="2026-II">
              </div>
            </div>
            <div class="row mt-12" style="justify-content:flex-end">
              <button class="btn btn-primary" onclick="addCourse()">+ Agregar curso</button>
            </div>
          </div>
        </div>

        <!-- PAGE: SYLLABUS -->
        <div id="page-syllabus" class="page">
          <div class="card">
            <div class="card-title">Datos del curso</div>
            <div class="form-grid">
              <div class="form-group">
                <label>Código</label>
                <input id="syl-code" placeholder="IFT200">
              </div>
              <div class="form-group">
                <label>Nombre</label>
                <input id="syl-name" placeholder="Bases de Datos">
              </div>
              <div class="form-group">
                <label>Semestre</label>
                <input id="syl-semester" placeholder="2026-II">
              </div>
              <div class="form-group">
                <label>Semanas</label>
                <input id="syl-weeks" type="number" value="16" min="1" max="32" onchange="initSyllabus()">
              </div>
            </div>
            <div class="form-group mt-12">
              <label>Descripción general del curso</label>
              <textarea id="syl-desc" placeholder="Este curso introduce los fundamentos..."></textarea>
            </div>
            <div class="row mt-12" style="justify-content:flex-end">
              <button class="btn btn-secondary" onclick="initSyllabus()">↻ Regenerar semanas</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Contenido semanal</div>
            <div id="syl-weeks-container"></div>
          </div>
          <div class="row" style="justify-content:flex-end; padding-bottom:24px">
            <button class="btn btn-primary" onclick="saveSyllabus()">💾 Generar README.md del curso</button>
          </div>
        </div>

        <!-- PAGE: NOTEBOOKLM -->
        <div id="page-notebooklm" class="page">
          <div class="card">
            <div class="card-title">Notebooks registrados</div>
            <div id="notebook-list"></div>
            <div class="row mt-12" style="justify-content:flex-end">
              <button class="btn btn-secondary btn-sm" onclick="copyNotebookConfig()">📋 Copiar tabla Markdown</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Registrar nuevo notebook</div>
            <div class="form-grid">
              <div class="form-group">
                <label>Asignatura / Curso</label>
                <input id="nb-course" placeholder="IFT200 — Bases de Datos">
              </div>
              <div class="form-group">
                <label>Notebook ID</label>
                <input id="nb-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
              </div>
              <div class="form-group">
                <label>URL de compartir (opcional)</label>
                <input id="nb-url" placeholder="https://notebooklm.google.com/notebook/...">
              </div>
            </div>
            <div class="row mt-12" style="justify-content:flex-end">
              <button class="btn btn-primary" onclick="addNotebook()">+ Registrar</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">ℹ️ ¿Dónde encuentro el Notebook ID?</div>
            <p class="text-muted">
              1. Abre <strong style="color:var(--text)">notebooklm.google.com</strong><br>
              2. Entra al notebook de tu curso<br>
              3. Copia la URL — el ID es la cadena larga entre <code style="color:var(--teal-light)">/notebook/</code> y el <code style="color:var(--teal-light)">?</code><br>
              4. Ejemplo: <code style="color:var(--teal-light)">notebooklm.google.com/notebook/<strong>abc123def456</strong></code>
            </p>
          </div>
        </div>

      </div>
    </div>

    <div id="toast"></div>
  `;

  // Inicializar páginas que necesitan datos
  initInstitution();
  initSyllabus();
  navigate(state.currentPage);
}

// ── Arrancar ───────────────────────────────────────────────────────────────
render();
