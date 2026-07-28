#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rules = path.resolve(__dirname, "rules-runner.js");
const args = process.argv.slice(2);
const hook = args.shift();
if (!hook || !["post-edit", "pre-compile"].includes(hook)) {
  console.error("Uso: node scripts/hook-runner.js post-edit --changed <archivos...>");
  process.exit(2);
}
const changed = args.filter(value => value !== "--changed");
const targets = hook === "pre-compile"
  ? changed.slice(0, 1)
  : changed.filter(file => /(?:README\.md|\.tex)$/i.test(file));
if (!targets.length) {
  console.log(`Jintia Hook · ${hook}: no hay archivos compatibles que revisar.`);
  process.exit(0);
}
let failed = false;
for (const target of targets) {
  const result = spawnSync(process.execPath, [rules, target, ...(hook === "pre-compile" ? ["--strict"] : [])], {
    encoding: "utf8",
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
