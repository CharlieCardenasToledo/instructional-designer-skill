#!/usr/bin/env node
"use strict";

/**
 * migrate-runner.js — Detector y migrador de artefactos legacy en un directorio de curso
 *
 * Detecta y respalda:
 *   - Directorios latex/  (documentos LaTeX de generaciones anteriores)
 *   - Archivos .tex       (en cualquier nivel del árbol del curso)
 *   - Semanas duplicadas  (en README.md)
 *
 * Repara automáticamente (con backup previo):
 *   - Semanas duplicadas en README.md
 *
 * Requiere revisión manual (se respaldan pero no se eliminan):
 *   - Directorios latex/ y archivos .tex
 *
 * Produce un informe estructurado con tres campos:
 *   backedUp       — artefactos copiados a .jintia-backup/
 *   fixed          — problemas reparados automáticamente
 *   requiresReview — problemas que necesitan atención manual
 *
 * Uso:
 *   node scripts/migrate-runner.js <curso> [--dry-run] [--quarantine] [--keep-first|--keep-last] [--json]
 *
 * Flags:
 *   --quarantine   Mueve artefactos LaTeX al backup (copia + elimina originals). Requiere confirmación implícita.
 *   --keep-first   Al deduplicar semanas, conservar la primera aparición.
 *   --keep-last    Al deduplicar semanas, conservar la última aparición (antes comportamiento por defecto).
 *                  Sin --keep-first ni --keep-last: duplicados se reportan en requiresReview sin auto-reparar.
 */

const fs   = require("node:fs");
const path = require("node:path");

const {
  parseSyllabus,
  serializeSyllabus,
  validateSyllabus,
} = require("../runtime/core/syllabus-manager");

