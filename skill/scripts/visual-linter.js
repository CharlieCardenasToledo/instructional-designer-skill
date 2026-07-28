#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { validate } = require("./schema-validator");
const { contrastRatio, inspectSource } = require("./visual-quality");

const main = process.argv[2];
if (!main) {
  console.error("Uso: node scripts/visual-linter.js <guia.tex>");
  process.exit(1);
}
const root = path.dirname(path.resolve(main));
const figureRoot = path.join(root, "figure");
const manifestPath = path.join(figureRoot, "manifest.json");
const files = [path.resolve(main)];
const mainText = fs.readFileSync(files[0], "utf8");
for (const match of mainText.matchAll(/\\input\{([^}]+)\}/g)) {
  const file = path.join(root, match[1].endsWith(".tex") ? match[1] : `${match[1]}.tex`);
  if (fs.existsSync(file)) files.push(file);
}
const combined = files.map(file => fs.readFileSync(file, "utf8")).join("\n");
const errors = [];
if (/\\begin\{figure\*?\}|\\begin\{table\*?\}|\\caption\s*\{/.test(combined)) {
  errors.push("usa guidefigure/guidetable; hay flotantes o captions directos");
}
const figures = [...combined.matchAll(/\\begin\{guidefigure\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{guidefigure\}/g)];
if (figures.length && !fs.existsSync(manifestPath)) errors.push("falta figure/manifest.json");
let manifest = { figures: [] };
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "schemas", "visual-manifest.schema.json"), "utf8"));
  errors.push(...validate(manifest, schema).map(error => `manifest.json ${error}`));
}
for (const match of figures) {
  const label = match[1].match(/\\guidefigurecaption\{[\s\S]*?\}\{fig:([^}]+)\}/);
  if (!label) {
    errors.push("guidefigure sin guidefigurecaption");
    continue;
  }
  const id = `fig-${label[1].replace(/_/g, "-")}`;
  const entry = manifest.figures.find(item => item.id === id);
  if (!entry) errors.push(`${id} no aparece en manifest.json`);
  else {
    if (!entry.altText || entry.altText.trim().length < 12) errors.push(`${id} no tiene altText suficiente`);
    if (!entry.rendered) errors.push(`${id} no declara archivo renderizado`);
    if (["chart", "forest-plot", "map"].includes(entry.representation) && !entry.dataTable) {
      errors.push(`${id} es cuantitativa y no declara dataTable`);
    }
    if (entry.complexity === "high" && !entry.longDescription) errors.push(`${id} es compleja y no tiene longDescription`);
    if (entry.complexity === "high" && (!entry.readingOrder || entry.readingOrder.length === 0)) {
      errors.push(`${id} es compleja y no declara readingOrder`);
    }
    if (["chart", "forest-plot", "map"].includes(entry.representation) && !entry.provenance) {
      errors.push(`${id} es cuantitativa y no declara provenance`);
    }
    if (entry.provenance && entry.provenance !== "original") {
      if (!entry.sourceAttribution) errors.push(`${id} no declara sourceAttribution`);
      if (!entry.license) errors.push(`${id} no declara licencia`);
    }
    if (entry.palette) {
      const ratio = contrastRatio(entry.palette.foreground, entry.palette.background);
      if (ratio < 4.5) errors.push(`${id} tiene contraste ${ratio.toFixed(2)}:1; se requiere al menos 4.5:1`);
      for (const color of entry.palette.series || []) {
        const seriesRatio = contrastRatio(color, entry.palette.background);
        if (seriesRatio < 3) errors.push(`${id} tiene una serie con contraste ${seriesRatio.toFixed(2)}:1; se requiere al menos 3:1`);
      }
    }
    const quality = inspectSource(path.resolve(figureRoot, entry.source), entry.engine);
    errors.push(...quality.errors.map(error => `${id}: ${error}`));
    quality.warnings.forEach(warning => console.warn(`[WARNING] ${id}: ${warning}`));
  }
}
if (errors.length) {
  errors.forEach(error => console.error(`[ERROR] ${error}`));
  process.exit(1);
}
console.log(`OK: ${figures.length} figura(s) cumplen el contrato visual.`);
