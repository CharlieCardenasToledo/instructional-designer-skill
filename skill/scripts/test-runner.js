#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function collect(directory, files = []) {
  for (const name of fs.readdirSync(directory)) {
    const target = path.join(directory, name);
    if (fs.statSync(target).isDirectory()) collect(target, files);
    else if (/\.test\.js$/i.test(name)) files.push(target);
  }
  return files;
}

const tests = collect(path.resolve(__dirname, "..", "tests")).sort();
if (!tests.length) {
  console.error("No se encontraron archivos *.test.js");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
  shell: false,
  env: process.env
});
process.exit(result.status ?? 1);

