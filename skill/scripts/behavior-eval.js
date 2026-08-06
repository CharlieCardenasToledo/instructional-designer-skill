#!/usr/bin/env node
"use strict";

/**
 * behavior-eval.js — Evaluador semántico de comportamientos del agente
 *
 * Evalúa un output del agente (guide.json + texto de respuesta) contra los
 * specs semánticos en `behaviors/semantic/`. Requiere ANTHROPIC_API_KEY.
 *
 * Sin API key: muestra los specs que necesitan evaluación manual.
 *
 * Uso:
 *   node scripts/behavior-eval.js --output <guide.json|respuesta.txt> [--spec BHV-SEM-001] [--json]
 *   node scripts/behavior-eval.js --list
 *
 * Variables de entorno:
 *   ANTHROPIC_API_KEY  — API key de Anthropic (requerida para evaluación automática)
 *   ANTHROPIC_MODEL    — Modelo a usar (default: claude-haiku-4-5-20251001)
 */

const fs    = require("node:fs");
const path  = require("node:path");
const https = require("node:https");

const ROOT         = path.resolve(__dirname, "..");
const SPECS_DIR    = path.join(ROOT, "behaviors", "semantic");
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

// ── Carga de specs ─────────────────────────────────────────────────────────────

function loadSpecs() {
  if (!fs.existsSync(SPECS_DIR)) return [];
  return fs.readdirSync(SPECS_DIR)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const raw  = fs.readFileSync(path.join(SPECS_DIR, f), "utf8");
      const meta = parseFrontmatter(raw);
      return { file: f, path: path.join(SPECS_DIR, f), ...meta, body: raw };
    })
    .sort((a, b) => (a.id || "").localeCompare(b.id || ""));
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

// ── Llamada a la API de Anthropic ──────────────────────────────────────────────

