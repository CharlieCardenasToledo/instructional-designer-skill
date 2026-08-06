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

// Reglas LGC: { id, pattern (RegExp), description }
const LEGACY_RULES = [
  { id: "LGC-001", pattern: /elegantbook-clasico/g,     description: "Nombre de plantilla LaTeX eliminada" },
  { id: "LGC-002", pattern: /kaohandt-marginal/g,       description: "Nombre de plantilla LaTeX eliminada" },
  { id: "LGC-003", pattern: /latex-linter\.js/g,        description: "Script LaTeX eliminado" },
  { id: "LGC-004", pattern: /latex-validator\.js/g,     description: "Script LaTeX eliminado" },
  { id: "LGC-005", pattern: /preamble\.tex/g,           description: "Archivo de preámbulo LaTeX eliminado" },
  { id: "LGC-007", pattern: /\\textcite\{/g,            description: "Macro de cita LaTeX (usar citation node)" },
  { id: "LGC-008", pattern: /\\parencite\{/g,           description: "Macro de cita LaTeX (usar citation node)" },
  { id: "LGC-009", pattern: /\\printbibliography/g,     description: "Macro de bibliografía LaTeX (usar bibliography node)" },
];

const SCAN_EXTS = new Set([".md", ".js", ".mjs", ".json", ".yaml", ".yml"]);

const IGNORE_DIRS  = new Set(["node_modules", ".git", "dist", "dist2", "landing"]);
// Archivos exentos: historial de cambios, licencias, scripts de migración,
// playbook de migración, este script (contiene patrones como literales)
// y el test del propio linter (necesita strings legacy para sus fixtures).
const IGNORE_FILES = new Set([
  "CHANGELOG.md",
  "THIRD_PARTY_NOTICES.md",
  "legacy-manager.js",
  "legacy-linter.js",
  "linters.test.js",
  "migrate.md",
]);

// ── Escáner ──────────────────────────────────────────────────────────────────

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines   = content.split("\n");
  const issues  = [];

  for (const rule of LEGACY_RULES) {
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
  const allIssues = [];

  for (const file of files) {
    try {
      allIssues.push(...checkFile(file));
    } catch (err) {
      allIssues.push({ rule: "LGC-000", file, line: 0, col: 0, match: "", message: `Error al leer: ${err.message}` });
    }
  }

  return {
    tool:    "jintia legacy-linter",
    version: "1.0.0",
    scanned: files.length,
    issues:  allIssues,
    summary: { scanned: files.length, issues: allIssues.length, ok: allIssues.length === 0 },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args   = process.argv.slice(2);
  const asJson = args.includes("--json");

  const report = run();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Jintia Legacy Linter — ${report.scanned} archivos escaneados`);
    if (!report.issues.length) {
      console.log("✓ No se encontraron términos heredados LaTeX/v10.");
    } else {
      for (const issue of report.issues) {
        const rel = path.relative(ROOT, issue.file);
        console.log(`✗ ${rel}:${issue.line}:${issue.col} — ${issue.message}`);
      }
    }
    console.log(`\nResultado: ${report.summary.issues} violaciones encontradas.`);
  }

  if (report.summary.issues > 0) process.exitCode = 1;
}

module.exports = { run, checkFile, LEGACY_RULES };
