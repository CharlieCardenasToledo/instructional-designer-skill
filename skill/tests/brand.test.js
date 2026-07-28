"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readBrand } = require("../../packages/brand");

const root = path.resolve(__dirname, "../..");

test("la marca comercial es Jintia y la forma lingüística es Jíntia", () => {
  const brand = readBrand();
  assert.equal(brand.brandName, "Jintia");
  assert.equal(brand.linguisticForm, "Jíntia");
  assert.equal(brand.language, "Shuar Chicham");
  assert.equal(brand.meaning, "camino");
});

test("Aarma jintia tiene fuente institucional con página", () => {
  const source = readBrand().sources.find(item => /Aarma jintia/i.test(item.claim));
  assert.equal(source.institution, "Ministerio de Educación del Ecuador");
  assert.equal(source.year, 2017);
  assert.equal(source.page, 106);
});

test("la atribución y el disclaimer están presentes en ambos README", () => {
  for (const file of ["README.md", "README.en.md"]) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(content, /Jíntia/);
    assert.match(content, /Aarma jintia/);
    assert.match(content, /does not imply|no implica/i);
  }
});

test("los identificadores técnicos conservan la forma comercial sin tilde", () => {
  for (const file of ["package.json", "skill/package.json", "packages/brand/package.json", "app/desktop/src/appMeta.js"]) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(content, /(?:name|bin|brandName)\s*[:=][^\n]*Jíntia/);
  }
});
