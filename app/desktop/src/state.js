/**
 * state.js — Estado global centralizado (Single Responsibility Principle)
 * Única fuente de verdad de la app. Persiste en localStorage donde corresponde.
 */

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

export const state = {
  page:          "courses",
  deps:          [],
  config:        load("ids_config",  {}),
  courses:       load("ids_courses", []),
  editingCourse: undefined,
};

export function saveConfig()  { localStorage.setItem("ids_config",  JSON.stringify(state.config)); }
export function saveCourses() { localStorage.setItem("ids_courses", JSON.stringify(state.courses)); }

export function getNotebooks() {
  return load("ids_notebooks", []);
}
export function saveNotebooks(list) {
  localStorage.setItem("ids_notebooks", JSON.stringify(list));
}
