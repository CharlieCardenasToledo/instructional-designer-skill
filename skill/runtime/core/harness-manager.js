"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { PROVIDERS, providerById, normalizeProviders } = require("./harnesses");
const SKILL_VERSION = require("../../package.json").version;

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
  if (provider.id === "codex") return path.join(homeDir, ".agents");
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

function resolveTargets({ projectRoot = process.cwd(), homeDir = process.env.USERPROFILE || process.env.HOME || "", env = process.env, platform = process.platform, providers = PROVIDERS, availableVersion = SKILL_VERSION } = {}) {
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
  if (path.resolve(sourcePath) !== path.resolve(target)) {
    fs.cpSync(sourcePath, target, { recursive: true, force: true, errorOnExist: false });
  }
  fs.writeFileSync(path.join(target, "VERSION"), `${version}\n`);
  fs.writeFileSync(path.join(target, MANIFEST), `${JSON.stringify({ managedBy: "jintia", version, source: path.resolve(sourcePath), files: ["SKILL.md", "VERSION"] }, null, 2)}\n`);
}

// `allowed-tools` is Claude Code's tool-permission scoping syntax. Codex's
// SKILL.md contract uses name/description for discovery, so the Codex copy
// removes this provider-specific block while preserving the shared body.
function stripAllowedToolsFrontmatter(skillMd) {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return skillMd;
  let skipping = false;
  const kept = match[1].split(/\r?\n/).filter(line => {
    if (/^allowed-tools:\s*$/.test(line)) { skipping = true; return false; }
    if (skipping && /^\s+-\s/.test(line)) return false;
    skipping = false;
    return true;
  });
  return skillMd.slice(0, match.index) + `---\n${kept.join("\n")}\n---\n` + skillMd.slice(match.index + match[0].length);
}

function stripCodexSkillMd(target) {
  const skillMdPath = path.join(target, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) return;
  const original = fs.readFileSync(skillMdPath, "utf8");
  const stripped = stripAllowedToolsFrontmatter(original);
  if (stripped !== original) fs.writeFileSync(skillMdPath, stripped);
}

function codexAgentsDir(scope, projectRoot, homeDir, env = process.env) {
  const base = scope === "project" ? path.join(projectRoot, ".codex") : env.CODEX_HOME || path.join(homeDir, ".codex");
  return path.join(base, "agents");
}

function extractMision(markdown) {
  const heading = "## Misión";
  const start = markdown.indexOf(heading);
  if (start === -1) return "";
  const afterHeading = markdown.slice(start + heading.length);
  const next = afterHeading.search(/\n##\s/);
  const section = next === -1 ? afterHeading : afterHeading.slice(0, next);
  return section.trim().replace(/\s+/g, " ");
}

function tomlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim()}"`;
}

function tomlMultilineString(value) {
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"""/g, '""\\"');
  return `"""\n${escaped}\n"""`;
}

function agentMarkdownToToml(name, markdown) {
  const description = extractMision(markdown) || name;
  return [
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    `developer_instructions = ${tomlMultilineString(markdown.trim())}`,
    "",
  ].join("\n");
}

function syncCodexAgents(sourcePath, scope, options) {
  const agentsSource = path.join(sourcePath, "agents");
  if (!fs.existsSync(agentsSource)) return;
  const destination = codexAgentsDir(scope, options.projectRoot, options.homeDir, options.env);
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(agentsSource, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const name = entry.name.slice(0, -3);
    const markdown = fs.readFileSync(path.join(agentsSource, entry.name), "utf8");
    fs.writeFileSync(path.join(destination, `${name}.toml`), agentMarkdownToToml(name, markdown));
  }
}

function removeCodexAgents(sourcePath, scope, options) {
  const agentsSource = path.join(sourcePath, "agents");
  if (!fs.existsSync(agentsSource)) return;
  const destination = codexAgentsDir(scope, options.projectRoot, options.homeDir, options.env);
  for (const entry of fs.readdirSync(agentsSource, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const name = entry.name.slice(0, -3);
    const tomlPath = path.join(destination, `${name}.toml`);
    if (fs.existsSync(tomlPath)) fs.rmSync(tomlPath);
  }
}

function selectTargets(options) {
  const selected = normalizeProviders(options.providers || options.explicitProviders || []);
  if (!selected.length) throw new Error("Debes indicar al menos un proveedor con --providers=claude,codex,cursor.");
  const scope = options.scope || "project";
  if (!["project", "global"].includes(scope)) throw new Error("El alcance debe ser project o global.");
  return selected.map(provider => ({
    id: provider.id,
    name: provider.name,
    provider,
    scope,
    target: installPath(provider, scope, options.projectRoot, options.homeDir, options.env, options.platform),
  }));
}

function mutate(operation, options) {
  if (!options.confirm) throw new Error("La operación modifica archivos. Confirma explícitamente con --yes.");
  const sourcePath = path.resolve(options.sourcePath || path.join(__dirname, "..", ".."));
  const version = options.version || SKILL_VERSION;
  const results = [];
  for (const item of selectTargets(options)) {
    const before = readInstalledState(item.target, version);
    if (operation === "uninstall") {
      if (!before.managed) { results.push({ ...item, status: before.status, changed: false, message: "No se eliminó: no existe una instalación gestionada por Jintia." }); continue; }
      fs.rmSync(item.target, { recursive: true, force: false });
      if (item.provider.id === "codex") removeCodexAgents(sourcePath, item.scope, options);
      results.push({ ...item, status: "not-detected", changed: true });
      continue;
    }
    if (before.exists && !before.managed && operation !== "repair") throw new Error(`No se sobrescribe una ruta ajena: ${item.target}`);
    if (operation === "repair" && before.exists && !before.managed) throw new Error(`No se repara una ruta no gestionada: ${item.target}`);
    copySkill(sourcePath, item.target, version);
    if (item.provider.id === "codex") {
      syncCodexAgents(sourcePath, item.scope, options);
      stripCodexSkillMd(item.target);
    }
    results.push({ ...item, status: operation === "install" ? "installed" : operation, version, changed: true });
  }
  return { operation, version, results };
}

module.exports = { MANIFEST, compareVersions, globalBase, installPath, readInstalledState, detectInstallationStates, mutate, codexAgentsDir, agentMarkdownToToml, stripAllowedToolsFrontmatter };
