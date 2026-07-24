/**
 * pages/institution.js — Datos institucionales con preview en vivo (SRP)
 * Principios:
 *  - Norman: feedback inmediato con preview mientras el usuario escribe
 *  - Shneiderman: cierre — confirmación visual del guardado automático
 */
import { state, saveConfig } from "../state.js";
import { applyInstitutionConfig } from "../api.js";
import { escapeHtml }         from "../dom.js";
import { toast }             from "../toast.js";
import { refreshIcons }      from "../icons.js";

export function renderInstitution() {
  initColorPicker();
  bindTextFields();
  updatePreview();
  refreshIcons();
}

// ── Color picker nativo HTML5 ─────────────────────────────────────────────
function initColorPicker() {
  const el = document.getElementById("cfg-color");
  if (!el) return;

  const r = state.config.colorR ?? 0;
  const g = state.config.colorG ?? 121;
  const b = state.config.colorB ?? 107;
  el.value = rgbToHex(r, g, b);

  const fresh = el.cloneNode(true);
  fresh.value = el.value;
  el.parentNode.replaceChild(fresh, el);

  fresh.addEventListener("input", () => {
    const hex = fresh.value;
    const { r, g, b } = hexToRgb(hex);
    state.config.colorR   = r;
    state.config.colorG   = g;
    state.config.colorB   = b;
    state.config.colorHex = hex;
    saveConfig();
    updatePreview();
    const label = document.getElementById("cfg-color-label");
    if (label) label.textContent = hex;
  });

  const label = document.getElementById("cfg-color-label");
  if (label) label.textContent = rgbToHex(r, g, b);
}

// ── Campos de texto y selects ─────────────────────────────────────────────
function bindTextFields() {
  ["author", "career", "faculty", "institution", "ecosystem"].forEach(f => {
    const el = document.getElementById(`cfg-${f}`);
    if (!el) return;
    el.value = state.config[f] ?? "";
    const fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener("input", () => {
      state.config[f] = fresh.value;
      saveConfig();
      updatePreview();
    });
    fresh.value = state.config[f] ?? "";
  });

  const degreeEl = document.getElementById("cfg-degree");
  if (degreeEl) {
    degreeEl.value = state.config.degree ?? "";
    degreeEl.addEventListener("change", () => {
      state.config.degree = degreeEl.value;
      saveConfig();
      updatePreview();
    });
  }

  document.getElementById("btn-copy-latex")?.addEventListener("click", copyLatexConfig);
}

// ── Preview en vivo ───────────────────────────────────────────────────────
function updatePreview() {
  const preview = document.getElementById("inst-preview");
  if (!preview) return;

  const c      = state.config;
  const r      = c.colorR ?? 0;
  const g      = c.colorG ?? 121;
  const b      = c.colorB ?? 107;
  const hex    = c.colorHex || rgbToHex(r, g, b);
  const author = c.author   || "Tu Nombre";
  const degree = c.degree   || "Ph.D.";
  const career = c.career   || "Tu Carrera";
  const faculty = c.faculty || "Facultad";
  const inst   = c.institution || "Tu Institución";

  const luminance   = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textOnColor = luminance > 0.5 ? "#1a1a1a" : "#ffffff";

  const latexBlock = `\\author{${author}, ${degree}}
\\institute{Carrera de\\\\${career}}
\\extrainfo{${faculty}\\\\${inst}}

\\definecolor{weekaccent}{RGB}{${r},${g},${b}}
\\definecolor{structurecolor}{RGB}{${r},${g},${b}}
\\definecolor{main}{RGB}{${r},${g},${b}}`;

  preview.innerHTML = `
    <div class="latex-cover" style="border-top:4px solid ${hex}">
      <div class="latex-cover-stripe" style="background:${hex};color:${textOnColor}">
        GUÍA DE CLASE
      </div>
      <div class="latex-cover-body">
        <div class="latex-cover-title" style="color:${hex}">Semana 01</div>
        <div class="latex-cover-subtitle">Introducción al curso</div>
        <div class="latex-cover-meta">
          <div><strong>${escapeHtml(author)}</strong>${degree ? `, ${escapeHtml(degree)}` : ""}</div>
          <div style="color:#888;font-size:11px">Carrera de ${escapeHtml(career)}</div>
          <div style="color:#888;font-size:11px">${escapeHtml(faculty)} · ${escapeHtml(inst)}</div>
        </div>
      </div>
    </div>

    <div class="latex-block" style="margin-top:12px">
      <div class="latex-block-header">
        <span style="font-size:11px;font-weight:700;color:#666">Preámbulo LaTeX generado</span>
        <button class="btn btn-ghost btn-xs" id="btn-copy-latex" title="Copiar bloque LaTeX">
          <i data-lucide="clipboard-copy" width="12" height="12"></i> Copiar
        </button>
      </div>
      <pre class="latex-pre"><code>${escapeHtml(latexBlock)}</code></pre>
    </div>`;

  document.getElementById("btn-copy-latex")?.addEventListener("click", copyLatexConfig);
  refreshIcons();
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
  toast("Configuración LaTeX copiada", "success");
}

window.saveInstitutionConfig = async function saveInstitutionConfig() {
  const config = state.config;
  if (!config.author?.trim() || !config.institution?.trim() || !config.faculty?.trim() || !config.career?.trim()) {
    toast("Completa autor, institución, facultad y carrera", "error");
    return;
  }
  try {
    const result = await applyInstitutionConfig({
      author: config.author || "",
      degree: config.degree || "",
      career: config.career || "",
      faculty: config.faculty || "",
      institution: config.institution || "",
      color_r: Number(config.colorR ?? 0),
      color_g: Number(config.colorG ?? 121),
      color_b: Number(config.colorB ?? 107),
      ecosystem: config.ecosystem || "",
    });
    toast(result.message, result.success ? "success" : "error", 6000);
  } catch (error) {
    toast(`No se pudo guardar la configuración: ${error}`, "error");
  }
};

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 121, b: 107 };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, parseInt(v) || 0)).toString(16).padStart(2, "0")).join("");
}
