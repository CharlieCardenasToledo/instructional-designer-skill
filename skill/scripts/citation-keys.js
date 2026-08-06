#!/usr/bin/env node
"use strict";

/**
 * citation-keys.js — Extracción recursiva de claves bibliográficas de guide.json
 *
 * Función compartida entre guide-renderer, content-linter y behavior-runner
 * para garantizar que todos los subsistemas operen sobre el mismo conjunto
 * de claves citadas.
 *
 * Fuentes reconocidas:
 *   - Nodos `citation` (compatibilidad hacia atrás, deprecated)
 *   - Sintaxis inline {{cite:clave}} y {{cite:clave|mode}} en cualquier string
 *   - Arrays de content (recursivo)
 *   - assessment.items (cada ítem puede contener {{cite:}})
 */

const CITE_INLINE = /\{\{cite:([^|}}\s]+)/g;

/**
 * Extrae claves bibliográficas inline de un string.
 * @param {string} text
 * @returns {string[]}
 */
function extractInlineKeys(text) {
  if (typeof text !== "string") return [];
  const keys = [];
  let m;
  const re = new RegExp(CITE_INLINE.source, "g");
  while ((m = re.exec(text)) !== null) keys.push(m[1].trim());
  return keys;
}

/**
 * Extrae claves de un campo content (string, array recursivo o null).
 * @param {*} content
 * @returns {string[]}
 */
function collectFromContent(content) {
  if (!content) return [];
  if (typeof content === "string") return extractInlineKeys(content);
  if (Array.isArray(content)) return content.flatMap(item => collectFromContent(item));
  return [];
}

/**
 * Recorre todas las secciones de guide.json y devuelve las claves únicas citadas.
 *
 * Incluye:
 *   - Nodos `citation` con campo `keys[]` (compatibilidad con compat period)
 *   - Sintaxis inline {{cite:clave}} en `content` de cualquier nodo
 *   - Items de nodos `assessment`
 *
 * @param {{ sections?: object[] }} guide
 * @returns {string[]} Claves únicas, deduplicadas, en orden de primera aparición
 */
function collectCitationKeys(guide) {
  const sections = guide.sections || [];
  const seen     = new Set();
  const keys     = [];

  function add(key) {
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  for (const section of sections) {
    // nodo citation (deprecated pero con periodo de compatibilidad)
    if (section.type === "citation" && Array.isArray(section.keys)) {
      section.keys.forEach(add);
    }
    // inline en content
    collectFromContent(section.content).forEach(add);
    // inline en items de assessment
    if (Array.isArray(section.items)) {
      section.items.forEach(item => collectFromContent(item).forEach(add));
    }
  }

  return keys;
}

module.exports = { collectCitationKeys, extractInlineKeys, collectFromContent };
