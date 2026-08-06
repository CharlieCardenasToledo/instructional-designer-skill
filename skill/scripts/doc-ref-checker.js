#!/usr/bin/env node
"use strict";

/**
 * doc-ref-checker.js — Verificador de referencias internas en documentación Markdown
 *
 * Escanea los archivos .md de la skill y detecta rutas en backticks simples
 * que apuntan a archivos de la propia skill que no existen.
 * Solo verifica rutas con prefijos internos conocidos (references/, commands/,
 * scripts/, etc.) para evitar falsos positivos con rutas del usuario.
 *
 * Uso:
 *   node scripts/doc-ref-checker.js [--json] [--strict]
 */

const fs   = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// Solo se verifican rutas que comiencen con estos prefijos (internos a la skill).
// config/ NO se incluye: esos archivos son creados por el proyecto del usuario,
// no forman parte de la distribución de la skill.
const SKILL_PREFIXES = [
  "references/", "commands/", "scripts/", "agents/",
  "schemas/", "themes/", "tests/", "behaviors/", "bin/", "runtime/",
  "rules/", "skill/",
];

// Extensiones que se interpretan como rutas de archivo (no comandos)
const FILE_EXTS = new Set([
  ".md", ".js", ".mjs", ".json", ".yaml", ".yml", ".css", ".html", ".bib", ".toml",
]);

// Archivos y directorios ignorados en el escaneo
const IGNORE_DIRS  = new Set(["node_modules", ".git", "dist", "dist2", "landing"]);
const IGNORE_FILES = new Set(["CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Elimina bloques ```...``` para no analizar ejemplos de código. */
function stripFencedCode(content) {
  return content.replace(/```[\s\S]*?```/g, m => "\n".repeat(m.split("\n").length - 1));
}

/** Devuelve true si el contenido del backtick parece una ruta de archivo interna. */
function isSkillFileRef(inner) {
  if (inner.includes(" ") || inner.includes("<") || inner.includes(">")) return false;
  const ext = path.extname(inner).toLowerCase();
  if (!FILE_EXTS.has(ext)) return false;
  return SKILL_PREFIXES.some(p => inner.startsWith(p));
}

/** Intenta resolver una ruta contra el ROOT de la skill o el root del repo. */
function resolveRef(ref) {
  const fromSkill = path.resolve(ROOT, ref);
  if (fs.existsSync(fromSkill)) return { exists: true };
  // Intentar como relativo al repo (padre de skill/)
  const fromRepo = path.resolve(ROOT, "..", ref);
  if (fs.existsSync(fromRepo)) return { exists: true };
  return { exists: false, resolved: fromSkill };
}

// ── Escáner de un archivo ────────────────────────────────────────────────────

function checkFile(mdPath) {
  const raw     = fs.readFileSync(mdPath, "utf8");
  const content = stripFencedCode(raw);
  const issues  = [];
  const pattern = /`([^`\n]+)`/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const inner = m[1].trim();
    if (!isSkillFileRef(inner)) continue;
    const { exists, resolved } = resolveRef(inner);
    if (!exists) {
      const lineNum = raw.slice(0, m.index).split("\n").length;
      issues.push({
        file:    mdPath,
        line:    lineNum,
        ref:     inner,
        resolved,
        message: `Referencia rota: \`${inner}\``,
      });
    }
  }
  return issues;
}

// ── Colector de archivos ──────────────────────────────────────────────────────

function collectMd(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMd(full));
    } else if (entry.name.endsWith(".md") && !IGNORE_FILES.has(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// ── Runner ────────────────────────────────────────────────────────────────────

function run(options = {}) {
  const scanRoot  = options.dir || ROOT;
  const mdFiles   = collectMd(scanRoot);
  const allIssues = [];

  for (const file of mdFiles) {
    try {
      allIssues.push(...checkFile(file));
    } catch (err) {
      allIssues.push({ file, line: 0, ref: "", message: `Error al leer: ${err.message}` });
    }
  }

  return {
    tool:    "jintia doc-ref-checker",
    version: "1.0.0",
    scanned: mdFiles.length,
    issues:  allIssues,
    summary: { scanned: mdFiles.length, issues: allIssues.length, ok: allIssues.length === 0 },
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
    console.log(`Jintia Doc Ref Checker — ${report.scanned} archivos escaneados`);
    if (!report.issues.length) {
      console.log("✓ No se encontraron referencias rotas.");
    } else {
      for (const issue of report.issues) {
        const rel = path.relative(ROOT, issue.file);
        console.log(`✗ ${rel}:${issue.line} — ${issue.message}`);
      }
    }
    console.log(`\nResultado: ${report.summary.issues} referencias rotas.`);
  }

  if (report.summary.issues > 0) process.exitCode = 1;
}

module.exports = { run, checkFile, isSkillFileRef };
