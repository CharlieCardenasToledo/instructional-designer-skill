#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const core = require("../runtime/core");
const { loadCourseState, saveCourseState, updateCourseState, coursePaths } = core;
function statePath(course) { return coursePaths(course).state; }
function load(course) { return loadCourseState(course); }
function save(course, state) { return saveCourseState(course, state); }
function update(course, week, status, source) { return updateCourseState(course, week, status, source); }
if (require.main === module) {
  const [command, course, week, status, source] = process.argv.slice(2);
  if (command !== "update" || !course || !week || !status) {
    console.error("Uso: node scripts/state-manager.js update <curso> <semana> <estado> [archivo-fuente]");
    process.exit(2);
  }
  console.log(`Estado guardado en ${update(course, week, status, source)}`);
}
module.exports = { load, save, update, statePath };
