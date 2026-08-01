#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const skillRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillRoot, "..");
const read = file => fs.readFileSync(path.join(repoRoot, file), "utf8");
const failures = [];
const brandPath = path.join(skillRoot, "config", "brand.json");

if (!fs.existsSync(brandPath)) failures.push("Falta skill/config/brand.json");
else {
  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  if (brand.brandName !== "Jintia") failures.push("brandName debe ser Jintia");
  if (brand.linguisticForm !== "Jíntia") failures.push("linguisticForm debe ser Jíntia");
  if (brand.meaning !== "camino") failures.push("meaning debe ser camino");
  if (!brand.disclaimer) failures.push("Falta disclaimer de atribución");
  if (!brand.sources?.some(source => /Aarma jintia/i.test(source.claim || "") && source.page === 106)) failures.push("Falta fuente institucional de Aarma jintia con página 106");
}

for (const file of ["README.md", "README.en.md", "skill/SKILL.md"]) {
  const content = read(file);
  if (!content.includes("Jíntia") || !content.includes("Aarma jintia")) failures.push(`${file} no contiene la atribución canónica`);
}
const prohibitedPatterns = [/representa oficialmente al pueblo shuar/i, /aprobado por (?:el|la|las) .*shuar/i, /símbolo ceremonial de jintia/i, /diseño facial de viaje/i, /\bjíbaro\b/i];
for (const file of ["README.md", "README.en.md", "skill/SKILL.md"]) {
  const content = read(file);
  for (const pattern of prohibitedPatterns) if (pattern.test(content)) failures.push(`${file} contiene una afirmación cultural prohibida: ${pattern}`);
}
for (const file of ["package.json", "skill/package.json", "packages/brand/package.json", "skill/bin/jintia.js"]) {
  if (/(?:name|bin|brandName)\s*[:=][^\n]*Jíntia/.test(read(file))) failures.push(`${file} usa Jíntia en un identificador técnico`);
}
if (failures.length) { failures.forEach(failure => console.error(`[ERROR] ${failure}`)); process.exit(1); }
console.log("Brand validation OK para Jintia.");
