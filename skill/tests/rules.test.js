"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runRules, catalog } = require("../scripts/rules-runner");
const { update, load } = require("../scripts/state-manager");

test("el catálogo de reglas tiene identificadores estables y categorías", () => {
  assert.ok(catalog.rules.length >= 6);
  assert.equal(new Set(catalog.rules.map(rule => rule.id)).size, catalog.rules.length);
  assert.ok(catalog.rules.every(rule => /^JIN-[A-Z]+-\d{3}$/.test(rule.id)));
});

test("las reglas detectan un sílabo incompleto", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-rules-"));
  const file = path.join(root, "README.md");
  fs.writeFileSync(file, "# Curso\n");
  const report = runRules(file);
  assert.equal(report.summary.errors, 3);
  assert.ok(report.issues.some(issue => issue.rule === "JIN-SYL-001"));
  assert.ok(report.issues.some(issue => issue.rule === "JIN-SYL-004"));
});

test("el estado guarda semana, fecha y hash de la fuente", () => {
  const course = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-state-"));
  const source = path.join(course, "source.md");
  fs.writeFileSync(source, "contenido");
  const stateFile = update(course, 3, "validated", source);
  const state = load(course);
  assert.ok(fs.existsSync(stateFile));
  assert.equal(state.weeks["03"].status, "validated");
  assert.equal(state.weeks["03"].source, "source.md");
  assert.match(state.weeks["03"].sourceHash, /^[a-f0-9]{64}$/);
});
