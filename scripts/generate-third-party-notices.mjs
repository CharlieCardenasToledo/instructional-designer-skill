import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "app", "desktop");
const outputPath = path.join(desktop, "public", "legal", "third-party-notices.json");

const npmLock = JSON.parse(fs.readFileSync(path.join(desktop, "package-lock.json"), "utf8"));
const npmPackages = Object.entries(npmLock.packages)
  .filter(([location, metadata]) => location.startsWith("node_modules/") && !metadata.dev)
  .map(([location, metadata]) => ({
    ecosystem: "npm",
    name: location.slice("node_modules/".length),
    version: metadata.version,
    license: metadata.license || "NO REGISTRADA",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const cargoToml = fs.readFileSync(path.join(desktop, "src-tauri", "Cargo.toml"), "utf8");
const cargoLock = fs.readFileSync(path.join(desktop, "src-tauri", "Cargo.lock"), "utf8");
const dependencyBlock = cargoToml.match(/\[dependencies\]([\s\S]*?)(?:\n\[|$)/)?.[1] || "";
const cargoLicense = {
  tauri: "MIT OR Apache-2.0",
  "tauri-plugin-dialog": "MIT OR Apache-2.0",
  "tauri-plugin-opener": "MIT OR Apache-2.0",
  serde: "MIT OR Apache-2.0",
  serde_json: "MIT OR Apache-2.0",
  include_dir: "MIT",
  zip: "MIT",
  reqwest: "MIT OR Apache-2.0",
  scraper: "ISC",
  regex: "MIT OR Apache-2.0",
  url: "MIT OR Apache-2.0",
};
const cargoNames = [...dependencyBlock.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map(match => match[1]);
const cargoPackages = cargoNames.map(name => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const version = cargoLock.match(new RegExp(`name = "${escaped}"\\r?\\nversion = "([^"]+)"`))?.[1] || "NO REGISTRADA";
  return {
    ecosystem: "cargo",
    name,
    version,
    license: cargoLicense[name] || "NO REGISTRADA",
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const elegantBook = fs.readFileSync(
  path.join(root, "skill", "templates", "elegantbook-clasico", "elegantbook.cls"),
  "utf8",
);
const kaohandt = fs.readFileSync(
  path.join(root, "skill", "templates", "kaohandt-marginal", "kaohandt.cls"),
  "utf8",
);
const resources = [
  {
    name: "ElegantBook",
    use: "Plantilla LaTeX distribuida con Jintia Skill",
    license: /(?:LPPL|LaTeX Project Public License)[\s\S]{0,240}1\.3c/i.test(elegantBook)
      ? "LPPL 1.3c or later"
      : "NO REGISTRADA",
  },
  {
    name: "Kaobook / Kaohandt",
    use: "Plantilla LaTeX marginal distribuida con Jintia Skill",
    license: /LPPL/i.test(kaohandt) ? "LPPL 1.3 or later" : "NO REGISTRADA",
  },
  {
    name: "Material Symbols",
    use: "Iconos cargados desde Google Fonts; el archivo tipográfico no se distribuye",
    license: "Apache-2.0",
  },
  {
    name: "Inter",
    use: "Tipografía cargada desde Google Fonts; el archivo tipográfico no se distribuye",
    license: "OFL-1.1",
  },
];

const packages = [...npmPackages, ...cargoPackages];
const unresolved = [
  ...packages.filter(item => item.license === "NO REGISTRADA" || item.version === "NO REGISTRADA"),
  ...resources.filter(item => item.license === "NO REGISTRADA"),
];
const inventory = {
  schemaVersion: 1,
  generatedFrom: [
    "app/desktop/package-lock.json",
    "app/desktop/src-tauri/Cargo.lock",
    "app/desktop/src-tauri/Cargo.toml",
    "skill/templates/elegantbook-clasico/elegantbook.cls",
    "skill/templates/kaohandt-marginal/kaohandt.cls",
  ],
  packages,
  resources,
  unresolved,
};
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== serialized) {
    console.error("El inventario legal está desactualizado. Ejecuta npm run licenses:generate.");
    process.exit(1);
  }
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized);
  console.log(`Inventario legal actualizado: ${path.relative(root, outputPath)}`);
}

if (unresolved.length) {
  console.error(`Hay ${unresolved.length} dependencias o recursos sin licencia/versión registrada.`);
  process.exit(1);
}
