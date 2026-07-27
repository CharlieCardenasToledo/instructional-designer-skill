import { listTemplates, getActiveTemplate, setActiveTemplate } from "../api.js";
import { toast } from "../toast.js";
import { escapeHtml } from "../dom.js";
import { ui, cx } from "../uiClasses.js";

let _templates = [];
let _activeId = "";
let _selectedId = "";

export async function renderTemplates() {
  const el = document.getElementById("p-templates");
  if (!el) return;

  el.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-[22px] font-extrabold tracking-tight text-app-text">Plantillas</h1>
          <p class="mt-1 text-[13px] text-app-muted">Elige el formato de tus guías.</p>
        </div>
        <div class="${cx(ui.liquid.group, 'flex flex-wrap gap-1')}" id="tpl-filter-btns">
          <button class="${cx(ui.button.base, ui.button.primary, ui.button.sm)} tpl-filter-btn" data-filter="all">Todas</button>
          <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} tpl-filter-btn" data-filter="institutional">Institucional</button>
          <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm)} tpl-filter-btn" data-filter="personal">Personal</button>
        </div>
      </div>
      <div id="tpl-bento" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3.5">
        <div class="col-span-full p-10 text-center text-slate-400">
          <span class="material-symbols-outlined mb-2 block text-[32px]">hourglass_empty</span>
          Cargando plantillas…
        </div>
      </div>
    </div>`;

  // Filter button behavior
  el.querySelectorAll(".tpl-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const primary = ui.button.primary.split(" ");
      const secondary = ui.button.secondary.split(" ");
      el.querySelectorAll(".tpl-filter-btn").forEach(b => {
        primary.forEach(cls => b.classList.remove(cls));
        secondary.forEach(cls => b.classList.add(cls));
      });
      secondary.forEach(cls => btn.classList.remove(cls));
      primary.forEach(cls => btn.classList.add(cls));
      renderBento(btn.dataset.filter);
    });
  });

  try {
    [_templates, _activeId] = await Promise.all([listTemplates(), getActiveTemplate()]);
    _selectedId = _activeId;
    const filters = document.getElementById("tpl-filter-btns");
    if (filters && _templates.length <= 1) filters.hidden = true;
    renderBento("all");
  } catch (e) {
    document.getElementById("tpl-bento").innerHTML = `
      <div class="col-span-full p-8 text-center text-red-500">
        <span class="material-symbols-outlined mb-2 block text-[28px]">error</span>
        Error al cargar plantillas: ${escapeHtml(String(e))}
      </div>`;
  }
}

function renderBento(filter) {
  const bento = document.getElementById("tpl-bento");
  if (!bento) return;

  let templates = _templates;
  if (filter === "institutional") templates = _templates.filter(t => t.featured);
  if (filter === "personal")     templates = _templates.filter(t => !t.featured);

  if (!templates.length) {
    bento.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400">Sin plantillas en esta categoría.</div>`;
    return;
  }

  const featured    = templates.find(t => t.featured) || templates[0];
  const secondary   = templates.filter(t => t.id !== featured.id).slice(0, 1)[0];
  const gridItems   = templates.filter(t => t.id !== featured.id && t.id !== secondary?.id).slice(0, 3);

  bento.innerHTML = `
    <!-- Featured (8-col) -->
    <div class="relative col-span-1 flex flex-col gap-[18px] overflow-hidden rounded-app-lg border border-slate-200 bg-white p-[18px] shadow-sm md:col-span-2 sm:flex-row xl:col-span-8">
      <div class="pointer-events-none absolute inset-0 bg-brand-soft"></div>
      <div class="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg border border-slate-300/50 bg-white sm:w-[45%]">
        <div class="pointer-events-none w-[161%] origin-top-left scale-[.62] p-3 text-[10px] leading-relaxed text-slate-700">
          <h1 class="mb-2 border-b border-slate-200 pb-1.5 text-sm font-bold">${escapeHtml(featured.name)}</h1>
          <p class="mb-2.5 text-slate-500">${escapeHtml(featured.description?.slice(0, 80) || "")}</p>
          <h2 class="mb-1.5 text-xs font-semibold">1. Objetivos del curso</h2>
          <ul class="mb-2 pl-3.5"><li>Análisis de complejidad</li><li>Estructuras avanzadas</li></ul>
        </div>
      </div>
      <div class="relative flex flex-1 flex-col justify-between">
        <div>
          <div class="mb-2 flex items-start justify-between">
            <span class="rounded bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase text-brand">${featured.featured ? "INSTITUCIONAL ESTÁNDAR" : "PLANTILLA"}</span>
            ${featured.id === _activeId ? `<span class="material-symbols-outlined text-xl text-brand" style="font-variation-settings:'FILL' 1">check_circle</span>` : ""}
          </div>
          <h3 class="mb-1.5 text-base font-bold text-app-text">${escapeHtml(featured.name)}</h3>
          <p class="mb-3 text-[12.5px] leading-relaxed text-app-muted">${escapeHtml(featured.description || "")}</p>
          <div class="mb-3.5 flex flex-wrap gap-1.5">
            ${(featured.tags || []).slice(0, 4).map(tag => `<span class="rounded border border-slate-300/50 bg-slate-200/25 px-2 py-0.5 text-[10px] text-app-muted">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div class="flex gap-2">
          <button class="${cx(ui.button.base, featured.id === _activeId ? ui.button.secondary : ui.button.primary, ui.button.sm, 'flex-1')} tpl-btn" data-tpl-id="${escapeHtml(featured.id)}">
            ${featured.id === _activeId ? "Activa / Editar" : "Activar plantilla"}
          </button>
        </div>
      </div>
    </div>

    <!-- Secondary (4-col) -->
    ${secondary ? `
    <div class="col-span-1 flex flex-col justify-between rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
      <div>
        <div class="mb-3 aspect-video w-full overflow-hidden rounded-lg border border-slate-300/40 bg-white p-2.5 text-[10px] leading-relaxed text-slate-700">
          <div class="mb-2 border-b border-slate-200 pb-1.5 text-center font-bold">${escapeHtml(secondary.name)}</div>
          <div class="mb-2.5 text-center italic text-slate-500">Docente: …</div>
          <div>${escapeHtml(secondary.description?.slice(0, 60) || "")}</div>
        </div>
        <h3 class="mb-1.5 text-[13.5px] font-bold text-app-text">${escapeHtml(secondary.name)}</h3>
        <p class="mb-2.5 text-xs leading-normal text-app-muted">${escapeHtml(secondary.description?.slice(0, 100) || "")}</p>
      </div>
      <button class="${cx(ui.button.base, ui.button.secondary, ui.button.sm, 'w-full')} tpl-btn" data-tpl-id="${escapeHtml(secondary.id)}">
        ${secondary.id === _activeId ? "Activa" : "Seleccionar"}
      </button>
    </div>` : ""}

    <!-- Grid items (4-col each) -->
    ${gridItems.map(t => `
    <div class="col-span-1 flex flex-col rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
      <div class="mb-2.5 flex items-center gap-2 border-b border-slate-300/30 pb-2.5">
        <span class="material-symbols-outlined text-xl text-brand">assignment_ind</span>
        <span class="text-[13px] font-bold text-app-text">${escapeHtml(t.name)}</span>
      </div>
      <p class="mb-3 flex-1 text-xs leading-relaxed text-app-muted">${escapeHtml(t.description || "")}</p>
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-wider text-slate-400">${t.featured ? "INSTITUCIONAL" : "PERSONAL"}</span>
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm, 'text-brand px-2.5 py-1')} tpl-btn" data-tpl-id="${escapeHtml(t.id)}">
          ${t.id === _activeId ? "Activa" : "Seleccionar"}
        </button>
      </div>
    </div>`).join("")}

  `;

  // Bind template buttons
  bento.querySelectorAll(".tpl-btn").forEach(btn => {
    btn.addEventListener("click", () => activateTemplate(btn.dataset.tplId));
  });
}

async function activateTemplate(id) {
  if (!id || id === _activeId) return;
  try {
    const result = await setActiveTemplate(id);
    if (result?.success) {
      _activeId = id;
      _selectedId = id;
      toast(`Plantilla "${_templates.find(t => t.id === id)?.name}" activada`, "success");
      renderBento("all");
    } else {
      throw new Error(result?.message || "Error desconocido");
    }
  } catch (e) {
    toast(`Error al activar: ${e}`, "error");
  }
}
