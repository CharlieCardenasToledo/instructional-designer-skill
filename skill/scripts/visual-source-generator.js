"use strict";

function quoted(value) {
  return JSON.stringify(String(value));
}

function validateGraph(model) {
  const ids = new Set((model.nodes || []).map(node => node.id));
  if (ids.size !== (model.nodes || []).length) throw new Error("El modelo contiene ids de nodo duplicados.");
  for (const edge of model.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`Arista con nodo inexistente: ${edge.from} -> ${edge.to}`);
  }
}

function graphviz(model) {
  validateGraph(model);
  const direction = model.direction || "TB";
  const lines = ["digraph jintia {", `  rankdir=${direction};`, "  node [shape=box, style=\"rounded,filled\", fillcolor=\"#eef6f5\", color=\"#00796b\"];"];
  for (const node of model.nodes || []) lines.push(`  ${node.id} [label=${quoted(node.label)}];`);
  for (const edge of model.edges || []) lines.push(`  ${edge.from} -> ${edge.to}${edge.label ? ` [label=${quoted(edge.label)}]` : ""};`);
  return `${lines.join("\n")}\n}\n`;
}

function mermaid(model) {
  validateGraph(model);
  const lines = [`flowchart ${model.direction || "TB"}`];
  for (const node of model.nodes || []) lines.push(`  ${node.id}[${quoted(node.label)}]`);
  for (const edge of model.edges || []) lines.push(`  ${edge.from} -->${edge.label ? `|${edge.label}|` : ""} ${edge.to}`);
  return `${lines.join("\n")}\n`;
}

function d2(model) {
  if (Array.isArray(model.events)) {
    const lines = ["direction: right"];
    model.events.forEach((event, index) => {
      const id = `event_${index + 1}`;
      lines.push(`${id}: ${quoted(`${event.date}\\n${event.label}`)}`);
      if (index > 0) lines.push(`event_${index} -> ${id}`);
    });
    return `${lines.join("\n")}\n`;
  }
  validateGraph(model);
  const lines = [`direction: ${(model.direction || "TB").toLowerCase()}`];
  for (const node of model.nodes || []) lines.push(`${node.id}: ${quoted(node.label)}`);
  for (const edge of model.edges || []) lines.push(`${edge.from} -> ${edge.to}${edge.label ? `: ${quoted(edge.label)}` : ""}`);
  return `${lines.join("\n")}\n`;
}

function forestPlot(model, description) {
  if (!Array.isArray(model.estimates) || model.estimates.length === 0) {
    throw new Error("Forest plot requiere model.estimates.");
  }
  for (const item of model.estimates) {
    if (item.lower > item.estimate || item.estimate > item.upper) {
      throw new Error(`Intervalo inválido para ${item.label}.`);
    }
  }
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: model.estimates },
    layer: [
      {
        mark: { type: "rule", strokeWidth: 2 },
        encoding: {
          y: { field: "label", type: "nominal", sort: null, title: null },
          x: { field: "lower", type: "quantitative", title: model.xTitle || "Estimación e intervalo" },
          x2: { field: "upper" }
        }
      },
      {
        mark: { type: "point", filled: true, size: 90 },
        encoding: {
          y: { field: "label", type: "nominal", sort: null },
          x: { field: "estimate", type: "quantitative" },
          tooltip: [
            { field: "label" },
            { field: "estimate", type: "quantitative" },
            { field: "lower", type: "quantitative" },
            { field: "upper", type: "quantitative" }
          ]
        }
      }
    ]
  }, null, 2)}\n`;
}

function geoMap(model, description) {
  if (model.geojson?.type !== "FeatureCollection" || !Array.isArray(model.geojson.features)) {
    throw new Error("Mapa requiere model.geojson como FeatureCollection.");
  }
  const field = model.valueField || "value";
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: model.geojson.features },
    mark: { type: "geoshape", stroke: "#ffffff", strokeWidth: 0.5 },
    projection: { type: "mercator" },
    encoding: {
      color: {
        field: `properties.${field}`,
        type: "quantitative",
        title: field,
        scale: { scheme: "tealblues" }
      },
      tooltip: [
        { field: "properties.name", type: "nominal", title: "Región" },
        { field: `properties.${field}`, type: "quantitative", title: field }
      ]
    }
  }, null, 2)}\n`;
}

function wavedrom(model) {
  if (!Array.isArray(model.signals) || model.signals.length === 0) {
    throw new Error("WaveDrom requiere model.signals.");
  }
  return `${JSON.stringify({
    signal: model.signals.map(signal => ({
      name: signal.name,
      wave: signal.wave,
      ...(signal.data ? { data: signal.data } : {})
    }))
  }, null, 2)}\n`;
}

function vegaLite(model, description) {
  if (!Array.isArray(model.categories) || !Array.isArray(model.values) || model.categories.length !== model.values.length) {
    throw new Error("Vega-Lite requiere categories y values con la misma longitud.");
  }
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: model.categories.map((category, index) => ({ category, value: model.values[index] })) },
    mark: { type: "bar" },
    encoding: {
      x: { field: "category", type: "nominal", title: model.xTitle || "Categoría", sort: null },
      y: { field: "value", type: "quantitative", title: model.yTitle || "Valor", scale: { zero: true } },
      tooltip: [
        { field: "category", type: "nominal" },
        { field: "value", type: "quantitative" }
      ]
    }
  }, null, 2)}\n`;
}

function rdkit(model) {
  if (!model.smiles) throw new Error("RDKit requiere model.smiles.");
  return `import os
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D

smiles = ${JSON.stringify(model.smiles)}
output = os.environ["JINTIA_VISUAL_OUTPUT"]
mol = Chem.MolFromSmiles(smiles)
if mol is None:
    raise ValueError("SMILES inválido")
drawer = rdMolDraw2D.MolDraw2DSVG(1000, 700)
drawer.DrawMolecule(mol)
drawer.FinishDrawing()
with open(output, "w", encoding="utf-8") as handle:
    handle.write(drawer.GetDrawingText())
`;
}

function generateSource(engine, spec) {
  if (!spec.model) return null;
  if (engine === "graphviz") return graphviz(spec.model);
  if (engine === "mermaid") return mermaid(spec.model);
  if (engine === "d2") return d2(spec.model);
  if (engine === "vega-lite") {
    if (spec.representation === "forest-plot") return forestPlot(spec.model, spec.altText);
    if (spec.representation === "map") return geoMap(spec.model, spec.altText);
    return vegaLite(spec.model, spec.altText);
  }
  if (engine === "wavedrom") return wavedrom(spec.model);
  if (engine === "rdkit") return rdkit(spec.model);
  throw new Error(`El motor ${engine} no admite generación desde model; proporciona source o sourceFile.`);
}

module.exports = { generateSource, graphviz, mermaid, d2, vegaLite, forestPlot, geoMap, wavedrom, rdkit };
