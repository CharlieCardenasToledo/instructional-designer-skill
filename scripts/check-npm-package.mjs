import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Ejecuta esta validación mediante npm run package:check.");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const skillPackage = JSON.parse(readFileSync(resolve(root, "skill/package.json"), "utf8"));
const packed = JSON.parse(execFileSync(process.execPath, [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}));

const [artifact] = packed;
const failures = [];
const files = new Set((artifact?.files || []).map(file => file.path.replace(/\\/g, "/")));
const required = [
  "LICENSE",
  "README.md",
  "package.json",
  "skill/.claude-plugin/plugin.json",
  "skill/SKILL.md",
  "skill/agents/openai.yaml",
  "skill/bin/jintia.js",
  "skill/runtime/core/harness-manager.js",
  "skill/templates/elegantbook-clasico/meta.json",
];

if (packageJson.name !== "jintia") failures.push(`nombre npm inesperado: ${packageJson.name}`);
if (packageJson.version !== skillPackage.version) failures.push("la versión npm no coincide con la skill");
if (packageJson.bin?.jintia !== "skill/bin/jintia.js") failures.push("falta el ejecutable jintia");
if (artifact?.name !== packageJson.name || artifact?.version !== packageJson.version) failures.push("npm pack devolvió identidad inconsistente");
for (const file of required) if (!files.has(file)) failures.push(`falta en el paquete npm: ${file}`);
for (const file of files) {
  if (file.startsWith("skill/tests/") || /(?:institution|notebooks)\.json$/i.test(file)) {
    failures.push(`archivo privado o de desarrollo incluido: ${file}`);
  }
}

if (failures.length) {
  failures.forEach(failure => console.error(`[ERROR] ${failure}`));
  process.exit(1);
}

console.log(`Paquete npm válido: ${artifact.name}@${artifact.version}, ${artifact.entryCount} archivos, ${artifact.unpackedSize} bytes sin comprimir.`);
