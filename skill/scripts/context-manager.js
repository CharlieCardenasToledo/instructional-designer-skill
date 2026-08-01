#!/usr/bin/env node
"use strict";

const core = require("../runtime/core");

const [command, course, ...args] = process.argv.slice(2);
const asJson = args.includes("--json");
function output(value) {
  if (asJson) console.log(JSON.stringify(value, null, 2));
  else if (value.message) console.log(value.message);
  else if (value.content) console.log(value.content);
  else console.log(value.valid ? "✓ Contexto válido" : `✗ Faltan: ${value.missing.join(", ")}`);
}
if (!command || !course || !["init", "read", "validate"].includes(command)) {
  console.error("Uso: node scripts/context-manager.js <init|read|validate> <curso> [--json]");
  process.exit(2);
}
try {
  if (command === "init") {
    const result = core.initContext(course);
    output({ command: "context init", ...result, message: result.created ? `Contexto creado en ${result.path}` : `Contexto conservado en ${result.path}` });
  } else if (command === "read") {
    output({ command: "context read", ...core.readContext(course) });
  } else {
    const result = core.validateContext(course);
    output({ command: "context validate", ...result });
    if (!result.valid) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
