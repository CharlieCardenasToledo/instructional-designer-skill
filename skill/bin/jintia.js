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
  jintia update [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes] [--verify-contract]
  jintia status [--providers=claude,codex] [--project RUTA] [--json]
  jintia repair|uninstall [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes]
  jintia init <curso> [--code CODIGO] [--name NOMBRE]
  jintia doctor [--json]
  jintia context <init|read|validate> <curso> [--json]
  jintia agents plan <operación> [--json]
  jintia detect [proyecto] [--providers=claude,codex] [--json]
  jintia harness <status|install|update|repair|uninstall> [--providers=claude,codex] [--scope=project|global] [--project RUTA] [--yes] [--json]
  jintia audit <README.md> [--json] [--strict]
  jintia state update <curso> <semana> <estado> [archivo-fuente]
  jintia hook post-edit --changed <archivos...>

  — Sílabo —
  jintia syllabus validate <README.md>
  jintia syllabus check    <curso> <semana>     [--json]
  jintia syllabus import   <curso> <archivo>    [--json]

  — Plan semanal —
  jintia plan save    <curso> <semana> [--file plan.json] [--json]
  jintia plan approve <curso> <semana> [--json]
  jintia plan check   <curso> <semana> [--json]
  jintia plan status  <curso> <semana> [--json]

  — Compuerta de evidencia —
  jintia evidence check <curso> <semana> [--notebook-available] [--json]

  — Motor editorial HTML —
  jintia validate  <guide.json> [--strict] [--json]
  jintia render    <guide.json> [--theme ID] [--output guide.html]
  jintia compile   <guide.json> [--output guide.pdf]
  jintia preview   <guide.json>
  jintia preflight <guide.html>

  — Visual —
  jintia visual render  <spec.json> --template ID
  jintia visual inspect <manifest.json>
  jintia migrate <curso> [--dry-run] [--json]
  jintia behavior <guide.json> [--strict] [--json]
  jintia behavior eval --output <guide.json|respuesta.txt> [--spec ID] [--json]
  jintia behavior list [--json]

  — Sesión editorial —
  jintia transcript export <curso> [--mode editorial|technical|summary] [--output FILE] [--redact=email,path,token] [--json]

  — Calidad de documentación —
  jintia docs:check   [--json]
  jintia legacy:check [--json]

