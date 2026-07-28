#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { candidatesFor } = require("./visual-selector");
const { detectCapabilities } = require("./visual-capabilities");
const { validate } = require("./schema-validator");
const { generateSource } = require("./visual-source-generator");
const visualSpecSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "schemas", "visual-spec.schema.json"), "utf8"));

const ENGINES = {
  graphviz: { command: "dot", ext: "dot", formats: ["pdf", "svg", "png"], args: (s, o, f) => [`-T${f}`, s, "-o", o] },
  mermaid: { command: "mmdc", ext: "mmd", formats: ["pdf", "svg", "png"], args: (s, o) => ["-i", s, "-o", o, "-b", "transparent"] },
  plantuml: { command: "plantuml", ext: "puml", formats: ["pdf", "svg", "png"], args: (s, o, f) => [`-t${f}`, "-o", path.dirname(o), s] },
  d2: { command: "d2", ext: "d2", formats: ["pdf", "svg", "png"], args: (s, o) => [s, o] },
  "vega-lite": { command: "vl2svg", ext: "vl.json", formats: ["svg"], args: (s) => [s] },
  tikz: { command: "pdflatex", ext: "tex", formats: ["pdf"], args: (s, o) => ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(o)}`, s] },
  circuitikz: { command: "pdflatex", ext: "tex", formats: ["pdf"], args: (s, o) => ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(o)}`, s] },
  chemfig: { command: "pdflatex", ext: "tex", formats: ["pdf"], args: (s, o) => ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(o)}`, s] },
  forest: { command: "pdflatex", ext: "tex", formats: ["pdf"], args: (s, o) => ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(o)}`, s] }
  ,matplotlib: { tool: "python", ext: "py", formats: ["pdf", "svg", "png"], args: s => [s] }
  ,geopandas: { tool: "python", ext: "py", formats: ["pdf", "svg", "png"], args: s => [s] }
  ,rdkit: { tool: "python", ext: "py", formats: ["svg"], args: s => [s] }
  ,html: { tool: "chrome", ext: "html", formats: ["png"], args: (s, o) => [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--disable-features=UseSkiaRenderer,Vulkan",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=3000",
    "--window-size=1200,900",
    `--screenshot=${o}`,
    `file:///${s.replace(/\\/g, "/")}`
  ] }
  ,wavedrom: { tool: "wavedrom", ext: "json", formats: ["svg", "png"], args: (s, o) => ["-i", s, "-s", o] }
};

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readArgs(argv) {
  const value = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    spec: value("--spec"),
    template: value("--template") || "elegantbook-clasico",
    dryRun: argv.includes("--dry-run")
  };
}

function validateSpec(spec) {
  const errors = validate(spec, visualSpecSchema);
  const modelCanCreateTable = (
    Array.isArray(spec.model?.categories)
      && Array.isArray(spec.model?.values)
      && spec.model.categories.length === spec.model.values.length
  ) || Array.isArray(spec.model?.estimates)
    || (spec.model?.geojson?.type === "FeatureCollection" && Array.isArray(spec.model.geojson.features));
  if (["chart", "forest-plot", "map"].includes(spec.representation) && !spec.dataTable && !modelCanCreateTable) {
    errors.push("la visualización cuantitativa requiere dataTable o un model convertible a tabla");
  }
  const html = spec.engine === "html" || spec.representation === "interface";
  if (html && spec.source?.content && /(?:https?:)?\/\//i.test(spec.source.content)) {
    errors.push("HTML debe ser autosuficiente: no se permiten recursos HTTP, HTTPS ni CDN");
  }
  return errors;
}

function ensureInside(root, candidate) {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`ruta fuera de figure/: ${candidate}`);
  return resolved;
}

