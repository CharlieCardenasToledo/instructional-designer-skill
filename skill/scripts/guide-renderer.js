#!/usr/bin/env node
"use strict";

/**
 * guide-renderer.js — Motor de renderizado HTML de Jintia
 *
 * Convierte guide.json (AST neutral) en HTML semántico listo para
 * Vivliostyle o para vista previa en navegador.
 *
 * Uso CLI:
 *   node scripts/guide-renderer.js --spec guide.json [--theme jintia-clasico] [--output guide.html]
 *
 * Uso programático:
 *   const { renderGuide } = require("./guide-renderer");
 *   const html = await renderGuide("guide.json", { theme: "jintia-clasico" });
 */

const fs   = require("node:fs");
const path = require("node:path");

const ROOT        = path.resolve(__dirname, "..");
const THEMES_DIR  = path.join(ROOT, "themes");
const SCHEMA_PATH = path.join(ROOT, "schemas", "guide.schema.json");

// ─── Utilidades ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Convierte texto plano (con saltos de línea) en párrafos HTML. */
function textToHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(para => `<p>${escapeHtml(para.trim())}</p>`)
    .join("\n");
}

/** Renderiza el campo `content` de un nodo: puede ser string, array o null. */
function renderContent(content) {
  if (!content) return "";
  if (typeof content === "string") return textToHtml(content);
  if (Array.isArray(content)) return content.map(renderContent).join("\n");
  return escapeHtml(String(content));
}

// ─── Renders por tipo de nodo ────────────────────────────────────────────────

function renderCover(metadata) {
  const week    = metadata.week    ? `Semana ${metadata.week}` : "";
  const authors = (metadata.authors || []).map(escapeHtml).join(" · ");
  return `
<header class="jintia-cover" data-pagination="page-contained" role="banner">
  <p class="jintia-cover__course">${escapeHtml(metadata.course || "")}</p>
  ${week ? `<p class="jintia-cover__week">${escapeHtml(week)}</p>` : ""}
  <h1 class="jintia-cover__title">${escapeHtml(metadata.topic || "")}</h1>
  ${metadata.outcome ? `<p class="jintia-cover__outcome">${escapeHtml(metadata.outcome)}</p>` : ""}
  ${authors ? `<p class="jintia-cover__authors">${authors}</p>` : ""}
  ${metadata.period ? `<p class="jintia-cover__period">${escapeHtml(metadata.period)}</p>` : ""}
</header>`;
}

function renderBlock(node, typeClass, label) {
  const pagination = node.pagination || "atomic";
  const titleHtml  = node.title
    ? `<h2 class="jintia-block__title">${escapeHtml(node.title)}</h2>`
    : "";
  const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";

  return `
<aside class="jintia-block ${typeClass}"
       data-pagination="${escapeHtml(pagination)}"
       role="note"${idAttr}>
  <span class="jintia-block__label" aria-hidden="true">${escapeHtml(label)}</span>
  ${titleHtml}
  <div class="jintia-block__content">
${renderContent(node.content)}
  </div>
</aside>`;
}

function renderOrientation(node)   { return renderBlock(node, "jintia-orientation",   "Orientación"); }
function renderTheory(node)        { return renderBlock(node, "jintia-theory",         "Teoría"); }
function renderConcept(node)       { return renderBlock(node, "jintia-concept",        "Concepto"); }
function renderPractice(node)      { return renderBlock(node, "jintia-practice",       "Práctica guiada"); }
function renderWarning(node)       { return renderBlock(node, "jintia-warning",        "Advertencia"); }
function renderCriticalError(node) { return renderBlock(node, "jintia-critical-error", "Error crítico"); }
function renderScenario(node)      { return renderBlock(node, "jintia-scenario",       "Escenario"); }

function renderMarginNote(node) {
  const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  return `
<aside class="jintia-margin-note"${idAttr} role="note">
  ${renderContent(node.content)}
</aside>`;
}

/** Figura: HTML nativo con counter CSS para numeración automática. */
function renderFigure(node) {
  const pagination = node.pagination || "atomic";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const widthAttr  = node.width ? ` style="max-width:${escapeHtml(node.width)}"` : "";
  const src        = node.src || "";
  const alt        = escapeHtml(node.alt || "");
  const caption    = escapeHtml(node.caption || "");

  return `
<figure class="jintia-figure" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <img src="${escapeHtml(src)}" alt="${alt}" loading="lazy"${widthAttr} />
  <figcaption class="jintia-caption">${caption}</figcaption>
</figure>`;
}

/** htmlFigure: alias para el pipeline visual (reemplaza latexBlock). */
function htmlFigure(spec, outputPath) {
  return renderFigure({
    src:     outputPath,
    alt:     spec.alt     || "",
    caption: spec.caption || "",
    width:   spec.width   || "100%",
  });
}

/** Tabla estructurada desde guide.json. */
function renderTable(node) {
  const pagination = node.pagination || "splittable";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const caption    = escapeHtml(node.caption || "");
  const headers    = node.headers || [];
  const rows       = node.rows    || [];

  const theadHtml = headers.length
    ? `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`
    : "";

  const tbodyHtml = rows.length
    ? `<tbody>${rows.map(row =>
        `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
      ).join("\n")}</tbody>`
    : "";

  return `
<div class="jintia-table" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <table>
    ${caption ? `<caption>${caption}</caption>` : ""}
    ${theadHtml}
    ${tbodyHtml}
  </table>
