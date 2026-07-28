#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const registry = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "config", "visual-tools.json"), "utf8"));

function probe(command) {
  const checker = process.platform === "win32" ? "where.exe" : "which";
  const found = spawnSync(checker, [command], { encoding: "utf8", shell: false });
  if (found.status !== 0) return null;
  return (found.stdout || "").split(/\r?\n/).find(Boolean)?.trim() || command;
}

function version(command) {
  const args = path.basename(command).toLowerCase().startsWith("dot") ? ["-V"] : ["--version"];
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, timeout: 10000 });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout || ""}${result.stderr || ""}`.trim().split(/\r?\n/)[0] || "available";
}

function chromeCandidates() {
  if (process.platform !== "win32") return [];
  return [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
  ].filter(Boolean);
}

function detectCapabilities() {
  const tools = {};
  for (const [id, definition] of Object.entries(registry.tools)) {
    const configured = definition.environmentVariable && process.env[definition.environmentVariable];
    const candidates = [
      configured,
      ...(id === "chrome" ? chromeCandidates() : []),
      ...(definition.commands || []).map(probe)
    ].filter(Boolean);
    const command = candidates.find(candidate => fs.existsSync(candidate) || probe(candidate));
    tools[id] = {
      available: Boolean(command),
      command: command || null,
      // Chrome para Windows abre una ventana normal al recibir --version.
      // No ejecutar probes que el registro marque como inseguros para CLI.
      version: command && definition.versionProbe !== false ? version(command) : null,
      required: Boolean(definition.required),
      supports: definition.supports
    };
  }
  return { version: registry.version, generatedAt: new Date().toISOString(), tools };
}

if (require.main === module) {
  const result = detectCapabilities();
  const outIndex = process.argv.indexOf("--out");
  if (outIndex >= 0) {
    const target = path.resolve(process.argv[outIndex + 1]);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { detectCapabilities };
