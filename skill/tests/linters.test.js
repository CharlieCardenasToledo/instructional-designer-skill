"use strict";

/**
 * linters.test.js — Pruebas para doc-ref-checker.js y legacy-linter.js
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const path   = require("node:path");
const fs     = require("node:fs");
const os     = require("node:os");

const docRefChecker = require("../scripts/doc-ref-checker");
const legacyLinter  = require("../scripts/legacy-linter");

const ROOT = path.resolve(__dirname, "..");

// ── doc-ref-checker ───────────────────────────────────────────────────────────

test("doc-ref-checker: isSkillFileRef rechaza rutas sin prefijo conocido", () => {
  assert.equal(docRefChecker.isSkillFileRef("guide.json"), false);
  assert.equal(docRefChecker.isSkillFileRef("README.md"), false);
  assert.equal(docRefChecker.isSkillFileRef("node scripts/foo.js"), false);
});

test("doc-ref-checker: isSkillFileRef rechaza rutas config/ (archivos de usuario)", () => {
  assert.equal(docRefChecker.isSkillFileRef("config/institution.json"), false);
  assert.equal(docRefChecker.isSkillFileRef("config/notebooks.json"), false);
});

test("doc-ref-checker: isSkillFileRef acepta rutas internas conocidas", () => {
  assert.equal(docRefChecker.isSkillFileRef("references/checklist.md"), true);
  assert.equal(docRefChecker.isSkillFileRef("scripts/content-linter.js"), true);
  assert.equal(docRefChecker.isSkillFileRef("commands/compile.md"), true);
  assert.equal(docRefChecker.isSkillFileRef("schemas/guide.schema.json"), true);
  assert.equal(docRefChecker.isSkillFileRef("behaviors/semantic/BHV-SEM-001.md"), true);
});

test("doc-ref-checker: checkFile no reporta referencias válidas", () => {
  // SKILL.md referencia referencias/ y commands/ que sí existen
  const issues = docRefChecker.checkFile(path.join(ROOT, "SKILL.md"));
  assert.equal(issues.length, 0, `Issues inesperadas: ${JSON.stringify(issues)}`);
});

test("doc-ref-checker: checkFile reporta referencia rota en archivo temporal", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, "Leer `references/archivo-que-no-existe.md` antes de continuar.\n");
  try {
    const issues = docRefChecker.checkFile(tmp);
    assert.equal(issues.length, 1);
    assert.match(issues[0].ref, /references\/archivo-que-no-existe\.md/);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("doc-ref-checker: checkFile ignora backticks dentro de bloques de código", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, "```\n`references/no-existe.md`\n```\n");
  try {
    const issues = docRefChecker.checkFile(tmp);
    assert.equal(issues.length, 0);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("doc-ref-checker: run sobre skill/ no reporta referencias rotas", () => {
  const report = docRefChecker.run({ dir: ROOT });
  assert.equal(report.summary.ok, true, `Referencias rotas: ${JSON.stringify(report.issues)}`);
  assert.ok(report.scanned > 0);
});

// ── legacy-linter ─────────────────────────────────────────────────────────────

test("legacy-linter: detecta elegantbook-clasico en archivo temporal", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, '{ "activeTemplate": "elegantbook-clasico" }\n');
  try {
    const issues = legacyLinter.checkFile(tmp);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, "LGC-001");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("legacy-linter: detecta kaohandt-marginal en archivo temporal", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, "Usar kaohandt-marginal para márgenes.\n");
  try {
    const issues = legacyLinter.checkFile(tmp);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, "LGC-002");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("legacy-linter: detecta macros LaTeX de cita", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, "Citar con \\textcite{autor} o \\parencite{autor}.\n");
  try {
    const issues = legacyLinter.checkFile(tmp);
    assert.equal(issues.length, 2);
    const ids = issues.map(i => i.rule).sort();
    assert.deepEqual(ids, ["LGC-007", "LGC-008"]);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("legacy-linter: detecta \\printbibliography", () => {
  const tmp = path.join(os.tmpdir(), `jintia-test-${Date.now()}.md`);
  fs.writeFileSync(tmp, "Al final del documento: \\printbibliography\n");
  try {
    const issues = legacyLinter.checkFile(tmp);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, "LGC-009");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("legacy-linter: run sobre skill/ no reporta violaciones", () => {
  const report = legacyLinter.run({ dir: ROOT });
  assert.equal(report.summary.ok, true, `Violaciones encontradas: ${JSON.stringify(report.issues)}`);
  assert.ok(report.scanned > 0);
});

test("legacy-linter: no reporta falsos positivos en scripts exentos", () => {
  // legacy-linter.js y legacy-manager.js están exentos — el run limpio lo confirma
  const report = legacyLinter.run({ dir: ROOT });
  const fromLinter = report.issues.filter(i => i.file && i.file.includes("legacy-linter.js"));
  assert.equal(fromLinter.length, 0);
});
