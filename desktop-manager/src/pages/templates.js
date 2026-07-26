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
        <div class="flex flex-wrap gap-2" id="tpl-filter-btns">
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
    <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-[18px] shadow-glass backdrop-blur-xl col-span-1 md:col-span-2 xl:col-span-8 flex flex-col gap-[18px] sm:flex-row relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-brand-soft"></div>
      <div class="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg border border-slate-300/50 bg-white sm:w-[45%]">
        <div style="padding:12px;font-size:10px;color:#374151;line-height:1.5;transform:scale(0.62);transform-origin:top left;width:161%;pointer-events:none">
          <h1 style="font-weight:700;font-size:14px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">${escapeHtml(featured.name)}</h1>
          <p style="margin-bottom:10px;color:#666">${escapeHtml(featured.description?.slice(0, 80) || "")}</p>
          <h2 style="font-size:12px;font-weight:600;margin-bottom:6px">1. Objetivos del curso</h2>
          <ul style="padding-left:14px;margin-bottom:8px"><li>Análisis de complejidad</li><li>Estructuras avanzadas</li></ul>
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
    <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-4 shadow-glass backdrop-blur-xl col-span-1 xl:col-span-4 flex flex-col justify-between">
      <div>
        <div style="width:100%;aspect-ratio:16/9;border-radius:8px;border:1px solid rgba(195,198,213,0.40);background:white;overflow:hidden;margin-bottom:12px;padding:10px;font-size:10px;color:#374151;line-height:1.5">
          <div style="font-weight:700;text-align:center;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:8px">${escapeHtml(secondary.name)}</div>
          <div style="text-align:center;color:#666;font-style:italic;margin-bottom:10px">Docente: …</div>
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
    <div class="rounded-app-lg border border-slate-900/10 bg-white/65 p-4 shadow-glass backdrop-blur-xl col-span-1 xl:col-span-4 flex flex-col">
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
