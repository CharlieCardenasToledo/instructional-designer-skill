"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BRAND_PATH = path.resolve(__dirname, "../../skill/config/brand.json");

function readBrand() {
  return JSON.parse(fs.readFileSync(BRAND_PATH, "utf8"));
}

module.exports = { BRAND_PATH, readBrand };
