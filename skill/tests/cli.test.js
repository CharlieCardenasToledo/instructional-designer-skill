"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "bin", "jintia.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("la CLI expone ayuda y operaciones principales", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /jintia doctor/);
  assert.match(result.stdout, /jintia visual render/);
});

test("init crea una estructura idempotente sin sobrescribir README", () => {
  const course = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-cli-"));
  const first = run(["init", course, "--code", "IFT200", "--name", "Curso de prueba"]);
  assert.equal(first.status, 0, first.stderr);
  const readme = path.join(course, "README.md");
  const original = fs.readFileSync(readme, "utf8");
  const second = run(["init", course, "--code", "IFT200", "--name", "Otro nombre"]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(readme, "utf8"), original);
  for (const directory of ["semanas", "bibliografia", "config"]) assert.ok(fs.existsSync(path.join(course, directory)));
});

test("init --json devuelve el contrato estándar de reportes", () => {
  const course = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-report-"));
  const result = run(["init", course, "--code", "IFT200", "--name", "Curso JSON", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.tool, "jintia");
  assert.equal(report.command, "init");
  assert.equal(report.status, "success");
  assert.ok(Array.isArray(report.checks));
  assert.ok(Array.isArray(report.artifacts));
  assert.deepEqual(report.errors, []);
});

test("validate --json conserva el contrato estándar cuando falla", () => {
  const result = run(["validate", path.join(os.tmpdir(), "jintia-no-existe.tex"), "--json"]);
  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.command, "validate");
  assert.equal(report.status, "failed");
  assert.ok(report.errors.length > 0);
});

test("syllabus validate detecta el contrato canónico", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-syllabus-"));
  const readme = path.join(root, "README.md");
  fs.writeFileSync(readme, `**Asignatura:** Prueba\n**Periodo académico ordinario:** 2026\n\n### Semana 01 — Fundamentos\n**Unidad:** 1\n**Tema / contenido semanal:** Bases\n**Resultado de aprendizaje:** Analizar\n**Herramienta de aprendizaje:** Libro\n**Horas:** 4\n**Actividades calificadas:** Taller\n`);
  const result = run(["syllabus", "validate", readme]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /contrato mínimo canónico/);
});
