import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignored = new Set([".git", ".rtfm", ".claude", ".playwright-mcp", "node_modules", "dist", "target"]);
const errors = [];
const requiredProjectFiles = [
  "AUTHORS.md",
  "CITATION.cff",
  "LICENSE",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/design-system.md",
  "app/desktop/public/legal/project-license.txt",
  "app/desktop/public/legal/third-party-notices.json",
  "app/desktop/public/legal/trademarks.md",
];

for (const relative of requiredProjectFiles) {
  if (!existsSync(join(root, relative))) errors.push(`Falta el archivo obligatorio: ${relative}`);
}

function collect(directory, extension, files = []) {
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) collect(path, extension, files);
    else if (extname(name).toLowerCase() === extension) files.push(path);
  }
  return files;
}

const markdown = collect(root, ".md");
const obsolete = [
  ["instructional-designer-uide", "nombre anterior de la skill"],
  ["AcademiaOS", "marca anterior de la aplicación"],
  ["Instructional Designer Manager", "marca anterior de la aplicación"],
  ["compilacion-wsl.md", "referencia renombrada"],
  ["guia-semanaXX", "nombre semanal sin separador"],
  ["gemini-notebook-mcp@latest", "dependencia MCP sin versión verificada"],
];

for (const file of markdown) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(raw)) continue;
    const pathPart = decodeURIComponent(raw.split("#", 1)[0]);
    if (!pathPart) continue;
    const target = resolve(dirname(file), pathPart);
    if (!existsSync(target)) errors.push(`${file}: enlace local inexistente: ${raw}`);
  }
  if (file.endsWith("CHANGELOG.md")) continue;
  for (const [term, reason] of obsolete) {
    if (text.includes(term)) errors.push(`${file}: ${reason}: ${term}`);
  }
}

const schema = JSON.parse(readFileSync(join(root, "skill/config/institution.schema.json"), "utf8"));
const example = JSON.parse(readFileSync(join(root, "skill/config/institution.example.json"), "utf8"));
for (const key of schema.required) {
  if (!(key in example)) errors.push(`institution.example.json: falta ${key}`);
}
for (const key of schema.properties.institution.required) {
  if (!(key in example.institution)) errors.push(`institution.example.json: falta institution.${key}`);
}
if (example.branding.logoPath && !existsSync(join(root, "skill", example.branding.logoPath))) {
  errors.push("institution.example.json: logoPath apunta a un archivo inexistente");
}

const plugin = JSON.parse(readFileSync(join(root, "skill/.claude-plugin/plugin.json"), "utf8"));
const skillPackage = JSON.parse(readFileSync(join(root, "skill/package.json"), "utf8"));
const desktopPackage = JSON.parse(readFileSync(join(root, "app/desktop/package.json"), "utf8"));
const appMeta = readFileSync(join(root, "app/desktop/src/appMeta.js"), "utf8");
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (plugin.version !== skillPackage.version) {
  errors.push(`Versiones distintas: plugin ${plugin.version}, skill ${skillPackage.version}`);
}
if (!changelog.includes(`## ${plugin.version} `)) {
  errors.push(`CHANGELOG.md no contiene la versión ${plugin.version} del plugin`);
}
if (desktopPackage.author !== "Charlie Cárdenas Toledo" || desktopPackage.license !== "MIT") {
  errors.push("app/desktop/package.json no declara la autoría o licencia canónicas");
}
for (const canonical of ["Jintia Desktop", "Jintia Skill", "Charlie Cárdenas Toledo"]) {
  if (!appMeta.includes(canonical)) errors.push(`appMeta.js no contiene el valor canónico: ${canonical}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Documentación válida: ${markdown.length} Markdown, enlaces locales y contratos canónicos.`);
