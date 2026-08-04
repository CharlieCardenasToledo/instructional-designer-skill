// vivliostyle.config.js — Jintia Clásico
// Configuración para Vivliostyle CLI cuando se invoca desde el directorio de la guía.
// Generalmente Jintia pasa los argumentos directamente via vivliostyle-adapter.js;
// este archivo sirve como alternativa para uso manual.

/** @type {import('@vivliostyle/cli').VivliostyleConfigSchema} */
module.exports = {
  title:    process.env.JINTIA_TITLE  || "Guía Semanal",
  author:   process.env.JINTIA_AUTHOR || "",
  language: process.env.JINTIA_LANG   || "es",

  theme: [
    // Importa los módulos de theme-base disponibles (CC0-1.0)
    // Instalar con: npm install @vivliostyle/theme-base
    "@vivliostyle/theme-base",
    // El tema propio de Jintia (sobrescribe y extiende theme-base)
    "./theme.css",
  ],

  entry: [
    {
      path:  process.env.JINTIA_HTML || "guide.html",
      title: process.env.JINTIA_TITLE || "Guía Semanal",
    },
  ],

  output: [
    {
      path:   process.env.JINTIA_OUTPUT || "guide.pdf",
      format: "pdf",
    },
  ],

  workspaceDir: ".vivliostyle",
  readingProgression: "ltr",

  // Opciones de página (pueden sobreescribirse desde @page en print.css)
  size: "A4",

  // No incluir TOC automático; Jintia lo gestiona en el AST
  toc: false,
};
