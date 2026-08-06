#!/usr/bin/env node
"use strict";

/**
 * transcript-export.js — Exporta el estado editorial de una sesión Jintia
 *
 * Este script exporta el estado persistido del curso (planes, estados editoriales,
 * errores registrados, guías generadas) como un informe estructurado de sesión.
 *
 * IMPORTANTE: El transcript literal de la conversación (mensajes del usuario y del
 * asistente) solo puede exportarlo el harness (Claude Code, Codex, etc.) mediante
 * sus propios mecanismos de exportación. Este script exporta la TRAZA EDITORIAL,
 * no los mensajes de chat.
 *
 * Modos:
 *   editorial   Estado de planes, guías y validaciones (por defecto)
 *   technical   Editorial + errores de validación + comandos ejecutados
 *   summary     Resumen estructurado del progreso del curso
 *
 * Uso:
 *   node scripts/transcript-export.js <curso> [--output FILE] [--mode editorial|technical|summary]
 *                                             [--redact=email,path,token] [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");

const planState       = require("../runtime/core/plan-state");
const { loadCourseState } = require("../runtime/core/index");
const { validateSyllabus } = require("../runtime/core/syllabus-manager");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function isoNow() {
  return new Date().toISOString();
}

function redactString(str, redactFields) {
  if (!str || !redactFields.length) return str;
  let result = str;
  if (redactFields.includes("email")) {
    result = result.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]");
  }
  if (redactFields.includes("path")) {
    // Redactar rutas absolutas de Windows y Unix
    result = result.replace(/[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/gi, "[RUTA]");
    result = result.replace(/\/(?:home|Users)\/[^/\s]+(?:\/[^/\s]+)*/g, "[RUTA]");
  }
  if (redactFields.includes("token")) {
    result = result.replace(/(?:api[_-]?key|token|secret)[=:\s]+[\w-]{10,}/gi, "$&".replace(/[\w-]{10,}$/, "[TOKEN]"));
  }
  return result;
}

// ─── Recolección de datos persistidos ────────────────────────────────────────

