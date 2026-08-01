import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(join(root, "skill", "package.json"), "utf8"));
const output = join(root, "dist", "release", `v${packageJson.version}`);
const manifest = JSON.parse(await readFile(join(output, "jintia-release-manifest.json"), "utf8"));
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("schemaVersion debe ser 1");
if (manifest.skillVersion !== packageJson.version) failures.push("skillVersion no coincide con skill/package.json");
if (!Array.isArray(manifest.compatibility) || !["claude", "codex", "chatgpt"].every(value => manifest.compatibility.includes(value))) failures.push("faltan superficies compatibles");
if (manifest.mcp?.package !== "@charlie.act7/gemini-notebook-mcp") failures.push("paquete MCP inesperado");
if (!/^sha512-/.test(manifest.mcp?.npmIntegrity || "")) failures.push("falta integridad npm del MCP");

for (const [name, artifact] of Object.entries(manifest.artifacts || {})) {
  const path = join(output, artifact.file || "");
  try {
    const bytes = await readFile(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== artifact.sha256) failures.push(`${name}: SHA-256 no coincide`);
    if ((await stat(path)).size !== artifact.bytes) failures.push(`${name}: tamaño no coincide`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

if (failures.length) {
  failures.forEach(failure => console.error(`[ERROR] ${failure}`));
  process.exit(1);
}
console.log(`Contrato de release válido para Jintia Skill ${manifest.skillVersion}.`);
