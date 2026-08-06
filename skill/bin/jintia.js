#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createReport, parseJsonOutput, printReport } = require("../scripts/report");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = path.join(ROOT, "scripts");

// ─── Helpers para doctor HTML ────────────────────────────────────────────────

function checkVivliostyleVersion() {
  for (const cmd of ["vivliostyle", "viv"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8", stdio: "pipe", shell: false });
    if (probe.status === 0) return { ok: true, version: (probe.stdout || "").trim(), command: cmd };
  }
  return { ok: false };
}

function semverGte(version, min) {
  try {
    const parse = v => v.replace(/^v/, "").split(".").map(Number);
    const [ma, mi, pa] = parse(version);
    const [mamin, mimin, pamin] = parse(min);
    if (ma !== mamin) return ma > mamin;
    if (mi !== mimin) return mi > mimin;
    return pa >= pamin;
  } catch { return false; }
}

function usage() {
  console.log(`Jintia Toolchain

Uso:
  jintia install [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes]
  jintia update [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes]
  jintia status [--providers=claude,codex] [--project RUTA] [--json]
  jintia repair|uninstall [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes]
  jintia init <curso> [--code CODIGO] [--name NOMBRE]
  jintia syllabus validate <README.md>
  jintia doctor [--json]
  jintia context <init|read|validate> <curso> [--json]
  jintia agents plan <operación> [--json]
  jintia detect [proyecto] [--providers=claude,codex] [--json]
  jintia harness <status|install|update|repair|uninstall> [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes] [--json]
  jintia audit <README.md> [--json] [--strict]
  jintia state update <curso> <semana> <estado> [archivo-fuente]
  jintia hook post-edit --changed <archivos...>

  — Motor editorial HTML —
  jintia validate  <guide.json> [--strict] [--json]
  jintia render    <guide.json> [--theme ID] [--output guide.html]
  jintia compile   <guide.json> [--engine vivliostyle|pagedjs] [--output guide.pdf]
  jintia preview   <guide.json>
  jintia preflight <guide.html>

  — Visual —
  jintia visual render  <spec.json> --template ID
  jintia visual inspect <manifest.json>
  jintia migrate <semanas/semana-XX>
  jintia behavior <guide.json> [--strict] [--json]
  jintia behavior eval --output <guide.json|respuesta.txt> [--spec ID] [--json]
  jintia behavior list [--json]

  — Calidad de documentación —
  jintia docs:check   [--json]
  jintia legacy:check [--json]

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
  const viv     = checkVivliostyleVersion();
  const nodeOk  = semverGte(process.version, "22.12.0");

  const checks = [
    {
      id: "node", label: "Node.js", required: true,
      ok: true, detail: `${process.version}${!nodeOk ? " ⚠ (PDF requiere >=22.12.0)" : ""}`
    },
    {
      id: "node-22", label: "Node.js >=22.12.0 (PDF)", required: false,
      ok: nodeOk, detail: nodeOk ? process.version : `actual: ${process.version}`
    },
    {
      id: "vivliostyle", label: "Vivliostyle CLI", required: false,
      ok: viv.ok, detail: viv.ok ? `${viv.version} (${viv.command})` : "no encontrado — npm install --global @vivliostyle/cli"
    },
    {
      id: "python", label: "Python", command: "python", required: false
    },
    {
      id: "institution", label: "config/institution.json", required: false,
      ok: fs.existsSync(path.join(ROOT, "config", "institution.json"))
    },
    {
      id: "theme-clasico", label: "Tema jintia-clasico", required: true,
      ok: fs.existsSync(path.join(ROOT, "themes", "jintia-clasico", "meta.json"))
    },
  ];

  for (const check of checks) {
    if (check.ok === undefined) check.ok = commandExists(check.command);
    if (!check.detail && check.command && check.ok) check.detail = check.command;
  }

  const result = {
    tool: "jintia doctor",
    version: require(path.join(ROOT, "package.json")).version,
    checks,
    ok: checks.every(check => !check.required || check.ok)
  };

  if (asJson) {
    printReport(createReport({ command: "doctor", exitCode: result.ok ? 0 : 1, checks, data: result }));
  } else {
    console.log(`Jintia Doctor · ${result.version}`);
    for (const check of checks) {
      console.log(`${check.ok ? "✓" : "✗"} ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
    }
    console.log(result.ok
      ? "\nEstado: listo para el motor editorial HTML."
      : "\nEstado: faltan dependencias requeridas.");
  }

  if (!result.ok) process.exitCode = 1;
}

