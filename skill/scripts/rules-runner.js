#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "rules", "catalog.json"), "utf8"));

function issue(rule, message, file, line = 1) {
  return { rule: rule.id, category: rule.category, severity: rule.severity, message, file, line };
}

function lineOf(source, index) { return source.slice(0, index).split(/\r?\n/).length; }

function runRules(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`No existe el archivo objetivo: ${absolute}`);
  const source = fs.readFileSync(absolute, "utf8");
  const issues = [];
  const isSyllabus = path.basename(absolute).toLowerCase() === "readme.md";
  const isLatex = path.extname(absolute).toLowerCase() === ".tex";
  const rules = Object.fromEntries(catalog.rules.map(rule => [rule.id, rule]));

  if (isSyllabus) {
    if (!/\*\*Resultado de aprendizaje:\*\*/i.test(source)) issues.push(issue(rules["JIN-SYL-001"], "Falta **Resultado de aprendizaje:**.", absolute));
    if (!/^###\s+Semana\s+\d+/im.test(source)) issues.push(issue(rules["JIN-SYL-002"], "No se detectó una sección ### Semana XX.", absolute));
    if (!/\*\*(?:Bibliografía|Bibliografia|Recursos)[^:]*:\*\*/i.test(source) || !/\*\*Actividades calificadas:\*\*/i.test(source)) {
      issues.push(issue(rules["JIN-SYL-004"], "Falta bibliografía/recursos o actividades calificadas.", absolute));
    }
    const weekBlocks = source.split(/^###\s+Semana\s+\d+[^\n]*$/im).slice(1);
    for (const block of weekBlocks) {
      const hasOutcome = /\*\*Resultado de aprendizaje:\*\*/i.test(block);
      const hasEvidence = /\*\*(?:Actividades calificadas|Herramienta de aprendizaje):\*\*/i.test(block);
      if (!hasOutcome || !hasEvidence) issues.push(issue(rules["JIN-ALN-002"], "Una semana no conecta resultado con actividad, recurso o evidencia.", absolute));
    }
  }

  if (isLatex) {
    if (!/\\documentclass(?:\[[^\]]*\])?\{(?:elegantbook|kaohandt)\}/.test(source)) {
      issues.push(issue(rules["JIN-TMP-003"], "No se detectó documentclass elegantbook o kaohandt.", absolute));
    }
    const labels = [...source.matchAll(/\\label\{(fig:[^}]+)\}/g)].map(match => ({ key: match[1], index: match.index }));
    for (const label of labels) {
      const before = source.slice(0, label.index);
      const escaped = label.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`Figura(?:~|\\s+)\\\\ref\\\\{${escaped}\\\\}`).test(before)) {
        issues.push(issue(rules["JIN-LTX-006"], `La figura ${label.key} no tiene una referencia previa visible.`, absolute, lineOf(source, label.index)));
      }
    }
    if (/\\includegraphics(?:\[[^\]]*\])?\{/.test(source) && !/\\guidefigurecaption\{/.test(source)) {
      issues.push(issue(rules["JIN-ACC-002"], "Se encontró una imagen sin guidefigurecaption.", absolute));
    }
    const bibPath = path.join(path.dirname(absolute), "reference.bib");
    if (fs.existsSync(bibPath)) {
      const bib = fs.readFileSync(bibPath, "utf8");
      const cited = [...source.matchAll(/\\(?:textcite|parencite|cite)\{([^}]+)\}/g)].flatMap(match => match[1].split(",").map(key => key.trim()));
      for (const key of cited) if (!new RegExp(`@[^\\n{]+\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,`, "i").test(bib)) {
        issues.push(issue(rules["JIN-BIB-003"], `La clave bibliográfica ${key} no existe en reference.bib.`, absolute));
      }
    } else if (/\\(?:textcite|parencite|cite)\{/.test(source)) {
      issues.push(issue(rules["JIN-TMP-004"], "La guía contiene citas, pero falta reference.bib.", absolute));
    }
  }
  return { tool: "jintia rules", catalogVersion: catalog.version, target: absolute, issues, summary: {
    errors: issues.filter(item => item.severity === "error").length,
    warnings: issues.filter(item => item.severity === "warning").length,
    passed: issues.length === 0
  } };
}

function printReport(report, json = false) {
  if (json) return console.log(JSON.stringify(report, null, 2));
  console.log(`Jintia Rules · ${report.target}`);
  if (!report.issues.length) console.log("✓ No se encontraron incidencias.");
  for (const item of report.issues) console.log(`${item.severity === "error" ? "✗" : "⚠"} ${item.rule} · ${item.file}:${item.line} · ${item.message}`);
  console.log(`Resultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args.find(arg => !arg.startsWith("--"));
  if (!target) { console.error("Uso: node scripts/rules-runner.js <README.md|guia.tex> [--json] [--strict]"); process.exit(2); }
  try {
    const report = runRules(target);
    printReport(report, args.includes("--json"));
    if (report.summary.errors || (args.includes("--strict") && report.summary.warnings)) process.exitCode = 1;
  } catch (error) { console.error(`Jintia Rules: ${error.message}`); process.exitCode = 1; }
}

module.exports = { runRules, catalog };
