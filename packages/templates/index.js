"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../../skill/templates");

function list() {
  return fs.readdirSync(ROOT, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const id = entry.name;
    const metaPath = path.join(ROOT, id, "meta.json");
    return { id, path: path.join(ROOT, id), meta: fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null };
  });
}
module.exports = { ROOT, list };
