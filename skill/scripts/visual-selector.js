"use strict";

const ENGINE_FALLBACKS = {
  "vega-lite": ["matplotlib", "tikz"],
  geopandas: ["matplotlib"],
  dagitty: ["graphviz", "tikz"],
  rdkit: [],
  matplotlib: ["tikz"],
  wavedrom: ["tikz"],
  html: [],
  d2: ["graphviz", "tikz"],
  plantuml: ["mermaid"],
  graphviz: ["mermaid", "tikz"],
  mermaid: ["graphviz", "tikz"]
};

function selectEngine(spec) {
  if (spec.engine && spec.engine !== "auto") return spec.engine;
  if (spec.formalNotationRequired) {
    if (spec.discipline === "chemistry") return "chemfig";
    if (spec.discipline === "electronics") return "circuitikz";
    if (spec.representation === "technical-diagram") return "plantuml";
  }
  if (spec.discipline === "chemistry" && spec.representation === "annotated-image") return "rdkit";
  switch (spec.representation) {
    case "chart": return "vega-lite";
    case "forest-plot": return "vega-lite";
    case "map": return spec.model?.geojson ? "vega-lite" : "geopandas";
    case "network": return "graphviz";
    case "flowchart": return spec.complexity === "high" ? "graphviz" : "mermaid";
    case "timeline": return "d2";
    case "signal-diagram": return "wavedrom";
    case "causal-diagram": return "dagitty";
    case "interface": return "html";
    case "equation": return "tikz";
    case "disciplinary-notation":
      return spec.discipline === "chemistry" ? "chemfig" : "tikz";
    case "concept-map":
    case "technical-diagram":
      return "graphviz";
    default:
      return "tikz";
  }
}

function candidatesFor(spec) {
  const selected = selectEngine(spec);
  if (spec.formalNotationRequired) return [selected];
  const fallbacks = ENGINE_FALLBACKS[selected] || [];
  return [selected, ...fallbacks];
}

module.exports = { selectEngine, candidatesFor, ENGINE_FALLBACKS };
