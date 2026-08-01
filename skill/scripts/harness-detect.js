#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { detectInstallationStates } = require("../runtime/core");
const args = process.argv.slice(2);
const projectRoot = args.find(arg => !arg.startsWith("--")) || process.cwd();
const explicit = args.filter(arg => arg.startsWith("--providers=")).flatMap(arg => arg.slice("--providers=".length).split(","));
const states = detectInstallationStates({ projectRoot, explicitProviders: explicit, availableVersion: "10.8.0" });
const report = {
  schemaVersion: "1.1.0",
  projectRoot,
  source: explicit.length ? "explicit" : "matrix",
  providers: states.map(item => ({
    id: item.id,
    name: item.name,
    scope: item.scope,
    foundPath: fs.existsSync(item.target) ? path.dirname(path.dirname(item.target)) : null,
    installPath: item.target,
    installed: item.state.installed,
    version: item.state.version,
    availableVersion: item.state.availableVersion,
    status: item.state.status
  }))
};
if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Jintia Detect · ${report.projectRoot}`);
  for (const provider of report.providers) console.log(`${provider.status === "not-detected" ? "○" : "✓"} ${provider.name} · ${provider.scope} · ${provider.foundPath || "no detectado"}`);
}
