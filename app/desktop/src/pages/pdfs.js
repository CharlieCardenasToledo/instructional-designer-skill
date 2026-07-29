import { listGeneratedPdfs, openGeneratedPdf, revealGeneratedPdf } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { ui, cx, projectColorMap } from "../uiClasses.js";
import { ic } from "../icons.js";

// Project colors are now centralized in styles.css as CSS custom properties.
// Reference them via projectColorMap from uiClasses for maintenance.
const DEFAULT_COLOR = "#0f766e"; // var(--project-color-jintia)
const ALLOWED_COLORS = new Set(Object.values(projectColorMap).map(c => c.hex));
const ALLOWED_ICONS = new Set(["folder", "school", "database", "science", "psychology", "palette"]);
// Los valores de arriba se guardan tal cual (compatibilidad con datos existentes);
// este mapa solo traduce el valor guardado al nombre real del ícono Lucide.
const PROJECT_ICON_LUCIDE = { folder: "folder", school: "graduation-cap", database: "database", science: "flask-conical", psychology: "brain", palette: "palette" };

let _query = "";
let _courseFilter = "all";
let _pdfs = [];
let _loading = false;
let _error = "";
let _requestId = 0;

function projectRoots() {
  return state.courses
    .filter(course => String(course.project_path || "").trim())
    .map(course => ({
      courseCode: String(course.code || ""),
      courseName: String(course.name || ""),
      projectPath: String(course.project_path),
    }));
}

function courseIdentity(code) {
  const course = state.courses.find(item => String(item.code) === String(code));
  return {
    color: ALLOWED_COLORS.has(course?.project_color) ? course.project_color : DEFAULT_COLOR,
    icon: ALLOWED_ICONS.has(course?.project_icon) ? course.project_icon : "folder",
  };
}

export function renderPdfs() {
  const el = document.getElementById("p-pdfs");
  if (!el) return;
  el.innerHTML = shellMarkup();
  bindPageEvents();
  refreshPdfs();
}

function shellMarkup() {
  return `
    <div class="${ui.layout.stack}">
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="pdf-library-title">
        <span class="sr-only">Biblioteca de PDFs</span>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="pdf-library-title" class="text-xl font-bold leading-7 text-brand-950">Documentos listos para publicar</h2>
            <p class="mt-1 text-sm leading-5 text-slate-500">Reúne las guías PDF encontradas dentro de tus proyectos preparados.</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-slate-50 px-3 py-2 text-center">
              <strong class="block text-base text-app-text" id="pdf-total">${_pdfs.length}</strong>
              <span class="text-[11px] text-app-muted">documentos</span>
            </div>
            <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" id="pdf-refresh">
              ${ic("refresh-cw", 17)}Actualizar
            </button>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row" aria-label="Buscar y filtrar PDFs">
        <div class="relative min-w-0 flex-1">
          <label for="pdf-search" class="sr-only">Buscar PDF</label>
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden="true">${ic("search", 18)}</span>
          <input class="h-11 pl-10" id="pdf-search" type="search" placeholder="Buscar por archivo, carpeta o asignatura" value="${escapeHtml(_query)}">
        </div>
        <label for="pdf-course-filter" class="sr-only">Filtrar por asignatura</label>
        <select id="pdf-course-filter" class="h-11 sm:w-[240px]">
          <option value="all">Todas las asignaturas</option>
          ${state.courses.filter(course => course.project_path).map(course => `
            <option value="${escapeHtml(course.code)}" ${_courseFilter === course.code ? "selected" : ""}>${escapeHtml(course.code)} · ${escapeHtml(course.name)}</option>
          `).join("")}
        </select>
      </section>

      <section class="min-h-0 flex-1" id="pdf-results" aria-live="polite">${resultsMarkup()}</section>
    </div>`;
}

async function refreshPdfs() {
  const roots = projectRoots();
  if (!roots.length) {
    _pdfs = [];
    _loading = false;
    _error = "";
    updateResults();
    return;
  }
  const requestId = ++_requestId;
  _loading = true;
  _error = "";
  updateResults();
  try {
    const result = await listGeneratedPdfs(roots);
    if (requestId !== _requestId) return;
    _pdfs = Array.isArray(result) ? result : [];
  } catch (error) {
    if (requestId !== _requestId) return;
    _error = String(error);
  } finally {
    if (requestId === _requestId) {
      _loading = false;
      updateResults();
    }
  }
}

function filteredPdfs() {
  const query = _query.trim().toLocaleLowerCase("es");
  return _pdfs.filter(pdf => {
    const matchesCourse = _courseFilter === "all" || pdf.courseCode === _courseFilter;
    const matchesQuery = !query || [pdf.name, pdf.relativePath, pdf.courseCode, pdf.courseName]
      .some(value => String(value || "").toLocaleLowerCase("es").includes(query));
    return matchesCourse && matchesQuery;
  });
}

function resultsMarkup() {
  if (_loading) return loadingMarkup();
  if (_error) return errorMarkup();
  if (!projectRoots().length) return noProjectsMarkup();
  if (!_pdfs.length) return noPdfsMarkup();
  const rows = filteredPdfs();
  if (!rows.length) return noMatchesMarkup();
  return `
    <div class="${cx(ui.surface.card, "overflow-hidden")}">
      <div class="divide-y divide-slate-200">${rows.map(pdfRow).join("")}</div>
      <div class="border-t border-slate-200 px-4 py-3 text-xs text-app-muted">${rows.length} de ${_pdfs.length} documentos</div>
    </div>`;
}

