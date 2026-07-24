/**
 * templatePreview.js — Motor de preview HTML que replica el aspecto de un PDF LaTeX
 *
 * Renderiza una versión HTML pixel-approx del documento LaTeX generado,
 * usando datos reales del usuario + lorem ipsum para el contenido.
 * No requiere compilar LaTeX — es una representación visual fiel.
 *
 * Principio aplicado: Don Norman — Feedback: el usuario ve el resultado
 * antes de generar el archivo real.
 */

import { escapeHtml } from "./dom.js";

// Lorem ipsum académico en español
const LOREM = {
  intro: "La comprensión de los fundamentos teóricos constituye el punto de partida indispensable para el desarrollo de competencias aplicadas en este dominio. Este marco conceptual permite al estudiante contextualizar los fenómenos observados dentro de una estructura epistemológica coherente.",
  body1: "El análisis de los componentes estructurales revela patrones recurrentes que sustentan la práctica profesional. La identificación de estas regularidades facilita la transferencia del conocimiento a contextos inéditos, promoviendo el pensamiento crítico y la autonomía intelectual.",
  body2: "Las metodologías contemporáneas privilegian el aprendizaje situado, donde la teoría y la práctica se articulan de manera dialógica. Este enfoque permite al estudiante construir significados a partir de la experiencia directa, validados por el marco teórico correspondiente.",
  activity: "Analiza el siguiente caso y elabora una propuesta de solución fundamentada en los conceptos desarrollados durante la semana. Justifica cada decisión con referencias a los autores estudiados y considera las implicaciones éticas y técnicas de tu propuesta.",
  bibliography: "Apellido, N., & Apellido, N. (2024). Título del libro de referencia principal. Editorial Académica. https://doi.org/10.xxxx/xxxxx",
};

const TOPICS = ["Fundamentos conceptuales del dominio", "Estructura y componentes del sistema", "Metodologías de análisis y diseño", "Aplicación práctica y casos de uso"];
const OUTCOMES = ["Identificar y clasificar los componentes principales", "Aplicar las metodologías estudiadas en casos prácticos", "Evaluar críticamente las soluciones propuestas"];

/**
 * Renderiza el preview HTML de una plantilla dado su tipo y la config institucional.
 * @param {string} previewType - ID del tipo de preview ("elegantbook-clasico" etc.)
 * @param {object} config - Configuración institucional del usuario
 * @param {string} activeId - ID de la plantilla actualmente activa
 * @returns {string} HTML string
 */
export function renderTemplatePreview(previewType, config, activeId) {
  const candidate = config.colorHex || rgbToHex(config.colorR ?? 0, config.colorG ?? 121, config.colorB ?? 107);
  const hex = /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "#00796b";
  const author = escapeHtml(config.author || "Tu Nombre");
  const degree = escapeHtml(config.degree || "Ph.D.");
  const career = escapeHtml(config.career || "Tu Carrera");
  const inst   = escapeHtml(config.institution || "Tu Institución");
  const week   = "01";

  const luminance = getLuminance(hex);
  const textOnPrimary = luminance > 0.5 ? "#1a1a1a" : "#ffffff";

  switch (previewType) {
    default:                        return previewElegantbookClasico(hex, textOnPrimary, author, degree, career, inst, week);
  }
}

