#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function hashFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function statePath(course) { return path.join(path.resolve(course), ".jintia", "state.json"); }
function load(course) {
  const file = statePath(course);
  if (!fs.existsSync(file)) return { schemaVersion: "1.0", weeks: {} };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function save(course, state) {
  const file = statePath(course);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  return file;
}
function update(course, week, status, source) {
  const state = load(course);
  state.schemaVersion ||= "1.0";
  state.jintiaVersion ||= "10.8.0";
  state.weeks ||= {};
  state.weeks[String(week).padStart(2, "0")] = {
    status,
    updatedAt: new Date().toISOString(),
    ...(source && fs.existsSync(path.resolve(source)) ? { sourceHash: hashFile(path.resolve(source)), source: path.relative(path.resolve(course), path.resolve(source)).replace(/\\/g, "/") } : {})
  };
  return save(course, state);
}
if (require.main === module) {
  const [command, course, week, status, source] = process.argv.slice(2);
  if (command !== "update" || !course || !week || !status) {
    console.error("Uso: node scripts/state-manager.js update <curso> <semana> <estado> [archivo-fuente]");
    process.exit(2);
  }
  console.log(`Estado guardado en ${update(course, week, status, source)}`);
}
module.exports = { load, save, update, statePath };
