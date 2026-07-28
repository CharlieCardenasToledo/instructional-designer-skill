#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/syllabus-validator.js <README.md>");
  process.exit(2);
}
const absolute = path.resolve(file);
if (!fs.existsSync(absolute)) {
  console.error(`No existe el sílabo: ${absolute}`);
  process.exit(1);
}
const source = fs.readFileSync(absolute, "utf8");
const required = [
  ["Asignatura", /\*\*Asignatura:\*\*/i],
  ["periodo académico", /\*\*Periodo académico ordinario:\*\*/i],
  ["semana", /^###\s+Semana\s+\d+/im],
  ["unidad", /\*\*Unidad:\*\*/i],
  ["tema semanal", /\*\*Tema\s*\/\s*contenido semanal:\*\*/i],
  ["resultado de aprendizaje", /\*\*Resultado de aprendizaje:\*\*/i],
  ["herramienta de aprendizaje", /\*\*Herramienta de aprendizaje:\*\*/i],
  ["horas", /\*\*Horas:\*\*/i],
  ["actividad calificada", /\*\*Actividades calificadas:\*\*/i]
];
const missing = required.filter(([, pattern]) => !pattern.test(source)).map(([label]) => label);
const weeks = source.match(/^###\s+Semana\s+\d+/gim) || [];
console.log(`Jintia Syllabus Validate · ${absolute}`);
console.log(`Semanas detectadas: ${weeks.length}`);
if (missing.length) {
  console.error(`Faltan campos canónicos: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("✓ El sílabo contiene el contrato mínimo canónico.");
