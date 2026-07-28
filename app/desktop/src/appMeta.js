/**
 * Fuente canónica de identidad y enlaces públicos de Jintia.
 * La versión de la aplicación se obtiene en ejecución desde Tauri.
 */
export const APP_META = Object.freeze({
  brandName: "Jintia",
  desktopName: "Jintia Desktop",
  skillName: "Jintia Skill",
  skillVersion: "10.6.0",
  creator: "Charlie Cárdenas Toledo",
  creatorUrl: "https://github.com/CharlieCardenasToledo",
  tagline: "Diseña el camino del aprendizaje.",
  copyright: "© 2026 Charlie Cárdenas Toledo",
  license: "MIT",
  repository: "https://github.com/CharlieCardenasToledo/instructional-designer-skill",
  issues: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/issues",
  licenseUrl: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/blob/master/LICENSE",
  privacyUrl: "https://github.com/CharlieCardenasToledo/instructional-designer-skill/blob/master/PRIVACY.md",
});

export const ALLOWED_EXTERNAL_URLS = Object.freeze([
  APP_META.creatorUrl,
  APP_META.repository,
  APP_META.issues,
  APP_META.licenseUrl,
  APP_META.privacyUrl,
]);
