"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { selectEngine, candidatesFor } = require("../scripts/visual-selector");
const { validateSpec, latexBlock } = require("../scripts/visual-renderer");
const { detectCapabilities } = require("../scripts/visual-capabilities");
const { inspectFile } = require("../scripts/visual-inspector");
const { hashes } = require("../scripts/visual-regression");
const {
  graphviz, mermaid, d2, vegaLite, forestPlot, geoMap, wavedrom, rdkit
} = require("../scripts/visual-source-generator");
const { expandProgressive } = require("../scripts/visual-progressive");
const { encodePng, decodePng, comparePng } = require("../scripts/png-compare");
const { contrastRatio, inspectSvg, inspectHtml } = require("../scripts/visual-quality");

test("elige Vega-Lite para datos cuantitativos", () => {
  assert.equal(selectEngine({ representation: "chart" }), "vega-lite");
});

test("elige Graphviz para redes y Mermaid para flujos simples", () => {
  assert.equal(selectEngine({ representation: "network" }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", complexity: "low" }), "mermaid");
});

test("elige DAGitty para causalidad y declara fallback semántico", () => {
  assert.equal(selectEngine({ representation: "causal-diagram" }), "dagitty");
  assert.deepEqual(candidatesFor({ representation: "causal-diagram" }), ["dagitty", "graphviz", "tikz"]);
});

test("la notación formal no se degrada a un motor distinto", () => {
  assert.deepEqual(candidatesFor({
    representation: "causal-diagram",
    formalNotationRequired: true,
    engine: "dagitty"
  }), ["dagitty"]);
});

test("respeta notación disciplinar formal", () => {
  assert.equal(selectEngine({
    representation: "disciplinary-notation",
    discipline: "chemistry",
    formalNotationRequired: true
  }), "chemfig");
});

test("expone fallbacks en orden", () => {
  assert.deepEqual(candidatesFor({ representation: "chart" }), ["vega-lite", "matplotlib", "tikz"]);
  assert.deepEqual(candidatesFor({ engine: "d2" }), ["d2", "graphviz", "tikz"]);
});

test("el registro de capacidades conserva todos los motores declarados", () => {
  const capabilities = detectCapabilities();
  assert.equal(capabilities.version, 1);
  assert.ok(capabilities.tools.graphviz.supports.includes("graphviz"));
  assert.ok(capabilities.tools.chrome.supports.includes("html"));
  assert.equal(capabilities.tools.chrome.version, null);
  assert.equal(typeof capabilities.tools.latex.available, "boolean");
});

test("el detector no ejecuta un probe de versión que abra Chrome", () => {
  const registry = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "..", "config", "visual-tools.json"),
    "utf8"
  ));
  assert.equal(registry.tools.chrome.versionProbe, false);
});

test("la especificación exige accesibilidad y tabla para gráficos", () => {
  const errors = validateSpec({
    id: "fig-resultados",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Barras por categoría",
    source: { content: "{}" }
  });
  assert.ok(errors.some(error => error.includes("dataTable")));
  assert.deepEqual(validateSpec({
    id: "fig-resultados",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras muestran un aumento sostenido por categoría.",
    dataTable: "data/resultados.csv",
    source: { content: "{}" }
  }), []);
  assert.deepEqual(validateSpec({
    id: "fig-modelo",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras comparan dos categorías con valores diferentes.",
    model: { categories: ["A", "B"], values: [2, 5] }
  }), []);
});

test("el renderer genera una tabla CSV accesible desde el modelo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-chart-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-casos.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-casos",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras comparan cinco y siete casos entre dos regiones.",
    model: { categories: ["Norte", "Sur"], values: [5, 7] }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  assert.equal(manifest.figures[0].dataTable, "data/fig-casos.csv");
  assert.match(fs.readFileSync(path.join(root, "figure", "data", "fig-casos.csv"), "utf8"), /Norte,5/);
});

test("el esquema rechaza propiedades desconocidas y motores inválidos", () => {
  const errors = validateSpec({
    id: "fig-red",
    pedagogicalIntent: "relate",
    representation: "network",
    engine: "herramienta-inventada",
    altText: "La red conecta tres entidades mediante relaciones dirigidas.",
    source: { content: "digraph { a -> b }" },
    desconocido: true
  });
  assert.ok(errors.some(error => error.includes("valor no permitido")));
  assert.ok(errors.some(error => error.includes("propiedad no permitida")));
});