// Directorios que nunca se escanean durante la detección
const IGNORE_DIRS = new Set(["node_modules", ".git", ".jintia-backup", "legacy", ".jintia"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsNow() {
  const n = new Date();
  const p = v => String(v).padStart(2, "0");
  return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
}

function walkDir(dir, cb) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    cb(entry, fullPath);
    if (entry.isDirectory()) walkDir(fullPath, cb);
  }
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function removeDirSync(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirSync(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

// ─── Detección ────────────────────────────────────────────────────────────────

function detectLatexDirs(courseRoot) {
  const found = [];
  walkDir(courseRoot, (entry, fullPath) => {
    if (entry.isDirectory() && entry.name === "latex") found.push(fullPath);
  });
  return found;
}

function detectTexFiles(courseRoot) {
  const found = [];
  walkDir(courseRoot, (entry, fullPath) => {
    if (entry.isFile() && entry.name.endsWith(".tex")) found.push(fullPath);
  });
  return found;
}

function detectDuplicateWeeks(readmePath) {
  if (!fs.existsSync(readmePath)) return [];
  const content = fs.readFileSync(readmePath, "utf8");
  const model   = parseSyllabus(content);
  const seen    = new Set();
  const dupes   = [];
  for (const w of model.weeks) {
    if (seen.has(w.number)) { if (!dupes.includes(w.number)) dupes.push(w.number); }
    else seen.add(w.number);
  }
  return dupes;
}

// ─── Reparación ───────────────────────────────────────────────────────────────

function deduplicateWeeks(readmePath, backupRoot, courseRoot, strategy = "last") {
  const content = fs.readFileSync(readmePath, "utf8");
  const model   = parseSyllabus(content);

  // Conservar primera o última aparición según strategy
  const seenMap = new Map();
  if (strategy === "first") {
    for (const w of model.weeks) { if (!seenMap.has(w.number)) seenMap.set(w.number, w); }
  } else {
    for (const w of model.weeks) seenMap.set(w.number, w);
  }
  const dedupedModel = {
    ...model,
    weeks: [...seenMap.values()].sort((a, b) => a.number - b.number),
  };

  const rebuilt       = serializeSyllabus(dedupedModel);
  const { valid, errors } = validateSyllabus(rebuilt);

  if (!valid) return { ok: false, errors };

  // Backup del README.md original antes de modificar
  const relReadme  = path.relative(courseRoot, readmePath);
  const backupPath = path.join(backupRoot, `${relReadme}.pre-dedup`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(readmePath, backupPath);

  fs.writeFileSync(readmePath, rebuilt, "utf8");
  return { ok: true, backupPath };
}

// ─── Runner principal ─────────────────────────────────────────────────────────

function runMigrate(courseRoot, options = {}) {
  const dryRun      = options.dryRun || false;
  const quarantine  = options.quarantine || false;
  const keepStrategy = options.keepFirst ? "first" : options.keepLast ? "last" : null;
  const ts          = tsNow();
  const backupRoot  = path.join(courseRoot, ".jintia-backup", ts);

  const backedUp       = [];
  const fixed          = [];
  const requiresReview = [];

  // Detección
  const latexDirs  = detectLatexDirs(courseRoot);
  const texFiles   = detectTexFiles(courseRoot);
  const readmePath = path.join(courseRoot, "README.md");
  const dupWeeks   = detectDuplicateWeeks(readmePath);

  if (!latexDirs.length && !texFiles.length && !dupWeeks.length) {
    return { ok: true, clean: true, timestamp: ts, backedUp, fixed, requiresReview };
  }

  // Crear directorio de backup si hay algo que respaldar
  if (!dryRun) {
    fs.mkdirSync(backupRoot, { recursive: true });
  }

  // Directorios latex/ — respaldar; con --quarantine también eliminar originals
  for (const dir of latexDirs) {
    const rel = path.relative(courseRoot, dir);
    if (!dryRun) {
      const dst = path.join(backupRoot, rel);
      copyDirSync(dir, dst);
      const entry = {
        type:       "latex_dir",
        path:       rel,
        backedUpTo: path.relative(courseRoot, dst),
      };
      if (quarantine) {
        removeDirSync(dir);
        entry.quarantined = true;
      }
      backedUp.push(entry);
    }
    if (!quarantine || dryRun) {
      requiresReview.push({
        type:   "latex_dir",
        path:   rel,
        action: dryRun && quarantine ? "would_quarantine" : "manual_deletion",
        note:   dryRun
          ? (quarantine ? "Sería movido a .jintia-backup/ (--quarantine)." : "Sería respaldado en .jintia-backup/. Eliminar manualmente si ya no se necesita.")
          : "Respaldado en .jintia-backup/. Eliminar manualmente si ya no se necesita.",
      });
    } else {
      fixed.push({ type: "latex_dir", path: rel, action: "quarantined" });
    }
  }

  // Archivos .tex — respaldar; con --quarantine también eliminar originals
  for (const file of texFiles) {
    const rel = path.relative(courseRoot, file);
    if (!dryRun) {
      const dst = path.join(backupRoot, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(file, dst);
      const entry = {
        type:       "tex_file",
        path:       rel,
        backedUpTo: path.relative(courseRoot, dst),
      };
      if (quarantine) {
        fs.unlinkSync(file);
        entry.quarantined = true;
      }
      backedUp.push(entry);
    }
    if (!quarantine || dryRun) {
      requiresReview.push({
        type:   "tex_file",
        path:   rel,
        action: dryRun && quarantine ? "would_quarantine" : "manual_deletion",
        note:   dryRun
          ? (quarantine ? "Sería movido a .jintia-backup/ (--quarantine)." : "Sería respaldado en .jintia-backup/. Eliminar manualmente si ya no se necesita.")
          : "Respaldado en .jintia-backup/. Eliminar manualmente si ya no se necesita.",
      });
    } else {
      fixed.push({ type: "tex_file", path: rel, action: "quarantined" });
    }
  }

  // Semanas duplicadas — auto-reparar solo si se especificó --keep-first o --keep-last
  if (dupWeeks.length) {
    if (!dryRun && keepStrategy) {
      const result = deduplicateWeeks(readmePath, backupRoot, courseRoot, keepStrategy);
      if (result.ok) {
        fixed.push({
          type:       "duplicate_weeks",
          weeks:      dupWeeks,
          action:     `deduplicated (${keepStrategy})`,
          backupPath: path.relative(courseRoot, result.backupPath),
        });
      } else {
        requiresReview.push({
          type:   "duplicate_weeks",
          weeks:  dupWeeks,
          action: "manual_fix",
          note:   `Deduplicación falló: ${result.errors?.join("; ")}`,
        });
      }
    } else {
      requiresReview.push({
        type:   "duplicate_weeks",
        weeks:  dupWeeks,
        action: keepStrategy ? "dedup_needed" : "choose_strategy",
        note:   dryRun && keepStrategy
          ? `Se corregirá con estrategia '${keepStrategy}' al ejecutar sin --dry-run.`
          : `Pasa --keep-first o --keep-last para auto-resolver. Las semanas duplicadas son: ${dupWeeks.join(", ")}.`,
      });
    }
  }

  return {
    ok:          true,
    clean:       false,
    timestamp:   ts,
    backupRoot:  dryRun ? null : path.relative(courseRoot, backupRoot),
    backedUp,
    fixed,
    requiresReview,
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args        = process.argv.slice(2);
  const courseDir   = args.find(a => !a.startsWith("--")) || ".";
  const dryRun      = args.includes("--dry-run");
  const quarantine  = args.includes("--quarantine");
  const keepFirst   = args.includes("--keep-first");
  const keepLast    = args.includes("--keep-last");
  const asJson      = args.includes("--json");

  const courseRoot = path.resolve(courseDir);

  if (!fs.existsSync(courseRoot)) {
    const msg = `No existe el directorio: ${courseRoot}`;
    if (asJson) console.log(JSON.stringify({ status: "error", message: msg }));
    else console.error(`✗ ${msg}`);
    process.exitCode = 1;
    return;
  }

  const result = runMigrate(courseRoot, { dryRun, quarantine, keepFirst, keepLast });

  if (asJson) {
    console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
    return;
  }

  if (result.clean) {
    console.log(`✓ No se encontraron artefactos legacy en: ${courseRoot}`);
    return;
  }

  console.log(dryRun ? `[dry-run] Análisis de ${courseRoot}\n` : `✓ Migración completada: ${courseRoot}\n`);

  if (result.backedUp.length) {
    console.log(`Respaldados (${result.backedUp.length}):`);
    for (const item of result.backedUp) {
      console.log(`  • [${item.type}] ${item.path}`);
      console.log(`    → ${item.backedUpTo}`);
    }
    console.log();
  }

  if (result.fixed.length) {
    console.log(`Reparados automáticamente (${result.fixed.length}):`);
    for (const item of result.fixed) {
      if (item.type === "duplicate_weeks") {
        console.log(`  ✓ Semanas duplicadas eliminadas: ${item.weeks.join(", ")}`);
        console.log(`    Respaldo previo: ${item.backupPath}`);
      }
    }
    console.log();
  }

  if (result.requiresReview.length) {
    console.log(`Requiere revisión manual (${result.requiresReview.length}):`);
    for (const item of result.requiresReview) {
      const label = item.weeks ? `semanas ${item.weeks.join(",")}` : item.path;
      console.log(`  ⚠ [${item.type}] ${label}`);
      if (item.note) console.log(`    ${item.note}`);
    }
    console.log();
  }

  if (!dryRun && result.backupRoot) {
    console.log(`Respaldo guardado en: ${result.backupRoot}`);
  }
}

module.exports = { runMigrate, detectLatexDirs, detectTexFiles, detectDuplicateWeeks };