function updateManifest(figureRoot, entry) {
  const manifestPath = path.join(figureRoot, "manifest.json");
  let manifest = { version: 1, figures: [] };
  if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.figures = (manifest.figures || []).filter(item => item.id !== entry.id);
  manifest.figures.push(entry);
  manifest.figures.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function latexBlock(entry) {
  const width = entry.templatePlacement === "wide" ? "wide" : entry.templatePlacement;
  return [
    `\\begin{guidefigure}[placement=${width || "auto"}]`,
    "\\centering",
    `\\includegraphics[width=\\linewidth]{${entry.rendered.replace(/\\/g, "/")}}`,
    `\\guidefigurecaption{${entry.caption || entry.altText}}{fig:${entry.id.replace(/^fig-/, "")}}`,
    "\\end{guidefigure}"
  ].join("\n");
}

function main() {
  const args = readArgs(process.argv.slice(2));
  if (!args.spec) fail("usa --spec figure/specs/fig-id.json");
  const specPath = path.resolve(args.spec);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const errors = validateSpec(spec);
  if (errors.length) fail(errors.join("; "));
  const figureRoot = path.resolve(path.dirname(specPath), "..");
  const capabilities = detectCapabilities();
  const candidates = candidatesFor(spec);
  const detected = candidates.map(engine => ({
    engine,
    config: ENGINES[engine],
    command: ENGINES[engine]?.tool
      ? capabilities.tools[ENGINES[engine].tool]?.command
      : ENGINES[engine]?.command,
    version: ENGINES[engine]?.tool
      ? capabilities.tools[ENGINES[engine].tool]?.version
      : Object.values(capabilities.tools).find(tool => tool.command && path.basename(tool.command).replace(/\.exe$/i, "") === ENGINES[engine]?.command)?.version || null
  }));
  const choice = args.dryRun
    ? detected.find(item => item.config)
    : detected.find(item => item.config && item.command);
  if (!choice) fail(`ningún motor disponible: ${candidates.join(" -> ")}`);
  const fallback = choice.engine === candidates[0] ? null : { from: candidates[0], to: choice.engine, reason: "motor no disponible" };
  if (fallback && !spec.model) fail(`el fallback ${fallback.from} -> ${fallback.to} requiere model para regenerar una fuente compatible`);
  const format = choice.config.formats.includes(spec.outputFormat) ? spec.outputFormat : choice.config.formats[0];
  const sourceDir = path.join(figureRoot, "sources");
  const dataDir = path.join(figureRoot, "data");
  const renderedDir = path.join(figureRoot, "rendered");
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(renderedDir, { recursive: true });
  let dataTable = spec.dataTable || null;
  if (!dataTable && ["chart", "forest-plot", "map"].includes(spec.representation) && spec.model) {
    const csvCell = value => {
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };
    const tablePath = path.join(dataDir, `${spec.id}.csv`);
    let rows;
    if (spec.representation === "forest-plot") {
      rows = ["label,estimate,lower,upper", ...spec.model.estimates.map(
        item => [item.label, item.estimate, item.lower, item.upper].map(csvCell).join(",")
      )];
    } else if (spec.representation === "map") {
      const field = spec.model.valueField || "value";
      rows = [`name,${csvCell(field)}`, ...spec.model.geojson.features.map(
        feature => [feature.properties?.name || "", feature.properties?.[field] ?? ""].map(csvCell).join(",")
      )];
    } else {
      rows = ["category,value", ...spec.model.categories.map(
        (category, index) => `${csvCell(category)},${csvCell(spec.model.values[index])}`
      )];
    }
    fs.writeFileSync(tablePath, `${rows.join("\n")}\n`);
    dataTable = path.relative(figureRoot, tablePath).replace(/\\/g, "/");
  }
  const generatedContent = spec.model ? generateSource(choice.engine, spec) : null;
  const sourcePath = spec.sourceFile
    ? ensureInside(figureRoot, spec.sourceFile)
    : path.join(sourceDir, `${spec.id}.${choice.config.ext}`);
  if (spec.source?.content || generatedContent) fs.writeFileSync(sourcePath, spec.source?.content || generatedContent);
  const outputPath = path.join(renderedDir, `${spec.id}.${format}`);
  let finalOutputPath = outputPath;
  let status = fallback ? "fallback" : "valid";
  if (!args.dryRun) {
    const commandArgs = choice.config.args(sourcePath, outputPath, format);
    const options = {
      encoding: "utf8",
      shell: false,
      env: { ...process.env, JINTIA_VISUAL_OUTPUT: outputPath, JINTIA_VISUAL_FORMAT: format }
    };
    if (choice.engine === "vega-lite") options.stdio = ["ignore", fs.openSync(outputPath, "w"), "pipe"];
    const result = spawnSync(choice.command, commandArgs, options);
    if (result.error || result.status !== 0) fail(`${choice.engine} falló: ${result.stderr || result.error?.message}`);
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) fail(`no se produjo ${outputPath}`);
    if (format === "svg" && spec.outputFormat !== "svg" && capabilities.tools.inkscape?.available) {
      const pdfPath = path.join(renderedDir, `${spec.id}.pdf`);
      const conversion = spawnSync(
        capabilities.tools.inkscape.command,
        [outputPath, "--export-type=pdf", `--export-filename=${pdfPath}`],
        { encoding: "utf8", shell: false }
      );
      if (conversion.status !== 0 || !fs.existsSync(pdfPath) || fs.statSync(pdfPath).size === 0) {
        fail(`Inkscape no pudo normalizar ${outputPath} a PDF: ${conversion.stderr || "salida ausente"}`);
      }
      finalOutputPath = pdfPath;
    }
  } else {
    status = "planned";
  }
  const relative = value => path.relative(figureRoot, value).replace(/\\/g, "/");
  const entry = {
    id: spec.id,
    engine: choice.engine,
    source: relative(sourcePath),
    rendered: relative(finalOutputPath),
    preview: null,
    templatePlacement: spec.placement || "auto",
    status,
    altText: spec.altText,
    longDescription: spec.longDescription || null,
    representation: spec.representation,
    complexity: spec.complexity || "low",
    dataTable,
    caption: spec.caption,
    sourceAttribution: spec.sourceAttribution || null,
    license: spec.license || null,
    provenance: spec.provenance || null,
    palette: spec.palette || null,
    fallback,
    toolVersion: choice.version
  };
  updateManifest(figureRoot, entry);
  console.log(JSON.stringify({ entry, latex: latexBlock(entry), detected }, null, 2));
}

if (require.main === module) main();

module.exports = { validateSpec, latexBlock };
