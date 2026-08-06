#!/usr/bin/env node
"use strict";

/**
 * visual-linter.js — Valida los nodos figure de un guide.json contra figure/manifest.json
 *
 * Para cada nodo `figure` en sections, comprueba:
 *   - alt y caption no vacíos (accesibilidad)
 *   - src o visualSpec declarados (imagen o spec dinámica)
 *   - entrada en manifest.json con inspection.valid === true
 *   - dataTable para figuras cuantitativas
 *   - longDescription y readingOrder para figuras complejas
 *   - sourceAttribution y license cuando provenance es externo
 *
 * También detecta entradas en el manifiesto que ninguna figura de la guía usa.
 *
 * Uso CLI:
 *   node scripts/visual-linter.js guide.json [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");
const { validate } = require("./schema-validator");

const QUANT_TYPES    = new Set(["chart", "forest-plot", "map"]);
const EXT_PROVENANCE = new Set([
  "adapted_from_source", "reproduced_from_source", "generated_from_verified_data",
  "generated_from_verified_content", "licensed_image", "annotation_on_external_source",
]);

function loadManifest(figureRoot) {
  const manifestPath = path.join(figureRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return { _error: `manifest.json mal formado: ${err.message}`, figures: [] };
  }
}

/**
 * Linta los nodos figure de guide.json contra el manifiesto visual.
 *
 * @param {string} guidePath  - Ruta al guide.json
 * @param {object} [options]
 * @param {boolean} [options.json] - Salida JSON
 * @returns {{ errors: string[], warnings: string[], figureCount: number }}
 */
function lintGuide(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`No existe: ${absolute}`);
  }

  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (err) {
    throw new Error(`JSON inválido en ${absolute}: ${err.message}`);
  }

  const sections    = guide.sections || [];
  const figureRoot  = path.join(path.dirname(absolute), "figure");
  const figures     = sections.filter(s => s.type === "figure");
  const errors      = [];
  const warnings    = [];

  // Sin figuras → nada que validar
  if (figures.length === 0) {
    return { errors, warnings, figureCount: 0, manifestFigures: 0 };
  }

  // Hay figuras pero no hay manifest.json
  const manifest = loadManifest(figureRoot);
  if (manifest === null) {
    errors.push(`La guía tiene ${figures.length} figura(s) pero no existe figure/manifest.json — ejecutar el pipeline visual primero.`);
    return { errors, warnings, figureCount: figures.length, manifestFigures: 0 };
  }

  if (manifest._error) {
    errors.push(manifest._error);
    return { errors, warnings, figureCount: figures.length, manifestFigures: 0 };
  }

  // Validar schema del manifiesto si existe
  const schemaPath = path.resolve(__dirname, "..", "schemas", "visual-manifest.schema.json");
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const schemaErrors = validate(manifest, schema);
    schemaErrors.forEach(e => errors.push(`manifest.json ${e}`));
  }

  const manifestById = new Map((manifest.figures || []).map(e => [e.id, e]));
  const usedIds      = new Set();

  for (let i = 0; i < figures.length; i++) {
    const node   = figures[i];
    const label  = node.id ? `figure "${node.id}"` : `figure [pos ${sections.indexOf(node) + 1}]`;

    // Accesibilidad
    if (!node.alt || node.alt.trim().length < 12) {
      errors.push(`${label}: 'alt' ausente o demasiado corto (mínimo 12 caracteres).`);
    }
    if (!node.caption || node.caption.trim() === "") {
      errors.push(`${label}: 'caption' ausente o vacío.`);
    }

    // Imagen o spec dinámica
    const hasSrc     = node.src      && node.src.trim() !== "";
    const hasVisSpec = node.visualSpec && node.visualSpec.trim() !== "";
    if (!hasSrc && !hasVisSpec) {
      errors.push(`${label}: debe declarar 'src' (imagen ya renderizada) o 'visualSpec' (spec dinámica).`);
    }

    // Inferir ID desde src o visualSpec para buscar en el manifiesto
    const inferredId = hasSrc
      ? path.basename(node.src, path.extname(node.src))
      : (hasVisSpec ? path.basename(node.visualSpec, ".json") : null);

    if (inferredId) usedIds.add(inferredId);

    // Validar contra el manifiesto
    if (inferredId && manifestById.has(inferredId)) {
      const entry = manifestById.get(inferredId);

      if (!entry.inspection?.valid) {
        errors.push(`${label} (${inferredId}): la inspección en el manifiesto no es válida o está ausente — re-ejecutar el pipeline visual.`);
      }
      if (!entry.rendered) {
        errors.push(`${label} (${inferredId}): 'rendered' no declarado en el manifiesto.`);
      }
      if (entry.rendered && !fs.existsSync(path.join(figureRoot, entry.rendered))) {
        errors.push(`${label} (${inferredId}): el archivo renderizado no existe en figure/${entry.rendered}.`);
      }
      if (QUANT_TYPES.has(entry.representation) && !entry.dataTable) {
        errors.push(`${label} (${inferredId}): figura cuantitativa (${entry.representation}) sin 'dataTable'.`);
      }
      if (entry.complexity === "high" && !entry.longDescription) {
        warnings.push(`${label} (${inferredId}): figura compleja sin 'longDescription'.`);
      }
      if (entry.complexity === "high" && (!entry.readingOrder || entry.readingOrder.length === 0)) {
        warnings.push(`${label} (${inferredId}): figura compleja sin 'readingOrder'.`);
      }
      if (EXT_PROVENANCE.has(entry.provenance)) {
        if (!entry.sourceAttribution) errors.push(`${label} (${inferredId}): procedencia externa sin 'sourceAttribution'.`);
        if (!entry.license)           errors.push(`${label} (${inferredId}): procedencia externa sin 'license'.`);
      }
    } else if (inferredId && !hasVisSpec) {
      // Figura en la guía pero no registrada en el manifiesto (y no es spec dinámica)
      warnings.push(`${label} (${inferredId}): no está registrada en figure/manifest.json — ejecutar el pipeline visual.`);
    }
  }

  // Detectar entradas del manifiesto que ningún nodo figure referencia
  for (const entry of manifest.figures || []) {
    if (!usedIds.has(entry.id)) {
      warnings.push(`manifest.json: entrada "${entry.id}" no está referenciada por ningún nodo figure en la guía — posible figura huérfana.`);
    }
  }

  return {
    errors,
    warnings,
    figureCount:     figures.length,
    manifestFigures: (manifest.figures || []).length,
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const guidePath = args.find(a => !a.startsWith("--"));
  const asJson    = args.includes("--json");

  if (!guidePath) {
    console.error("Uso: node scripts/visual-linter.js guide.json [--json]");
    process.exit(1);
  }

  try {
    const result = lintGuide(guidePath, { json: asJson });

    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.errors.length > 0 ? 1 : 0);
    }

    const { errors, warnings, figureCount, manifestFigures } = result;

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`OK: ${figureCount} figura(s) cumplen el contrato visual (${manifestFigures} en manifiesto).`);
      process.exit(0);
    }

    errors.forEach(e => console.error(`[ERROR] ${e}`));
    warnings.forEach(w => console.warn(`[WARNING] ${w}`));

    if (errors.length > 0) process.exit(1);
  } catch (err) {
    console.error(`visual-linter: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { lintGuide };
