#!/usr/bin/env node
/**
 * sync-version.mjs — Propaga la versión desde skill/package.json a todos los manifiestos.
 *
 * Uso:
 *   node scripts/sync-version.mjs [--check]
 *
 * Sin flags: actualiza los archivos y reporta qué cambió.
 * Con --check: solo verifica, sale con código 1 si hay desincronización.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT     = resolve(import.meta.dirname, "..");
const readJson = rel => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
const checkOnly = process.argv.includes("--check");

// ─── Fuente de verdad ─────────────────────────────────────────────────────────
const skillPkg = readJson("skill/package.json");
const version  = skillPkg.version;

// ─── Archivos que deben sincronizarse ────────────────────────────────────────
const TARGETS = [
  "package.json",
  "skill/.claude-plugin/plugin.json",
  "openai-plugin/.codex-plugin/plugin.json",
];

let outOfSync = 0;

for (const rel of TARGETS) {
  const fullPath = resolve(ROOT, rel);
  const data = readJson(rel);
  if (data.version === version) {
    console.log(`  ${rel}: ${version}`);
  } else if (checkOnly) {
    console.error(`[DESYNC] ${rel}: ${data.version} ≠ ${version}`);
    outOfSync++;
  } else {
    data.version = version;
    writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`✓ ${rel}: ${data.version} → ${version}`);
  }
}

if (checkOnly && outOfSync > 0) {
  console.error(`\n${outOfSync} archivo(s) desincronizados. Ejecuta: npm run sync-version`);
  process.exit(1);
}

if (!checkOnly) console.log(`\nVersiones sincronizadas a ${version}.`);
