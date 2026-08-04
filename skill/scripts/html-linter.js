#!/usr/bin/env node
"use strict";

/**
 * html-linter.js — Validador DOM del HTML generado por guide-renderer.js
 *
 * Analiza el HTML estáticamente (sin navegador) para verificar accesibilidad,
 * clases jintia-*, atributos data-pagination, referencias cruzadas y tablas.
 *
 * Usa node-html-parser cuando está disponible; si no, opera con regex como fallback.
 *
 * Uso:
 *   node scripts/html-linter.js guide.html [--strict] [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Carga opcional de node-html-parser ──────────────────────────────────────

let parse     = null;
let parserAvailable = false;

try {
  ({ parse } = require("node-html-parser"));
  parserAvailable = true;
} catch {
  // Modo fallback: regex
}

// ─── Catálogo de reglas DOM ───────────────────────────────────────────────────

const RULES = {
  "JIN-HTM-001": {
    id: "JIN-HTM-001", category: "accessibility", severity: "error",
    description: "Todo <img> debe tener atributo alt no vacío.",
  },
  "JIN-HTM-002": {
    id: "JIN-HTM-002", category: "pagination", severity: "warning",
    description: "Todo bloque pedagógico debe tener atributo data-pagination.",
  },
  "JIN-HTM-003": {
    id: "JIN-HTM-003", category: "accessibility", severity: "warning",
    description: "Las tablas deben tener <caption> y <thead>.",
  },
  "JIN-HTM-004": {
    id: "JIN-HTM-004", category: "structure", severity: "warning",
    description: "Cada documento debe tener exactamente un <h1>.",
  },
  "JIN-HTM-005": {
    id: "JIN-HTM-005", category: "structure", severity: "warning",
    description: "Las referencias cruzadas (href=#id) deben apuntar a IDs existentes.",
  },
  "JIN-HTM-006": {
    id: "JIN-HTM-006", category: "structure", severity: "error",
    description: "El documento debe tener <html lang>, <title> y <meta charset>.",
  },
  "JIN-HTM-007": {
    id: "JIN-HTM-007", category: "accessibility", severity: "warning",
    description: "Las figuras deben tener <figcaption> junto a <img>.",
  },
  "JIN-HTM-008": {
    id: "JIN-HTM-008", category: "structure", severity: "warning",
    description: "El documento debe contener un elemento <main> con role=main.",
  },
};

// ─── Linter con node-html-parser ─────────────────────────────────────────────

function lintWithParser(source, absolute) {
  const issues  = [];
  const root    = parse(source, { comment: false });

  function issue(ruleId, message) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute });
  }

  // JIN-HTM-006: metadata mínima
  const htmlEl    = root.querySelector("html");
  const titleEl   = root.querySelector("title");
  const charsetEl = root.querySelector("meta[charset]");
  if (!htmlEl?.getAttribute("lang") || !titleEl?.text.trim() || !charsetEl) {
    issue("JIN-HTM-006", "Faltan elementos de metadata: <html lang>, <title> o <meta charset>.");
  }

  // JIN-HTM-004: exactamente un <h1>
  const h1s = root.querySelectorAll("h1");
  if (h1s.length !== 1) {
    issue("JIN-HTM-004", `Se encontraron ${h1s.length} elementos <h1>; se esperaba exactamente 1.`);
  }

  // JIN-HTM-008: <main>
  const mainEl = root.querySelector("main");
  if (!mainEl) {
    issue("JIN-HTM-008", "No se encontró elemento <main>.");
  }

  // JIN-HTM-001: imágenes con alt
  for (const img of root.querySelectorAll("img")) {
    const alt = img.getAttribute("alt");
    if (alt === null || alt.trim() === "") {
      issue("JIN-HTM-001", `<img> sin atributo alt (src="${img.getAttribute("src") || ""}").`);
    }
  }

  // JIN-HTM-007: figuras con figcaption
  for (const fig of root.querySelectorAll("figure")) {
    if (!fig.querySelector("figcaption")) {
      issue("JIN-HTM-007", "<figure> sin <figcaption>.");
    }
  }

  // JIN-HTM-002: bloques pedagógicos con data-pagination
  const blockSelectors = [
    ".jintia-orientation", ".jintia-theory", ".jintia-concept",
    ".jintia-practice",    ".jintia-warning", ".jintia-critical-error",
    ".jintia-scenario",    ".jintia-assessment",
  ];
  for (const sel of blockSelectors) {
    for (const el of root.querySelectorAll(sel)) {
      if (!el.getAttribute("data-pagination")) {
        issue("JIN-HTM-002", `Bloque ${sel} sin atributo data-pagination.`);
      }
    }
  }

  // JIN-HTM-003: tablas con caption y thead
  for (const table of root.querySelectorAll("table")) {
    const hasCaption = !!table.querySelector("caption");
    const hasThead   = !!table.querySelector("thead");
    if (!hasCaption) issue("JIN-HTM-003", "<table> sin <caption>.");
    if (!hasThead)   issue("JIN-HTM-003", "<table> sin <thead>.");
  }

  // JIN-HTM-005: referencias cruzadas internas apuntan a IDs existentes
  const allIds = new Set(
    [...root.querySelectorAll("[id]")].map(el => el.getAttribute("id"))
  );
  for (const anchor of root.querySelectorAll("a[href^='#']")) {
    const href   = anchor.getAttribute("href") || "";
    const target = href.slice(1);
    if (target && !allIds.has(target)) {
      issue("JIN-HTM-005", `Referencia cruzada "#${target}" no apunta a ningún ID existente.`);
    }
  }

  return issues;
}

// ─── Fallback con regex (sin node-html-parser) ───────────────────────────────

function lintWithRegex(source, absolute) {
  const issues = [];

  function issue(ruleId, message) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute });
  }

  // JIN-HTM-006
  if (!/<html[^>]+lang=/i.test(source) || !/<title>[^<]+<\/title>/i.test(source) || !/<meta[^>]+charset/i.test(source)) {
    issue("JIN-HTM-006", "Faltan elementos de metadata: <html lang>, <title> o <meta charset>.");
  }

  // JIN-HTM-004
  const h1Count = (source.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) issue("JIN-HTM-004", `Se encontraron ${h1Count} elementos <h1>; se esperaba exactamente 1.`);

  // JIN-HTM-008
  if (!/<main\b/i.test(source)) issue("JIN-HTM-008", "No se encontró elemento <main>.");

  // JIN-HTM-001: imágenes sin alt
  const imgPattern = /<img\b([^>]*)>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(source)) !== null) {
    const attrs = imgMatch[1];
    if (!(/alt=["'][^"']+["']/i.test(attrs))) {
      issue("JIN-HTM-001", `<img> sin atributo alt.`);
    }
  }

  // JIN-HTM-007: figure sin figcaption
  const figBlocks = source.match(/<figure[\s\S]*?<\/figure>/gi) || [];
  for (const fig of figBlocks) {
    if (!/<figcaption/i.test(fig)) issue("JIN-HTM-007", "<figure> sin <figcaption>.");
  }

  // JIN-HTM-002: bloques sin data-pagination
  const blockPattern = /class="[^"]*jintia-(?:orientation|theory|concept|practice|warning|critical-error|scenario|assessment)[^"]*"/gi;
  const paginationPattern = /data-pagination=/i;
  const blockTags = source.match(/<(?:aside|section)[^>]+class="[^"]*jintia-[^"]*"[^>]*>/gi) || [];
  for (const tag of blockTags) {
    if (!paginationPattern.test(tag)) {
      issue("JIN-HTM-002", `Bloque pedagógico sin data-pagination: ${tag.slice(0, 80)}...`);
    }
  }

  void blockPattern; // used via blockTags extraction above

  return issues;
}

// ─── Runner principal ─────────────────────────────────────────────────────────

function lintHtml(htmlPath) {
  const absolute = path.resolve(htmlPath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Archivo HTML no encontrado: ${absolute}`);
  }

  const source = fs.readFileSync(absolute, "utf8");
  const issues = parserAvailable
    ? lintWithParser(source, absolute)
    : lintWithRegex(source, absolute);

  return {
    tool:    "jintia html-linter",
    version: "1.0.0",
    parser:  parserAvailable ? "node-html-parser" : "regex-fallback",
    target:  absolute,
    issues,
    summary: {
      errors:   issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      passed:   issues.filter(i => i.severity === "error").length === 0,
    },
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--"));
  const asJson = args.includes("--json");
  const strict = args.includes("--strict");

  if (!target) {
    console.error("Uso: node scripts/html-linter.js guide.html [--strict] [--json]");
    process.exit(2);
  }

  if (!parserAvailable) {
    console.warn("⚠ node-html-parser no instalado — usando modo regex. Para mejor cobertura: npm install node-html-parser");
  }

  try {
    const report = lintHtml(target);

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Jintia HTML Linter · ${report.target} (parser: ${report.parser})`);
      if (!report.issues.length) {
        console.log("✓ No se encontraron incidencias.");
      } else {
        for (const item of report.issues) {
          console.log(`${item.severity === "error" ? "✗" : "⚠"} ${item.rule} · ${item.message}`);
        }
      }
      console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
    }

    const shouldFail = report.summary.errors > 0 || (strict && report.summary.warnings > 0);
    if (shouldFail) process.exitCode = 1;
  } catch (err) {
    console.error(`html-linter: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { lintHtml, RULES };
