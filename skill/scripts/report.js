"use strict";

const SCHEMA_VERSION = "1.0.0";

function createReport({ command, target = null, exitCode = 0, checks = [], artifacts = [], warnings = [], errors = [], data = null, output = "" }) {
  const normalizedErrors = errors.length ? errors : exitCode === 0 ? [] : [{ code: "COMMAND_FAILED", message: lastOutputLine(output) || `El comando terminó con código ${exitCode}.` }];
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: "jintia",
    command,
    target,
    status: normalizedErrors.length ? "failed" : "success",
    exitCode,
    checks,
    artifacts,
    warnings,
    errors: normalizedErrors,
    ...(data === null ? {} : { data }),
  };
}

function lastOutputLine(output) {
  return String(output || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1) || "";
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function printReport(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = { SCHEMA_VERSION, createReport, parseJsonOutput, printReport };