function callApi(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no está definida.");

  const body = JSON.stringify({
    model:      DEFAULT_MODEL,
    max_tokens: 1024,
    messages:   [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path:     "/v1/messages",
        method:   "POST",
        headers:  {
          "Content-Type":      "application/json",
          "x-api-key":         key,
          "anthropic-version": "2023-06-01",
        },
      },
      res => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error.message));
            resolve(parsed.content?.[0]?.text || "");
          } catch (err) {
            reject(new Error(`Respuesta API inválida: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Construcción del prompt de evaluación ─────────────────────────────────────

function buildEvalPrompt(spec, outputContent) {
  return `Eres un evaluador experto en diseño instruccional universitario.
Evalúa el siguiente output de un agente de IA contra el spec de comportamiento indicado.
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional.

## Spec de comportamiento

${spec.body}

## Output del agente a evaluar

\`\`\`
${outputContent}
\`\`\`

## Instrucciones de evaluación

1. Lee los criterios de evaluación del spec.
2. Evalúa cada criterio del 0 al peso máximo indicado.
3. Calcula el puntaje total.
4. Determina si pasa (score >= umbral mínimo del spec, generalmente 70-80).

Responde con este JSON exacto (sin markdown ni texto antes/después):
{
  "specId": "${spec.id}",
  "score": <número 0-100>,
  "passed": <true|false>,
  "criteria": [
    { "name": "<nombre del criterio>", "weight": <peso>, "earned": <puntos obtenidos>, "note": "<observación breve>" }
  ],
  "violations": ["<descripción de cada violación encontrada>"],
  "summary": "<una oración que resume el veredicto>"
}`;
}

// ── Evaluador principal ────────────────────────────────────────────────────────

async function evalOutput(outputPath, specId) {
  const specs = loadSpecs();
  const target = specId
    ? specs.filter(s => s.id === specId)
    : specs;

  if (target.length === 0) {
    console.error(`No se encontraron specs${specId ? ` para ${specId}` : ""} en ${SPECS_DIR}`);
    process.exit(2);
  }

  const outputContent = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : outputPath; // si no es ruta, tratar como contenido directo

  const results = [];

  for (const spec of target) {
    if (!process.env.ANTHROPIC_API_KEY) {
      results.push({
        specId:  spec.id,
        name:    spec.name,
        status:  "manual-required",
        message: `Establece ANTHROPIC_API_KEY para ejecutar este spec automáticamente.`,
        spec:    spec.path,
      });
      continue;
    }

    try {
      const prompt   = buildEvalPrompt(spec, outputContent);
      const response = await callApi(prompt);

      let evaluation;
      try {
        // Extraer JSON aunque venga con texto alrededor
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        evaluation = null;
      }

      if (!evaluation) {
        results.push({
          specId:  spec.id,
          name:    spec.name,
          status:  "error",
          message: `La API devolvió una respuesta no parseable: ${response.slice(0, 200)}`,
        });
        continue;
      }

      results.push({
        specId:     evaluation.specId || spec.id,
        name:       spec.name,
        status:     evaluation.passed ? "passed" : "failed",
        score:      evaluation.score,
        criteria:   evaluation.criteria,
        violations: evaluation.violations,
        summary:    evaluation.summary,
      });
    } catch (err) {
      results.push({
        specId:  spec.id,
        name:    spec.name,
        status:  "error",
        message: err.message,
      });
    }
  }

  return {
    tool:    "jintia behavior-eval",
    version: "1.0.0",
    target:  outputPath,
    results,
    summary: {
      total:          results.length,
      passed:         results.filter(r => r.status === "passed").length,
      failed:         results.filter(r => r.status === "failed").length,
      manualRequired: results.filter(r => r.status === "manual-required").length,
      errors:         results.filter(r => r.status === "error").length,
    },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const asJson = args.includes("--json");

  // Listar specs disponibles
  if (args.includes("--list")) {
    const specs = loadSpecs();
    if (asJson) {
      console.log(JSON.stringify(specs.map(s => ({
        id: s.id, name: s.name, severity: s.severity, category: s.category,
        description: s.description,
      })), null, 2));
    } else {
      console.log("Specs de comportamiento semántico disponibles:\n");
      for (const s of specs) {
        console.log(`  ${s.id}  [${s.severity}]  ${s.description}`);
      }
    }
    return;
  }

  const outputIdx = args.indexOf("--output");
  const outputArg = outputIdx >= 0 ? args[outputIdx + 1] : args.find(a => !a.startsWith("--"));
  const specArg   = args.find((a, i) => args[i - 1] === "--spec");

  if (!outputArg) {
    console.error(`Uso:
  node scripts/behavior-eval.js --output <guide.json|respuesta.txt> [--spec BHV-SEM-001] [--json]
  node scripts/behavior-eval.js --list

Variables de entorno:
  ANTHROPIC_API_KEY  — requerida para evaluación automática
  ANTHROPIC_MODEL    — modelo (default: ${DEFAULT_MODEL})`);
    process.exit(2);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ ANTHROPIC_API_KEY no definida — se mostrará qué specs necesitan evaluación manual.\n");
  }

  try {
    const report = await evalOutput(outputArg, specArg || null);

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Jintia Behavior Eval · ${report.target}\n`);
      for (const r of report.results) {
        const icon = r.status === "passed" ? "✓" : r.status === "failed" ? "✗" : "⚠";
        console.log(`${icon} ${r.specId}  ${r.name}`);
        if (r.score !== undefined) console.log(`   Puntaje: ${r.score}/100`);
        if (r.summary)             console.log(`   ${r.summary}`);
        if (r.violations?.length)  console.log(`   Violaciones: ${r.violations.join("; ")}`);
        if (r.message)             console.log(`   ${r.message}`);
        if (r.spec)                console.log(`   Spec: ${r.spec}`);
        console.log();
      }
      const { summary } = report;
      console.log(`Resultado: ${summary.passed} ok, ${summary.failed} fallidos, ${summary.manualRequired} manuales, ${summary.errors} errores.`);
    }

    if (report.summary.failed > 0 || report.summary.errors > 0) process.exitCode = 1;
  } catch (err) {
    console.error(`behavior-eval: ${err.message}`);
    process.exitCode = 1;
  }
}

main();

module.exports = { loadSpecs, evalOutput, buildEvalPrompt };
