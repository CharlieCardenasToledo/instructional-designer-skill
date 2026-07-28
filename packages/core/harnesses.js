"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROVIDERS = [
  { id: "claude", name: "Claude Code", aliases: ["claude", "claude-code"], projectDir: ".claude", globalHints: [".claude"], skillsDir: "skills", supportsHooks: true },
  { id: "codex", name: "Codex CLI", aliases: ["codex", "agents"], projectDir: ".agents", globalHints: [".codex", ".agents"], skillsDir: "skills", supportsHooks: true },
  { id: "cursor", name: "Cursor", aliases: ["cursor"], projectDir: ".cursor", globalHints: [".cursor"], skillsDir: "skills", supportsHooks: true },
  { id: "gemini", name: "Gemini CLI", aliases: ["gemini", "gemini-cli"], projectDir: ".gemini", globalHints: [".gemini"], skillsDir: "skills", supportsHooks: false },
  { id: "copilot", name: "GitHub Copilot", aliases: ["copilot", "github"], projectDir: ".github", globalHints: [".github"], skillsDir: "skills", supportsHooks: true },
  { id: "grok", name: "Grok Build", aliases: ["grok", "xai", "grok-build"], projectDir: ".grok", globalHints: [".grok"], skillsDir: "skills", supportsHooks: false },
  { id: "kiro", name: "Kiro", aliases: ["kiro"], projectDir: ".kiro", globalHints: [".kiro"], skillsDir: "skills", supportsHooks: false },
  { id: "opencode", name: "OpenCode", aliases: ["opencode"], projectDir: ".opencode", globalHints: [".opencode"], skillsDir: "skills", supportsHooks: false },
  { id: "pi", name: "Project Indigo", aliases: ["pi", "project-indigo"], projectDir: ".pi", globalHints: [path.join(".pi", "agent")], skillsDir: "skills", supportsHooks: false },
  { id: "qoder", name: "Qoder", aliases: ["qoder"], projectDir: ".qoder", globalHints: [".qoder"], skillsDir: "skills", supportsHooks: false },
  { id: "trae", name: "Trae", aliases: ["trae"], projectDir: ".trae", globalHints: [".trae"], skillsDir: "skills", supportsHooks: false },
  { id: "rovodev", name: "Rovo Dev", aliases: ["rovodev", "rovo"], projectDir: ".rovodev", globalHints: [".rovodev"], skillsDir: "skills", supportsHooks: false },
  { id: "vibe", name: "Mistral Vibe", aliases: ["vibe", "mistral-vibe"], projectDir: ".vibe", globalHints: [".vibe"], skillsDir: "skills", supportsHooks: false },
];

function providerById(id) {
  const normalized = String(id || "").trim().toLowerCase();
  return PROVIDERS.find(provider => provider.id === normalized || provider.aliases.includes(normalized));
}

function normalizeProviders(values) {
  return [...new Set(values.flatMap(value => String(value).split(",")).map(providerById).filter(Boolean).map(provider => provider.id))]
    .map(id => providerById(id));
}

function hasRealSkillEntries(skillsPath) {
  if (!fs.existsSync(skillsPath) || !fs.statSync(skillsPath).isDirectory()) return false;
  return fs.readdirSync(skillsPath, { withFileTypes: true }).some(entry => entry.isDirectory() && fs.existsSync(path.join(skillsPath, entry.name, "SKILL.md")));
}

function inspect(provider, scope, foundPath, skillsPath) {
  const skillPath = path.join(skillsPath, "jintia-skill");
  const installed = fs.existsSync(path.join(skillPath, "SKILL.md"));
  const versionPath = path.join(skillPath, "VERSION");
  return {
    id: provider.id,
    name: provider.name,
    scope,
    foundPath,
    installPath: skillsPath,
    installed,
    hasSkills: hasRealSkillEntries(skillsPath),
    skillPath,
    version: installed && fs.existsSync(versionPath) ? fs.readFileSync(versionPath, "utf8").trim() : null,
    status: installed ? "installed" : foundPath ? "detected" : "not-detected",
    supportsHooks: provider.supportsHooks,
  };
}

function detectHarnesses({ projectRoot = process.cwd(), homeDir = process.env.USERPROFILE || process.env.HOME || "", explicitProviders = [], env = process.env } = {}) {
  const root = path.resolve(projectRoot);
  const selected = normalizeProviders(explicitProviders);
  const providers = selected.length ? selected : PROVIDERS;
  const detections = [];
  for (const provider of providers) {
    const projectPath = path.join(root, provider.projectDir);
    if (selected.length || fs.existsSync(projectPath)) detections.push(inspect(provider, "project", fs.existsSync(projectPath) ? projectPath : null, path.join(projectPath, provider.skillsDir)));
  }
  if (!selected.length) {
    for (const provider of providers) {
      const globalHints = provider.id === "opencode" && env.OPENCODE_CONFIG_DIR ? [env.OPENCODE_CONFIG_DIR] : provider.globalHints;
      for (const hint of globalHints) {
        const foundPath = path.isAbsolute(hint) ? hint : path.join(homeDir, hint);
        if (fs.existsSync(foundPath)) {
          const skillsPath = path.join(foundPath, provider.skillsDir);
          detections.push(inspect(provider, "global", foundPath, skillsPath));
          break;
        }
      }
    }
  }
  const unique = new Map(detections.map(detection => [`${detection.id}:${detection.scope}`, detection]));
  const result = [...unique.values()];
  return { schemaVersion: "1.0.0", projectRoot: root, providers: result.length ? result : [inspect(providerById("claude"), "project", null, path.join(root, ".claude", "skills")), inspect(providerById("codex"), "project", null, path.join(root, ".agents", "skills"))], source: selected.length ? "explicit" : result.some(item => item.scope === "project") ? "project" : result.some(item => item.scope === "global") ? "global" : "default" };
}

module.exports = { PROVIDERS, providerById, normalizeProviders, hasRealSkillEntries, detectHarnesses };
