"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CORE_VERSION = "1.0.0";
const CONTEXT_FILE = "JINTIA.md";
const CONTEXT_SECTIONS = ["Course", "Pedagogy", "Editorial"];
const harnesses = require("./harnesses");
const harnessManager = require("./harness-manager");
const SKILL_VERSION = require("../../package.json").version;

function courseRoot(course) {
  if (!course || typeof course !== "string") throw new TypeError("Se requiere la ruta del curso.");
  return path.resolve(course);
}

function coursePaths(course) {
  const root = courseRoot(course);
  return {
    root,
    readme: path.join(root, "README.md"),
    state: path.join(root, ".jintia", "state.json"),
    weeks: path.join(root, "semanas"),
    bibliography: path.join(root, "bibliografia"),
    config: path.join(root, "config"),
    context: path.join(root, CONTEXT_FILE),
  };
}

function defaultContext() {
  return `# Jintia Context\n\n<!-- Datos duraderos del proyecto. No sustituye el README.md canónico. -->\n\n## Course\n\n- Nombre: \n- Código: \n- Periodo: \n- Plantilla: \n\n## Pedagogy\n\n- Perfil del estudiante: \n- Conocimientos previos: \n- Modalidad: \n- Restricciones: \n\n## Editorial\n\n- Idioma: español\n- Terminología: \n- Convenciones de figuras: guidefigure\n- Convenciones de tablas: guidetable\n`;
}

function initContext(course, overwrite = false) {
  const paths = coursePaths(course);
  if (!overwrite && fs.existsSync(paths.context)) return { path: paths.context, created: false };
  fs.writeFileSync(paths.context, defaultContext());
  return { path: paths.context, created: true };
}

function readContext(course) {
  const paths = coursePaths(course);
  return { path: paths.context, exists: fs.existsSync(paths.context), content: fs.existsSync(paths.context) ? fs.readFileSync(paths.context, "utf8") : null };
}

function validateContext(course) {
  const context = readContext(course);
  const missing = context.exists ? CONTEXT_SECTIONS.filter(section => !new RegExp(`^##\\s+${section}\\s*$`, "im").test(context.content)) : ["JINTIA.md", ...CONTEXT_SECTIONS];
  return { valid: missing.length === 0, path: context.path, missing };
}

function normalizeWeek(week) {
  const value = Number(week);
  if (!Number.isInteger(value) || value < 1 || value > 52) throw new RangeError("La semana debe ser un entero entre 1 y 52.");
  return String(value).padStart(2, "0");
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function loadCourseState(course) {
  const paths = coursePaths(course);
  if (!fs.existsSync(paths.state)) return { schemaVersion: "1.0", weeks: {} };
  const parsed = JSON.parse(fs.readFileSync(paths.state, "utf8"));
  return { schemaVersion: "1.0", weeks: {}, ...parsed, weeks: parsed.weeks || {} };
}

function saveCourseState(course, state) {
  const paths = coursePaths(course);
  fs.mkdirSync(path.dirname(paths.state), { recursive: true });
  fs.writeFileSync(paths.state, `${JSON.stringify(state, null, 2)}\n`);
  return paths.state;
}

function updateCourseState(course, week, status, source, now = new Date()) {
  if (!status || typeof status !== "string") throw new TypeError("Se requiere un estado editorial.");
  const paths = coursePaths(course);
  const state = loadCourseState(course);
  state.schemaVersion ||= "1.0";
  state.jintiaVersion ||= SKILL_VERSION;
  state.weeks[normalizeWeek(week)] = {
    status,
    updatedAt: now.toISOString(),
    ...(source && fs.existsSync(path.resolve(source)) ? {
      sourceHash: hashFile(path.resolve(source)),
      source: path.relative(paths.root, path.resolve(source)).replace(/\\/g, "/"),
    } : {}),
  };
  return saveCourseState(paths.root, state);
}

function readCourse(course) {
  const paths = coursePaths(course);
  return {
    ...paths,
    exists: fs.existsSync(paths.root),
    syllabusExists: fs.existsSync(paths.readme),
    syllabus: fs.existsSync(paths.readme) ? fs.readFileSync(paths.readme, "utf8") : null,
    state: loadCourseState(paths.root),
  };
}

const evidenceGate   = require("./evidence-gate");
const planState      = require("./plan-state");
const syllabusManager = require("./syllabus-manager");
const citations      = require("./citations");

module.exports = {
  CORE_VERSION, CONTEXT_FILE, CONTEXT_SECTIONS,
  courseRoot, coursePaths,
  initContext, readContext, validateContext,
  normalizeWeek, hashFile,
  loadCourseState, saveCourseState, updateCourseState, readCourse,
  ...harnesses, ...harnessManager,
  // Módulos core P0/P1
  evidenceGate,
  planState,
  syllabusManager,
  citations,
};
