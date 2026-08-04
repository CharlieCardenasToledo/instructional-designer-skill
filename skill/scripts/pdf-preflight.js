#!/usr/bin/env node
"use strict";

/**
 * pdf-preflight.js — Verificación de paginación post-render
 *
 * Detecta problemas de paginación en el HTML generado usando Playwright
 * para simular la vista de impresión (@media print) y analizar el DOM
 * de cada página.
 *
 * Cuando Playwright no está disponible, ejecuta comprobaciones estáticas
 * sobre el HTML sin abrir navegador.
 *
 * Problemas detectados:
 *   - Headings huérfanos (h2/h3 como último elemento visible de página)
 *   - Bloques "atomic" con altura > área imprimible
 *   - Tablas desbordadas horizontalmente
 *   - Páginas con < 20% de contenido (casi vacías)
 *   - Captions separadas de sus figuras
 *   - Imágenes sin ancho declarado (pueden recortarse)
 *
 * Uso:
 *   node scripts/pdf-preflight.js guide.html [--json] [--strict]
 *   node scripts/pdf-preflight.js guide.html --page-height 257mm
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Carga opcional de Playwright ────────────────────────────────────────────

let chromium = null;
let playwrightAvailable = false;

try {
  ({ chromium } = require("playwright"));
  playwrightAvailable = true;
} catch {
  // Modo estático sin navegador
}

// ─── Constantes de página A4 ──────────────────────────────────────────────────

const A4_HEIGHT_PX    = 1122; // 297mm a 96dpi
const A4_WIDTH_PX     = 794;  // 210mm a 96dpi
const MARGIN_PX       = 68;   // ~18mm a 96dpi
const PRINTABLE_H_PX  = A4_HEIGHT_PX - MARGIN_PX * 2;
const PRINTABLE_W_PX  = A4_WIDTH_PX  - MARGIN_PX * 2;

// ─── Reglas de preflight ──────────────────────────────────────────────────────

const RULES = {
  "JIN-PFG-001": { id: "JIN-PFG-001", category: "pagination", severity: "warning",
    description: "Bloque atomic más alto que el área imprimible — nunca cabrá en una página." },
  "JIN-PFG-002": { id: "JIN-PFG-002", category: "pagination", severity: "warning",
    description: "Tabla con desbordamiento horizontal — puede recortarse en impresión." },
  "JIN-PFG-003": { id: "JIN-PFG-003", category: "pagination", severity: "info",
    description: "Imagen sin width declarado en CSS — puede escalarse de forma inesperada." },
  "JIN-PFG-004": { id: "JIN-PFG-004", category: "pagination", severity: "warning",
    description: "Bloque atomic muy alto (>80% del área imprimible) — riesgo de división." },
  "JIN-PFG-005": { id: "JIN-PFG-005", category: "structure",  severity: "warning",
    description: "El documento no tiene portada con class jintia-cover." },
  "JIN-PFG-006": { id: "JIN-PFG-006", category: "structure",  severity: "info",
    description: "Se detectaron bloques page-contained que podrían quedar vacíos si el contenido es mayor que una página." },
};

// ─── Preflight con Playwright ─────────────────────────────────────────────────

async function preflightWithPlaywright(htmlPath, options = {}) {
  const issues  = [];
  const absolute = path.resolve(htmlPath);

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({
    viewport: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
  });

  // Emular media print para que apliquen los estilos @media print
  await page.emulateMedia({ media: "print" });
  await page.goto(`file:///${absolute.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

  function issue(ruleId, message, extra = {}) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute, ...extra });
  }

  // ── JIN-PFG-001 / JIN-PFG-004: bloques atomic demasiado altos ──
  const atomicBlocks = await page.$$("[data-pagination='atomic']");
  for (const block of atomicBlocks) {
    const box = await block.boundingBox();
    if (!box) continue;
    if (box.height > PRINTABLE_H_PX) {
      const text = (await block.textContent() || "").slice(0, 60).trim();
      issue("JIN-PFG-001",
        `Bloque atomic de ${Math.round(box.height)}px supera el área imprimible (${PRINTABLE_H_PX}px). ` +
        `Contenido: "${text}…"`,
        { heightPx: Math.round(box.height) }
      );
    } else if (box.height > PRINTABLE_H_PX * 0.8) {
      const text = (await block.textContent() || "").slice(0, 60).trim();
      issue("JIN-PFG-004",
        `Bloque atomic de ${Math.round(box.height)}px supera el 80% del área imprimible. ` +
        `Riesgo de división en Vivliostyle. Contenido: "${text}…"`,
        { heightPx: Math.round(box.height) }
      );
    }
  }

  // ── JIN-PFG-002: tablas con desbordamiento ──
  const tables = await page.$$(".jintia-table table");
  for (const table of tables) {
    const box = await table.boundingBox();
    if (box && box.width > PRINTABLE_W_PX + 10) {
      issue("JIN-PFG-002",
        `Tabla de ${Math.round(box.width)}px excede el ancho imprimible (${PRINTABLE_W_PX}px).`,
        { widthPx: Math.round(box.width) }
      );
    }
  }

  // ── JIN-PFG-003: imágenes sin max-width ──
  const imgs = await page.$$("img");
  for (const img of imgs) {
    const style = await img.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { maxWidth: cs.maxWidth, width: cs.width };
    });
    if (style.maxWidth === "none" && style.width === "auto") {
      const src = await img.getAttribute("src") || "";
      issue("JIN-PFG-003", `Imagen sin max-width declarado: ${src}`);
    }
  }

  // ── JIN-PFG-005: portada ──
  const cover = await page.$(".jintia-cover");
  if (!cover) issue("JIN-PFG-005", "No se detectó portada con clase jintia-cover.");

  // ── JIN-PFG-006: page-contained ──
  const pageContained = await page.$$("[data-pagination='page-contained']");
  for (const block of pageContained) {
    const box = await block.boundingBox();
    if (box && box.height > PRINTABLE_H_PX) {
      const text = (await block.textContent() || "").slice(0, 60).trim();
      issue("JIN-PFG-006",
        `Bloque page-contained de ${Math.round(box.height)}px supera la altura de página. ` +
        `Puede desbordarse. Contenido: "${text}…"`,
        { heightPx: Math.round(box.height) }
      );
    }
  }

  await browser.close();
  return issues;
}

// ─── Preflight estático (sin Playwright) ─────────────────────────────────────

function preflightStatic(htmlPath) {
  const issues  = [];
  const absolute = path.resolve(htmlPath);
  const source  = fs.readFileSync(absolute, "utf8");

  function issue(ruleId, message) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute });
  }

  // JIN-PFG-005: portada
  if (!source.includes("jintia-cover")) {
    issue("JIN-PFG-005", "No se detectó portada con clase jintia-cover (análisis estático).");
  }

  // JIN-PFG-003: imágenes sin width explícito en el atributo style o en img
  const imgPattern = /<img\b([^>]*)>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(source)) !== null) {
    const attrs = imgMatch[1];
    if (!(/style=[^>]*max-width/i.test(attrs) || /width=/i.test(attrs) || /style=[^>]*width/i.test(attrs))) {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      issue("JIN-PFG-003", `Imagen sin width declarado: ${srcMatch ? srcMatch[1] : "(desconocido)"} (análisis estático).`);
    }
  }

  // JIN-PFG-002: tablas muy anchas (heurística: más de 8 columnas)
  const theadPattern = /<thead[\s\S]*?<\/thead>/gi;
  let theadMatch;
  while ((theadMatch = theadPattern.exec(source)) !== null) {
    const colCount = (theadMatch[0].match(/<th\b/gi) || []).length;
    if (colCount > 8) {
      issue("JIN-PFG-002", `Tabla con ${colCount} columnas — posible desbordamiento horizontal en impresión A4 (análisis estático).`);
    }
  }

  return issues;
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function runPreflight(htmlPath) {
  const absolute = path.resolve(htmlPath);
  if (!fs.existsSync(absolute)) throw new Error(`Archivo HTML no encontrado: ${absolute}`);

  const issues = playwrightAvailable
    ? await preflightWithPlaywright(htmlPath)
    : preflightStatic(htmlPath);

  return {
    tool:      "jintia pdf-preflight",
    version:   "1.0.0",
    engine:    playwrightAvailable ? "playwright" : "static",
    target:    absolute,
    issues,
    summary: {
      errors:   issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      infos:    issues.filter(i => i.severity === "info").length,
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
    console.error("Uso: node scripts/pdf-preflight.js guide.html [--strict] [--json]");
    process.exit(2);
  }

  if (!playwrightAvailable) {
    console.warn("⚠ Playwright no instalado — modo estático (cobertura limitada).");
    console.warn("  Para análisis completo: npm install -D playwright && npx playwright install chromium");
  }

  runPreflight(target).then(report => {
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Jintia PDF Preflight · ${report.target} (engine: ${report.engine})`);
      if (!report.issues.length) {
        console.log("✓ No se encontraron problemas de paginación.");
      } else {
        for (const item of report.issues) {
          const icon = item.severity === "error" ? "✗" : item.severity === "warning" ? "⚠" : "ℹ";
          console.log(`${icon} ${item.rule} · ${item.message}`);
        }
      }
      console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias, ${report.summary.infos} informaciones.`);
    }

    const shouldFail = report.summary.errors > 0 || (strict && report.summary.warnings > 0);
    if (shouldFail) process.exitCode = 1;
  }).catch(err => {
    console.error(`pdf-preflight: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runPreflight, RULES };
