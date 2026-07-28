"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readCourse } = require("../../packages/core");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");
function copyFixture(name) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `jintia-${name}-`));
  fs.cpSync(path.join(fixtures, name), target, { recursive: true });
  return target;
}

test("fixture mínimo pasa syllabus validate y conserva estado desde la CLI", () => {
  const course = copyFixture("minimal-course");
  const validation = spawnSync(process.execPath, [cli, "syllabus", "validate", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  const update = spawnSync(process.execPath, [cli, "state", "update", course, "1", "validated", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(update.status, 0, update.stderr);
  assert.equal(readCourse(course).state.weeks["01"].status, "validated");
});

test("fixture incompleto falla validación sin alterar el curso", () => {
  const course = copyFixture("malformed-syllabus");
  const result = spawnSync(process.execPath, [cli, "syllabus", "validate", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.deepEqual(readCourse(course).state.weeks, {});
});

test("fixture legado permanece aislado hasta ejecutar una migración explícita", () => {
  const course = copyFixture("legacy-project");
  const state = readCourse(course);
  assert.equal(state.syllabusExists, true);
  assert.deepEqual(state.state.weeks, {});
  assert.equal(fs.existsSync(path.join(course, ".jintia", "state.json")), false);
});

test("context init es idempotente y context validate exige las secciones duraderas", () => {
  const course = copyFixture("minimal-course");
  const init = spawnSync(process.execPath, [cli, "context", "init", course, "--json"], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).data.created, true);
  const second = spawnSync(process.execPath, [cli, "context", "init", course, "--json"], { encoding: "utf8" });
  assert.equal(JSON.parse(second.stdout).data.created, false);
  const validation = spawnSync(process.execPath, [cli, "context", "validate", course, "--json"], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout).data.valid, true);
});

test("agents plan devuelve contratos existentes y orden de delegación", () => {
  const result = spawnSync(process.execPath, [cli, "agents", "plan", "guide", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "agents plan");
  assert.equal(report.data.operation, "guide");
  assert.ok(report.data.agents.length >= 3);
  assert.ok(report.data.agents.every(agent => agent.status === "pending"));
});

test("los paquetes internos exponen límites consumibles sin duplicar implementaciones", () => {
  const cliPackage = require("../../packages/cli");
  const rules = require("../../packages/rules");
  const templates = require("../../packages/templates");
  const skill = require("../../packages/skill");
  assert.match(cliPackage.bin, /skill[\\/]bin[\\/]jintia\.js$/);
  assert.ok(Array.isArray(rules.catalog.rules));
  assert.ok(templates.list().some(template => template.id === "elegantbook-clasico"));
  assert.match(skill.skillFile, /skill[\\/]SKILL\.md$/);
});

test("la instalación de hooks queda explícitamente separada del runner", () => {
  const installer = fs.readFileSync(path.join(root, "scripts", "hook-install.js"), "utf8");
  assert.match(installer, /core\.hooksPath/);
  assert.match(installer, /pre-commit/);
  assert.match(installer, /No se instaló el hook/);
});