// ── ElegantBook Clásico ───────────────────────────────────────────────────
function previewElegantbookClasico(hex, textOnPrimary, author, degree, career, inst, week) {
  const dim  = hexAlpha(hex, 0.12);
  const mid  = hexAlpha(hex, 0.25);
  const border = hexAlpha(hex, 0.4);

  return `
  <div class="lp-page lp-elegantbook">

    <!-- Portada -->
    <div class="lp-cover" style="border-top:4px solid ${hex}">
      <div class="lp-cover-stripe" style="background:${hex};color:${textOnPrimary}">
        GUÍA DE CLASE · SEMANA ${week}
      </div>
      <div class="lp-cover-body">
        <div class="lp-cover-title" style="color:${hex}">Semana ${week}</div>
        <div class="lp-cover-subtitle">Fundamentos y Aplicaciones</div>
        <div class="lp-cover-divider" style="background:${hex}"></div>
        <div class="lp-cover-meta">
          <div style="font-weight:700">${author}, ${degree}</div>
          <div style="color:#666;font-size:10px">Carrera de ${career}</div>
          <div style="color:#666;font-size:10px">${inst}</div>
        </div>
      </div>
    </div>

    <!-- Página interior -->
    <div class="lp-inner">
      <div class="lp-header" style="color:${hex};border-bottom-color:${border}">
        <span>Elaborado por: ${author}, ${degree}</span>
        <span>Carrera: ${career}</span>
      </div>

      <!-- Capítulo -->
      <div class="lp-chapter">
        <div class="lp-chapter-num" style="color:${hex}">Capítulo 1</div>
        <div class="lp-chapter-title" style="border-left:3px solid ${hex}">
          Fundamentos Conceptuales
        </div>
      </div>

      <!-- Bloque softblock -->
      <div class="lp-block" style="background:${dim};border-left:3px solid ${hex}">
        <div class="lp-block-title" style="color:${hex}">Orientación · Semana ${week}</div>
        <div class="lp-block-body">
          <div class="lp-topic-row">
            <span class="lp-dot" style="background:${hex}"></span>
            <span>Tema 1: ${TOPICS[0]}</span>
          </div>
          <div class="lp-topic-row">
            <span class="lp-dot" style="background:${hex}"></span>
            <span>Tema 2: ${TOPICS[1]}</span>
          </div>
          <div class="lp-meta-row">
            <span>4h docencia · 8h autónomo</span>
          </div>
        </div>
      </div>

      <!-- Texto de cuerpo -->
      <div class="lp-section-title">1.1 Marco Teórico</div>
      <div class="lp-paragraph">${LOREM.intro}</div>

      <!-- Bloque accentblock (con color primario) -->
      <div class="lp-block" style="background:${hex};color:${textOnPrimary}">
        <div class="lp-block-title" style="color:${textOnPrimary};opacity:.8">Análisis Técnico</div>
        <div class="lp-block-body" style="color:${textOnPrimary}">
          ${LOREM.body1}
        </div>
      </div>

      <!-- Más texto -->
      <div class="lp-paragraph">${LOREM.body2}</div>

      <!-- Bloque mintblock -->
      <div class="lp-block" style="background:#e8f7f0;border-left:3px solid #12b76a">
        <div class="lp-block-title" style="color:#16a34a">Guía Práctica</div>
        <div class="lp-block-body">
          <div class="lp-topic-row"><span class="lp-dot" style="background:#12b76a"></span><span>${OUTCOMES[0]}</span></div>
          <div class="lp-topic-row"><span class="lp-dot" style="background:#12b76a"></span><span>${OUTCOMES[1]}</span></div>
        </div>
      </div>

      <!-- Bloque sandblock -->
      <div class="lp-block" style="background:#fdf5e6;border-left:3px solid #f79009">
        <div class="lp-block-title" style="color:#b45309">Actividad Calificada · 20%</div>
        <div class="lp-block-body">${LOREM.activity}</div>
      </div>

      <!-- Bibliografía -->
      <div class="lp-section-title">Bibliografía</div>
      <div class="lp-bib">${LOREM.bibliography}</div>

      <div class="lp-footer" style="border-top-color:${border}">
        <span style="color:${hex}">${inst}</span>
        <span style="color:#999">Pág. 1</span>
      </div>
    </div>
  </div>`;
}

// ── ElegantBook Minimalista ───────────────────────────────────────────────
function previewMinimalista(hex, textOnPrimary, author, degree, career, inst, week) {
  return `
  <div class="lp-page lp-minimal">

    <!-- Portada minimalista -->
    <div class="lp-cover lp-cover-minimal">
      <div style="border-bottom:2px solid ${hex};padding-bottom:10px;margin-bottom:12px">
        <div style="font-size:18px;font-weight:300;letter-spacing:.05em;color:#1a1a1a">Semana ${week}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Fundamentos y Aplicaciones</div>
      </div>
      <div style="font-size:11px;color:#555;line-height:1.8">
        <div>${author}${degree ? `, ${degree}` : ""}</div>
        <div>${career}</div>
        <div>${inst}</div>
      </div>
      <div style="margin-top:16px;font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.1em">
        Guía de Clase · APA 7.ª edición
      </div>
    </div>

    <!-- Interior minimalista -->
    <div class="lp-inner">
      <div class="lp-header" style="color:#555;border-bottom-color:#e5e7eb">
        <span>${author}, ${degree}</span>
        <span>${career}</span>
      </div>

      <div style="font-size:15px;font-weight:700;color:#1a1a1a;border-left:3px solid ${hex};padding-left:10px;margin:14px 0 8px">
        Fundamentos Conceptuales
      </div>

      <!-- Concepto clave -->
      <div style="border-left:2px solid ${hex};padding:8px 12px;margin:8px 0;background:#fafafa">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:4px">Concepto clave</div>
        <div style="font-size:11px;font-style:italic;color:#333">${LOREM.intro.slice(0, 140)}…</div>
      </div>

      <div class="lp-paragraph">${LOREM.body1}</div>

      <!-- Cita académica -->
      <div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;margin:8px 0;background:white">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:4px">Cita académica</div>
        <div style="font-size:11px;font-style:italic;color:#444">"${LOREM.body2.slice(0, 120)}…"</div>
      </div>

      <!-- Actividad -->
      <div style="border:1.5px dashed #ccc;border-radius:4px;padding:8px 12px;margin:8px 0">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:4px">Actividad</div>
        <div style="font-size:10px;color:#333">${LOREM.activity.slice(0, 160)}…</div>
      </div>

      <div class="lp-section-title" style="color:#555">Referencias bibliográficas</div>
      <div class="lp-bib">${LOREM.bibliography}</div>

      <div class="lp-footer" style="border-top-color:#e5e7eb">
        <span style="color:#555">${inst}</span>
        <span style="color:#aaa">Pág. 1</span>
      </div>
    </div>
  </div>`;
}

