#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { comparePng } = require("./png-compare");

function hashes(manifest) {
  return Object.fromEntries((manifest.figures || [])
    .filter(figure => figure.inspection?.valid && figure.inspection.sha256)
    .map(figure => [figure.id, figure.inspection.sha256]));
}

function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.error("Uso: node scripts/visual-regression.js figure/manifest.json [--update]");
    process.exit(1);
  }
  const manifestPath = path.resolve(manifestArg);
  const root = path.dirname(manifestPath);
  const baselinePath = path.join(root, "visual-baseline.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const current = hashes(manifest);
  const modeIndex = process.argv.indexOf("--mode");
  const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "exact";
  const thresholdIndex = process.argv.indexOf("--threshold");
  const threshold = thresholdIndex >= 0 ? Number(process.argv[thresholdIndex + 1]) : 0.01;
  if (!["exact", "perceptual"].includes(mode)) {
    console.error("--mode debe ser exact o perceptual");
    process.exit(1);
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    console.error("--threshold debe estar entre 0 y 1");
    process.exit(1);
  }
  if (process.argv.includes("--update")) {
    const baselineDir = path.join(root, "baseline");
    fs.mkdirSync(baselineDir, { recursive: true });
    const images = {};
    for (const figure of manifest.figures || []) {
      if (!figure.preview) continue;
      const source = path.resolve(root, figure.preview);
      if (!fs.existsSync(source)) continue;
      const target = path.join(baselineDir, `${figure.id}.png`);
      fs.copyFileSync(source, target);
      images[figure.id] = path.relative(root, target).replace(/\\/g, "/");
    }
    fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 2, hashes: current, images }, null, 2)}\n`);
    console.log(`Baseline actualizada: ${baselinePath}`);
    return;
  }
  if (!fs.existsSync(baselinePath)) {
    console.error("No existe visual-baseline.json. Revise las figuras y ejecute de nuevo con --update.");
    process.exit(1);
  }
  const baselineDocument = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const baseline = baselineDocument.hashes || {};
  const changes = [];
  for (const id of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (!(id in baseline)) changes.push(`${id}: figura nueva`);
    else if (!(id in current)) changes.push(`${id}: figura ausente`);
    else if (baseline[id] !== current[id]) {
      if (mode === "perceptual") {
        const figure = (manifest.figures || []).find(item => item.id === id);
        const expected = baselineDocument.images?.[id];
        if (!figure?.preview || !expected) {
          changes.push(`${id}: salida modificada y no hay previews comparables`);
          continue;
        }
        const diffsDir = path.join(root, "diffs");
        fs.mkdirSync(diffsDir, { recursive: true });
        const comparison = comparePng(
          path.resolve(root, figure.preview),
          path.resolve(root, expected),
          path.join(diffsDir, `${id}.png`)
        );
        if (!comparison.comparable || comparison.differenceRatio > threshold || comparison.hashDistance > 8) {
          changes.push(`${id}: diferencia perceptual ${(comparison.differenceRatio * 100).toFixed(2)}%, hash ${comparison.hashDistance}/64`);
        }
      } else {
        changes.push(`${id}: salida modificada`);
      }
    }
  }
  if (changes.length) {
    changes.forEach(change => console.error(`[CAMBIO] ${change}`));
    process.exit(1);
  }
  console.log(`OK: ${Object.keys(current).length} figura(s) coinciden con el baseline (${mode}).`);
}

if (require.main === module) main();
module.exports = { hashes };
