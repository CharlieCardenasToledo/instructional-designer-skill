/**
 * templates.js — Galería de plantillas LaTeX (SRP)
 *
 * Principios aplicados:
 * - Gestalt (proximidad): tarjetas agrupadas, preview a la derecha
 * - Don Norman (affordance): botón "Activar" prominente en la activa, deshabilitado
 * - Shneiderman (feedback): badge "Activa" claro, spinner al cambiar
 * - Fitts: botones de acción grandes
 */
import { listTemplates, getActiveTemplate, setActiveTemplate } from "../api.js";
import { renderTemplatePreview } from "../templatePreview.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";
import { state } from "../state.js";
import { escapeHtml } from "../dom.js";

let _templates = [];
let _activeId = "";
let _selectedId = "";

export async function renderTemplates() {
  const el = document.getElementById("p-templates");
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Plantillas LaTeX</h1>
        <p class="page-subtitle">Elige el diseño visual para tus guías de clase</p>
      </div>
    </div>
    <div class="tpl-layout">
      <div class="tpl-gallery" id="tpl-gallery">
        <div class="spinner-wrap">${ic("Loader2",20)} Cargando plantillas…</div>
      </div>
      <div class="tpl-preview-panel" id="tpl-preview-panel">
        <div class="tpl-preview-header">
          <span id="tpl-preview-name" style="font-weight:600"></span>
          <button id="tpl-activate-btn" class="btn btn-primary" style="display:none">
            ${ic("Zap",14)} Activar plantilla
          </button>
        </div>
        <div class="tpl-preview-scroll" id="tpl-preview-scroll">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;flex-direction:column;gap:8px">
            ${ic("Eye",28)}
            <span>Selecciona una plantilla para ver el preview</span>
          </div>
        </div>
      </div>
    </div>`;

  refreshIcons();
  document.getElementById("tpl-activate-btn")?.addEventListener("click", activateTemplate);

  try {
    [_templates, _activeId] = await Promise.all([listTemplates(), getActiveTemplate()]);
    _selectedId = _activeId;
    renderGallery();
    if (_selectedId) renderPreview(_selectedId);
  } catch (e) {
    document.getElementById("tpl-gallery").innerHTML = `
      <div class="alert alert-error">${ic("AlertTriangle",14)} Error al cargar plantillas: ${escapeHtml(e)}</div>`;
    refreshIcons();
  }
}

function renderGallery() {
  const gallery = document.getElementById("tpl-gallery");
  if (!_templates.length) {
    gallery.innerHTML = `<div class="alert alert-info">${ic("Info",14)} No hay plantillas disponibles.</div>`;
    refreshIcons();
    return;
  }

  // Featured primero, luego el resto
  const sorted = [..._templates].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  gallery.innerHTML = sorted.map(t => {
    const isActive   = t.id === _activeId;
    const isSelected = t.id === _selectedId;
    return `
    <button
      class="tpl-card ${isSelected ? "tpl-card--selected" : ""} ${isActive ? "tpl-card--active" : ""}"
      data-template-id="${escapeHtml(t.id)}"
      title="${escapeHtml(t.description)}"
    >
      <div class="tpl-card-header">
        <div>
          <div class="tpl-card-name">${escapeHtml(t.name)}</div>
          <div class="tpl-card-tags">
            ${(t.tags || []).slice(0, 3).map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          ${isActive ? `<span class="badge badge-success">${ic("CheckCircle2",11)} Activa</span>` : ""}
          ${t.featured ? `<span class="badge badge-info">${ic("Zap",11)} Destacada</span>` : ""}
        </div>
      </div>
      <div class="tpl-card-desc">${escapeHtml(t.description)}</div>
      <div class="tpl-card-meta">
        ${ic("FileText",11)} ${escapeHtml(t.documentClass || "elegantbook")}
      </div>
    </button>`;
  }).join("");

  gallery.querySelectorAll("[data-template-id]").forEach(button => {
    button.addEventListener("click", () => selectTemplate(button.dataset.templateId));
  });
  refreshIcons();
}

function renderPreview(templateId) {
  const tpl = _templates.find(t => t.id === templateId);
  if (!tpl) return;

  const nameEl    = document.getElementById("tpl-preview-name");
  const scrollEl  = document.getElementById("tpl-preview-scroll");
  const activateBtn = document.getElementById("tpl-activate-btn");

  if (nameEl) nameEl.textContent = tpl.name;
  if (activateBtn) {
    activateBtn.style.display = templateId === _activeId ? "none" : "flex";
  }

  const config = state.config || {};
  const html = renderTemplatePreview(tpl.previewType || tpl.id, config, _activeId);

  if (scrollEl) {
    scrollEl.innerHTML = `<div class="lp-container">${html}</div>`;
  }
}

function selectTemplate(id) {
  _selectedId = id;
  renderGallery();
  renderPreview(id);
}

async function activateTemplate() {
  if (!_selectedId || _selectedId === _activeId) return;
  const btn = document.getElementById("tpl-activate-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `${ic("Loader2",14)} Activando…`; refreshIcons(); }

  try {
    const result = await setActiveTemplate(_selectedId);
    if (result && result.success) {
      _activeId = _selectedId;
      toast(`Plantilla "${_templates.find(t => t.id === _activeId)?.name}" activada`, "success");
      renderGallery();
      renderPreview(_selectedId);
    } else {
      throw new Error(result?.message || "Error desconocido");
    }
  } catch (e) {
    toast(`Error al activar: ${e}`, "error");
    if (btn) { btn.disabled = false; btn.innerHTML = `${ic("Zap",14)} Activar plantilla`; refreshIcons(); }
  }
}
