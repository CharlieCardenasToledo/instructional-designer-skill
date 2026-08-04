#!/usr/bin/env node
"use strict";

/**
 * guide-migrator.js — Conversor de guías LaTeX legadas a guide.json
 *
 * Lee un archivo .tex generado por las plantillas ElegantBook o Kaohandt
 * de Jintia y produce un guide.json compatible con el motor HTML.
 *
 * Modo de uso:
 *   node scripts/guide-migrator.js semanas/semana-03/guia-semana-03.tex
 *   node scripts/guide-migrator.js semanas/semana-03/guia-semana-03.tex --output guide.json
 *   node scripts/guide-migrator.js semanas/semana-03/guia-semana-03.tex --dry-run
 *
 * El migrador hace un mejor esfuerzo (best-effort). Los bloques que no pueda
 * convertir automáticamente los emite como nodos de tipo "theory" con el
 * contenido LaTeX en bruto rodeado de un comentario de advertencia.
 *
 * Después de migrar, ejecuta:
 *   jintia validate guide.json
 * para verificar la estructura pedagógica.
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Tabla de conversión de entornos LaTeX → tipos HTML ──────────────────────

const ENV_MAP = {
  "jintia-orientacion":  "orientation",
  "jintia-teoria":       "theory",
  "jintia-concepto":     "concept",
  "jintia-practica":     "practice",
  "jintia-advertencia":  "warning",
  "jintia-errorcritico": "critical-error",
  "jintia-escenario":    "scenario",
  "jintia-evaluacion":   "assessment",
  // Aliases de ElegantBook / Kaohandt adaptados
  "guideorientation":    "orientation",
  "guidetheory":         "theory",
  "guideconcept":        "concept",
  "guidepractice":       "practice",
  "guidewarning":        "warning",
  "guidecritical":       "critical-error",
  "guidescenario":       "scenario",
  "guideassessment":     "assessment",
  "noteblock":           "margin-note",
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

function stripLatex(text) {
  if (!text) return "";
  return text
    // Negritas y cursivas
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    // Comillas tipográficas LaTeX
    .replace(/``([^']*)''/g, "\u201c$1\u201d")
    .replace(/`([^']*)'/, "\u2018$1\u2019")
    // Comandos de color/tamaño
    .replace(/\\(?:color|textcolor)\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\(?:large|Large|LARGE|huge|Huge|small|footnotesize)\s*/g, "")
    // Listas: \item → guion
    .replace(/\\item\[?[^\]]*\]?\s*/g, "- ")
    // Saltos de línea LaTeX
    .replace(/\\\\(\[\d+pt\])?/g, "\n")
    .replace(/\\newline\b/g, "\n")
    // Citas bibliográficas → [clave]
    .replace(/\\(?:textcite|parencite|cite)\{([^}]+)\}/g, "[$1]")
    // Comandos de acento e idioma comunes
    .replace(/\\['`^"~c]\{([^}])\}/g, "$1")
    // Grupos vacíos y comandos desconocidos sin argumento
    .replace(/\\[a-zA-Z]+\*/?\s*(?:\[[^\]]*\])?\{\}/g, "")
    .replace(/\\[a-zA-Z]+\*?\s+/g, " ")
    // Llaves residuales
    .replace(/[{}]/g, "")
    // Múltiples espacios y saltos de línea
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractArg(source, start) {
  // Extrae el contenido del siguiente grupo {…} desde la posición `start`
  const openIdx = source.indexOf("{", start);
  if (openIdx < 0) return { value: "", end: start };
  let depth = 0;
  let end   = openIdx;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  return { value: source.slice(openIdx + 1, end), end: end + 1 };
}

function extractOptArg(source, start) {
  // Extrae el contenido del siguiente […] si está inmediatamente después de start
  const trimmed = source.slice(start).trimStart();
  const offset  = source.length - source.slice(start).length + start;
  const extra   = start + (source.length - source.slice(start).length);
  void extra;
  if (!trimmed.startsWith("[")) return { value: null, end: start };
  const closeIdx = trimmed.indexOf("]");
  if (closeIdx < 0) return { value: null, end: start };
  return { value: trimmed.slice(1, closeIdx), end: start + source.slice(start).indexOf("]") + 1 };
}

// ─── Extracción de bloques ────────────────────────────────────────────────────

/**
 * Extrae todos los bloques \begin{env}...\end{env} del fuente LaTeX.
 * Devuelve un array de { env, title, content, index }
 */
function extractBlocks(source) {
  const blocks = [];
  const beginRe = /\\begin\{([^}]+)\}/g;
  let match;

  while ((match = beginRe.exec(source)) !== null) {
    const env      = match[1];
    const endTag   = `\\end{${env}}`;
    const bodyStart = match.index + match[0].length;
    const bodyEnd   = source.indexOf(endTag, bodyStart);
    if (bodyEnd < 0) continue;

    const body = source.slice(bodyStart, bodyEnd).trim();

    // Intentar extraer título del primer \begin arg o primer \section-like cmd
    let title   = "";
    let content = body;

    // Algunos entornos llevan título como argumento: \begin{guidetheory}{Título}
    const titleMatch = body.match(/^\s*\{([^}]+)\}(?:\{[^}]*\})?\s*([\s\S]*)/);
    if (titleMatch) {
      title   = stripLatex(titleMatch[1]);
      content = titleMatch[2];
    }

    // Buscar \section, \subsection, \guidetitle dentro del bloque
    const sectionMatch = body.match(/\\(?:section|subsection|guidetitle)\{([^}]+)\}/);
    if (sectionMatch && !title) {
      title   = stripLatex(sectionMatch[1]);
      content = body.replace(/\\(?:section|subsection|guidetitle)\{[^}]+\}/, "").trim();
    }

    blocks.push({ env, title, content: stripLatex(content), index: match.index });
    beginRe.lastIndex = bodyEnd + endTag.length;
  }

  return blocks;
}

