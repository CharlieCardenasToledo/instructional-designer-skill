#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const course = process.argv[2];
if (!course) {
  console.error("Uso: node scripts/hook-install.js <curso>");
  process.exit(2);
}
const root = path.resolve(course);
const git = path.join(root, ".git");
if (!fs.existsSync(git)) {
  console.error(`No se instaló el hook: ${root} no es un repositorio Git.`);
  process.exit(1);
}
const hooks = path.join(root, ".jintia", "hooks");
fs.mkdirSync(hooks, { recursive: true });
const runner = path.resolve(__dirname, "hook-runner.js");
const hook = `#!/usr/bin/env node\nconst { spawnSync } = require("node:child_process");\nconst { execFileSync } = require("node:child_process");\nconst files = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).trim().split(/\\r?\\n/).filter(Boolean);\nif (!files.length) process.exit(0);\nconst result = spawnSync(process.execPath, [${JSON.stringify(runner)}, "post-edit", "--changed", ...files], { stdio: "inherit" });\nprocess.exit(result.status ?? 1);\n`;
const hookPath = path.join(hooks, "pre-commit");
fs.writeFileSync(hookPath, hook);
if (process.platform !== "win32") fs.chmodSync(hookPath, 0o755);
const configured = spawnSync("git", ["-C", root, "config", "core.hooksPath", ".jintia/hooks"], { encoding: "utf8" });
if (configured.status !== 0) {
  console.error(configured.stderr || "No se pudo configurar core.hooksPath.");
  process.exit(configured.status || 1);
}
console.log(`Hook pre-commit instalado en ${hookPath}`);
