#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = path.join(ROOT, "scripts");

function usage() {
  console.log(`Jintia Toolchain

Uso:
  jintia init <curso> [--code CODIGO] [--name NOMBRE]
  jintia syllabus validate <README.md>
  jintia doctor [--json]
  jintia validate <guia.tex> [--template ID]
  jintia compile <guia.tex>
  jintia visual render <spec.json> --template ID [--guide guia.tex]
  jintia visual inspect <manifest.json>
  jintia migrate <semanas/semana-XX>

Comandos de flujo para la skill: plan, guide, assessment y audit.
Consulta skill/commands/ para sus playbooks.`);
}

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

function commandExists(command) {
  const probe = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], {
    encoding: "utf8",
    stdio: "ignore",
    shell: false
  });
  return probe.status === 0;
}

function initCourse(coursePath, args) {
  const root = path.resolve(coursePath);
  const code = option(args, "--code", path.basename(root).toUpperCase());
  const name = option(args, "--name", path.basename(root));
  const directories = ["semanas", "bibliografia", "config"];
  for (const directory of directories) fs.mkdirSync(path.join(root, directory), { recursive: true });
  const readme = path.join(root, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `# ${name}\n\n**Asignatura:** ${name}\n**Código:** ${code}\n\n## Semanas\n\nAñade aquí el sílabo canónico con una sección por semana.\n`);
    console.log(`Creado ${readme}`);
  } else {
    console.log(`Conservado ${readme}; no se sobrescribió el sílabo existente.`);
  }
  console.log(`Estructura Jintia lista en ${root}`);
}

function doctor(asJson) {
  const checks = [
    { id: "node", label: "Node.js", command: process.execPath, required: true, ok: true, detail: process.version },
    { id: "python", label: "Python", command: "python", required: false },
    { id: "pdflatex", label: "pdflatex", command: "pdflatex", required: true },
    { id: "biber", label: "biber", command: "biber", required: true },
    { id: "institution", label: "config/institution.json", required: false, ok: fs.existsSync(path.join(ROOT, "config", "institution.json")) },
    { id: "templates", label: "Plantillas LaTeX", required: true, ok: ["elegantbook-clasico", "kaohandt-marginal"].every(id => fs.existsSync(path.join(ROOT, "templates", id, "meta.json"))) }
  ];
  for (const check of checks) {
    if (check.ok === undefined) check.ok = commandExists(check.command);
    if (!check.detail && check.command && check.ok) check.detail = check.command;
  }
  const result = { tool: "jintia doctor", version: require(path.join(ROOT, "package.json")).version, checks, ok: checks.every(check => !check.required || check.ok) };
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Jintia Doctor · ${result.version}`);
    for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
    console.log(result.ok ? "\nEstado: listo para la toolchain requerida." : "\nEstado: faltan dependencias requeridas.");
  }
  if (!result.ok) process.exitCode = 1;
}

function main(argv) {
  const [command, subcommand, ...rest] = argv;
  if (!command || command === "help" || command === "--help") return usage();
  if (command === "init") return initCourse(subcommand, rest);
  if (command === "doctor") return doctor(argv.includes("--json"));
  if (command === "validate") return runScript("latex-linter.js", argv.slice(1));
  if (command === "compile") return runScript("latex-validator.js", argv.slice(1));
  if (command === "migrate") return runScript("legacy-manager.js", argv.slice(1));
  if (command === "syllabus" && subcommand === "validate") return runScript("syllabus-validator.js", rest);
  if (command === "visual" && subcommand === "render") return runScript("visual-pipeline.js", rest);
  if (command === "visual" && subcommand === "inspect") return runScript("visual-inspector.js", rest);
  if (["plan", "guide", "assessment", "audit"].includes(command)) {
    console.log(`El comando /jintia ${command} es un playbook de la skill. Consulta skill/commands/${command}.md y conserva la salida en el curso.`);
    return;
  }
  console.error(`Comando desconocido: ${command}`);
  usage();
  process.exitCode = 2;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`Jintia: ${error.message}`);
  process.exitCode = 1;
}
