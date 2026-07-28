#!/usr/bin/env node
"use strict";

const { detectHarnesses } = require("../../packages/core");
const args = process.argv.slice(2);
const projectRoot = args.find(arg => !arg.startsWith("--")) || process.cwd();
const explicit = args.filter(arg => arg.startsWith("--providers=")).flatMap(arg => arg.slice("--providers=".length).split(","));
const report = detectHarnesses({ projectRoot, explicitProviders: explicit });
if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Jintia Detect · ${report.projectRoot}`);
  for (const provider of report.providers) console.log(`${provider.status === "not-detected" ? "○" : "✓"} ${provider.name} · ${provider.scope} · ${provider.foundPath || "no detectado"}`);
}
