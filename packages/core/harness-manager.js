"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { PROVIDERS, providerById, normalizeProviders } = require("./harnesses");

const MANIFEST = ".jintia-install.json";

function versionParts(value) {
  const match = String(value || "").match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)] : null;
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function globalBase(provider, homeDir, env = process.env, platform = process.platform) {
  if (provider.id === "codex" && env.CODEX_HOME) return env.CODEX_HOME;
  if (provider.id === "opencode" && env.OPENCODE_CONFIG_DIR) return env.OPENCODE_CONFIG_DIR;
  if (platform === "win32" && provider.id === "copilot" && env.APPDATA) return path.join(env.APPDATA, "github-copilot");
  if (platform === "darwin" && provider.id === "cursor") return path.join(homeDir, "Library", "Application Support", "Cursor");
  return path.join(homeDir, provider.globalHints[0]);
}

function installPath(provider, scope, projectRoot = process.cwd(), homeDir = process.env.USERPROFILE || process.env.HOME || "", env = process.env, platform = process.platform) {
  const base = scope === "project" ? path.join(projectRoot, provider.projectDir) : globalBase(provider, homeDir, env, platform);
  return path.join(base, provider.skillsDir, "jintia-skill");
}

function readInstalledState(target, availableVersion) {
  const skillFile = path.join(target, "SKILL.md");
  const manifestFile = path.join(target, MANIFEST);
  const versionFile = path.join(target, "VERSION");
  const exists = fs.existsSync(target);
  const installed = fs.existsSync(skillFile);
  let manifest = null;
  if (fs.existsSync(manifestFile)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")); }
    catch { manifest = { managedBy: "invalid" }; }
  }
  const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : null;
  const comparison = compareVersions(version, availableVersion);
  let status = "not-detected";
  if (exists && !installed) status = manifest?.managedBy === "jintia" ? "repair-needed" : "incomplete";
  else if (installed && !manifest) status = "repair-needed";
  else if (installed && comparison !== null && comparison < 0) status = "outdated";
  else if (installed) status = "installed";
  return { exists, installed, managed: Boolean(manifest?.managedBy === "jintia"), manifest, version, availableVersion, status };
}

function resolveTargets({ projectRoot = process.cwd(), homeDir = process.env.USERPROFILE || process.env.HOME || "", env = process.env, platform = process.platform, providers = PROVIDERS, availableVersion = "10.8.0" } = {}) {
  return providers.flatMap(provider => ["project", "global"].map(scope => {
    const target = installPath(provider, scope, path.resolve(projectRoot), homeDir, env, platform);
    const state = readInstalledState(target, availableVersion);
    const harnessPath = path.dirname(path.dirname(target));
    if (state.status === "not-detected" && fs.existsSync(harnessPath)) state.status = "detected";
    return { id: provider.id, name: provider.name, scope, target, state };
  }));
}

function detectInstallationStates(options = {}) {
  const selected = normalizeProviders(options.explicitProviders || options.providers || []);
  const providers = selected.length ? selected : PROVIDERS;
  return resolveTargets({ ...options, providers });
}

function copySkill(sourcePath, target, version) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(sourcePath, target, { recursive: true, force: true, errorOnExist: false });
  fs.writeFileSync(path.join(target, "VERSION"), `${version}\n`);
  fs.writeFileSync(path.join(target, MANIFEST), `${JSON.stringify({ managedBy: "jintia", version, source: path.resolve(sourcePath), files: ["SKILL.md", "VERSION"] }, null, 2)}\n`);
}

function selectTargets(options) {
  const selected = normalizeProviders(options.providers || options.explicitProviders || []);
  if (!selected.length) throw new Error("Debes indicar al menos un proveedor con --providers=claude,codex,cursor.");
  const scope = options.scope || "project";
  if (!["project", "global"].includes(scope)) throw new Error("El alcance debe ser project o global.");
  return selected.map(provider => ({ provider, scope, target: installPath(provider, scope, options.projectRoot, options.homeDir, options.env, options.platform) }));
}

function mutate(operation, options) {
  if (!options.confirm) throw new Error("La operación modifica archivos. Confirma explícitamente con --yes.");
  const sourcePath = path.resolve(options.sourcePath || path.join(__dirname, "..", "..", "skill"));
  const version = options.version || "10.8.0";
  const results = [];
  for (const item of selectTargets(options)) {
    const before = readInstalledState(item.target, version);
    if (operation === "uninstall") {
      if (!before.managed) { results.push({ ...item, status: before.status, changed: false, message: "No se eliminó: no existe una instalación gestionada por Jintia." }); continue; }
      fs.rmSync(item.target, { recursive: true, force: false });
      results.push({ ...item, status: "not-detected", changed: true });
      continue;
    }
    if (before.exists && !before.managed && operation !== "repair") throw new Error(`No se sobrescribe una ruta ajena: ${item.target}`);
    if (operation === "repair" && before.exists && !before.managed) throw new Error(`No se repara una ruta no gestionada: ${item.target}`);
    copySkill(sourcePath, item.target, version);
    results.push({ ...item, status: operation === "install" ? "installed" : operation, version, changed: true });
  }
  return { operation, version, results };
}

module.exports = { MANIFEST, compareVersions, globalBase, installPath, readInstalledState, detectInstallationStates, mutate };
