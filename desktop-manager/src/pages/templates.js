import { listTemplates, getActiveTemplate, setActiveTemplate } from "../api.js";
import { renderTemplatePreview } from "../templatePreview.js";
import { toast } from "../toast.js";
import { state } from "../state.js";
import { escapeHtml } from "../dom.js";

let _templates = [];
let _activeId = "";
let _selectedId = "";

export async function renderTemplates() {
  const el = document.getElementById("p-templates");
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:22px;font-weight:800;color:var(--text);letter-spacing:-0.03em">Biblioteca de plantillas</h1>
          <p style="font-size:13px;color:var(--muted);margin-top:4px">Explora y activa plantillas LaTeX y Markdown para tus cursos.</p>
        </div>
        <div style="display:flex;gap:8px" id="tpl-filter-btns">
          <button class="btn btn-primary btn-sm tpl-filter-btn" data-filter="all">Todas</button>
          <button class="btn btn-secondary btn-sm tpl-filter-btn" data-filter="institutional">Institucional</button>
          <button class="btn btn-secondary btn-sm tpl-filter-btn" data-filter="personal">Personal</button>
        </div>
      </div>
      <div id="tpl-bento" style="display:grid;grid-template-columns:repeat(12,1fr);gap:14px">
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--dim)">
          <span class="material-symbols-outlined" style="font-size:32px;display:block;margin-bottom:8px">hourglass_empty</span>
          Cargando plantillas…
        </div>
      </div>
    </div>`;

  // Filter button behavior
  el.querySelectorAll(".tpl-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      el.querySelectorAll(".tpl-filter-btn").forEach(b => b.classList.replace("btn-primary", "btn-secondary"));
      btn.classList.replace("btn-secondary", "btn-primary");
      renderBento(btn.dataset.filter);
    });
  });

  try {
    [_templates, _activeId] = await Promise.all([listTemplates(), getActiveTemplate()]);
    _selectedId = _activeId;
    renderBento("all");
  } catch (e) {
    document.getElementById("tpl-bento").innerHTML = `
      <div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--red)">
        <span class="material-symbols-outlined" style="font-size:28px;display:block;margin-bottom:8px">error</span>
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
    bento.innerHTML = `<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--dim)">Sin plantillas en esta categoría.</div>`;
    return;
  }

  const featured    = templates.find(t => t.featured) || templates[0];
  const secondary   = templates.filter(t => t.id !== featured.id).slice(0, 1)[0];
  const gridItems   = templates.filter(t => t.id !== featured.id && t.id !== secondary?.id).slice(0, 3);

  bento.innerHTML = `
    <!-- Featured (8-col) -->
    <div class="glass-card" style="grid-column:span 8;padding:18px;display:flex;gap:18px;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,49,126,0.04),transparent);pointer-events:none"></div>
      <div style="width:45%;aspect-ratio:4/3;border-radius:8px;border:1px solid rgba(195,198,213,0.50);background:white;overflow:hidden;position:relative;flex-shrink:0">
        <div style="padding:12px;font-size:10px;color:#374151;line-height:1.5;transform:scale(0.62);transform-origin:top left;width:161%;pointer-events:none">
          <h1 style="font-weight:700;font-size:14px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">${escapeHtml(featured.name)}</h1>
          <p style="margin-bottom:10px;color:#666">${escapeHtml(featured.description?.slice(0, 80) || "")}</p>
          <h2 style="font-size:12px;font-weight:600;margin-bottom:6px">1. Objetivos del curso</h2>
          <ul style="padding-left:14px;margin-bottom:8px"><li>Análisis de complejidad</li><li>Estructuras avanzadas</li></ul>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;position:relative">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <span style="background:rgba(0,49,126,0.10);color:var(--teal);font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase">${featured.featured ? "INSTITUCIONAL ESTÁNDAR" : "PLANTILLA"}</span>
            ${featured.id === _activeId ? `<span class="material-symbols-outlined" style="color:var(--teal);font-size:20px;font-variation-settings:'FILL' 1">check_circle</span>` : ""}
          </div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">${escapeHtml(featured.name)}</h3>
          <p style="font-size:12.5px;color:var(--muted);margin-bottom:12px;line-height:1.55">${escapeHtml(featured.description || "")}</p>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
            ${(featured.tags || []).slice(0, 4).map(tag => `<span style="padding:2px 8px;background:rgba(195,198,213,0.25);border-radius:4px;font-size:10px;color:var(--muted);border:1px solid rgba(195,198,213,0.50)">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ${featured.id === _activeId ? "btn-secondary" : "btn-primary"} btn-sm tpl-btn" data-tpl-id="${escapeHtml(featured.id)}" style="flex:1;justify-content:center">
            ${featured.id === _activeId ? "Activa / Editar" : "Activar plantilla"}
          </button>
          <button class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined" style="font-size:16px">content_copy</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Secondary (4-col) -->
    ${secondary ? `
    <div class="glass-card" style="grid-column:span 4;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="width:100%;aspect-ratio:16/9;border-radius:8px;border:1px solid rgba(195,198,213,0.40);background:white;overflow:hidden;margin-bottom:12px;padding:10px;font-size:10px;color:#374151;line-height:1.5">
          <div style="font-weight:700;text-align:center;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:8px">${escapeHtml(secondary.name)}</div>
          <div style="text-align:center;color:#666;font-style:italic;margin-bottom:10px">Docente: …</div>
          <div>${escapeHtml(secondary.description?.slice(0, 60) || "")}</div>
        </div>
        <h3 style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:5px">${escapeHtml(secondary.name)}</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px">${escapeHtml(secondary.description?.slice(0, 100) || "")}</p>
      </div>
      <button class="btn btn-secondary btn-sm tpl-btn" data-tpl-id="${escapeHtml(secondary.id)}" style="width:100%;justify-content:center">
        ${secondary.id === _activeId ? "Activa" : "Seleccionar"}
      </button>
    </div>` : ""}

    <!-- Grid items (4-col each) -->
    ${gridItems.map(t => `
    <div class="glass-card" style="grid-column:span 4;padding:16px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(195,198,213,0.30)">
        <span class="material-symbols-outlined" style="color:var(--teal);font-size:20px">assignment_ind</span>
        <span style="font-size:13px;font-weight:700;color:var(--text)">${escapeHtml(t.name)}</span>
      </div>
      <p style="font-size:12px;color:var(--muted);line-height:1.55;flex:1;margin-bottom:12px">${escapeHtml(t.description || "")}</p>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)">${t.featured ? "INSTITUCIONAL" : "PERSONAL"}</span>
        <button class="btn btn-ghost btn-sm tpl-btn" data-tpl-id="${escapeHtml(t.id)}" style="color:var(--teal);padding:4px 10px">
          ${t.id === _activeId ? "Activa" : "Seleccionar"}
        </button>
      </div>
    </div>`).join("")}

    <!-- Create blank (4-col) -->
    <div class="glass-card" style="grid-column:span 4;min-height:180px;border:2px dashed rgba(195,198,213,0.60);background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:10px;border-radius:12px;transition:border-color 0.15s,background 0.15s" id="tpl-blank">
      <div style="width:44px;height:44px;border-radius:50%;background:rgba(195,198,213,0.25);display:flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="color:var(--teal)">add</span>
      </div>
      <div style="font-size:13.5px;font-weight:700;color:var(--text)">Plantilla en blanco</div>
      <div style="font-size:12px;color:var(--muted);text-align:center">Comienza desde cero o importa un archivo .tex</div>
    </div>
  `;

  // Bind template buttons
  bento.querySelectorAll(".tpl-btn").forEach(btn => {
    btn.addEventListener("click", () => activateTemplate(btn.dataset.tplId));
  });

  bento.querySelector("#tpl-blank")?.addEventListener("mouseenter", e => {
    e.currentTarget.style.borderColor = "rgba(0,49,126,0.40)";
    e.currentTarget.style.background = "rgba(0,49,126,0.03)";
  });
  bento.querySelector("#tpl-blank")?.addEventListener("mouseleave", e => {
    e.currentTarget.style.borderColor = "rgba(195,198,213,0.60)";
    e.currentTarget.style.background = "transparent";
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
