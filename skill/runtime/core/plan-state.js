"use strict";

/**
 * plan-state.js — Estado persistente del plan semanal
 *
 * Persiste .jintia-plan.json dentro de semanas/semana-XX/ para que la
 * operación guide pueda verificar que el plan fue aprobado antes de
 * generar cualquier archivo.
 *
 * Estados del plan:
 *   pending    Plan calculado, pendiente de aprobación del usuario
 *   blocked    Faltan fuentes o información material (evidence-gate falló)
 *   approved   El usuario aprobó explícitamente el plan
 *   generated  guide.json fue creado con éxito
 */

const fs   = require("node:fs");
const path = require("node:path");

const PLAN_FILE = ".jintia-plan.json";

const VALID_STATUSES = ["pending", "blocked", "approved", "generated"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekPadded(weekNumber) {
  const n = Number(weekNumber);
  if (!Number.isInteger(n) || n < 1 || n > 52) {
    throw new RangeError(`Número de semana inválido: ${weekNumber}. Debe ser un entero entre 1 y 52.`);
  }
  return String(n).padStart(2, "0");
}

function planPath(courseRoot, weekNumber) {
  return path.join(
    path.resolve(courseRoot),
    "semanas",
    `semana-${weekPadded(weekNumber)}`,
    PLAN_FILE
  );
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Guarda un plan en estado pending (o blocked si evidence gate falló).
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @param {object} planData    Datos del plan (topic, outcomes, evidence, etc.)
 * @returns {string}           Ruta del archivo guardado
 */
function savePlan(courseRoot, weekNumber, planData) {
  const file = planPath(courseRoot, weekNumber);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const status = planData.missingEvidence && planData.missingEvidence.length > 0
    ? "blocked"
    : "pending";

  const record = {
    schemaVersion: "1.0",
    course:        planData.course || path.basename(path.resolve(courseRoot)),
    week:          Number(weekNumber),
    topic:         planData.topic || "",
    outcomes:      planData.outcomes || {},
    evidence:      planData.evidence || [],
    missingEvidence: planData.missingEvidence || [],
    plannedFiles:  planData.plannedFiles || [
      `semanas/semana-${weekPadded(weekNumber)}/guide.json`,
      `semanas/semana-${weekPadded(weekNumber)}/reference.bib`,
      `semanas/semana-${weekPadded(weekNumber)}/figure/`,
    ],
    status,
    savedAt:       new Date().toISOString(),
    approvedAt:    null,
    generatedAt:   null,
  };

  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/**
 * Marca el plan como aprobado por el usuario.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {{ ok: boolean, message: string, path: string }}
 */
function approvePlan(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);

  if (!fs.existsSync(file)) {
    return {
      ok:      false,
      message: `No existe un plan para la semana ${weekNumber}. Ejecuta primero 'jintia plan save'.`,
      path:    file,
    };
  }

  const record = JSON.parse(fs.readFileSync(file, "utf8"));

  if (record.status === "blocked") {
    return {
      ok:      false,
      message: `El plan está bloqueado por evidencia faltante: ${record.missingEvidence.join(", ")}. Resuelve las fuentes primero.`,
      path:    file,
    };
  }

  record.status     = "approved";
  record.approvedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  return { ok: true, message: `Plan de la semana ${weekNumber} aprobado.`, path: file };
}

/**
 * Comprueba si el plan de la semana está en estado approved.
 * La operación guide DEBE llamar esto antes de crear guide.json.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {{ approved: boolean, status: string|null, message: string }}
 */
function checkPlanApproved(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);

  if (!fs.existsSync(file)) {
    return {
      approved: false,
      status:   null,
      message:  `No existe plan para la semana ${weekNumber}. Ejecuta '/jintia plan' primero y obtén aprobación explícita del usuario.`,
    };
  }

  const record = JSON.parse(fs.readFileSync(file, "utf8"));

  if (record.status === "approved" || record.status === "generated") {
    return { approved: true, status: record.status, message: "Plan aprobado. Puedes generar guide.json." };
  }

  if (record.status === "blocked") {
    return {
      approved: false,
      status:   "blocked",
      message:  `El plan está bloqueado. Evidencia faltante: ${(record.missingEvidence || []).join(", ")}`,
    };
  }

  return {
    approved: false,
    status:   record.status,
    message:  `El plan existe pero aún no fue aprobado (estado: ${record.status}). Muestra el plan al usuario y espera confirmación explícita.`,
  };
}

/**
 * Marca el plan como generated después de crear guide.json.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {string}           Ruta del archivo actualizado
 */
function markGenerated(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);
  if (!fs.existsSync(file)) return file;

  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  record.status      = "generated";
  record.generatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/**
 * Lee el estado actual del plan de una semana.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {object|null}      Registro del plan o null si no existe
 */
function getPlan(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = {
  PLAN_FILE,
  VALID_STATUSES,
  savePlan,
  approvePlan,
  checkPlanApproved,
  markGenerated,
  getPlan,
  planPath,
};
