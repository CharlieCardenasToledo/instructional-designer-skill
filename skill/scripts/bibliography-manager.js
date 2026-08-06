#!/usr/bin/env node
"use strict";

/**
 * bibliography-manager.js — Integración Citation.js para Jintia
 *
 * Lee archivos .bib (BibTeX/BibLaTeX), resuelve claves y genera
 * HTML de citas inline y secciones de bibliografía en APA u otros estilos CSL.
 *
 * Requiere (instalados en skill/node_modules o globalmente):
 *   @citation-js/core
 *   @citation-js/plugin-bibtex
 *   @citation-js/plugin-csl
 *
 * Si Citation.js no está disponible, el módulo opera en modo degradado:
 * las citas se muestran como claves entre corchetes y la bibliografía
 * lista las claves sin formatear.
 */

const fs   = require("node:fs");
const path = require("node:path");

function escHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Carga opcional de Citation.js ───────────────────────────────────────────

let Cite       = null;
let citationJs = false;

try {
  Cite = require("@citation-js/core").Cite;
  require("@citation-js/plugin-bibtex");
  require("@citation-js/plugin-csl");
  citationJs = true;
} catch {
  // No disponible; operar en modo degradado
}

// ─── Cache de bibliografías cargadas ─────────────────────────────────────────

const cache = new Map();

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Carga y parsea un archivo .bib.
 * @param {string} bibPath - Ruta al archivo .bib
 * @returns {{ entries: object[], raw: string, available: boolean }}
 */