function pdfRow(pdf) {
  const identity = courseIdentity(pdf.courseCode);
  return `
    <article class="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700" aria-hidden="true">
          ${ic("file-text", 20)}
        </div>
        <div class="min-w-0">
          <h3 class="truncate text-sm font-bold text-app-text" title="${escapeHtml(pdf.name)}">${escapeHtml(pdf.name)}</h3>
          <p class="mt-1 truncate text-xs text-app-muted" title="${escapeHtml(pdf.relativePath)}">${escapeHtml(pdf.relativePath)}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
              <span style="color:${identity.color}">${ic(PROJECT_ICON_LUCIDE[identity.icon] || "folder", 14)}</span>
              ${escapeHtml(pdf.courseCode)} · ${escapeHtml(pdf.courseName)}
            </span>
            <span class="text-app-muted">${formatBytes(pdf.sizeBytes)} · ${formatDate(pdf.modifiedMs)}</span>
          </div>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="${cx(ui.button.base, ui.button.primary, "min-h-11 flex-1 sm:flex-none")}" data-pdf-action="open" data-pdf-path="${escapeHtml(pdf.path)}">
          ${ic("external-link", 17)}Abrir
        </button>
        <button type="button" class="${cx(ui.button.base, ui.button.secondary, "min-h-11 flex-1 sm:flex-none")}" data-pdf-action="reveal" data-pdf-path="${escapeHtml(pdf.path)}">
          ${ic("folder-open", 17)}Ver carpeta
        </button>
      </div>
    </article>`;
}

function loadingMarkup() {
  return `
    <div class="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="status">
      <span class="animate-spin text-brand-600">${ic("loader-2", 36)}</span>
      <strong class="mt-3 text-sm text-app-text">Buscando PDFs en tus proyectos…</strong>
      <span class="mt-1 text-xs text-app-muted">Las carpetas se revisan sin modificar sus archivos.</span>
    </div>`;
}

function emptyMarkup(icon, title, description, action = "") {
  return `
    <div class="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">${ic(icon, 32)}</div>
      <h3 class="mt-4 text-base font-bold text-app-text">${title}</h3>
      <p class="mt-2 max-w-[460px] text-sm leading-6 text-app-muted">${description}</p>
      ${action}
    </div>`;
}

function noProjectsMarkup() {
  return emptyMarkup("folder-plus", "Prepara una asignatura para reunir sus PDFs aquí",
    "Cuando una asignatura tenga su carpeta de proyecto, Jintia podrá localizar los PDFs generados por la skill.",
    `<button type="button" class="${cx(ui.button.base, ui.button.primary, "mt-5 min-h-11")}" id="pdf-go-courses">Ir a Cursos</button>`);
}

function noPdfsMarkup() {
  return emptyMarkup("file-text", "Todavía no hay PDFs en estos proyectos", "Genera una guía con la skill y pulsa Actualizar. Solo aparecerán archivos con extensión PDF.");
}

function noMatchesMarkup() {
  return emptyMarkup("search-x", "No encontramos coincidencias", "Prueba con otro nombre o selecciona todas las asignaturas.");
}

function errorMarkup() {
  return emptyMarkup("circle-alert", "No pudimos revisar los PDFs", `Revisa que las carpetas sigan disponibles y vuelve a intentarlo. ${escapeHtml(_error)}`,
    `<button type="button" class="${cx(ui.button.base, ui.button.secondary, "mt-5 min-h-11")}" id="pdf-retry">Reintentar</button>`);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(ms) {
  const date = new Date(Number(ms) || 0);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function updateResults() {
  const results = document.getElementById("pdf-results");
  if (results) results.innerHTML = resultsMarkup();
  const total = document.getElementById("pdf-total");
  if (total) total.textContent = String(_pdfs.length);
  bindResultEvents();
}

function bindPageEvents() {
  document.getElementById("pdf-search")?.addEventListener("input", event => {
    _query = event.target.value;
    updateResults();
  });
  document.getElementById("pdf-course-filter")?.addEventListener("change", event => {
    _courseFilter = event.target.value;
    updateResults();
  });
  document.getElementById("pdf-refresh")?.addEventListener("click", refreshPdfs);
  bindResultEvents();
}

function bindResultEvents() {
  document.getElementById("pdf-go-courses")?.addEventListener("click", () => navigate("courses"));
  document.getElementById("pdf-retry")?.addEventListener("click", refreshPdfs);
  document.querySelectorAll("[data-pdf-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const path = button.dataset.pdfPath;
      const action = button.dataset.pdfAction;
      button.disabled = true;
      try {
        const result = action === "open"
          ? await openGeneratedPdf(path, projectRoots())
          : await revealGeneratedPdf(path, projectRoots());
        if (!result?.success) throw new Error(result?.message || "No se pudo completar la acción.");
      } catch (error) {
        toast(`No se pudo ${action === "open" ? "abrir el PDF" : "mostrar su carpeta"}. (${error})`, "error", 7000);
      } finally {
        button.disabled = false;
      }
    });
  });
}
