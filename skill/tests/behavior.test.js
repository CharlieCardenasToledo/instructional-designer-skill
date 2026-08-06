"use strict";

/**
 * behavior.test.js — Pruebas de comportamiento determinístico del agente Jintia
 *
 * Verifica que behavior-runner.js detecta correctamente las violaciones de
 * contratos de comportamiento en guides con problemas conocidos, y que
 * aprueba el fixture canónico guide-sample.json.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const path   = require("node:path");

const { runBehaviors, BEHAVIORS } = require("../scripts/behavior-runner");

const root     = path.resolve(__dirname, "..");
const fixtures = path.join(__dirname, "fixtures");
const sample   = path.join(fixtures, "guide-sample.json");
const badGuides = path.join(fixtures, "behaviors");

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusOf(report, behaviorId) {
  const r = report.results.find(r => r.id === behaviorId);
  if (!r) throw new Error(`Comportamiento ${behaviorId} no encontrado en el reporte`);
  return r.status;
}

// ── Fixture canónico — debe pasar todos los comportamientos ───────────────────

test("guide-sample.json pasa todos los comportamientos determinísticos", () => {
  const report = runBehaviors(sample);
  assert.equal(report.summary.failed, 0,
    `Comportamientos fallidos en guide-sample: ${report.results.filter(r => r.status === "failed").map(r => `${r.id}: ${r.message}`).join("; ")}`
  );
  assert.ok(report.summary.ok, "summary.ok debe ser true");
});

// ── BHV-D-001: scenario debe aparecer después de theory/concept ──────────────

test("BHV-D-001 detecta escenario colocado antes de la teoría", () => {
  const report = runBehaviors(path.join(badGuides, "guide-scenario-before-theory.json"));
  assert.equal(statusOf(report, "BHV-D-001"), "failed",
    "BHV-D-001 debe fallar cuando el escenario está antes de la teoría");
});

test("BHV-D-001 pasa cuando no hay nodos scenario", () => {
  const report = runBehaviors(sample); // guide-sample no tiene scenario
  assert.equal(statusOf(report, "BHV-D-001"), "passed");
});

// ── BHV-D-002: bibliography debe ser el último nodo ──────────────────────────

test("BHV-D-002 detecta bibliography no ubicada al final", () => {
  const report = runBehaviors(path.join(badGuides, "guide-bibliography-not-last.json"));
  assert.equal(statusOf(report, "BHV-D-002"), "failed",
    "BHV-D-002 debe fallar cuando bibliography no es el último nodo");
});

// ── BHV-D-003: assessment debe seguir a practice o scenario ─────────────────

test("BHV-D-003 detecta assessment sin practice previo", () => {
  const report = runBehaviors(path.join(badGuides, "guide-assessment-before-practice.json"));
  assert.equal(statusOf(report, "BHV-D-003"), "failed",
    "BHV-D-003 debe fallar cuando assessment no está precedido por practice o scenario");
});

test("BHV-D-003 pasa en guide-sample (assessment precedido por practice)", () => {
  const report = runBehaviors(sample);
  assert.equal(statusOf(report, "BHV-D-003"), "passed");
});

// ── BHV-D-004: orientation debe ser el primer nodo ───────────────────────────

test("BHV-D-004 detecta orientation no ubicada como primer nodo", () => {
  const report = runBehaviors(path.join(badGuides, "guide-orientation-not-first.json"));
  assert.equal(statusOf(report, "BHV-D-004"), "failed",
    "BHV-D-004 debe fallar cuando orientation no es el primer nodo");
});

test("BHV-D-004 pasa en guide-sample (orientation es primer nodo)", () => {
  const report = runBehaviors(sample);
  assert.equal(statusOf(report, "BHV-D-004"), "passed");
});

// ── BHV-D-005: outcome debe ser sustantivo ───────────────────────────────────

test("BHV-D-005 detecta outcome demasiado corto o no verbal", () => {
  const { runBehaviors: run } = require("../scripts/behavior-runner");
  // Crear un guide temporal en memoria con outcome inválido
  const os   = require("node:os");
  const fs   = require("node:fs");
  const tmp  = path.join(os.tmpdir(), "jintia-bhv-d005.json");
  const guide = {
    metadata: { course: "BD", week: 1, topic: "Intro", outcome: "Aprender" },
    sections: [{ type: "orientation", id: "o", content: "Intro." }],
  };
  fs.writeFileSync(tmp, JSON.stringify(guide));
  const report = run(tmp);
  fs.rmSync(tmp);
  assert.equal(statusOf(report, "BHV-D-005"), "failed",
    'BHV-D-005 debe fallar con outcome "Aprender" (muy corto y no imperativo)');
});

test("BHV-D-005 pasa en guide-sample (outcome sustantivo)", () => {
  const report = runBehaviors(sample);
  assert.equal(statusOf(report, "BHV-D-005"), "passed");
});

// ── BHV-D-007: teoría sin citas ──────────────────────────────────────────────

test("BHV-D-007 detecta guía con nodos teóricos y sin ninguna referencia", () => {
  const report = runBehaviors(path.join(badGuides, "guide-theory-no-citation.json"));
  assert.equal(statusOf(report, "BHV-D-007"), "failed",
    "BHV-D-007 debe fallar cuando hay teoría sin ningún respaldo bibliográfico");
});

test("BHV-D-007 pasa en guide-sample (declara bibliography)", () => {
  const report = runBehaviors(sample);
  assert.equal(statusOf(report, "BHV-D-007"), "passed");
});

// ── Estructura del reporte ────────────────────────────────────────────────────

test("el reporte tiene los campos obligatorios del contrato", () => {
  const report = runBehaviors(sample);
  assert.equal(typeof report.tool,    "string");
  assert.equal(typeof report.version, "string");
  assert.equal(typeof report.target,  "string");
  assert.ok(Array.isArray(report.results));
  assert.equal(typeof report.summary.total,  "number");
  assert.equal(typeof report.summary.passed, "number");
  assert.equal(typeof report.summary.failed, "number");
  assert.equal(typeof report.summary.ok,     "boolean");
});

test("cada comportamiento del catálogo aparece en el reporte", () => {
  const report  = runBehaviors(sample);
  const ids     = new Set(report.results.map(r => r.id));
  const missing = BEHAVIORS.filter(b => !ids.has(b.id));
  assert.equal(missing.length, 0,
    `Comportamientos sin resultado en el reporte: ${missing.map(b => b.id).join(", ")}`
  );
});