Flujo canónico:
  init → syllabus validate → plan save → plan approve → guide.json → validate → render → compile`);
}

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function runScript(script, args, command = script.replace(/\.js$/, "")) {
  const asJson = args.includes("--json");
  const forwardedArgs = args.filter(arg => arg !== "--json");
  const childArgs = asJson && (script === "rules-runner.js" || script === "context-manager.js" || script === "agent-plan.js" || script === "harness-detect.js" || script === "harness-manager.js" || script === "migrate-runner.js")
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

  // update --verify-contract: pre-check → update → post-check
  if (command === "update" && argv.includes("--verify-contract")) {
    const updateArgs = [command, subcommand, ...rest].filter(Boolean).filter(a => a !== "--verify-contract");
    console.log("── Pre-update: verificando contratos editoriales ──");
    const legacyPre = spawnSync(process.execPath, [path.join(SCRIPTS, "legacy-linter.js")], {
      cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false,
    });
    const updateResult = spawnSync(process.execPath, [path.join(SCRIPTS, "harness-manager.js"), ...updateArgs], {
      cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false,
    });
    if (updateResult.error) throw updateResult.error;
    console.log("\n── Post-update: verificando estado editorial ──");
    doctor(false);
    spawnSync(process.execPath, [path.join(SCRIPTS, "legacy-linter.js")], {
      cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: false,
    });
    process.exitCode = updateResult.status ?? 1;
    return;
  }

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
  if (command === "render") {
    const renderArgs = argv.slice(1);
    const inputFile  = renderArgs.find(a => !a.startsWith("-"));
    // Si la entrada es .json y no se pasó --output, generar guide.html al lado del JSON
    if (inputFile && /\.json$/i.test(inputFile) && !renderArgs.includes("--output")) {
      const htmlPath = inputFile.replace(/\.json$/i, ".html");
      return runScript("guide-renderer.js", [...renderArgs, "--output", htmlPath], "render");
    }
    return runScript("guide-renderer.js", renderArgs, "render");
  }

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

  if (command === "migrate")        return runScript("migrate-runner.js",  argv.slice(1), "migrate");
  if (command === "docs:check")    return runScript("doc-ref-checker.js",  argv.slice(1), "docs:check");
  if (command === "legacy:check")  return runScript("legacy-linter.js",    argv.slice(1), "legacy:check");

  if (command === "behavior") {
    if (subcommand === "eval")  return runScript("behavior-eval.js",  rest, "behavior eval");
    if (subcommand === "list")  return runScript("behavior-eval.js",  ["--list", ...rest], "behavior list");
    // Sin subcommand: behavior-runner determinístico sobre guide.json
    return runScript("behavior-runner.js", argv.slice(1), "behavior");
  }
  // ─── Sílabo ─────────────────────────────────────────────────────────────────
  if (command === "syllabus") {
    if (subcommand === "validate") return runScript("syllabus-validator.js", rest, "syllabus validate");

    if (subcommand === "check") {
      const { validateSyllabus } = require("../runtime/core/syllabus-manager");
      const courseDir = rest[0];
      const week      = rest[1];
      const asJson    = rest.includes("--json");
      if (!courseDir) { console.error("Uso: jintia syllabus check <curso> <semana>"); process.exitCode = 2; return; }
      const readmePath = path.resolve(courseDir, "README.md");
      if (!fs.existsSync(readmePath)) {
        console.error(`No existe README.md en: ${courseDir}`);
        process.exitCode = 1; return;
      }
      const content = fs.readFileSync(readmePath, "utf8");
      const { valid, errors } = validateSyllabus(content);
      if (asJson) {
        console.log(JSON.stringify({ status: valid ? "success" : "error", errors }));
      } else {
        if (valid) { console.log("✓ Sílabo válido."); }
        else { errors.forEach(e => console.error(`✗ ${e}`)); process.exitCode = 1; }
      }
      return;
    }

    if (subcommand === "import") {
      const courseDir = rest[0];
      const source    = rest[1];
      if (!courseDir || !source) {
        console.error("Uso: jintia syllabus import <curso> <archivo>");
        process.exitCode = 2; return;
      }
      console.log(`Importación de sílabo desde: ${source}`);
      console.log("Esta operación convierte el archivo al contrato README.md canónico.");
      console.log("Implementa la conversión específica del formato con scripts/syllabus-import.js.");
      console.log(`Consulta skill/references/esquema-silabo.md para el contrato.`);
      return;
    }

    console.error(`Subcomando desconocido: jintia syllabus ${subcommand || "<vacío>"}`);
    console.error("Subcomandos disponibles: validate, check, import");
    process.exitCode = 2; return;
  }

  // ─── Plan semanal ────────────────────────────────────────────────────────────
  if (command === "plan") {
    const planState = require("../runtime/core/plan-state");
    const asJson    = argv.includes("--json");

    if (subcommand === "save") {
      const courseDir  = rest[0];
      const weekNumber = rest[1];
      const planFile   = option(rest, "--file", null);
      if (!courseDir || !weekNumber) {
        console.error("Uso: jintia plan save <curso> <semana> [--file plan.json]");
        process.exitCode = 2; return;
      }
      const planData = planFile && fs.existsSync(planFile)
        ? JSON.parse(fs.readFileSync(planFile, "utf8"))
        : { course: path.basename(path.resolve(courseDir)), missingEvidence: [] };
      const saved = planState.savePlan(path.resolve(courseDir), weekNumber, planData);
      if (asJson) {
        console.log(JSON.stringify({ status: "saved", path: saved, week: weekNumber }));
      } else {
        console.log(`✓ Plan de semana ${weekNumber} guardado: ${saved}`);
      }
      return;
    }

    if (subcommand === "approve") {
      const courseDir  = rest[0];
      const weekNumber = rest[1];
      if (!courseDir || !weekNumber) {
        console.error("Uso: jintia plan approve <curso> <semana>");
        process.exitCode = 2; return;
      }
      const result = planState.approvePlan(path.resolve(courseDir), weekNumber);
      if (asJson) {
        console.log(JSON.stringify({ status: result.ok ? "approved" : "error", message: result.message, path: result.path }));
      } else {
        console.log(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`);
      }
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (subcommand === "check") {
      const courseDir  = rest[0];
      const weekNumber = rest[1];
      if (!courseDir || !weekNumber) {
        console.error("Uso: jintia plan check <curso> <semana>");
        process.exitCode = 2; return;
      }
      const result = planState.checkPlanApproved(path.resolve(courseDir), weekNumber);
      if (asJson) {
        console.log(JSON.stringify({ approved: result.approved, status: result.status, message: result.message }));
      } else {
        console.log(result.approved ? `✓ ${result.message}` : `✗ ${result.message}`);
      }
      if (!result.approved) process.exitCode = 1;
      return;
    }

    if (subcommand === "status") {
      const courseDir  = rest[0];
      const weekNumber = rest[1];
      if (!courseDir || !weekNumber) {
        console.error("Uso: jintia plan status <curso> <semana>");
        process.exitCode = 2; return;
      }
      const record = planState.getPlan(path.resolve(courseDir), weekNumber);
      if (!record) {
        const msg = `No existe plan para semana ${weekNumber} en ${courseDir}.`;
        if (asJson) console.log(JSON.stringify({ status: "not_found", message: msg }));
        else console.log(`✗ ${msg}`);
        process.exitCode = 1; return;
      }
      if (asJson) { console.log(JSON.stringify(record)); }
      else {
        console.log(`Plan semana ${record.week} — ${record.course}`);
        console.log(`  Estado:    ${record.status}`);
        console.log(`  Tema:      ${record.topic || "(sin especificar)"}`);
        console.log(`  Guardado:  ${record.savedAt}`);
        if (record.approvedAt) console.log(`  Aprobado:  ${record.approvedAt}`);
        if (record.missingEvidence?.length) {
          console.log(`  Evidencia faltante: ${record.missingEvidence.join(", ")}`);
        }
      }
      return;
    }

    // Sin subcomando: mostrar guía del playbook
    console.log(`La operación plan es un playbook de la skill.`);
    console.log(`Consulta: ${path.join(ROOT, "commands", "plan.md")}`);
    console.log(`Subcomandos CLI: save, approve, check, status`);
    return;
  }

  // ─── Compuerta de evidencia ──────────────────────────────────────────────────
  if (command === "evidence" && subcommand === "check") {
    const evidenceGate  = require("../runtime/core/evidence-gate");
    const courseDir     = rest[0];
    const weekNumber    = rest[1];
    const asJson        = rest.includes("--json");
    const nlmAvailable  = rest.includes("--notebook-available");
    if (!courseDir || !weekNumber) {
      console.error("Uso: jintia evidence check <curso> <semana> [--notebook-available] [--json]");
      process.exitCode = 2; return;
    }
    const result = evidenceGate.check({
      courseRoot:  path.resolve(courseDir),
      weekNumber:  Number(weekNumber),
      notebookLM:  { configured: nlmAvailable, available: nlmAvailable },
    });
    const report = evidenceGate.toReport(result);
    if (asJson) { console.log(JSON.stringify(report)); }
    else {
      if (result.allowed) {
        console.log(`✓ Evidencia disponible para semana ${weekNumber}.`);
        result.sources.forEach(s => console.log(`  • ${s.type}: ${s.path || "(notebook)"}`));
        if (result.warning) console.log(`  ⚠ ${result.warning}`);
      } else {
        console.error(`✗ ${result.code}: ${result.message}`);
        if (result.detail) console.error(`  ${result.detail}`);
      }
    }
    if (!result.allowed) process.exitCode = 1;
    return;
  }

  if (command === "visual" && subcommand === "render") return runScript("visual-pipeline.js", rest, "visual render");
  if (command === "visual" && subcommand === "inspect") return runScript("visual-inspector.js", rest, "visual inspect");

  if (command === "guide") {
    console.log(`La operación guide es un playbook de la skill.`);
    console.log(`Consulta: ${path.join(ROOT, "commands", "guide.md")}`);
    console.log(`Antes de generar guide.json, verifica: jintia plan check <curso> <semana>`);
    return;
  }
  if (command === "assessment") {
    console.log(`La operación assessment es un playbook de la skill.`);
    console.log(`Consulta: ${path.join(ROOT, "commands", "assessment.md")}`);
    return;
  }

  if (command === "transcript") {
    if (subcommand === "export") {
      const { exportTranscript } = require("../scripts/transcript-export");
      const courseDir  = rest[0];
      const asJson     = rest.includes("--json");
      const modeArg    = rest.find(a => a.startsWith("--mode="))?.slice(7) || "editorial";
      const outputFlag = rest.find(a => a.startsWith("--output="))?.slice(9)
                      || (rest.includes("--output") ? rest[rest.indexOf("--output") + 1] : null);
      const redactArg  = rest.find(a => a.startsWith("--redact="))?.slice(9) || "";

      if (!courseDir || courseDir.startsWith("--")) {
        console.error("Uso: jintia transcript export <curso> [--mode editorial|technical|summary] [--output FILE]");
        process.exitCode = 2; return;
      }

      const result = exportTranscript(path.resolve(courseDir), { mode: modeArg, redact: redactArg });

      if (result.error) {
        if (asJson) console.log(JSON.stringify({ status: "error", ...result }));
        else { console.error(`✗ ${result.error}: ${result.message}`); console.error(`  ${result.detail}`); }
        process.exitCode = 1; return;
      }

      if (outputFlag) {
        const outPath = path.resolve(outputFlag);
        fs.writeFileSync(outPath, result.content, "utf8");
        if (!asJson) console.log(`✓ Informe de sesión exportado: ${outPath}`);
        else console.log(JSON.stringify({ status: "ok", output: outPath }));
      } else {
        if (asJson) console.log(JSON.stringify({ status: "ok", content: result.content }));
        else console.log(result.content);
      }
      return;
    }

    console.log(`La operación transcript es un playbook de la skill.`);
    console.log(`Consulta: ${path.join(ROOT, "commands", "transcript.md")}`);
    console.log(`Subcomandos: export`);
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