function loadBibliography(bibPath) {
  const absolute = path.resolve(bibPath);

  if (cache.has(absolute)) return cache.get(absolute);

  if (!fs.existsSync(absolute)) {
    const result = { entries: [], raw: "", available: false, path: absolute };
    cache.set(absolute, result);
    return result;
  }

  const raw = fs.readFileSync(absolute, "utf8");

  if (!citationJs) {
    // Modo degradado: extraer claves manualmente con regex
    const keyPattern = /@\w+\s*\{\s*([^,\s]+)/g;
    const keys = [];
    let match;
    while ((match = keyPattern.exec(raw)) !== null) keys.push(match[1]);
    const result = { entries: [], keys, raw, available: false, path: absolute };
    cache.set(absolute, result);
    return result;
  }

  try {
    const cite    = new Cite(raw, { forceType: "@bibtex/text" });
    const entries = cite.data;
    const result  = { entries, cite, raw, available: true, path: absolute };
    cache.set(absolute, result);
    return result;
  } catch (err) {
    console.warn(`[bibliography-manager] No se pudo parsear ${absolute}: ${err.message}`);
    const result = { entries: [], raw, available: false, path: absolute };
    cache.set(absolute, result);
    return result;
  }
}

/**
 * Comprueba si una clave existe en la bibliografía cargada.
 * @param {string} key
 * @param {{ keys?: string[], entries?: object[] }} bib
 * @returns {boolean}
 */
function keyExists(key, bib) {
  if (bib.keys) return bib.keys.includes(key);
  if (bib.entries) return bib.entries.some(e => e.id === key);
  return false;
}

/**
 * Genera HTML de una cita inline.
 * @param {string[]} keys - Claves bibliográficas
 * @param {"narrative"|"parenthetical"} mode
 * @param {object} bib - Bibliografía cargada con loadBibliography()
 * @param {string} [style="apa"] - Estilo CSL
 * @returns {string} HTML de la cita
 */
function renderCitation(keys, mode, bib, style = "apa") {
  if (!Array.isArray(keys) || keys.length === 0) return "";

  const safeKeys = escHtml(keys.join(","));

  if (!citationJs || !bib.available) {
    // Modo degradado — claves escapadas
    const formatted = escHtml(keys.join("; "));
    return mode === "narrative"
      ? `<cite class="jintia-citation" data-keys="${safeKeys}">${formatted}</cite>`
      : `<cite class="jintia-citation" data-keys="${safeKeys}">(${formatted})</cite>`;
  }

  try {
    // Modo narrativo: "Apellido (año)" — construido desde CSL-JSON, escapado
    if (mode === "narrative") {
      const entry = bib.entries.find(e => e.id === keys[0]);
      if (entry) {
        const author = entry.author?.[0]?.family
          || entry.author?.[0]?.literal
          || keys[0];
        const year = entry.issued?.["date-parts"]?.[0]?.[0]
          ?? entry.issued?.literal
          ?? "";
        const yearStr = year ? ` (${escHtml(String(year))})` : "";
        return `<cite class="jintia-citation jintia-citation--narrative" data-keys="${safeKeys}">${escHtml(String(author))}${yearStr}</cite>`;
      }
    }

    // Modo parentético: Citation.js genera el HTML; su salida ya está sanitizada por CSL
    const subset = new Cite(bib.entries.filter(e => keys.includes(e.id)));
    const text = subset.format("citation", {
      format:   "html",
      template: style,
      lang:     "es-ES",
    });
    return `<cite class="jintia-citation" data-keys="${safeKeys}">${text}</cite>`;
  } catch (err) {
    console.warn(`[bibliography-manager] Error al formatear cita ${keys}: ${err.message}`);
    return `<cite class="jintia-citation" data-keys="${safeKeys}">[${escHtml(keys.join("; "))}]</cite>`;
  }
}

/**
 * Genera HTML de una sección de bibliografía completa.
 * @param {string[]|null} keys - Claves a incluir (null = todas)
 * @param {object} bib - Bibliografía cargada
 * @param {string} [style="apa"]
 * @returns {string[]} Array de strings HTML (una por entrada)
 */
function renderBibliographyEntries(keys, bib, style = "apa") {
  if (!citationJs || !bib.available) {
    // Modo degradado: listar claves
    const allKeys = keys || bib.keys || [];
    return allKeys.map(k => `<span class="bib-key">[${k}]</span> (bibliografía no disponible — instalar @citation-js/core)`);
  }

  try {
    const entries = keys
      ? bib.entries.filter(e => keys.includes(e.id))
      : bib.entries;

    if (entries.length === 0) return [];

    const cite = new Cite(entries);
    const html = cite.format("bibliography", {
      format:   "html",
      template: style,
      lang:     "es-ES",
    });

    // Citation.js devuelve un bloque HTML; dividir por <div> de entrada
    return html
      .split(/<div[^>]*>/)
      .slice(1)
      .map(chunk => chunk.replace(/<\/div>.*/, "").trim())
      .filter(Boolean);
  } catch (err) {
    console.warn(`[bibliography-manager] Error al formatear bibliografía: ${err.message}`);
    return (keys || []).map(k => `[${k}]`);
  }
}

// ─── CLI diagnóstico ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args    = process.argv.slice(2);
  const bibPath = args.find(a => !a.startsWith("--")) || "reference.bib";

  if (!bibPath) {
    console.error("Uso: node scripts/bibliography-manager.js reference.bib [--key autor2024]");
    process.exit(2);
  }

  const bib  = loadBibliography(bibPath);
  const key  = args.find((a, i) => args[i - 1] === "--key");
  const mode = args.includes("--narrative") ? "narrative" : "parenthetical";

  if (!bib.available && !citationJs) {
    console.log("⚠ Citation.js no está instalado. Operando en modo degradado.");
    console.log("  Instalar: npm install @citation-js/core @citation-js/plugin-bibtex @citation-js/plugin-csl");
  }

  if (key) {
    const exists = keyExists(key, bib);
    console.log(`Clave "${key}": ${exists ? "✓ encontrada" : "✗ no encontrada"}`);
    if (exists) {
      const html = renderCitation([key], mode, bib);
      console.log("Cita HTML:", html);
    }
  } else {
    const count = bib.entries?.length || bib.keys?.length || 0;
    console.log(`Bibliografía: ${bib.path}`);
    console.log(`Entradas: ${count}`);
    console.log(`Citation.js: ${citationJs ? "✓ disponible" : "✗ no instalado (modo degradado)"}`);
  }
}

module.exports = {
  loadBibliography,
  keyExists,
  renderCitation,
  renderBibliographyEntries,
  isCitationJsAvailable: () => citationJs,
};
