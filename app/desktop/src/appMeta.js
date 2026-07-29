import brand from "../../../skill/config/brand.json";

/**
 * Fuente canónica de identidad y enlaces públicos de Jintia.
 * La versión de la aplicación se obtiene en ejecución desde Tauri.
 */
export const APP_META = Object.freeze({
  brandName: "Jintia",
  desktopName: "Jintia Desktop",
  skillName: "Jintia Skill",
  skillVersion: "10.8.0",
  creator: "Charlie Cárdenas Toledo",
  creatorUrl: "https://github.com/CharlieCardenasToledo",
  tagline: "Diseña el camino del aprendizaje.",
  originName: brand.linguisticForm,
  originLanguage: brand.language,
  originMeaning: brand.meaning,
  originAttribution: brand.originSummary,
  originDisclaimer: brand.disclaimer,
  copyright: "© 2026 Charlie Cárdenas Toledo",
  license: "MIT",
  repository: "https://github.com/CharlieCardenasToledo/instructional-designer-skill",
  issues: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/issues",
  licenseUrl: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/blob/master/LICENSE",
  privacyUrl: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/blob/master/PRIVACY.md",
  // notebooklm.google.com sigue resolviendo (Google renombró NotebookLM a
  // "Gemini Notebook" en 2026-07 y movió el dominio canónico), pero este es
  // el que se ofrece al usuario para no mandarlo a un alias.
  notebookLmUrl: "https://notebook.google.com/",
});

export const ALLOWED_EXTERNAL_URLS = Object.freeze([
  APP_META.creatorUrl,
  APP_META.repository,
  APP_META.issues,
  APP_META.licenseUrl,
  APP_META.privacyUrl,
  APP_META.notebookLmUrl,
]);

// AI launch targets are intentionally scheme constrained. Course paths are
// encoded into each assistant's official deep link — Claude Code's
// claude-cli://open (https://code.claude.com/docs/en/deep-links) and the
// ChatGPT desktop app's codex://threads/new
// (https://learn.chatgpt.com/docs/reference/commands) — but arbitrary
// external URLs must never be accepted by the opener abstraction.
export const ALLOWED_AI_URLS = Object.freeze({
  schemes: Object.freeze(["claude-cli:", "codex:"]),
});
