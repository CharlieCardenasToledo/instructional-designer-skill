#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { detectInstallationStates, mutate } = require("../runtime/core");
const skillVersion = require("../package.json").version;

const args = process.argv.slice(2);
const operation = args.find(arg => !arg.startsWith("--")) || "status";
const value = name => {
  const arg = args.find(item => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
};
const providers = value("--providers")?.split(",") || [];
const projectRoot = path.resolve(value("--project") || process.cwd());
const scope = value("--scope") || "project";
const options = {
  providers,
  explicitProviders: providers,
  projectRoot,
  scope,
  sourcePath: value("--source"),
  version: value("--version") || skillVersion,
  confirm: args.includes("--yes")
};

function output(data) {
  if (args.includes("--json")) console.log(JSON.stringify(data, null, 2));
  else if (data.results) data.results.forEach(item => console.log(`${item.id}: ${item.scope} · ${item.status}${item.target ? ` · ${item.target}` : ""}`));
  else data.forEach(item => console.log(`${item.id}: ${item.scope} · ${item.state.status} · ${item.state.version || "sin versión"} · ${item.target}`));
}

try {
  const result = operation === "status" || operation === "doctor"
    ? { operation: "status", projectRoot, providers: detectInstallationStates(options) }
    : mutate(operation, options);
  output(result);
} catch (error) {
  console.error(`Jintia Harness: ${error.message}`);
  process.exitCode = 1;
}
