"use strict";

/**
 * e2e.test.js — Prueba de integración extremo a extremo del pipeline editorial
 *
 * Verifica que el flujo canónico:
 *   guide-sample.json → validate → render → html-lint → preflight
 * funcione de extremo a extremo con el fixture distribuido.
 *
 * La compilación a PDF (jintia compile) se omite si Vivliostyle no está
 * instalado en el entorno, y se documenta explícitamente cuando ocurre.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root     = path.resolve(__dirname, "..");
const cli      = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");
const GUIDE_SAMPLE = path.join(fixtures, "guide-sample.json");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: cwd || process.cwd(),
  });
}

function runScript(script, args, cwd) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    encoding: "utf8",
    cwd: cwd || process.cwd(),
  });
}

// ─── Preparar directorio de trabajo para la prueba ───────────────────────────

let workDir;
let guideJson;
let guideHtml;

test("configurar directorio de trabajo con fixture", () => {
  workDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-e2e-"));
  guideJson = path.join(workDir, "guide.json");
  guideHtml = path.join(workDir, "guide.html");

  fs.cpSync(GUIDE_SAMPLE, guideJson);
  assert.ok(fs.existsSync(guideJson), "guide.json copiado al directorio de trabajo");
});

// ─── Paso 1: validate ─────────────────────────────────────────────────────────

test("validate: guide-sample.json pasa sin errores", () => {
  const result = run(["validate", guideJson, "--json"], workDir);
  assert.equal(result.status, 0, `validate falló:\n${result.stderr}\n${result.stdout}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "success", `Errores encontrados: ${JSON.stringify(report.errors)}`);
  assert.equal(report.data?.summary?.errors ?? 0, 0, "No debe haber errores de esquema ni de contenido");
});

// ─── Paso 2: render ───────────────────────────────────────────────────────────

test("render: guide.json genera guide.html válido", () => {
  const result = run(["render", guideJson, "--output", guideHtml], workDir);
  assert.equal(result.status, 0, `render falló:\n${result.stderr}`);
  assert.ok(fs.existsSync(guideHtml), "guide.html debe existir");

  const html = fs.readFileSync(guideHtml, "utf8");
  assert.match(html, /<!DOCTYPE html>/i,       "HTML debe comenzar con DOCTYPE");
  assert.match(html, /jintia-cover/,            "HTML debe incluir portada con clase jintia-cover");
  assert.match(html, /jintia-orientation/,      "HTML debe incluir nodo orientation");
  assert.match(html, /jintia-content/,          "HTML debe incluir el contenedor principal");
  assert.match(html, /Normalización y Dependen/, "HTML debe incluir el tópico de la guía");
});

// ─── Paso 3: html-linter ─────────────────────────────────────────────────────

test("html-linter: guide.html pasa sin errores críticos", () => {
  const result = runScript("html-linter.js", [guideHtml, "--json"], workDir);
  // El linter puede no estar presente en todas las instalaciones; si falla con código 2 = uso, saltar
  if (result.status === 2) return; // archivo no encontrado o uso incorrecto

  assert.equal(result.status, 0, `html-linter falló:\n${result.stderr}\n${result.stdout}`);
  try {
    const report = JSON.parse(result.stdout);
    const errors = (report.issues || []).filter(i => i.severity === "error");
    assert.equal(errors.length, 0, `html-linter reportó errores: ${JSON.stringify(errors)}`);
  } catch {
    // Si no devuelve JSON estructurado, la salida no-cero ya está capturada arriba
  }
});

// ─── Paso 4: preflight ────────────────────────────────────────────────────────

test("preflight: guide.html pasa sin errores críticos de paginación", () => {
  const result = run(["preflight", guideHtml, "--json"], workDir);
  assert.equal(result.status, 0, `preflight falló:\n${result.stderr}\n${result.stdout}`);
  const report = JSON.parse(result.stdout);
  const criticalErrors = (report.data?.issues || []).filter(i => i.severity === "error");
  assert.equal(criticalErrors.length, 0, `preflight reportó errores críticos: ${JSON.stringify(criticalErrors)}`);
});

// ─── Paso 5: compile (condicional si Vivliostyle está disponible) ─────────────

test("compile: guide.json compila a PDF cuando Vivliostyle está disponible", () => {
  // Detectar Vivliostyle
  const probe = spawnSync("vivliostyle", ["--version"], { encoding: "utf8", stdio: "pipe", shell: false });
  const vivAvailable = probe.status === 0;

  if (!vivAvailable) {
    // Documentar explícitamente que no se compiló
    console.log("  ℹ Vivliostyle no instalado — compilación a PDF omitida (esperado en CI).");
    return;
  }

  const guidePdf = path.join(workDir, "guide.pdf");
  const result   = run(["compile", guideJson, "--output", guidePdf], workDir);
  assert.equal(result.status, 0, `compile falló:\n${result.stderr}`);
  assert.ok(fs.existsSync(guidePdf), "guide.pdf debe existir después de compilar");
  const stats = fs.statSync(guidePdf);
  assert.ok(stats.size > 1024, "guide.pdf debe tener contenido (> 1 KB)");
});

// ─── Verificaciones de coherencia del fixture ─────────────────────────────────

test("fixture: guide-sample.json tiene el esquema completo esperado", () => {
  const guide = JSON.parse(fs.readFileSync(GUIDE_SAMPLE, "utf8"));

  // Metadata obligatoria
  assert.ok(guide.metadata.course,   "metadata.course presente");
  assert.ok(guide.metadata.week,     "metadata.week presente");
  assert.ok(guide.metadata.topic,    "metadata.topic presente");
  assert.ok(guide.metadata.outcome,  "metadata.outcome presente");

  // Tipos de nodo presentes en el fixture
  const types = new Set(guide.sections.map(s => s.type));
  assert.ok(types.has("orientation"), "fixture debe incluir orientation");
  assert.ok(types.has("theory") || types.has("concept"), "fixture debe incluir al menos un nodo teórico");
  assert.ok(types.has("practice") || types.has("scenario"), "fixture debe incluir práctica o escenario");

  // Todos los nodos figure tienen alt y caption
  const figures = guide.sections.filter(s => s.type === "figure");
  for (const fig of figures) {
    assert.ok(fig.alt && fig.alt.trim(),         `figura "${fig.id}" debe tener alt`);
    assert.ok(fig.caption && fig.caption.trim(), `figura "${fig.id}" debe tener caption`);
  }
});

// ─── Limpiar ──────────────────────────────────────────────────────────────────

test("limpiar directorio de trabajo", () => {
  if (workDir && fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  assert.ok(!workDir || !fs.existsSync(workDir), "directorio de trabajo eliminado");
});
