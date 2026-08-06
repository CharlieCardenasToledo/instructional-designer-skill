"use strict";

/**
 * compile-stub.test.js — Verifica el pipeline compile sin instalar Vivliostyle.
 *
 * Crea un ejecutable falso de "vivliostyle" en un directorio temporal,
 * lo añade al PATH y comprueba que:
 *   1. jintia compile guide.json primero renderiza guide.html.
 *   2. Invoca vivliostyle con el HTML (no con el JSON).
 *   3. El CSS del tema se copia junto al HTML de salida.
 *
 * Funciona en CI sin instalar Vivliostyle CLI real.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const os     = require("node:os");
const { spawnSync } = require("node:child_process");

const ROOT      = path.resolve(__dirname, "..");
const JINTIA    = path.join(ROOT, "bin", "jintia.js");
const FIXTURES  = path.join(__dirname, "fixtures");
const GUIDE_SRC = path.join(FIXTURES, "guide-sample.json");

// ─── Ayudantes ────────────────────────────────────────────────────────────────

function createVivliostyleStub(stubDir) {
  const stubJs   = path.join(stubDir, "_vivliostyle-stub.js");
  const argsFile = path.join(stubDir, "vivliostyle-args.json");

  // El stub registra sus args, crea un PDF vacío y sale con 0
  fs.writeFileSync(stubJs, `
"use strict";
const fs   = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));
// Crear PDF simulado si --output se especifica
const outIdx = args.indexOf("--output");
if (outIdx >= 0 && args[outIdx + 1]) {
  fs.writeFileSync(args[outIdx + 1], "%PDF-1.4 jintia-stub\\n");
}
process.exit(0);
`);

  if (process.platform === "win32") {
    const cmd = path.join(stubDir, "vivliostyle.cmd");
    fs.writeFileSync(cmd, `@echo off\nnode "${stubJs}" %*\n`);
  } else {
    const sh = path.join(stubDir, "vivliostyle");
    fs.writeFileSync(sh, `#!/bin/sh\nexec node "${stubJs}" "$@"\n`);
    fs.chmodSync(sh, "755");
  }

  return argsFile;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("compile-stub: jintia compile guide.json invoca vivliostyle con HTML", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-stub-"));
  const argsFile = createVivliostyleStub(tmpDir);
  const outDir   = path.join(tmpDir, "out");
  fs.mkdirSync(outDir);

  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GUIDE_SRC, guideDst);

  const env    = { ...process.env, PATH: `${tmpDir}${path.delimiter}${process.env.PATH || ""}` };
  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst], {
    env, encoding: "utf8", stdio: "pipe", cwd: outDir,
  });

  try {
    assert.equal(result.status, 0, `Exit ${result.status}: ${result.stderr}`);

    // El HTML debe haberse creado antes de llamar a vivliostyle
    const htmlPath = path.join(outDir, "guide.html");
    assert.ok(fs.existsSync(htmlPath), "guide.html debe existir tras el render implícito");

    // Vivliostyle debe haber recibido el HTML, no el JSON
    assert.ok(fs.existsSync(argsFile), "El stub debe haber sido invocado");
    const args = JSON.parse(fs.readFileSync(argsFile, "utf8"));
    assert.ok(
      args.some(a => a.endsWith(".html")),
      `vivliostyle debe recibir un .html, recibió: ${JSON.stringify(args)}`,
    );
    assert.ok(
      !args.some(a => a.endsWith(".json")),
      "vivliostyle NO debe recibir el guide.json directamente",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: render copia los assets del tema junto al HTML", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-assets-"));
  const outDir = path.join(tmpDir, "semana-01");
  fs.mkdirSync(outDir);

  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GUIDE_SRC, guideDst);

  // Renderizar directamente (sin compilar)
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "guide-renderer.js"), guideDst, "--output", path.join(outDir, "guide.html")],
    { encoding: "utf8", stdio: "pipe" },
  );

  try {
    assert.equal(result.status, 0, `Exit ${result.status}: ${result.stderr}`);

    const cssPath = path.join(outDir, ".jintia-assets", "themes", "jintia-clasico", "theme.css");
    assert.ok(fs.existsSync(cssPath), ".jintia-assets/themes/jintia-clasico/theme.css debe existir junto al HTML");

    const html = fs.readFileSync(path.join(outDir, "guide.html"), "utf8");
    assert.ok(
      html.includes(".jintia-assets/themes/jintia-clasico/theme.css"),
      "El href del CSS en el HTML debe apuntar a .jintia-assets/",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: keyterm syntax se renderiza como span, no como texto escapado", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-keyterm-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Test", outcome: "Aplicar conceptos" },
      sections: [
        { type: "orientation", content: "Una {{keyterm:dependencia funcional}} es una restricción." },
      ],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    const html = renderGuide(guidePath);

    assert.ok(
      html.includes('<span class="jintia-keyterm">dependencia funcional</span>'),
      "{{keyterm:...}} debe renderizarse como span, no como texto escapado",
    );
    assert.ok(
      !html.includes("{{keyterm:"),
      "La sintaxis {{keyterm:}} no debe aparecer cruda en el HTML",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
