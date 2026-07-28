import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = relative => readFile(resolve(root, relative), "utf8");
const json = async relative => JSON.parse(await read(relative));
const failures = [];

const skillPackage = await json("skill/package.json");
const claudePlugin = await json("skill/.claude-plugin/plugin.json");
const openAiPlugin = await json("openai-plugin/.codex-plugin/plugin.json");
const [payload, appMeta, mock, changelog, skillCheck] = await Promise.all([
  read("app/desktop/src-tauri/src/payload.rs"),
  read("app/desktop/src/appMeta.js"),
  read("app/desktop/src/mocks/tauri-core.mock.js"),
  read("CHANGELOG.md"),
  json("package.json")
]);

const expected = skillPackage.version;
const checks = [
  ["Claude plugin", claudePlugin.version],
  ["ChatGPT/Codex plugin", openAiPlugin.version],
  ["Rust payload", payload.match(/SKILL_VERSION:\s*&str\s*=\s*"([^"]+)"/)?.[1]],
  ["Desktop metadata", appMeta.match(/skillVersion:\s*"([^"]+)"/)?.[1]],
  ["Desktop mock", mock.match(/available_skill_version:\s*"([^"]+)"/)?.[1]]
];
for (const [label, actual] of checks) {
  if (actual !== expected) failures.push(`${label}: ${actual || "ausente"}; esperado ${expected}`);
}
if (!changelog.includes(`jintia-skill\` ${expected}`)) {
  failures.push(`CHANGELOG.md no declara jintia-skill ${expected} en Sin publicar`);
}
if (!skillCheck.scripts?.["skill:check"]?.includes("visual-progressive.js")) {
  failures.push("skill:check no cubre visual-progressive.js");
}
if (!skillCheck.scripts?.["skill:check"]?.includes("visual-matrix-check.js")) {
  failures.push("skill:check no cubre visual-matrix-check.js");
}
if (!skillCheck.scripts?.["skill:check"]?.includes("visual-pipeline.js")) {
  failures.push("skill:check no cubre visual-pipeline.js");
}
if (!skillCheck.scripts?.["skill:check"]?.includes("test-runner.js")) {
  failures.push("skill:check no cubre test-runner.js");
}

const jsonFiles = [
  "skill/config/visual-tools.json",
  "skill/config/visual-install-profiles.json",
  "skill/schemas/visual-spec.schema.json",
  "skill/schemas/visual-manifest.schema.json",
  "skill/templates/elegantbook-clasico/meta.json",
  "skill/templates/kaohandt-marginal/meta.json"
];
for (const file of jsonFiles) {
  try {
    await json(file);
  } catch (error) {
    failures.push(`${file}: JSON inválido (${error.message})`);
  }
}

const requiredScripts = [
  "schema-validator.js",
  "visual-capabilities.js",
  "visual-inspector.js",
  "visual-linter.js",
  "visual-matrix-check.js",
  "visual-progressive.js",
  "visual-pipeline.js",
  "visual-regression.js",
  "visual-renderer.js",
  "visual-selector.js",
  "visual-source-generator.js",
  "test-runner.js"
];
for (const script of requiredScripts) {
  try {
    await read(`skill/scripts/${script}`);
  } catch {
    failures.push(`Falta skill/scripts/${script}`);
  }
}

try {
  const matrix = await read(".github/workflows/visual-engine-matrix.yml");
  for (const os of ["ubuntu-latest", "macos-latest", "windows-latest"]) {
    if (!matrix.includes(os)) failures.push(`La matriz visual no incluye ${os}`);
  }
  if (!matrix.includes('JINTIA_REAL_RENDER_TESTS: "1"')) {
    failures.push("La matriz visual no activa renderizado real");
  }
} catch {
  failures.push("Falta .github/workflows/visual-engine-matrix.yml");
}

if (failures.length) {
  failures.forEach(failure => console.error(`[ERROR] ${failure}`));
  process.exit(1);
}
console.log(`Release readiness OK para jintia-skill ${expected}.`);
console.log("La publicación aún requiere que la matriz remota de motores termine correctamente.");
