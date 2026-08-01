#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createReport, parseJsonOutput, printReport } = require("../scripts/report");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = path.join(ROOT, "scripts");

function usage() {
  console.log(`Jintia Toolchain

Uso:
  jintia init <curso> [--code CODIGO] [--name NOMBRE]
  jintia syllabus validate <README.md>
  jintia doctor [--json]
  jintia context <init|read|validate> <curso> [--json]
  jintia agents plan <operación> [--json]
  jintia detect [proyecto] [--providers=claude,codex] [--json]
  jintia harness <status|install|update|repair|uninstall> [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes] [--json]
  jintia audit <README.md|guia.tex> [--json] [--strict]
  jintia state update <curso> <semana> <estado> [archivo-fuente]
  jintia hook post-edit --changed <archivos...>
  jintia hook pre-compile <guia.tex>
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

function runScript(script, args, command = script.replace(/\.js$/, "")) {
  const asJson = args.includes("--json");
  const forwardedArgs = args.filter(arg => arg !== "--json");
  const childArgs = asJson && (script === "rules-runner.js" || script === "context-manager.js" || script === "agent-plan.js" || script === "harness-detect.js" || script === "harness-manager.js")
    ? [...forwardedArgs, "--json"]
    : forwardedArgs;
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...childArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: asJson ? "pipe" : "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (asJson) {
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    const data = parseJsonOutput(result.stdout);
    const target = forwardedArgs.find(arg => !arg.startsWith("--")) || null;
    printReport(createReport({ command, target, exitCode: result.status ?? 1, data, output }));
  }
  process.exitCode = result.status ?? 1;
}

function runHook(hook, args) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, "hook-runner.js"), hook, ...args], {
    cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false
  });
  return result.status ?? 1;
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
  const asJson = args.includes("--json");
  const root = path.resolve(coursePath);
  const code = option(args, "--code", path.basename(root).toUpperCase());
  const name = option(args, "--name", path.basename(root));
  const directories = ["semanas", "bibliografia", "config"];
  for (const directory of directories) fs.mkdirSync(path.join(root, directory), { recursive: true });
  const readme = path.join(root, "README.md");
  const created = !fs.existsSync(readme);
  if (created) {
    fs.writeFileSync(readme, `# ${name}\n\n**Asignatura:** ${name}\n**Código:** ${code}\n\n## Semanas\n\nAñade aquí el sílabo canónico con una sección por semana.\n`);
  }
  if (asJson) {
    printReport(createReport({
      command: "init",
      target: root,
      checks: [{ name: "course_structure", status: "passed", message: "Estructura Jintia disponible." }],
      artifacts: [readme, ...directories.map(directory => path.join(root, directory))],
      data: { createdReadme: created, code, name },
    }));
    return;
  }
  console.log(created ? `Creado ${readme}` : `Conservado ${readme}; no se sobrescribió el sílabo existente.`);
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
  if (asJson) printReport(createReport({ command: "doctor", exitCode: result.ok ? 0 : 1, checks, data: result }));
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
  if (command === "context") return runScript("context-manager.js", [subcommand, ...rest], `context ${subcommand}`);
  if (command === "agents" && subcommand === "plan") return runScript("agent-plan.js", rest, "agents plan");
  if (command === "detect") return runScript("harness-detect.js", argv.slice(1), "detect");
  if (command === "harness") return runScript("harness-manager.js", argv.slice(1), `harness ${subcommand || "status"}`);
  if (command === "audit" || command === "rules") return runScript("rules-runner.js", argv.slice(1), command);
  if (command === "state" && subcommand === "update") return runScript("state-manager.js", rest.length ? [subcommand, ...rest] : argv.slice(1), "state update");
  if (command === "hook" && subcommand === "install") return runScript("hook-install.js", rest, "hook install");
  if (command === "hook") return runScript("hook-runner.js", [subcommand, ...rest], `hook ${subcommand}`);
  if (command === "validate") return runScript("latex-linter.js", argv.slice(1), "validate");
  if (command === "compile") {
    const hookStatus = runHook("pre-compile", argv.slice(1));
    if (hookStatus !== 0) { process.exitCode = hookStatus; return; }
    return runScript("latex-validator.js", argv.slice(1), "compile");
  }
  if (command === "migrate") return runScript("legacy-manager.js", argv.slice(1), "migrate");
  if (command === "syllabus" && subcommand === "validate") return runScript("syllabus-validator.js", rest, "syllabus validate");
  if (command === "visual" && subcommand === "render") return runScript("visual-pipeline.js", rest, "visual render");
  if (command === "visual" && subcommand === "inspect") return runScript("visual-inspector.js", rest, "visual inspect");
  if (["plan", "guide", "assessment"].includes(command)) {
    console.log(`La operación ${command} es un playbook de la skill. Consulta ${path.join(ROOT, "commands", `${command}.md`)} y conserva la salida en el curso.`);
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
