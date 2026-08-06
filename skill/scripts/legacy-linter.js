#!/usr/bin/env node
"use strict";

/**
 * legacy-linter.js — Detector de términos heredados LaTeX/v10 en la skill
 *
 * Escanea archivos .md, .js, .json y .yaml dentro de skill/ y reporta
 * cualquier término que haya sido eliminado en la migración a HTML (v11).
 *
 * Uso:
 *   node scripts/legacy-linter.js [--json] [--strict]
 */

const fs   = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// ─── Reglas de términos v10 heredados ────────────────────────────────────────
// LGC-001..009: plantillas y scripts eliminados en la migración v10→v11
const LEGACY_RULES = [
  { id: "LGC-001", pattern: /elegantbook-clasico/g,     description: "Nombre de plantilla LaTeX eliminada" },
  { id: "LGC-002", pattern: /kaohandt-marginal/g,       description: "Nombre de plantilla LaTeX eliminada" },
  { id: "LGC-003", pattern: /latex-linter\.js/g,        description: "Script LaTeX eliminado" },
  { id: "LGC-004", pattern: /latex-validator\.js/g,     description: "Script LaTeX eliminado" },
  { id: "LGC-005", pattern: /preamble\.tex/g,           description: "Archivo de preámbulo LaTeX eliminado" },
  { id: "LGC-007", pattern: /\\textcite\{/g,            description: "Macro de cita LaTeX (usar {{cite:clave}})" },
  { id: "LGC-008", pattern: /\\parencite\{/g,           description: "Macro de cita LaTeX (usar {{cite:clave}})" },
  { id: "LGC-009", pattern: /\\printbibliography/g,     description: "Macro de bibliografía LaTeX (usar nodo bibliography)" },
];

// ─── Reglas de LaTeX activo en rutas de curso/skill ──────────────────────────
// LGC-010..019: términos que indican que el agente está generando LaTeX
// en lugar de guide.json. Se aplican a todos los archivos EXCEPTO los de
// rutas explícitamente exentas (ver ACTIVE_LATEX_EXEMPT_PATHS más abajo).
const ACTIVE_LATEX_RULES = [
  { id: "LGC-010", pattern: /\\documentclass\s*[\[{]/g,  description: "Documento LaTeX en ruta activa (crear guide.json en su lugar)" },
  { id: "LGC-011", pattern: /\\begin\{document\}/g,      description: "Entorno LaTeX en ruta activa (usar guide.json)" },
  { id: "LGC-012", pattern: /\bpdflatex\b/g,             description: "Compilador pdflatex en ruta activa (Vivliostyle reemplaza a pdflatex)" },
  { id: "LGC-013", pattern: /\bxelatex\b/g,              description: "Compilador xelatex en ruta activa (usar Vivliostyle)" },
  { id: "LGC-014", pattern: /\blualatex\b/g,             description: "Compilador lualatex en ruta activa (usar Vivliostyle)" },
  { id: "LGC-015", pattern: /guia-semana-\d+\.tex/g,     description: "Archivo de guía LaTeX detectado (usar guide.json)" },
];

// Patrones de rutas exentas para reglas ACTIVE_LATEX (relativas a ROOT)
// Nota: visual-renderer.js usa pdflatex solo para figuras TikZ — exento.
// guide-migrator.js convierte .tex antiguos — exento.
// sistema-html.md describe qué NO hace el sistema — exento.
// audit.md muestra ejemplos de hallazgos históricos — exento.
const ACTIVE_LATEX_EXEMPT_PATHS = [
  "scripts/legacy-manager.js",
  "scripts/visual-renderer.js",
  "scripts/visual-pipeline.js",
  "scripts/visual-source-generator.js",
  "scripts/guide-migrator.js",
  "commands/migrate.md",
  "commands/audit.md",
  "references/figuras-tikz.md",
  "references/sistema-html.md",
  "config/visual-tools.json",
  "config/visual-install-profiles.json",
];

// Directorios exentos para reglas ACTIVE_LATEX
const ACTIVE_LATEX_EXEMPT_DIRS = [
  "tests/fixtures/legacy",
  "docs/history",
  ".jintia-backup",
];

const SCAN_EXTS = new Set([".md", ".js", ".mjs", ".json", ".yaml", ".yml"]);

// ─── Escaneo de directorio de curso ──────────────────────────────────────────

const COURSE_SCAN_EXTS    = new Set([".md", ".tex", ".txt", ".json"]);
const COURSE_IGNORE_DIRS  = new Set(["node_modules", ".git", ".jintia-backup", "legacy"]);

// Reglas de contenido para archivos en un directorio de curso
const COURSE_CONTENT_RULES = [
  { id: "LGC-C03", pattern: /\\documentclass\s*[\[{]/g, description: "Documento LaTeX detectado (crear guide.json en su lugar)" },
  { id: "LGC-C04", pattern: /\\begin\{document\}/g,     description: "Entorno LaTeX detectado (usar guide.json)" },
];

function walkCourseDir(dir, cb) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (COURSE_IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    cb(entry, fullPath);
    if (entry.isDirectory()) walkCourseDir(fullPath, cb);
  }
}

function scanCourse(courseRoot) {
  const issues    = [];
  const latexDirs = [];
  const texFiles  = [];

  walkCourseDir(courseRoot, (entry, fullPath) => {
    if (entry.isDirectory() && entry.name === "latex") {
      latexDirs.push(fullPath);
      issues.push({
        rule: "LGC-C01", file: fullPath, line: 0, col: 0, match: "latex/",
        message: `LGC-C01: Directorio latex/ detectado — respaldar con 'jintia migrate' y eliminar manualmente`,
      });
    }
    if (entry.isFile() && entry.name.endsWith(".tex")) {
      texFiles.push(fullPath);
      issues.push({
        rule: "LGC-C02", file: fullPath, line: 0, col: 0, match: ".tex",
        message: `LGC-C02: Archivo .tex detectado — usar guide.json en lugar de LaTeX`,
      });
    }
    if (entry.isFile() && COURSE_SCAN_EXTS.has(path.extname(entry.name).toLowerCase())) {
      let content;
      try { content = fs.readFileSync(fullPath, "utf8"); } catch { return; }
      const lines = content.split("\n");
      for (const rule of COURSE_CONTENT_RULES) {
        for (let i = 0; i < lines.length; i++) {
          rule.pattern.lastIndex = 0;
          let m;
          while ((m = rule.pattern.exec(lines[i])) !== null) {
            issues.push({
              rule:    rule.id,
              file:    fullPath,
              line:    i + 1,
              col:     m.index + 1,
              match:   m[0],
              message: `${rule.id}: ${rule.description} ("${m[0]}")`,
            });
          }
        }
      }
    }
  });

  return {
    tool:       "jintia legacy:check (course)",
    version:    "1.1.0",
    courseRoot,
    issues,
    summary: {
      latexDirs: latexDirs.length,
      texFiles:  texFiles.length,
      issues:    issues.length,
      ok:        issues.length === 0,
    },
  };
}

const IGNORE_DIRS  = new Set(["node_modules", ".git", "dist", "dist2", "landing"]);
// Archivos exentos de reglas heredadas v10: historial de cambios, licencias,
// scripts de migración, playbook de migración, este script (contiene los
// patrones como literales) y el test del propio linter.
const IGNORE_FILES = new Set([
  "CHANGELOG.md",
  "THIRD_PARTY_NOTICES.md",
  "legacy-manager.js",
  "legacy-linter.js",
  "linters.test.js",
  "migrate.md",
  "regression.test.js",
]);

// ── Helpers de exención ───────────────────────────────────────────────────────

function isExemptFromActiveLatex(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  if (ACTIVE_LATEX_EXEMPT_PATHS.some(p => rel.endsWith(p) || rel.includes(p))) return true;
  if (ACTIVE_LATEX_EXEMPT_DIRS.some(d => rel.includes(d))) return true;
  return false;
}

// ── Escáner ───────────────────────────────────────────────────────────────────

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines   = content.split("\n");
  const issues  = [];

  const activeLatexExempt = isExemptFromActiveLatex(filePath);

  const rules = activeLatexExempt
    ? LEGACY_RULES
    : [...LEGACY_RULES, ...ACTIVE_LATEX_RULES];

  for (const rule of rules) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(line)) !== null) {
        issues.push({
          rule:    rule.id,
          file:    filePath,
          line:    i + 1,
          col:     m.index + 1,
          match:   m[0],
          message: `${rule.id}: ${rule.description} ("${m[0]}")`,
        });
      }
    }
  }

  return issues;
}