function main(argv) {
  const [command, subcommand, ...rest] = argv;
  if (!command || command === "help" || command === "--help") return usage();
  if (["install", "update", "repair", "uninstall", "status"].includes(command)) {
    return runScript("harness-manager.js", [command, subcommand, ...rest].filter(Boolean), command);
  }
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

  // ─── Motor editorial HTML ───────────────────────────────────────────────────
  if (command === "validate") return runScript("content-linter.js", argv.slice(1), "validate");
  if (command === "render")   return runScript("guide-renderer.js", argv.slice(1), "render");

  if (command === "compile") {
    const restArgs = argv.slice(1);
    const inputFile = restArgs.find(a => !a.startsWith("-"));
    if (inputFile && /\.json$/i.test(inputFile)) {
      // guide.json → render a HTML → compilar a PDF
      const htmlPath  = inputFile.replace(/\.json$/i, ".html");
      const themeArg  = option(restArgs, "--theme", null);
      const outputArg = option(restArgs, "--output", null);
      const renderArgs = [inputFile, "--output", htmlPath];
      if (themeArg) renderArgs.push("--theme", themeArg);
      const renderResult = spawnSync(process.execPath, [path.join(SCRIPTS, "guide-renderer.js"), ...renderArgs], {
        cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false,
      });
      if (renderResult.error) throw renderResult.error;
      if (renderResult.status !== 0) { process.exitCode = renderResult.status; return; }
      const compileArgs = [htmlPath];
      if (outputArg) compileArgs.push("--output", outputArg);
      return runScript("vivliostyle-adapter.js", compileArgs, "compile");
    }
    return runScript("vivliostyle-adapter.js", restArgs, "compile");
  }

  if (command === "preview") {
    const restArgs = argv.slice(1);
    const inputFile = restArgs.find(a => !a.startsWith("-"));
    if (inputFile && /\.json$/i.test(inputFile)) {
      // guide.json → render a HTML → vista previa
      const htmlPath  = inputFile.replace(/\.json$/i, ".html");
      const themeArg  = option(restArgs, "--theme", null);
      const renderArgs = [inputFile, "--output", htmlPath];
      if (themeArg) renderArgs.push("--theme", themeArg);
      const renderResult = spawnSync(process.execPath, [path.join(SCRIPTS, "guide-renderer.js"), ...renderArgs], {
        cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false,
      });
      if (renderResult.error) throw renderResult.error;
      if (renderResult.status !== 0) { process.exitCode = renderResult.status; return; }
      const previewArgs = ["preview", htmlPath];
      const portArg = option(restArgs, "--port", null);
      if (portArg) previewArgs.push("--port", portArg);
      return runScript("vivliostyle-adapter.js", previewArgs, "preview");
    }
    return runScript("vivliostyle-adapter.js", ["preview", ...restArgs], "preview");
  }

  if (command === "preflight") return runScript("pdf-preflight.js", argv.slice(1), "preflight");

  if (command === "migrate")       return runScript("legacy-manager.js",   argv.slice(1), "migrate");
  if (command === "docs:check")    return runScript("doc-ref-checker.js",  argv.slice(1), "docs:check");
  if (command === "legacy:check")  return runScript("legacy-linter.js",    argv.slice(1), "legacy:check");

  if (command === "behavior") {
    if (subcommand === "eval")  return runScript("behavior-eval.js",  rest, "behavior eval");
    if (subcommand === "list")  return runScript("behavior-eval.js",  ["--list", ...rest], "behavior list");
    // Sin subcommand: behavior-runner determinístico sobre guide.json
    return runScript("behavior-runner.js", argv.slice(1), "behavior");
  }
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
