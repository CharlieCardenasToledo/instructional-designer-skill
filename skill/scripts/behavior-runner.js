#!/usr/bin/env node
"use strict";

/**
 * behavior-runner.js — Verificador de comportamientos determinísticos del agente
 *
 * Evalúa si un guide.json cumple los contratos de comportamiento que no pueden
 * verificarse solo con el esquema JSON ni con el linter pedagógico. Cada
 * comportamiento representa una invariante observable del agente Jintia.
 *
 * Uso:
 *   node scripts/behavior-runner.js guide.json [--strict] [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");
const { collectCitationKeys } = require("./citation-keys");

// ── Catálogo de comportamientos determinísticos ────────────────────────────────

const BEHAVIORS = [
  {
    id:          "BHV-D-001",
    name:        "scenario-after-theory",
    description: "Los nodos 'scenario' aparecen después de todos los nodos 'theory' y 'concept'.",
    rationale:   "El escenario aplica la teoría; colocarlo antes rompe la causalidad pedagógica.",
    check(guide) {
      const sections = guide.sections || [];
      let lastTheoryIdx    = -1;
      let firstScenarioIdx = -1;
      sections.forEach((s, i) => {
        if (s.type === "theory" || s.type === "concept") lastTheoryIdx = i;
        if (s.type === "scenario" && firstScenarioIdx === -1) firstScenarioIdx = i;
      });
      if (firstScenarioIdx === -1) return { passed: true, note: "Sin nodo scenario." };
      if (lastTheoryIdx    === -1) return { passed: true, note: "Sin nodo theory/concept." };
      if (firstScenarioIdx > lastTheoryIdx) return { passed: true };
      return {
        passed:  false,
        message: `Nodo 'scenario' (pos ${firstScenarioIdx + 1}) aparece antes del último nodo teórico (pos ${lastTheoryIdx + 1}).`,
      };
    },
  },

  {
    id:          "BHV-D-002",
    name:        "bibliography-at-end",
    description: "El nodo 'bibliography' es siempre el último nodo de la secuencia cuando está presente.",
    rationale:   "La bibliografía cierra el documento; un nodo después de ella rompe el cierre editorial.",
    check(guide) {
      const sections = guide.sections || [];
      const lastBibIdx = sections.map(s => s.type).lastIndexOf("bibliography");
      if (lastBibIdx === -1) return { passed: true, note: "Sin nodo bibliography." };
      if (lastBibIdx === sections.length - 1) return { passed: true };
      return {
        passed:  false,
        message: `Nodo 'bibliography' en posición ${lastBibIdx + 1} pero la guía tiene ${sections.length} nodos — debe ser el último.`,
      };
    },
  },

  {
    id:          "BHV-D-003",
    name:        "assessment-after-practice",
    description: "Todo nodo 'assessment' está precedido inmediatamente por 'practice' o 'scenario'.",
    rationale:   "La evaluación sigue a la práctica guiada; evaluar sin preparar viola el Backward Design.",
    check(guide) {
      const sections = guide.sections || [];
      const violations = [];
      sections.forEach((s, i) => {
        if (s.type !== "assessment") return;
        const prevType = i > 0 ? sections[i - 1].type : null;
        if (prevType !== "practice" && prevType !== "scenario") {
          violations.push(
            `assessment en pos ${i + 1} precedido por "${prevType || "ninguno"}".`
          );
        }
      });
      return violations.length === 0
        ? { passed: true }
        : { passed: false, message: violations.join(" | ") };
    },
  },

  {
    id:          "BHV-D-004",
    name:        "orientation-is-first",
    description: "El primer nodo de 'sections' es siempre de tipo 'orientation'.",
    rationale:   "La orientación establece el propósito y el tiempo; su ausencia al inicio deja al estudiante sin contexto.",
    check(guide) {
      const sections = guide.sections || [];
      if (sections.length === 0) return { passed: false, message: "La guía no tiene nodos en sections." };
      if (sections[0].type === "orientation") return { passed: true };
      return {
        passed:  false,
        message: `El primer nodo es de tipo "${sections[0].type}" — debe ser "orientation".`,
      };
    },
  },

  {
    id:          "BHV-D-005",
    name:        "outcome-is-substantive",
    description: "El campo 'outcome' en metadata contiene texto sustantivo (≥ 15 caracteres, comienza con verbo).",
    rationale:   "Un RA decorativo ('Aprender') no permite diseñar evidencia observable; debe ser un desempeño medible.",
    check(guide) {
      const outcome = ((guide.metadata || {}).outcome || "").trim();
      if (outcome.length < 15) {
        return {
          passed:  false,
          message: `outcome "${outcome}" tiene ${outcome.length} caracteres — mínimo 15 para ser sustantivo.`,
        };
      }
      // Verificar verbo en infinitivo en español: debe terminar en -ar, -er o -ir.
      // Válido: "Aplicar", "Diseñar", "Construir", "Analizar", "Resolver".
      // Inválido: "Conocimiento profundo...", "Comprensión de...", "Aprendizaje de..." (sustantivos).
      const infinitivePattern = /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]*(ar|er|ir)\b/;
      if (!infinitivePattern.test(outcome)) {
        return {
          passed:  false,
          message: `outcome "${outcome}" no comienza con un verbo en infinitivo (-ar, -er, -ir). ` +
                   `Ej.: "Aplicar", "Diseñar", "Construir", "Analizar", "Resolver".`,
        };
      }
      return { passed: true };
    },
  },

  {
    id:          "BHV-D-006",
    name:        "no-orphan-citation-keys",
    description: "Toda clave citada (nodos 'citation' o sintaxis {{cite:}}) existe en el archivo .bib declarado.",
    rationale:   "Una clave sin entrada en .bib produce una referencia invisible; el agente no puede inventar fuentes.",
    check(guide, context = {}) {
      const allKeys = collectCitationKeys(guide);
      if (allKeys.length === 0) return { passed: true, note: "Sin citas (nodos ni inline)." };

      const bibPath = context.bibPath;
      if (!bibPath || !fs.existsSync(bibPath)) {
        return {
          passed: null,
          note:   `Archivo .bib no disponible (${bibPath || "ruta no especificada"}) — verificación omitida.`,
        };
      }

      const bibContent = fs.readFileSync(bibPath, "utf8");
      const re = /@\w+\s*\{\s*([^,\s]+)/g;
      const known = new Set();
      let m;
      while ((m = re.exec(bibContent)) !== null) known.add(m[1]);

      const orphans = allKeys.filter(k => !known.has(k));
      return orphans.length === 0
        ? { passed: true }
        : { passed: false, message: `Claves no encontradas en .bib: ${orphans.join(", ")}` };
    },
  },

  {
    id:          "BHV-D-007",
    name:        "no-theory-without-any-citation",
    description: "Una guía con nodos 'theory' o 'concept' debe contener al menos una cita real (inline o nodo citation).",
    rationale:   "El agente no debe redactar teoría sin respaldo. Declarar un .bib vacío no es suficiente: debe existir al menos una cita efectiva.",
    check(guide) {
      const sections = guide.sections || [];
      const hasTheory = sections.some(s => s.type === "theory" || s.type === "concept");
      if (!hasTheory) return { passed: true, note: "Sin nodos theory/concept." };
      const keys = collectCitationKeys(guide);
      if (keys.length > 0) return { passed: true };
      return {
        passed:  false,
        message: "La guía contiene nodos teóricos pero no incluye ninguna cita real (ni inline {{cite:}} ni nodo citation) — posible contenido sin respaldo.",
      };
    },
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────────

function runBehaviors(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);

  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (err) {
    return {
      tool:    "jintia behavior-runner",
      version: "1.0.0",
      target:  absolute,
      error:   err.message,
      results: [],
      summary: { total: 0, passed: 0, failed: 0, inconclusive: 0 },
    };
  }

  const bibDecl = (guide.metadata || {}).bibliography;
  const context = {
    bibPath: options.bibPath ||
      (bibDecl ? path.resolve(path.dirname(absolute), bibDecl) : null),
  };

  const results = BEHAVIORS.map(b => {
    try {
      const r = b.check(guide, context);
      return {
        id:          b.id,
        name:        b.name,
        description: b.description,
        rationale:   b.rationale,
        status:      r.passed === true ? "passed" : r.passed === false ? "failed" : "inconclusive",
        message:     r.message || r.note || null,
      };
    } catch (err) {
      return {
        id:      b.id,
        name:    b.name,
        status:  "error",
        message: err.message,
      };
    }
  });

  const summary = {
    total:        results.length,
    passed:       results.filter(r => r.status === "passed").length,
    failed:       results.filter(r => r.status === "failed").length,
    inconclusive: results.filter(r => r.status === "inconclusive" || r.status === "error").length,
    ok:           results.every(r => r.status !== "failed"),
  };

  return { tool: "jintia behavior-runner", version: "1.0.0", target: absolute, results, summary };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--"));
  const asJson = args.includes("--json");
  const strict = args.includes("--strict");

  if (!target) {
    console.error("Uso: node scripts/behavior-runner.js guide.json [--strict] [--json]");
    process.exit(2);
  }

  const report = runBehaviors(target);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Jintia Behavior Runner · ${report.target}`);
    if (report.error) {
      console.error(`✗ Error: ${report.error}`);
    } else {
      for (const r of report.results) {
        const icon = r.status === "passed" ? "✓" : r.status === "failed" ? "✗" : "⚠";
        const detail = r.message ? ` — ${r.message}` : "";
        console.log(`${icon} ${r.id} ${r.name}${detail}`);
      }
      console.log(`\nResultado: ${report.summary.passed} ok, ${report.summary.failed} fallidos, ${report.summary.inconclusive} inconclusos.`);
    }
  }

  const shouldFail = report.summary.failed > 0 ||
    (strict && report.summary.inconclusive > 0);
  if (shouldFail) process.exitCode = 1;
}

module.exports = { runBehaviors, BEHAVIORS };
