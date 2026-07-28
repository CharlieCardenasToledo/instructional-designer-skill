#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function expandProgressive(spec) {
  const stages = spec.model?.stages;
  if (!Array.isArray(stages) || stages.length < 2) {
    throw new Error("Una figura progresiva requiere al menos dos model.stages.");
  }
  const nodes = spec.model.nodes || [];
  const known = new Set(nodes.map(node => node.id));
  const visible = new Set();
  return stages.map((stage, index) => {
    for (const id of stage.nodeIds) {
      if (!known.has(id)) throw new Error(`La etapa ${stage.id} referencia el nodo inexistente ${id}.`);
      visible.add(id);
    }
    const model = {
      ...spec.model,
      nodes: nodes.filter(node => visible.has(node.id)),
      edges: (spec.model.edges || []).filter(edge => visible.has(edge.from) && visible.has(edge.to))
    };
    delete model.stages;
    return {
      ...spec,
      id: `${spec.id}-${String(index + 1).padStart(2, "0")}-${stage.id}`,
      title: spec.title ? `${spec.title} — ${stage.label}` : stage.label,
      caption: spec.caption ? `${spec.caption} Etapa ${index + 1}: ${stage.label}.` : `Etapa ${index + 1}: ${stage.label}.`,
      altText: `${spec.altText} Etapa ${index + 1}: ${stage.label}.`,
      model
    };
  });
}

function main() {
  const index = process.argv.indexOf("--spec");
  if (index < 0 || !process.argv[index + 1]) {
    console.error("Uso: node scripts/visual-progressive.js --spec figure/specs/fig-id.json [--render] [--dry-run]");
    process.exit(1);
  }
  const sourcePath = path.resolve(process.argv[index + 1]);
  const spec = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  let expanded;
  try {
    expanded = expandProgressive(spec);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  const written = [];
  for (const stage of expanded) {
    const target = path.join(path.dirname(sourcePath), `${stage.id}.json`);
    fs.writeFileSync(target, `${JSON.stringify(stage, null, 2)}\n`);
    written.push(target);
    if (process.argv.includes("--render")) {
      const args = [path.resolve(__dirname, "visual-renderer.js"), "--spec", target];
      if (process.argv.includes("--dry-run")) args.push("--dry-run");
      const result = spawnSync(process.execPath, args, { encoding: "utf8", shell: false });
      if (result.status !== 0) {
        console.error(result.stderr);
        process.exit(result.status || 1);
      }
    }
  }
  console.log(JSON.stringify({ stages: written }, null, 2));
}

if (require.main === module) main();
module.exports = { expandProgressive };
