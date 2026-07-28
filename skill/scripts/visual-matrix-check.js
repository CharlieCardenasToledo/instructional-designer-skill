#!/usr/bin/env node
"use strict";

const { detectCapabilities } = require("./visual-capabilities");

const expected = (process.env.JINTIA_EXPECT_VISUAL_TOOLS || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);
const capabilities = detectCapabilities();
const missing = expected.filter(id => !capabilities.tools[id]?.available);

for (const id of expected) {
  const tool = capabilities.tools[id];
  console.log(`${tool?.available ? "OK" : "MISSING"} ${id}: ${tool?.command || "no detectado"}`);
}

if (missing.length) {
  console.error(`Faltan motores visuales requeridos por la matriz: ${missing.join(", ")}`);
  process.exit(1);
}
