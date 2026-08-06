#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function value(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    ...options
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message);
  }
  return result.stdout;
}

function main() {
  const argv = process.argv.slice(2);
  const spec = value(argv, "--spec");
  const template = value(argv, "--template") || "jintia-tecnico";
  const guide = value(argv, "--guide");
  if (!spec) throw new Error("Uso: visual-pipeline.js --spec figure/specs/fig-id.json --template <id> [--guide guide.json]");

  const renderer = path.resolve(__dirname, "visual-renderer.js");
  const rendered = run(process.execPath, [renderer, "--spec", spec, "--template", template]);
  const result = JSON.parse(rendered);
  const figureRoot = path.resolve(path.dirname(path.resolve(spec)), "..");
  const manifest = path.join(figureRoot, "manifest.json");

  run(process.execPath, [path.resolve(__dirname, "visual-inspector.js"), manifest]);
  if (guide) run(process.execPath, [path.resolve(__dirname, "visual-linter.js"), path.resolve(guide)]);

  const inspected = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const entry = inspected.figures.find(item => item.id === result.entry.id);
  if (!entry?.inspection?.valid) throw new Error(`la inspección de ${result.entry.id} no produjo una salida válida`);

  // node: objeto listo para insertar en guide.json sections[]
  const node = result.node || {
    type:       "figure",
    id:         entry.id,
    src:        entry.rendered ? `figure/${entry.rendered.replace(/\\/g, "/")}` : undefined,
    alt:        entry.altText  || "",
    caption:    entry.caption  || entry.altText || "",
    pagination: entry.templatePlacement === "wide" ? "page-contained" : "atomic",
  };

  console.log(JSON.stringify({ entry, node, html: result.html, manifest }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