/**
 * Extrae figuras del tipo \guidefigure o \includegraphics con \guidefigurecaption.
 */
function extractFigures(source) {
  const figures = [];
  const figRe   = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}[\s\S]{0,300}?\\guidefigurecaption\{([^}]+)\}\{([^}]+)\}/g;
  let match;

  while ((match = figRe.exec(source)) !== null) {
    const src     = match[1].replace(/\\/g, "/");
    const caption = stripLatex(match[2]);
    const label   = match[3].replace(/^fig:/, "fig-");
    figures.push({ type: "figure", id: label, src, alt: caption, caption, pagination: "atomic" });
  }

  return figures;
}

/**
 * Extrae metadata del preámbulo o de comandos \def/\newcommand específicos de Jintia.
 */
function extractMetadata(source) {
  const metadata = {};

  const patterns = {
    course:  /\\(?:def\\jcourse|newcommand\\jcourse)\{([^}]+)\}/,
    topic:   /\\(?:def\\jtopic|newcommand\\jtopic)\{([^}]+)\}/,
    week:    /\\(?:def\\jweek|newcommand\\jweek)\{([^}]+)\}/,
    outcome: /\\(?:def\\joutcome|newcommand\\joutcome)\{([^}]+)\}/,
    period:  /\\(?:def\\jperiod|newcommand\\jperiod)\{([^}]+)\}/,
    authors: /\\author\{([^}]+)\}/,
    // Alternativas de ElegantBook
    title:   /\\title\{([^}]+)\}/,
  };

  for (const [key, re] of Object.entries(patterns)) {
    const m = source.match(re);
    if (m) metadata[key] = stripLatex(m[1]);
  }

  // topic desde \title si no hay \jtopic
  if (!metadata.topic && metadata.title) {
    metadata.topic = metadata.title;
    delete metadata.title;
  }

  // week como número
  if (metadata.week) {
    const num = parseInt(metadata.week, 10);
    if (!isNaN(num)) metadata.week = num;
  }

  // authors como array
  if (metadata.authors) {
    metadata.authors = metadata.authors.split(/\\and|,/).map(s => s.trim()).filter(Boolean);
  }

  // bibliography: buscar \addbibresource{ref.bib}
  const bibMatch = source.match(/\\addbibresource\{([^}]+)\}/);
  if (bibMatch) metadata.bibliography = bibMatch[1];

  return metadata;
}

// ─── Conversión principal ─────────────────────────────────────────────────────

