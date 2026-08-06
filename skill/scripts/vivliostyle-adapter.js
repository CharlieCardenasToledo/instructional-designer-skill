#!/usr/bin/env node
"use strict";

/**
 * vivliostyle-adapter.js — Adaptador Vivliostyle CLI para Jintia
 *
 * Invoca Vivliostyle CLI como proceso EXTERNO e INDEPENDIENTE mediante
 * spawnSync. Nunca importa la API interna de @vivliostyle/cli.
 * Esto preserva la licencia MIT de Jintia (Vivliostyle usa AGPL-3.0).
 *
 * Uso CLI:
 *   node scripts/vivliostyle-adapter.js guide.html [--output guide.pdf] [--size A4]
 *
 * Uso programático:
 *   const { buildPdf, checkVivliostyle } = require("./vivliostyle-adapter");
 *   buildPdf("guide.html", "guide.pdf");
 */

const { spawnSync } = require("node:child_process");
const fs   = require("node:fs");
const path = require("node:path");

// ─── Detección de Vivliostyle ─────────────────────────────────────────────────

/**
 * Comprueba si Vivliostyle CLI está disponible en PATH.
 * @returns {{ ok: boolean, version?: string, command: string }}
 */
function checkVivliostyle() {
  // En Windows, shell:true es necesario para encontrar archivos .cmd en PATH.
  // La detección de versión no ejecuta input del usuario, por lo que es seguro.
  const useShell = process.platform === "win32";
  for (const cmd of ["vivliostyle", "viv"]) {
    const probe = spawnSync(cmd, ["--version"], {
      encoding: "utf8",
      stdio:    "pipe",
      shell:    useShell,
    });
    if (probe.status === 0) {
      return { ok: true, version: (probe.stdout || "").trim(), command: cmd };
    }
  }
  return { ok: false, command: "vivliostyle" };
}

// ─── Compilación PDF ──────────────────────────────────────────────────────────

/**
 * Convierte un archivo HTML a PDF usando Vivliostyle CLI.
 *
 * ⚠ IMPORTANTE: Solo usa spawnSync con el ejecutable del sistema.
 *   Nunca importar require("@vivliostyle/cli") — eso convertiría Jintia
 *   en un programa combinado bajo AGPL-3.0.
 *
 * @param {string} htmlPath   - Ruta al archivo HTML de entrada
 * @param {string} outputPath - Ruta al PDF de salida
 * @param {object} [options]
 * @param {string} [options.size]       - Tamaño de página (default: "A4")
 * @param {string} [options.theme]      - Ruta a CSS de tema adicional
 * @param {string} [options.timeout]    - Timeout en ms (default: 60000)
 * @param {boolean} [options.verbose]   - Salida detallada
 */
function buildPdf(htmlPath, outputPath, options = {}) {
  const vivliostyle = checkVivliostyle();

  if (!vivliostyle.ok) {
    throw new Error(
      "Vivliostyle CLI no encontrado. Instálalo con:\n" +
      "  npm install --global @vivliostyle/cli\n" +
      "Requiere Node.js >=22.12.0."
    );
  }

  const absHtml   = path.resolve(htmlPath);
  const absOutput = path.resolve(outputPath);

  if (!fs.existsSync(absHtml)) {
    throw new Error(`Archivo HTML no encontrado: ${absHtml}`);
  }

  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  const args = [
    "build",
    absHtml,
    "--output",   absOutput,
    "--size",     options.size || "A4",
  ];

  if (options.theme)   args.push("--theme",   path.resolve(options.theme));
  if (options.verbose) args.push("--verbose");

  if (options.verbose) {
    console.log(`[vivliostyle-adapter] ${vivliostyle.command} ${args.join(" ")}`);
  }

  const result = spawnSync(vivliostyle.command, args, {
    encoding: "utf8",
    stdio:    "inherit",
    shell:    process.platform === "win32",
    timeout:  options.timeout || 60_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Vivliostyle terminó con código de salida ${result.status}.\n` +
      "Verifica que el HTML sea válido y que el tema CSS esté accesible."
    );
  }

  return absOutput;
}

// ─── Vista previa (abre en navegador) ────────────────────────────────────────

/**
 * Lanza el servidor de vista previa de Vivliostyle.
 * @param {string} htmlPath
 * @param {object} [options]
 * @param {number} [options.port] - Puerto (default: 13000)
 */
function previewHtml(htmlPath, options = {}) {
  const vivliostyle = checkVivliostyle();

  if (!vivliostyle.ok) {
    throw new Error("Vivliostyle CLI no encontrado. Ver instrucciones de instalación.");
  }

  const absHtml = path.resolve(htmlPath);
  const port    = options.port || 13000;

  const args = ["preview", absHtml, "--port", String(port)];

  console.log(`[vivliostyle-adapter] Iniciando vista previa en http://localhost:${port}`);
  console.log("Presiona Ctrl+C para detener.");

  // Para preview usamos spawn (no sync) para no bloquear el proceso
  const { spawn } = require("node:child_process");
  const child = spawn(vivliostyle.command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("error", err => {
    console.error(`[vivliostyle-adapter] Error al iniciar vista previa: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", code => {
    process.exit(code || 0);
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const subcommand = args[0];

  function argValue(name) {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  }

  if (subcommand === "--version" || subcommand === "version") {
    const v = checkVivliostyle();
    console.log(v.ok
      ? `Vivliostyle CLI: ${v.version} (${v.command})`
      : "Vivliostyle CLI: no encontrado"
    );
    process.exit(v.ok ? 0 : 1);
  }

  if (subcommand === "preview") {
    const htmlPath = args[1] || "guide.html";
    try {
      previewHtml(htmlPath, { port: Number(argValue("--port")) || 13000 });
    } catch (err) {
      console.error(`vivliostyle-adapter: ${err.message}`);
      process.exit(1);
    }
    return; // child process mantiene el proceso vivo
  }

  // Por defecto: build
  const htmlPath   = args.find(a => !a.startsWith("--") && a !== "build") || "guide.html";
  const outputPath = argValue("--output") || htmlPath.replace(/\.html?$/, ".pdf") || "guide.pdf";
  const theme      = argValue("--theme");
  const size       = argValue("--size") || "A4";
  const verbose    = args.includes("--verbose");

  try {
    const out = buildPdf(htmlPath, outputPath, { size, theme, verbose });
    console.log(`✓ PDF generado: ${out}`);
  } catch (err) {
    console.error(`vivliostyle-adapter: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { buildPdf, checkVivliostyle, previewHtml };