test("genera fuentes de grafo desde un modelo neutral", () => {
  const model = {
    direction: "LR",
    nodes: [{ id: "resultado", label: "Resultado" }, { id: "evidencia", label: "Evidencia" }],
    edges: [{ from: "resultado", to: "evidencia", label: "se demuestra" }]
  };
  assert.match(graphviz(model), /rankdir=LR/);
  assert.match(graphviz(model), /resultado -> evidencia/);
  assert.match(mermaid(model), /flowchart LR/);
  assert.match(mermaid(model), /resultado -->\|se demuestra\| evidencia/);
});

test("genera Vega-Lite con eje cero y datos embebidos", () => {
  const spec = JSON.parse(vegaLite({
    categories: ["A", "B"],
    values: [2, 5],
    yTitle: "Casos"
  }, "Comparación de casos."));
  assert.deepEqual(spec.data.values, [{ category: "A", value: 2 }, { category: "B", value: 5 }]);
  assert.equal(spec.encoding.y.scale.zero, true);
});

test("genera un adaptador RDKit reproducible desde SMILES", () => {
  const source = rdkit({ smiles: "CCO" });
  assert.match(source, /MolFromSmiles/);
  assert.match(source, /JINTIA_VISUAL_OUTPUT/);
  assert.match(source, /"CCO"/);
});

test("genera cronologías y señales desde modelos neutrales", () => {
  assert.match(d2({
    events: [
      { date: "1990", label: "Inicio" },
      { date: "2000", label: "Reforma" }
    ]
  }), /event_1 -> event_2/);
  const signal = JSON.parse(wavedrom({
    signals: [{ name: "clk", wave: "p...." }, { name: "data", wave: "x.345", data: "A B C" }]
  }));
  assert.equal(signal.signal[1].data, "A B C");
});

test("genera forest plots con intervalos y rechaza intervalos imposibles", () => {
  const source = JSON.parse(forestPlot({
    estimates: [{ label: "Estudio A", estimate: 1.2, lower: 0.9, upper: 1.5 }]
  }, "Estimaciones."));
  assert.equal(source.layer[0].encoding.x2.field, "upper");
  assert.throws(() => forestPlot({
    estimates: [{ label: "Error", estimate: 2, lower: 3, upper: 4 }]
  }, "Error"), /Intervalo inválido/);
});

test("genera mapas Vega-Lite desde GeoJSON verificable", () => {
  const source = JSON.parse(geoMap({
    valueField: "casos",
    geojson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { name: "Norte", casos: 5 },
        geometry: { type: "Polygon", coordinates: [] }
      }]
    }
  }, "Casos por región."));
  assert.equal(source.mark.type, "geoshape");
  assert.equal(source.encoding.color.field, "properties.casos");
});

test("expande una figura progresiva acumulando nodos y relaciones", () => {
  const stages = expandProgressive({
    id: "fig-proceso",
    pedagogicalIntent: "sequence",
    representation: "flowchart",
    altText: "Secuencia acumulativa del proceso.",
    model: {
      nodes: [
        { id: "a", label: "Inicio" },
        { id: "b", label: "Análisis" },
        { id: "c", label: "Decisión" }
      ],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
      stages: [
        { id: "inicio", label: "Inicio", nodeIds: ["a"] },
        { id: "analisis", label: "Análisis", nodeIds: ["b"] },
        { id: "decision", label: "Decisión", nodeIds: ["c"] }
      ]
    }
  });
  assert.equal(stages.length, 3);
  assert.equal(stages[1].model.nodes.length, 2);
  assert.equal(stages[2].model.edges.length, 2);
  assert.equal(stages[2].id, "fig-proceso-03-decision");
});

test("rechaza dependencias remotas en figuras HTML", () => {
  const errors = validateSpec({
    id: "fig-ui",
    pedagogicalIntent: "simulate",
    representation: "interface",
    engine: "html",
    altText: "Formulario con una acción principal claramente identificada.",
    source: { content: "<script src=\"https://cdn.example/app.js\"></script>" }
  });
  assert.ok(errors.some(error => error.includes("autosuficiente")));
});

