"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { coursePaths, normalizeWeek, readCourse, updateCourseState } = require("./index");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-core-"));
fs.writeFileSync(path.join(root, "README.md"), "# Curso\n");
assert.equal(normalizeWeek(3), "03");
assert.throws(() => normalizeWeek(0), RangeError);
const source = path.join(root, "README.md");
const statePath = updateCourseState(root, 3, "validated", source, new Date("2026-01-02T03:04:05.000Z"));
assert.equal(statePath, coursePaths(root).state);
const course = readCourse(root);
assert.equal(course.syllabusExists, true);
assert.equal(course.state.weeks["03"].status, "validated");
assert.equal(course.state.weeks["03"].updatedAt, "2026-01-02T03:04:05.000Z");
console.log("@jintia/core OK");