</div>`;
}

/** Assessment: lista numerada de preguntas/actividades. */
function renderAssessment(node) {
  const pagination = node.pagination || "atomic";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const titleHtml  = node.title
    ? `<h2 class="jintia-block__title">${escapeHtml(node.title)}</h2>`
    : "";

  const items = Array.isArray(node.items) ? node.items : [];
  const itemsHtml = items.length
    ? `<ol class="jintia-assessment__list">${
        items.map(item =>
          `<li class="jintia-assessment__item">${renderContent(item)}</li>`
        ).join("\n")
      }</ol>`
    : renderContent(node.content);

  return `
<section class="jintia-block jintia-assessment" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <span class="jintia-block__label" aria-hidden="true">Actividad evaluativa</span>
  ${titleHtml}
  <div class="jintia-block__content">
    ${itemsHtml}
  </div>
</section>`;
}

/** Bibliografía: recibe lista de entradas ya formateadas como HTML por bibliography-manager. */
function renderBibliography(node) {
  const entries = Array.isArray(node.entries) ? node.entries : [];
  const idAttr  = node.id ? ` id="${escapeHtml(node.id)}"` : "";

  const listHtml = entries.length
    ? `<ul class="jintia-bibliography__list" role="list">
        ${entries.map(entry =>
          `<li class="jintia-bibliography__item">${entry}</li>`
        ).join("\n")}
      </ul>`
    : `<p class="jintia-muted">No se encontraron entradas bibliográficas.</p>`;

  return `
<section class="jintia-bibliography" data-pagination="splittable"${idAttr}>
  <h2>Referencias</h2>
  ${listHtml}
</section>`;
}

/** Cita inline: delegada a bibliography-manager; aquí solo envuelve el texto. */
function renderCitation(node) {
  const keys = (node.keys || []).join(", ");
  return `<cite class="jintia-citation" data-keys="${escapeHtml(keys)}">[${escapeHtml(keys)}]</cite>`;
}

// ─── Dispatcher de nodos ─────────────────────────────────────────────────────

const RENDERERS = {
  orientation:     renderOrientation,
  theory:          renderTheory,
  concept:         renderConcept,
  practice:        renderPractice,
  warning:         renderWarning,
  "critical-error": renderCriticalError,
  scenario:        renderScenario,
  "margin-note":   renderMarginNote,
  figure:          renderFigure,
  table:           renderTable,
  assessment:      renderAssessment,
  bibliography:    renderBibliography,
  citation:        renderCitation,
};

function renderSection(node) {
  const renderer = RENDERERS[node.type];
  if (!renderer) {
    console.warn(`[guide-renderer] Tipo de nodo desconocido: "${node.type}" — se omite.`);
    return `<!-- nodo desconocido: ${escapeHtml(node.type)} -->`;
  }
  return renderer(node);
}

// ─── HTML completo del documento ─────────────────────────────────────────────

function buildHtml(guide, themeRelativePath) {
  const { metadata, sections } = guide;
  const lang   = metadata.lang || "es";
  const title  = metadata.topic || "Guía Semanal";

  // Ruta al CSS del tema relativa al HTML de salida
  const cssHref = themeRelativePath || "./themes/jintia-clasico/theme.css";

  const coverHtml    = renderCover(metadata);
  const sectionsHtml = (sections || []).map(renderSection).join("\n\n");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metadata.outcome || title)}" />
  <meta name="author" content="${escapeHtml((metadata.authors || []).join(", "))}" />
  <link rel="stylesheet" href="${escapeHtml(cssHref)}" />
</head>
<body>

${coverHtml}

<main class="jintia-content" role="main">
${sectionsHtml}
</main>

</body>
</html>`;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Renderiza un guide.json a string HTML.
 * @param {string} guidePath - Ruta absoluta o relativa al guide.json
 * @param {object} [options]
 * @param {string} [options.theme]       - ID del tema (ej. "jintia-clasico")
 * @param {string} [options.themeCssHref] - Ruta CSS del tema en el HTML de salida
 * @returns {string} HTML completo del documento
 */
function renderGuide(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`guide.json no encontrado: ${absolute}`);
  }

  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (err) {
    throw new Error(`Error al parsear guide.json: ${err.message}`);
  }

  if (!guide.metadata || !guide.sections) {
    throw new Error("guide.json inválido: faltan los campos 'metadata' y/o 'sections'.");
  }

  const themeId  = options.theme || guide.metadata.theme || "jintia-clasico";
  const themeCss = options.themeCssHref || `./themes/${themeId}/theme.css`;

  return buildHtml(guide, themeCss);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args   = process.argv.slice(2);
  const specArg   = args.find((a, i) => args[i - 1] === "--spec") || args.find(a => !a.startsWith("--"));
  const outputArg = args.find((a, i) => args[i - 1] === "--output");
  const themeArg  = args.find((a, i) => args[i - 1] === "--theme");

  if (!specArg) {
    console.error("Uso: node scripts/guide-renderer.js --spec guide.json [--theme jintia-clasico] [--output guide.html]");
    process.exit(2);
  }

  try {
    const html = renderGuide(specArg, { theme: themeArg });
    if (outputArg) {
      const outPath = path.resolve(outputArg);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, "utf8");
      console.log(`✓ HTML generado: ${outPath}`);
    } else {
      process.stdout.write(html);
    }
  } catch (err) {
    console.error(`guide-renderer: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { renderGuide, renderSection, htmlFigure, escapeHtml, textToHtml };