test("genera el bloque LaTeX portable", () => {
  const block = latexBlock({
    rendered: "rendered/fig-red.pdf",
    templatePlacement: "wide",
    caption: "Relaciones principales.",
    altText: "Relaciones principales entre nodos.",
    id: "fig-red"
  });
  assert.match(block, /\\begin\{guidefigure\}\[placement=wide\]/);
  assert.match(block, /\\guidefigurecaption\{Relaciones principales\.\}\{fig:red\}/);
});

test("el modo dry-run crea fuente y manifiesto sin fingir renderizado", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-visual-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-red.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-red",
    pedagogicalIntent: "relate",
    representation: "network",
    altText: "La red relaciona resultados, práctica y evidencia observable.",
    source: { content: "digraph { resultado -> evidencia }" }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  assert.equal(manifest.figures[0].status, "planned");
  assert.ok(fs.existsSync(path.join(root, "figure", manifest.figures[0].source)));
  assert.ok(!fs.existsSync(path.join(root, "figure", manifest.figures[0].rendered)));
});

test("Chrome renderiza una figura HTML real cuando está disponible", {
  skip: process.env.JINTIA_REAL_RENDER_TESTS !== "1" || !detectCapabilities().tools.chrome.available
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-html-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-interfaz.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-interfaz",
    pedagogicalIntent: "simulate",
    representation: "interface",
    engine: "html",
    outputFormat: "png",
    altText: "Formulario local con un campo y un botón de confirmación.",
    source: {
      content: "<!doctype html><meta charset=\"utf-8\"><style>*{animation:none!important}body{margin:0;background:white;font:24px Arial}main{width:500px;padding:40px}button{padding:16px;background:#00796b;color:white}</style><main><label>Nombre <input></label><button>Confirmar</button></main>"
    }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  const rendered = path.join(root, "figure", manifest.figures[0].rendered);
  assert.equal(inspectFile(rendered).valid, true);
  assert.equal(manifest.figures[0].status, "valid");
});

test("el inspector comprueba firma y dimensiones PNG", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-inspector-"));
  const png = path.join(root, "pixel.png");
  fs.writeFileSync(png, Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
    "hex"
  ));
  const result = inspectFile(png);
  assert.equal(result.valid, true);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.dimensions, { width: 1, height: 1, unit: "px" });
});

test("la regresión usa solo salidas inspeccionadas y válidas", () => {
  assert.deepEqual(hashes({
    figures: [
      { id: "fig-a", inspection: { valid: true, sha256: "abc" } },
      { id: "fig-b", inspection: { valid: false, sha256: "def" } },
      { id: "fig-c" }
    ]
  }), { "fig-a": "abc" });
});

test("compara PNG por contenido y genera una imagen diff", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-png-diff-"));
  const expected = path.join(root, "expected.png");
  const actual = path.join(root, "actual.png");
  const diff = path.join(root, "diff.png");
  const base = Buffer.alloc(4 * 4 * 4, 255);
  const changed = Buffer.from(base);
  changed[0] = 0;
  changed[1] = 0;
  changed[2] = 0;
  encodePng(expected, { width: 4, height: 4, data: base });
  encodePng(actual, { width: 4, height: 4, data: changed });
  const comparison = comparePng(actual, expected, diff);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.differenceRatio, 1 / 16);
  assert.equal(decodePng(diff).width, 4);
});

test("valida contraste WCAG y problemas semánticos de SVG", () => {
  assert.ok(contrastRatio("#000000", "#ffffff") > 20);
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5);
  const result = inspectSvg('<svg><text font-size="8">Texto</text></svg>');
  assert.ok(result.errors.some(error => error.includes("viewBox")));
  assert.ok(result.errors.some(error => error.includes("menor de 10")));
});

test("detecta recursos y animaciones no reproducibles en HTML", () => {
  const result = inspectHtml('<meta charset="utf-8"><style>@keyframes giro{}</style><script src="https://example.test/app.js"></script>');
  assert.ok(result.errors.some(error => error.includes("remoto")));
  assert.ok(result.errors.some(error => error.includes("animaciones")));
});