// ── Nota Técnica IEEE ─────────────────────────────────────────────────────
function previewNotaTecnica(hex, textOnPrimary, author, degree, career, inst, week) {
  return `
  <div class="lp-page lp-ieee">

    <!-- Cabecera IEEE -->
    <div class="lp-cover lp-cover-ieee">
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px">
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;font-family:serif">Fundamentos y Aplicaciones</div>
        <div style="font-size:10px;color:#444;margin-top:4px;font-style:italic">Nota Técnica · Semana ${week}</div>
        <div style="font-size:9px;color:#666;margin-top:6px">${author}${degree ? `, ${degree}` : ""} — ${career}</div>
        <div style="font-size:9px;color:#888">${inst}</div>
      </div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;margin-bottom:4px">Resumen</div>
      <div style="font-size:10px;font-style:italic;color:#333;line-height:1.5">${LOREM.intro.slice(0, 220)}…</div>
      <div style="font-size:9px;color:#666;margin-top:6px">
        <strong>Palabras clave:</strong> fundamentos, metodología, aplicación, análisis, diseño
      </div>
    </div>

    <!-- Dos columnas IEEE -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:0">
      <div>
        <div class="lp-section-title" style="color:#1a1a1a;font-family:serif;border-bottom:1px solid #333;padding-bottom:3px">I. Introducción</div>
        <div style="font-size:10px;line-height:1.6;color:#333;text-indent:1em;text-align:justify">${LOREM.body1}</div>

        <!-- Teorema -->
        <div style="border:1px solid ${hex};border-radius:3px;padding:7px 9px;margin:8px 0;background:${hexAlpha(hex, 0.05)}">
          <div style="font-size:9px;font-weight:700;color:${hex}">Definición 1.1</div>
          <div style="font-size:10px;font-style:italic;color:#333;margin-top:3px">${LOREM.body2.slice(0, 100)}…</div>
        </div>

        <div class="lp-section-title" style="color:#1a1a1a;font-family:serif;border-bottom:1px solid #333;padding-bottom:3px">II. Metodología</div>
        <div style="font-size:10px;line-height:1.6;color:#333;text-indent:1em;text-align:justify">${LOREM.body2.slice(0, 180)}…</div>
      </div>

      <div>
        <div class="lp-section-title" style="color:#1a1a1a;font-family:serif;border-bottom:1px solid #333;padding-bottom:3px">III. Resultados</div>
        <div style="font-size:10px;line-height:1.6;color:#333;text-indent:1em;text-align:justify">${LOREM.body1.slice(100)}…</div>

        <!-- Algoritmo -->
        <div style="border:1px solid #ccc;border-radius:3px;padding:7px 9px;margin:8px 0;background:#f8f9fa;font-family:monospace;font-size:9px;color:#333;line-height:1.8">
          <div style="font-weight:700;margin-bottom:4px;color:${hex}">Algoritmo 1</div>
          <div>1: Input: datos, parámetros</div>
          <div>2: <strong>while</strong> condición <strong>do</strong></div>
          <div>3:&nbsp;&nbsp;&nbsp;Procesar(datos)</div>
          <div>4: <strong>end while</strong></div>
          <div>5: return resultado</div>
        </div>

        <div class="lp-section-title" style="color:#1a1a1a;font-family:serif;border-bottom:1px solid #333;padding-bottom:3px">IV. Referencias</div>
        <div style="font-size:9px;color:#333;line-height:1.6">[1] ${LOREM.bibliography.slice(0, 100)}…</div>
      </div>
    </div>

    <div class="lp-footer" style="border-top-color:#333;margin-top:8px">
      <span style="color:#333">${inst}</span>
      <span style="color:#999">Nota Técnica · Pág. 1</span>
    </div>
  </div>`;
}

// ── Utilidades ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 121, b: 107 };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, parseInt(v) || 0)).toString(16).padStart(2, "0")).join("");
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function hexAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