function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (
      SCAN_EXTS.has(path.extname(entry.name).toLowerCase()) &&
      !IGNORE_FILES.has(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

// ── Runner ────────────────────────────────────────────────────────────────────

function run(options = {}) {
  const scanRoot  = options.dir || ROOT;
  const files     = collectFiles(scanRoot);

  // También escanear openai-plugin/ (en el repo, fuera de skill/)
  // para detectar manifiestos que todavía declaren capacidades LaTeX.
  const pluginDir = path.resolve(ROOT, "..", "openai-plugin");
  if (!options.dir && fs.existsSync(pluginDir)) {
    files.push(...collectFiles(pluginDir));
  }

  const allIssues = [];

  for (const file of files) {
    try {
      allIssues.push(...checkFile(file));
    } catch (err) {
      allIssues.push({ rule: "LGC-000", file, line: 0, col: 0, match: "", message: `Error al leer: ${err.message}` });
    }
  }

  const activeIssues = allIssues.filter(i => i.rule.startsWith("LGC-01"));
  const legacyIssues = allIssues.filter(i => !i.rule.startsWith("LGC-01"));

  return {
    tool:    "jintia legacy-linter",
    version: "1.1.0",
    scanned: files.length,
    issues:  allIssues,
    summary: {
      scanned:       files.length,
      issues:        allIssues.length,
      legacyIssues:  legacyIssues.length,
      activeLatex:   activeIssues.length,
      ok:            allIssues.length === 0,
    },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const asJson    = args.includes("--json");
  const strict    = args.includes("--strict");
  const courseArg = args.find(a => !a.startsWith("--"));

  if (courseArg) {
    // Modo escaneo de curso
    const courseRoot = path.resolve(courseArg);
    if (!fs.existsSync(courseRoot)) {
      const msg = `No existe el directorio de curso: ${courseRoot}`;
      if (asJson) console.log(JSON.stringify({ status: "error", message: msg }));
      else console.error(`✗ ${msg}`);
      process.exitCode = 1;
    } else {
      const report = scanCourse(courseRoot);
      if (asJson) {
        console.log(JSON.stringify({ status: report.summary.ok ? "ok" : "error", ...report }, null, 2));
      } else {
        console.log(`Jintia Legacy Check (curso) — ${courseRoot}`);
        if (!report.issues.length) {
          console.log("✓ No se encontraron artefactos LaTeX en el directorio del curso.");
        } else {
          for (const issue of report.issues) {
            const rel = path.relative(courseRoot, issue.file);
            console.log(`✗ ${rel}${issue.line ? `:${issue.line}` : ""} — ${issue.message}`);
          }
        }
        console.log(`\nResultado: ${report.summary.latexDirs} dirs latex/, ${report.summary.texFiles} archivos .tex, ${report.summary.issues} problemas en total.`);
      }
      if (!report.summary.ok) process.exitCode = 1;
    }
  } else {
    // Modo escaneo de skill (comportamiento original)
    const report = run({ strict });
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Jintia Legacy Linter — ${report.scanned} archivos escaneados`);
      if (!report.issues.length) {
        console.log("✓ No se encontraron términos heredados LaTeX/v10.");
      } else {
        for (const issue of report.issues) {
          const rel = path.relative(ROOT, issue.file);
          const severity = issue.rule.startsWith("LGC-01") ? "✗ [LaTeX activo]" : "✗ [heredado]";
          console.log(`${severity} ${rel}:${issue.line}:${issue.col} — ${issue.message}`);
        }
      }
      console.log(`\nResultado: ${report.summary.legacyIssues} heredados, ${report.summary.activeLatex} LaTeX activo.`);
    }
    if (report.summary.issues > 0) process.exitCode = 1;
  }
}

module.exports = { run, scanCourse, checkFile, LEGACY_RULES, ACTIVE_LATEX_RULES };