function migrateLatex(texPath) {
  const absolute = path.resolve(texPath);
  if (!fs.existsSync(absolute)) throw new Error(`Archivo no encontrado: ${absolute}`);

  const source   = fs.readFileSync(absolute, "utf8");
  const metadata = extractMetadata(source);
  const blocks   = extractBlocks(source);
  const figures  = extractFigures(source);

  // Construir secciones: combinar bloques y figuras ordenados por posición
  const figuresWithIndex = figures.map((fig, i) => ({
    ...fig,
    _index: source.indexOf(`\\includegraphics`, i * 10) ?? 999999,
  }));

  const sections = [];
  const usedTypes = new Set();

  for (const block of blocks) {
    const mappedType = ENV_MAP[block.env] || null;

    if (!mappedType) {
      // Entorno desconocido: emitir como theory con advertencia en title
      sections.push({
        type:    "theory",
        id:      `migrated-${block.env}-${sections.length}`,
        title:   block.title || `[Migrado de \\${block.env}]`,
        content: block.content || "",
        _warning: `Entorno LaTeX desconocido: ${block.env}`,
        pagination: "splittable",
      });
      continue;
    }

    const node = {
      type: mappedType,
      id:   `${mappedType}-${sections.length + 1}`,
      pagination: ["figure", "assessment", "concept"].includes(mappedType) ? "atomic" : "splittable",
    };

    if (block.title)   node.title   = block.title;
    if (block.content) node.content = block.content;

    // assessment: intentar extraer ítems de listas \enumerate
    if (mappedType === "assessment") {
      const items = block.content
        .split(/\n-\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      if (items.length > 1) {
        node.items = items;
        delete node.content;
      }
    }

    sections.push(node);
    usedTypes.add(mappedType);
  }

  // Insertar figuras en el orden en que aparecen
  for (const fig of figuresWithIndex) {
    sections.push(fig);
  }

  // Asegurar al menos un nodo orientation
  if (!usedTypes.has("orientation") && sections.length > 0) {
    sections.unshift({
      type:    "orientation",
      id:      "orientation-1",
      title:   "Orientación",
      content: "[Completar: descripción del propósito y estructura de esta semana]",
      pagination: "atomic",
    });
  }

  return {
    metadata: {
      course:     metadata.course  || "",
      week:       metadata.week    || null,
      topic:      metadata.topic   || "",
      outcome:    metadata.outcome || "[Completar: resultado de aprendizaje]",
      theme:      "jintia-clasico",
      lang:       "es",
      bibliography: metadata.bibliography || null,
      authors:    metadata.authors  || [],
      period:     metadata.period   || null,
      _migrated:  true,
      _source:    path.basename(absolute),
    },
    sections,
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const texPath   = args.find(a => !a.startsWith("--"));
  const outputArg = args.find((a, i) => args[i - 1] === "--output");
  const dryRun    = args.includes("--dry-run");
  const verbose   = args.includes("--verbose");

  if (!texPath) {
    console.error("Uso: node scripts/guide-migrator.js guia.tex [--output guide.json] [--dry-run]");
    process.exit(2);
  }

  try {
    const guide = migrateLatex(texPath);

    const warnings = guide.sections.filter(s => s._warning);
    if (warnings.length > 0) {
      console.warn(`⚠  ${warnings.length} bloque(s) sin conversión automática:`);
      for (const w of warnings) console.warn(`   · ${w._warning}`);
    }

    // Limpiar campos internos antes de serializar
    for (const section of guide.sections) delete section._index;

    const json = JSON.stringify(guide, null, 2);

    if (dryRun || verbose) {
      console.log(json);
    }

    if (!dryRun) {
      const outPath = outputArg
        ? path.resolve(outputArg)
        : path.join(path.dirname(path.resolve(texPath)), "guide.json");

      fs.writeFileSync(outPath, json, "utf8");
      console.log(`✓ Migración completada: ${outPath}`);
      console.log(`  Secciones: ${guide.sections.length}`);
      console.log(`  Siguiente paso: jintia validate ${outPath}`);
    }
  } catch (err) {
    console.error(`guide-migrator: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { migrateLatex, extractMetadata, extractBlocks, stripLatex };