function collectPlanStates(courseRoot) {
  const semanasDir = path.join(courseRoot, "semanas");
  const plans = [];
  if (!fs.existsSync(semanasDir)) return plans;

  for (const entry of fs.readdirSync(semanasDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = entry.name.match(/^semana-(\d{2})$/);
    if (!m) continue;
    const weekNum = parseInt(m[1], 10);
    const record  = planState.getPlan(courseRoot, weekNum);
    if (record) plans.push(record);
  }
  return plans.sort((a, b) => a.week - b.week);
}

function collectGuideMetadata(courseRoot) {
  const guides = [];
  const semanasDir = path.join(courseRoot, "semanas");
  if (!fs.existsSync(semanasDir)) return guides;

  for (const entry of fs.readdirSync(semanasDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const guideJson = path.join(semanasDir, entry.name, "guide.json");
    if (!fs.existsSync(guideJson)) continue;
    try {
      const guide = JSON.parse(fs.readFileSync(guideJson, "utf8"));
      guides.push({
        week:      guide.metadata?.week,
        topic:     guide.metadata?.topic,
        outcome:   guide.metadata?.outcome,
        theme:     guide.metadata?.theme,
        sections:  (guide.sections || []).length,
        path:      guideJson,
        generated: fs.statSync(guideJson).mtime.toISOString(),
      });
    } catch { /* JSON inválido */ }
  }
  return guides.sort((a, b) => (a.week || 0) - (b.week || 0));
}

function collectValidationErrors(courseRoot) {
  const errors = [];
  const semanasDir = path.join(courseRoot, "semanas");
  if (!fs.existsSync(semanasDir)) return errors;

  for (const entry of fs.readdirSync(semanasDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const errFile = path.join(semanasDir, entry.name, ".jintia-errors.json");
    if (!fs.existsSync(errFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(errFile, "utf8"));
      errors.push({ week: entry.name, ...data });
    } catch { /* archivo malformado */ }
  }
  return errors;
}

// ─── Formateadores por modo ───────────────────────────────────────────────────

function formatEditorial(data, redact) {
  const r = s => redactString(s, redact);
  const lines = [
    `# Informe editorial de sesión Jintia`,
    ``,
    `**Generado:** ${timestamp()}`,
    `**Curso:** ${r(data.course)}`,
    `**Ruta:** ${r(data.courseRoot)}`,
    `**Versión skill:** ${data.skillVersion}`,
    ``,
    `---`,
    ``,
    `## Sílabo`,
    ``,
    `**Estado:** ${data.syllabusValid ? "✓ Válido" : "✗ Con errores"}`,
  ];

  if (!data.syllabusValid && data.syllabusErrors?.length) {
    for (const e of data.syllabusErrors) lines.push(`- ✗ ${e}`);
  }

  lines.push(``, `## Planes semanales`, ``);

  if (!data.plans.length) {
    lines.push("_Sin planes registrados._");
  } else {
    for (const p of data.plans) {
      lines.push(`### Semana ${String(p.week).padStart(2, "0")} — ${p.topic || "(sin tema)"}`);
      lines.push(`- Estado: **${p.status}**`);
      if (p.savedAt)    lines.push(`- Guardado: ${p.savedAt}`);
      if (p.approvedAt) lines.push(`- Aprobado: ${p.approvedAt}`);
      if (p.generatedAt) lines.push(`- Generado: ${p.generatedAt}`);
      if (p.missingEvidence?.length) {
        lines.push(`- Evidencia faltante: ${p.missingEvidence.join(", ")}`);
      }
      lines.push(``);
    }
  }

  lines.push(`## Guías generadas`, ``);
  if (!data.guides.length) {
    lines.push("_Sin guías generadas._");
  } else {
    for (const g of data.guides) {
      lines.push(`- **Semana ${g.week}**: ${g.topic} (${g.sections} secciones · ${g.theme}) — ${g.generated}`);
    }
  }

  lines.push(``, `---`, ``, `> Nota: Este informe contiene la traza editorial persistida del curso,`);
  lines.push(`> no los mensajes literales de la conversación.`);
  lines.push(`> Para exportar el chat, usar la función de exportación del harness (Claude Code / Codex).`);

  return lines.join("\n");
}

function formatTechnical(data, redact) {
  const base = formatEditorial(data, redact);
  const r    = s => redactString(s, redact);
  const extra = [
    ``,
    `## Estado del harness`,
    ``,
    `\`\`\`json`,
    JSON.stringify(data.courseState, null, 2),
    `\`\`\``,
  ];

  if (data.validationErrors?.length) {
    extra.push(``, `## Errores de validación registrados`, ``);
    for (const e of data.validationErrors) {
      extra.push(`### ${r(e.week)}`);
      extra.push(`\`\`\`json\n${r(JSON.stringify(e, null, 2))}\n\`\`\``);
    }
  }

  return base + "\n" + extra.join("\n");
}

function formatSummary(data, redact) {
  const total    = data.plans.length;
  const approved = data.plans.filter(p => p.status === "approved" || p.status === "generated").length;
  const generated = data.guides.length;
  const blocked  = data.plans.filter(p => p.status === "blocked").length;

  return [
    `# Resumen de sesión — ${redactString(data.course, redact)}`,
    ``,
    `Generado: ${timestamp()}`,
    ``,
    `| Métrica | Valor |`,
    `|---|---|`,
    `| Planes registrados | ${total} |`,
    `| Planes aprobados | ${approved} |`,
    `| Guías generadas | ${generated} |`,
    `| Planes bloqueados | ${blocked} |`,
    `| Sílabo válido | ${data.syllabusValid ? "Sí" : "No"} |`,
    ``,
    `> Este resumen fue generado automáticamente desde el estado persistido.`,
    `> No es una transcripción literal de la conversación.`,
  ].join("\n");
}

// ─── Runner principal ─────────────────────────────────────────────────────────

function exportTranscript(courseRoot, options = {}) {
  const mode        = options.mode || "editorial";
  const redact      = (options.redact || "").split(",").map(s => s.trim()).filter(Boolean);
  const skillPkg    = require("../package.json");

  // Advertir si se pide verbatim
  if (mode === "verbatim") {
    return {
      error:   "JIN-TRN-001",
      message: "El modo 'verbatim' no está disponible en este comando.",
      detail:  "Los mensajes literales de la conversación solo pueden exportarse desde el harness (Claude Code: /export, Codex: $export-session). Este comando exporta la traza editorial persistida del curso.",
    };
  }

  const readmePath = path.join(courseRoot, "README.md");
  let syllabusValid  = false;
  let syllabusErrors = [];

  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, "utf8");
    ({ valid: syllabusValid, errors: syllabusErrors } = validateSyllabus(content));
  }

  const plans          = collectPlanStates(courseRoot);
  const guides         = collectGuideMetadata(courseRoot);
  const validationErrors = collectValidationErrors(courseRoot);
  const courseState    = loadCourseState(courseRoot);

  // Metadata del curso
  let courseName = path.basename(courseRoot);
  if (fs.existsSync(readmePath)) {
    const m = fs.readFileSync(readmePath, "utf8").match(/\*\*Asignatura:\*\*\s*(.+)/i);
    if (m) courseName = m[1].trim();
  }

  const data = {
    courseRoot,
    course:       courseName,
    skillVersion: skillPkg.version,
    exportedAt:   isoNow(),
    syllabusValid,
    syllabusErrors,
    plans,
    guides,
    validationErrors,
    courseState,
  };

  let content;
  if (mode === "technical") content = formatTechnical(data, redact);
  else if (mode === "summary") content = formatSummary(data, redact);
  else content = formatEditorial(data, redact);

  return { ok: true, content, data };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args       = process.argv.slice(2);
  const courseDir  = args.find(a => !a.startsWith("--")) || ".";
  const outputArg  = args.find(a => a.startsWith("--output="))?.slice(9)
                  || args[args.indexOf("--output") + 1];
  const modeArg    = args.find(a => a.startsWith("--mode="))?.slice(7)
                  || args[args.indexOf("--mode") + 1]
                  || "editorial";
  const redactArg  = args.find(a => a.startsWith("--redact="))?.slice(9) || "";
  const asJson     = args.includes("--json");

  const courseRoot = path.resolve(courseDir);
  const result     = exportTranscript(courseRoot, { mode: modeArg, redact: redactArg });

  if (result.error) {
    if (asJson) {
      console.log(JSON.stringify({ status: "error", ...result }));
    } else {
      console.error(`✗ ${result.error}: ${result.message}`);
      console.error(`  ${result.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  if (outputArg) {
    const outPath = path.resolve(outputArg);
    fs.writeFileSync(outPath, result.content, "utf8");
    if (!asJson) console.log(`✓ Informe de sesión exportado: ${outPath}`);
    if (asJson) console.log(JSON.stringify({ status: "ok", output: outPath }));
  } else {
    if (asJson) {
      console.log(JSON.stringify({ status: "ok", content: result.content }));
    } else {
      console.log(result.content);
    }
  }
}

module.exports = { exportTranscript };
