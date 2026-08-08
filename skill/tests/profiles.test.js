"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "bin", "jintia.js");
const configPath = path.join(root, "config", "visual-install-profiles.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const cliRaw = spawnSync(
  process.execPath,
  [cli, "capabilities", "profiles", "--json"],
  { encoding: "utf8" }
);
const cliOutput = JSON.parse(cliRaw.stdout);

test("CLI proviene del archivo canónico", () => {
  assert.equal(cliRaw.status, 0, cliRaw.stderr);

  const expectedProfiles = Object.fromEntries(
    config.profiles.map(profile => [
      profile.id,
      {
        description: profile.description,
        python: profile.python,
        node: profile.node,
        binaries: profile.binaries,
      },
    ])
  );

  assert.deepEqual(cliOutput.profiles, expectedProfiles);
  assert.deepEqual(cliOutput.disciplines, config.disciplines);
});

test("perfiles obligatorios existen", () => {
  assert.deepEqual(
    Object.keys(cliOutput.profiles).sort(),
    ["core", "full", "minimum"]
  );
});

test("mappings disciplinares críticos", () => {
  assert.equal(cliOutput.disciplines["software-engineering"], "core");
  assert.equal(cliOutput.disciplines.electronics, "core");
  assert.equal(cliOutput.disciplines.design, "full");
});

test("herramientas visuales no pueden exceder capabilities", () => {
  for (const profile of config.profiles) {
    const allowed = new Set(["vivliostyle"]);
    for (const binary of (profile.binaries ?? [])) {
      allowed.add(binary.id);
    }
    for (const pkg of (profile.node?.packages ?? [])) {
      if (pkg.startsWith("@mermaid-js/mermaid-cli")) {
        allowed.add("mermaid");
      }
    }
    for (const tool of (profile.tools ?? [])) {
      assert.ok(
        allowed.has(tool.id),
        `Perfil "${profile.id}": herramienta "${tool.id}" no está declarada en capabilities`
      );
    }
  }
});

test("versiones binarias deben coincidir con tools", () => {
  for (const profile of config.profiles) {
    for (const binary of (profile.binaries ?? [])) {
      const tool = (profile.tools ?? []).find(t => t.id === binary.id);
      if (tool) {
        assert.equal(
          tool.version,
          binary.version,
          `Perfil "${profile.id}": binario "${binary.id}" — binary.version="${binary.version}" vs tool.version="${tool.version}"`
        );
      }
    }
  }
});

test("Mermaid debe estar pinneado a 11.12.x en core y full", () => {
  for (const profileId of ["core", "full"]) {
    const profile = config.profiles.find(p => p.id === profileId);
    assert.ok(
      (profile.node?.packages ?? []).includes("@mermaid-js/mermaid-cli@11.12.x"),
      `Perfil "${profileId}": Mermaid no está pinneado a @mermaid-js/mermaid-cli@11.12.x`
    );
    const mermaidTool = (profile.tools ?? []).find(t => t.id === "mermaid");
    assert.ok(mermaidTool, `Perfil "${profileId}": tool mermaid no encontrado`);
    assert.equal(
      mermaidTool.version,
      "11.12.x",
      `Perfil "${profileId}": tool mermaid tiene versión "${mermaidTool.version}", se esperaba "11.12.x"`
    );
  }
});
