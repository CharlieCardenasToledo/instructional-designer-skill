#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

function signature(format) {
  if (format === "pdf") return buffer => buffer.subarray(0, 5).toString() === "%PDF-";
  if (format === "png") return buffer => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (format === "svg") return buffer => /<svg[\s>]/i.test(buffer.toString("utf8", 0, Math.min(buffer.length, 4096)));
  return () => false;
}

function inspectFile(file) {
  if (!fs.existsSync(file)) return { valid: false, error: "archivo inexistente" };
  const stat = fs.statSync(file);
  if (stat.size === 0) return { valid: false, error: "archivo vacío" };
  const format = path.extname(file).slice(1).toLowerCase();
  if (!signature(format)(fs.readFileSync(file))) return { valid: false, error: `firma ${format} inválida` };
  const result = {
    valid: true,
    bytes: stat.size,
    format,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
  };
  if (format === "pdf") {
    const info = spawnSync("pdfinfo", [file], { encoding: "utf8", shell: false });
    const page = info.status === 0 && info.stdout.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
    if (page) result.dimensions = { width: Number(page[1]), height: Number(page[2]), unit: "pt" };
  }
  if (format === "png") {
    const buffer = fs.readFileSync(file);
    result.dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), unit: "px" };
  }
  return result;
}

function createPreview(rendered, preview) {
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  const format = path.extname(rendered).slice(1).toLowerCase();
  if (format === "png") {
    fs.copyFileSync(rendered, preview);
    return fs.existsSync(preview);
  }
  if (format === "pdf") {
    const prefix = preview.replace(/\.png$/i, "");
    const result = spawnSync("pdftoppm", ["-f", "1", "-singlefile", "-r", "144", "-png", rendered, prefix], { encoding: "utf8", shell: false });
    return result.status === 0 && fs.existsSync(preview);
  }
  if (format === "svg") {
    const result = spawnSync("inkscape", [rendered, "--export-type=png", `--export-filename=${preview}`], { encoding: "utf8", shell: false });
    return result.status === 0 && fs.existsSync(preview);
  }
  return false;
}

function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.error("Uso: node scripts/visual-inspector.js figure/manifest.json");
    process.exit(1);
  }
  const manifestPath = path.resolve(manifestArg);
  const root = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let failed = false;
  for (const figure of manifest.figures || []) {
    if (figure.status === "planned") continue;
    const inspection = inspectFile(path.resolve(root, figure.rendered));
    figure.inspection = inspection;
    if (!inspection.valid) {
      figure.status = "failed";
      failed = true;
    } else {
      const preview = figure.preview || `previews/${figure.id}.png`;
      if (createPreview(path.resolve(root, figure.rendered), path.resolve(root, preview))) {
        figure.preview = preview.replace(/\\/g, "/");
      } else {
        figure.preview = null;
        figure.inspection.previewWarning = "No hay convertidor disponible para crear la previsualización.";
      }
    }
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
  if (failed) process.exit(1);
}

if (require.main === module) main();
module.exports = { inspectFile };
