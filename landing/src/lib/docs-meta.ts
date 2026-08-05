export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
}

export const DOC_META: DocMeta[] = [
  { slug: "getting-started",       title: "Primeros pasos",               description: "Instalación y configuración inicial de Jíntia.",         section: "Inicio",         order: 1 },
  { slug: "create-first-course",   title: "Tu primer curso",              description: "Crea un curso desde cero con sílabo y fuentes.",          section: "Inicio",         order: 2 },
  { slug: "generate-weekly-guide", title: "Generar una guía semanal",     description: "Flujo completo desde el sílabo hasta el PDF.",            section: "Inicio",         order: 3 },
  { slug: "cli",                   title: "Referencia CLI",               description: "Todos los comandos de jintia: render, compile, doctor…",  section: "Referencia",     order: 4 },
  { slug: "architecture",          title: "Arquitectura",                 description: "Motor HTML, temas, guide.json y pipeline editorial.",      section: "Referencia",     order: 5 },
  { slug: "templates",             title: "Temas HTML",                   description: "Clásico, Técnico y Cuaderno: tokens, componentes, print.", section: "Referencia",     order: 6 },
  { slug: "rules",                 title: "Reglas de validación",         description: "Catálogo de reglas JIN-CNT-*, JIN-HTM-* y JIN-SYL-*.",    section: "Referencia",     order: 7 },
  { slug: "notebooklm",            title: "Integración NotebookLM",       description: "Cómo Jíntia consulta y cita fuentes verificadas.",         section: "Integraciones",  order: 8 },
  { slug: "harnesses",             title: "Compatibilidad con harnesses", description: "Claude Code, Codex, Cursor y GitHub Copilot.",            section: "Integraciones",  order: 9 },
  { slug: "guia-claude-desktop",   title: "Claude Desktop",               description: "Uso de Jíntia desde la aplicación Claude Desktop.",       section: "Integraciones",  order: 10 },
  { slug: "troubleshooting",       title: "Resolución de problemas",      description: "Errores comunes y cómo solucionarlos.",                   section: "Soporte",        order: 11 },
  { slug: "brand-guidelines",      title: "Identidad de marca",           description: "Nombre, tipografía, colores y uso correcto de la marca.", section: "Soporte",        order: 12 },
  { slug: "releasing",             title: "Publicación",                  description: "Cómo publicar una nueva versión de jintia-skill.",        section: "Soporte",        order: 13 },
];

export const SECTIONS = [...new Set(DOC_META.map((d) => d.section))];

export function getDocMeta(slug: string): DocMeta | undefined {
  return DOC_META.find((d) => d.slug === slug);
}
