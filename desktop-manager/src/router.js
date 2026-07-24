/**
 * router.js — Sistema de navegación entre páginas (Single Responsibility + OCP)
 * Abierto para extensión: agrega páginas al registro sin modificar la lógica de navegación.
 */
import { state }        from "./state.js";
import { refreshIcons } from "./icons.js";

/** Registro de páginas — añadir una página nueva aquí es suficiente (OCP). */
const PAGE_REGISTRY = {
  setup:       { title: "Dependencias del sistema",     sub: "Verifica e instala los requisitos para que el skill funcione" },
  institution: { title: "Datos institucionales",         sub: "Configura tu institución, carrera y colores LaTeX" },
  courses:     { title: "Mis cursos",                    sub: "Administra asignaturas y genera la estructura de carpetas" },
  syllabus:    { title: "Editor de sílabo",              sub: "Define el contenido semanal y genera el README.md del curso" },
  notebooklm:  { title: "NotebookLM",                    sub: "Gestiona notebooks y la sesión de autenticación Google" },
  templates:   { title: "Plantillas LaTeX",              sub: "Elige el diseño visual para tus guías de clase" },
  activate:    { title: "Activar en Claude Desktop",     sub: "Instala el skill y configura el servidor MCP con un clic" },
  settings:    { title: "Configuración",                 sub: "Ajustes institucionales, MCP, entorno y preferencias" },
  docs:        { title: "Documentación",                 sub: "Guías de inicio rápido, esquemas y referencias técnicas" },
};

/** Callbacks de renderizado registrados por cada módulo de página. */
const renderCallbacks = {};

/** Registra el callback de renderizado de una página. */
export function registerPage(id, callback) {
  renderCallbacks[id] = callback;
}

/** Navega a la página indicada. */
export function navigate(page) {
  if (!PAGE_REGISTRY[page]) return;
  state.page = page;

  // Gestalt: resaltar solo el ítem activo en sidebar (consistencia visual)
  document.querySelectorAll(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.page === page)
  );

  // Mostrar la página correcta, ocultar el resto
  document.querySelectorAll(".page").forEach(el =>
    el.classList.toggle("active", el.id === `p-${page}`)
  );

  // Actualizar topbar
  const { title, sub } = PAGE_REGISTRY[page];
  const h2  = document.querySelector(".topbar-left h2");
  const sub_ = document.querySelector(".topbar-sub");
  if (h2)   h2.textContent   = title;
  if (sub_) sub_.textContent = sub;

  // Ejecutar el callback de render de la página
  renderCallbacks[page]?.();
  refreshIcons();
}
