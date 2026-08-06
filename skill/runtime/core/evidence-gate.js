"use strict";

/**
 * evidence-gate.js — Compuerta de evidencia verificable
 *
 * Bloquea la generación de cualquier sección de guía cuando no existe
 * evidencia verificable. Un agente NO puede sustituir fuentes verificables
 * por conocimiento general sin disparar JIN-EVD-002.
 *
 * Códigos de error:
 *   JIN-EVD-001  Sin evidencia verificable disponible (ninguna fuente)
 *   JIN-EVD-002  Intento de sustituir evidencia por conocimiento genérico
 *   JIN-EVD-003  NotebookLM falló y no hay fuentes locales de respaldo
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Constantes ───────────────────────────────────────────────────────────────

const ERRORS = {
  JIN_EVD_001: {
    code:    "JIN-EVD-001",
    message: "No existe evidencia verificable para redactar esta semana.",
    detail:  "Proporciona un notebook de NotebookLM, bibliografía local o recortes antes de continuar.",
  },
  JIN_EVD_002: {
    code:    "JIN-EVD-002",
    message: "No está permitido sustituir evidencia verificable por conocimiento general.",
    detail:  "Jintia requiere procedencia verificable en cada afirmación disciplinar.",
  },
  JIN_EVD_003: {
    code:    "JIN-EVD-003",
    message: "NotebookLM no está disponible y no hay fuentes locales verificables.",
    detail:  "Registra al menos una fuente local antes de intentar generar la guía.",
  },
};

// ─── Utilidades internas ──────────────────────────────────────────────────────

function dirHasFiles(dirPath, extensions) {
  if (!fs.existsSync(dirPath)) return false;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some(e => {
      if (e.isDirectory()) return dirHasFiles(path.join(dirPath, e.name), extensions);
      return !extensions || extensions.some(ext => e.name.endsWith(ext));
    });
  } catch { return false; }
}

function checkLocalSources(courseRoot, weekNumber) {
  const weekPadded = String(weekNumber).padStart(2, "0");
  const sources = [];

  // reference.bib en la carpeta de la semana
  const bibPath = path.join(courseRoot, "semanas", `semana-${weekPadded}`, "reference.bib");
  if (fs.existsSync(bibPath) && fs.statSync(bibPath).size > 20) {
    sources.push({ type: "bib", path: bibPath });
  }

  // Recortes en bibliografia/recortes_por_semana/semana-XX/
  const clipsDir = path.join(courseRoot, "bibliografia", "recortes_por_semana", `semana-${weekPadded}`);
  if (dirHasFiles(clipsDir, [".md", ".txt", ".pdf"])) {
    sources.push({ type: "clips", path: clipsDir });
  }

  // Bibliografía local general en bibliografia/
  const biblioDir = path.join(courseRoot, "bibliografia");
  if (dirHasFiles(biblioDir, [".pdf", ".epub", ".bib"])) {
    sources.push({ type: "local_bibliography", path: biblioDir });
  }

  // Sílabo con fuentes declaradas (la línea debe tener contenido real, no solo espacios)
  const readmePath = path.join(courseRoot, "README.md");
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, "utf8");
    // Acepta fuente en la misma línea o en bullet list inmediata (formato multi-línea)
    const hasSameLine  = /\*\*Herramienta de aprendizaje:\*\*[ \t]+\S/i.test(content);
    const hasMultiLine = /\*\*Herramienta de aprendizaje:\*\*[ \t]*\r?\n[ \t]*[-*•][ \t]+\S/i.test(content);
    if (hasSameLine || hasMultiLine) sources.push({ type: "syllabus_sources", path: readmePath });
  }

  return sources;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Evalúa si existe evidencia suficiente para generar una sección de guía.
 *
 * @param {object} options
 * @param {string}  options.courseRoot       Ruta absoluta del curso
 * @param {number}  options.weekNumber       Número de semana (1-52)
 * @param {object}  [options.notebookLM]     Estado de NotebookLM:
 *                    { configured, available, reason }
 * @param {boolean} [options.allowGeneric]   Si true, genera JIN-EVD-002 en lugar
 *                                           de bloquear (para registrar el intento)
 * @returns {{ allowed: boolean, code?: string, message?: string, detail?: string,
 *             sources: object[] }}
 */
function check({ courseRoot, weekNumber, notebookLM = {}, allowGeneric = false }) {
  if (!courseRoot) throw new TypeError("Se requiere courseRoot.");
  if (!weekNumber) throw new TypeError("Se requiere weekNumber.");

  const nlmConfigured = Boolean(notebookLM.configured);
  const nlmAvailable  = Boolean(notebookLM.available);

  const localSources = checkLocalSources(courseRoot, weekNumber);

  // NotebookLM disponible → siempre permitir (la comprobación de autenticación
  // es responsabilidad del flujo de trabajo, no de esta compuerta)
  if (nlmConfigured && nlmAvailable) {
    return { allowed: true, sources: [{ type: "notebooklm" }, ...localSources] };
  }

  // NotebookLM falló + sin fuentes locales → JIN-EVD-003
  if (nlmConfigured && !nlmAvailable && localSources.length === 0) {
    return { allowed: false, ...ERRORS.JIN_EVD_003, sources: [] };
  }

  // Sin ninguna fuente → JIN-EVD-001
  if (!nlmConfigured && localSources.length === 0) {
    return { allowed: false, ...ERRORS.JIN_EVD_001, sources: [] };
  }

  // Fuentes locales sin NotebookLM → permitir con advertencia
  if (localSources.length > 0) {
    return { allowed: true, sources: localSources, warning: "NotebookLM no disponible; se usarán fuentes locales." };
  }

  return { allowed: false, ...ERRORS.JIN_EVD_001, sources: [] };
}

/**
 * Registra un intento de sustituir evidencia por conocimiento genérico.
 * Siempre devuelve allowed: false con JIN-EVD-002.
 *
 * Llamar esto cuando el agente detecte que está a punto de afirmar algo
 * disciplinar sin respaldo verificable.
 */
function blockGenericKnowledge() {
  return { allowed: false, ...ERRORS.JIN_EVD_002, sources: [] };
}

/**
 * Serializa el resultado de la compuerta en formato de reporte CLI.
 */
function toReport(result) {
  return {
    allowed:  result.allowed,
    code:     result.code || null,
    message:  result.message || null,
    detail:   result.detail || null,
    warning:  result.warning || null,
    sources:  result.sources || [],
  };
}

module.exports = { check, blockGenericKnowledge, toReport, ERRORS };
