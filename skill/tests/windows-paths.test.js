"use strict";

/**
 * windows-paths.test.js — Rutas de Windows con caracteres conflictivos
 *
 * Verifica que el pipeline completo (init → validate → render) funcione
 * correctamente cuando la ruta del curso contiene:
 *   - espacios
 *   - ampersand (&)
 *   - paréntesis ()
 *   - tildes (á, é, ó, ú, ñ)
 *   - caracteres Unicode
 *
 * Todos los spawnSync se ejecutan con shell: false para garantizar que no
 * se dependen de expansión de shell.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const { spawnSync } = require("node:child_process");

const root     = path.resolve(__dirname, "..");
const cli      = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");

// ─── Rutas con caracteres difíciles ──────────────────────────────────────────

const DIFFICULT_NAMES = [
  "Curso BD & Datos (2026)",          // espacios, & y paréntesis
  "Bases de datos — Introducción",    // em dash y tildes en nombre
  "Diseño instruccional año 2026",    // ñ y tildes
  "Curso(Avanzado)_2026",             // paréntesis sin espacios
];

// Usar tmpdir del sistema para evitar problemas con la ruta del repositorio
const TMP_ROOT = os.tmpdir();

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd:      cwd || process.cwd(),
    shell:    false,                  // sin shell → sin expansión de caracteres
    timeout:  30_000,
  });
}

// ─── Escenario 1: init en rutas difíciles ────────────────────────────────────

for (const name of DIFFICULT_NAMES) {
  test(`WINPATH — init funciona con ruta: "${name}"`, () => {
    const dir = path.join(TMP_ROOT, `jintia-win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name);
    fs.mkdirSync(dir, { recursive: true });

    const result = run(["init", dir, "--code", "TEST100", "--name", name], dir);
    assert.equal(result.status, 0,
      `init falló en ruta "${dir}":\n${result.stderr}\n${result.stdout}`);

    assert.ok(fs.existsSync(path.join(dir, "semanas")),      "semanas/ debe existir");
    assert.ok(fs.existsSync(path.join(dir, "bibliografia")), "bibliografia/ debe existir");
    assert.ok(fs.existsSync(path.join(dir, "README.md")),    "README.md debe existir");

    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });
}

// ─── Escenario 2: validate en ruta con espacios ──────────────────────────────

test("WINPATH — validate funciona con ruta que contiene espacios y tildes", () => {
  const name = "Diseño & Evaluación (Módulo 1)";
  const dir  = path.join(TMP_ROOT, `jintia-win-${Date.now()}`, name);
  fs.mkdirSync(dir, { recursive: true });

  const guideJson = path.join(dir, "guide.json");
  fs.cpSync(path.join(fixtures, "guide-sample.json"), guideJson);

  const result = run(["validate", guideJson, "--json"], dir);

  // El proceso no debe fallar por la ruta — puede fallar si la bib no existe
  // pero el proceso en sí debe ejecutarse
  assert.notEqual(result.status, null, "El proceso no debe quedarse colgado");
  assert.equal(result.error, undefined, `No debe haber error de spawn: ${result.error}`);

  // Verificar que la salida es JSON válido
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    assert.fail(`validate no devolvió JSON válido en ruta difícil:\n${result.stdout}\n${result.stderr}`);
  }
  assert.ok("status" in report, "El reporte debe tener campo status");

  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

// ─── Escenario 3: render en ruta con & y paréntesis ─────────────────────────

test("WINPATH — render funciona con ruta que contiene & y paréntesis", () => {
  const name = "Curso BD & Datos (2026)";
  const dir  = path.join(TMP_ROOT, `jintia-win-${Date.now()}`, name);
  fs.mkdirSync(dir, { recursive: true });

  const guideJson = path.join(dir, "guide.json");
  const guideHtml = path.join(dir, "guide.html");

  // Copiar fixture y ajustar bibliography path (el .bib no existe en este dir)
  const sample = JSON.parse(fs.readFileSync(path.join(fixtures, "guide-sample.json"), "utf8"));
  delete sample.metadata.bibliography; // sin bib para simplificar
  fs.writeFileSync(guideJson, JSON.stringify(sample, null, 2));

  const result = run(["render", guideJson, "--output", guideHtml], dir);

  assert.equal(result.status, 0,
    `render falló en ruta "${dir}":\n${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(guideHtml), "guide.html debe existir");

  const html = fs.readFileSync(guideHtml, "utf8");
  assert.match(html, /<!DOCTYPE html>/i, "HTML debe comenzar con DOCTYPE");

  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

// ─── Escenario 4: rutas con path.sep correcto en el plan ─────────────────────

test("WINPATH — plan-state usa path.sep correcto en rutas planeadas", () => {
  const { savePlan, getPlan } = require("../runtime/core/plan-state");
  const name = "Bases de datos — Semana & Módulo (2026)";
  const dir  = path.join(TMP_ROOT, `jintia-win-${Date.now()}`, name);

  fs.mkdirSync(path.join(dir, "semanas", "semana-01"), { recursive: true });

  const saved = savePlan(dir, 1, {
    course: "TEST",
    topic:  "Introducción",
    missingEvidence: [],
  });
  assert.ok(fs.existsSync(saved), `El archivo del plan debe existir en: ${saved}`);

  const record = getPlan(dir, 1);
  assert.ok(record, "El plan debe poder leerse de vuelta");

  // Las rutas planeadas deben usar / como separador canónico
  for (const f of record.plannedFiles) {
    assert.doesNotMatch(f, /\\/,
      `plannedFiles debe usar / como separador, pero encontró: ${f}`);
  }

  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

// ─── Escenario 5: syllabus-manager en ruta Unicode ───────────────────────────

test("WINPATH — syllabus-manager opera correctamente en ruta Unicode", () => {
  const { validateSyllabus, createBackup } = require("../runtime/core/syllabus-manager");
  const name = "Evaluación Año Académico 2026 ñ";
  const dir  = path.join(TMP_ROOT, `jintia-win-${Date.now()}`, name);
  fs.mkdirSync(dir, { recursive: true });

  const readme = path.join(dir, "README.md");
  const content = `# Curso de prueba

**Asignatura:** Bases de datos con caracteres especiales: áéíóú ñ
**Periodo académico ordinario:** 2026-A

### Semana 01 — Introducción

**Unidad:** 1
**Tema / contenido semanal:** Fundamentos
**Resultado de aprendizaje:** Identificar conceptos básicos.
**Herramienta de aprendizaje:** Beynon-Davies (2018)
**Horas:** 4
**Actividades calificadas:** Ninguna
`;
  fs.writeFileSync(readme, content, "utf8");

  // createBackup debe funcionar con rutas Unicode
  const backup = createBackup(readme);
  assert.ok(backup, "createBackup debe retornar ruta");
  assert.ok(fs.existsSync(backup), "El respaldo debe existir");

  // validateSyllabus debe leer correctamente caracteres Unicode
  const { valid, errors } = validateSyllabus(content);
  assert.ok(valid, `validateSyllabus debe pasar con caracteres Unicode. Errores: ${JSON.stringify(errors)}`);

  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});
