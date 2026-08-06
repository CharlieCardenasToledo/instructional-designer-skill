"use strict";

/**
 * citations.js — Módulo core unificado de citas
 *
 * Punto de entrada único para todos los subsistemas que necesiten trabajar
 * con citas bibliográficas: linter, renderer, plan, evidence-gate.
 *
 * Consolida las funciones dispersas en scripts/citation-keys.js y añade
 * la validación contra un archivo .bib y el renderizado de citas inline.
 *
 * Sintaxis canónica en guide.json:
 *   {{cite:clave}}               → cita parentética: (Apellido, año)
 *   {{cite:clave|narrative}}     → cita narrativa:   Apellido (año)
 *
 * El nodo `{ "type": "citation" }` está DEPRECADO.
 * Usar exclusivamente la sintaxis inline en campos `content`.
 */

const fs   = require("node:fs");
const path = require("node:path");

// Re-exportar utilidades de extracción de scripts/ para que runtime/core
// sea el punto de entrada canónico.
const { collectCitationKeys, extractInlineKeys, collectFromContent } = require("../../scripts/citation-keys");

// ─── Constantes ───────────────────────────────────────────────────────────────

const INLINE_CITE_PATTERN = /\{\{cite:([^|}}\s]+)(?:\|([^}]+))?\}\}/g;

// ─── Validación contra .bib ───────────────────────────────────────────────────

/**
 * Extrae las claves de un archivo .bib mediante regex.
 * @param {string} bibPath  Ruta absoluta al archivo .bib
 * @returns {Set<string>|null}  null si el archivo no existe
 */
function extractBibKeys(bibPath) {
  const absolute = path.resolve(bibPath);
  if (!fs.existsSync(absolute)) return null;
  const raw  = fs.readFileSync(absolute, "utf8");
  const keys = new Set();
  const re   = /@\w+\s*\{\s*([^,\s]+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) keys.add(m[1]);
  return keys;
}

/**
 * Valida que todas las claves citadas existan en el archivo .bib indicado.
 *
 * @param {string[]} keys     Lista de claves a verificar
 * @param {string}   bibPath  Ruta al archivo .bib (relativa al guide.json o absoluta)
 * @returns {{ valid: boolean, missing: string[], bibExists: boolean }}
 */
function validateCitationKeys(keys, bibPath) {
  if (!keys || keys.length === 0) {
    return { valid: true, missing: [], bibExists: fs.existsSync(path.resolve(bibPath)) };
  }

  const bibKeys = extractBibKeys(bibPath);
  if (bibKeys === null) {
    return { valid: false, missing: [...keys], bibExists: false };
  }

  const missing = keys.filter(k => !bibKeys.has(k));
  return { valid: missing.length === 0, missing, bibExists: true };
}

// ─── Renderizado de citas inline ──────────────────────────────────────────────

/**
 * Reemplaza las sintaxis `{{cite:clave}}` y `{{cite:clave|narrative}}` en un
 * string por marcado HTML de cita, usando el contexto bibliográfico dado.
 *
 * Si no se provee contexto bibliográfico, devuelve `[clave]` como fallback.
 *
 * @param {string}  text       Contenido del campo content
 * @param {object}  [bibCtx]   Contexto de Bibliography (entries, style, etc.)
 * @param {string}  [style]    Estilo CSL (default: "apa")
 * @returns {string}
 */
function renderInlineText(text, bibCtx = null, style = "apa") {
  if (typeof text !== "string") return text;
  return text.replace(
    new RegExp(INLINE_CITE_PATTERN.source, "g"),
    (match, key, modifier) => {
      const mode = modifier === "narrative" ? "narrative" : "parenthetical";
      if (!bibCtx || !bibCtx.entries) return `<cite class="jintia-cite">[${key}]</cite>`;
      const entry = bibCtx.entries[key];
      if (!entry) return `<cite class="jintia-cite">[${key}]</cite>`;
      return formatCite(entry, mode, style);
    }
  );
}

/**
 * Formatea una única cita bibliográfica según modo y estilo.
 * Solo soporta APA básico; para estilos completos usar Citation.js.
 *
 * @param {{ author?: string[], year?: string|number, title?: string }} entry
 * @param {"parenthetical"|"narrative"} mode
 * @param {string} style
 * @returns {string} HTML de la cita
 */
function formatCite(entry, mode = "parenthetical", style = "apa") {
  const author = Array.isArray(entry.author) ? entry.author[0]?.family || "Autor" : "Autor";
  const year   = entry.year || entry.issued?.["date-parts"]?.[0]?.[0] || "s.f.";
  const label  = `${author}, ${year}`;

  if (mode === "narrative") {
    return `<cite class="jintia-cite jintia-cite--narrative">${author} (${year})</cite>`;
  }
  return `<cite class="jintia-cite jintia-cite--parenthetical">(${label})</cite>`;
}

// ─── Verificación de captions y caption-only ─────────────────────────────────

/**
 * Verifica que todos los nodos figure en guide.json tengan alt y caption.
 * @param {{ sections?: object[] }} guide
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateFigureAccessibility(guide) {
  const issues = [];
  for (const section of guide.sections || []) {
    if (section.type !== "figure") continue;
    if (!section.alt || !section.alt.trim()) {
      issues.push(`Figura "${section.id || "(sin id)"}": falta alt.`);
    }
    if (!section.caption || !section.caption.trim()) {
      issues.push(`Figura "${section.id || "(sin id)"}": falta caption.`);
    }
    if (!section.src && !section.visualSpec) {
      issues.push(`Figura "${section.id || "(sin id)"}": falta src o visualSpec.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

// ─── API pública ──────────────────────────────────────────────────────────────

module.exports = {
  // Re-exportados de citation-keys.js
  collectCitationKeys,
  extractInlineKeys,
  collectFromContent,

  // Nuevas funciones de validación y renderizado
  extractBibKeys,
  validateCitationKeys,
  renderInlineText,
  formatCite,
  validateFigureAccessibility,

  // Constantes
  INLINE_CITE_PATTERN,
};
