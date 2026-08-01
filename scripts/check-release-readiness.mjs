import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = relative => readFile(resolve(root, relative), "utf8");
const json = async relative => JSON.parse(await read(relative));
const failures = [];

const skillPackage = await json("skill/package.json");
const brand = await json("skill/config/brand.json");
const claudePlugin = await json("skill/.claude-plugin/plugin.json");
const openAiPlugin = await json("openai-plugin/.codex-plugin/plugin.json");
const openAiMcp = await json("openai-plugin/.mcp.json");
const releaseConfig = await json("release/release-config.json");
const [payload, appMeta, mock, changelog, skillCheck] = await Promise.all([
  read("app/desktop/src-tauri/src/payload.rs"),
  read("app/desktop/src/appMeta.js"),
  read("app/desktop/src/mocks/tauri-core.mock.js"),
  read("CHANGELOG.md"),
  json("package.json")
]);

const expected = skillPackage.version;
if (brand.brandName !== "Jintia" || brand.linguisticForm !== "Jíntia" || brand.meaning !== "camino" || !brand.disclaimer) {
  failures.push("La versión no puede publicarse porque la atribución del origen del nombre Jintia está ausente o es inconsistente.");
}
if (!brand.sources?.some(source => /Aarma jintia/i.test(source.claim || "") && source.page === 106)) {
  failures.push("brand.json no contiene la fuente institucional de Aarma jintia con página 106.");
}
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
const expectedMcp = `${releaseConfig.mcp.package}@${releaseConfig.mcp.version}`;
if (openAiMcp.notebooklm?.args?.at(-1) !== expectedMcp) {
  failures.push(`Plugin OpenAI: MCP distinto de ${expectedMcp}`);
}
if (!payload.includes("SKILL_VERSION")) failures.push("Desktop no declara la versión disponible de la skill");
const mcpSource = await read("app/desktop/src-tauri/src/mcp.rs");
if (!mcpSource.includes(expectedMcp)) failures.push(`Desktop no fija ${expectedMcp}`);
if (releaseConfig.minimumDesktopVersion !== "1.1.0") failures.push("minimumDesktopVersion debe declarar 1.1.0 para la primera release separada");
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
if (!skillCheck.scripts?.["skill:check"]?.includes("brand-validator.js")) {
  failures.push("skill:check no cubre brand-validator.js");
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
  "../bin/jintia.js",
  "syllabus-validator.js",
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
  ,"brand-validator.js"
];
for (const script of requiredScripts) {
  try {
    await read(`skill/scripts/${script}`);
  } catch {
    failures.push(`Falta skill/scripts/${script}`);
  }
}

for (const file of ["README.md", "README.en.md", "docs/brand-guidelines.md", "app/desktop/src/pages/about.js"]) {
  try {
    const content = await read(file);
    if (!content.includes("Jíntia") || !content.includes("Aarma jintia")) failures.push(`${file} no contiene la atribución del origen de Jintia`);
  } catch { failures.push(`Falta ${file}`); }
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
