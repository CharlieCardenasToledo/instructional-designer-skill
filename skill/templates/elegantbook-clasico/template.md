# Plantilla ElegantBook clásico — guía semanal

Esta es la plantilla base de la skill para guías conceptuales y técnicas. Está
adaptada del patrón institucional UIDE, pero no fija una universidad, autor,
logo ni ecosistema: esos datos se leen desde `config/institution.json`.

## Contrato de compilación

- Clase: `elegantbook`, 11pt, una cara, idioma español.
- Bibliografía: `biblatex` + `biber`, con `reference.bib` y `\printbibliography`.
- El archivo principal solo orquesta el documento; el contenido vive en
  `sections/` y se incorpora con `\input{...}`.
- La secuencia mínima es `\frontmatter`, portada, `\mainmatter`, contenido,
  aplicación y referencias.
- Sustituye `{{PRIMARY_RGB}}`, `{{AUTHOR}}`, `{{INSTITUTION}}`,
  `{{CAREER}}`, `{{COURSE}}`, `{{WEEK}}` y `{{TOPIC}}` con la configuración
  institucional y el sílabo generado. Si no hay logo, omite `\logo`.

## Archivo principal recomendado

```latex
\documentclass[11pt,oneside,lang=es,color=blue,citestyle=apa,bibstyle=apa]{elegantbook}
\input{preamble.tex}

\title{Guía didáctica semanal}
\subtitle{Semana {{WEEK}}\\[Título del tema]}
\author{{{AUTHOR}}}
\institute{{{CAREER}}}
\date{{{ACADEMIC_PERIOD}}}
\version{Semana {{WEEK}}}
\bioinfo{Asignatura}{{{COURSE}}}
\extrainfo{{{INSTITUTION}}}

\begin{document}
\frontmatter
\maketitle
\mainmatter
\input{sections/01-introduccion}
\input{sections/02-desarrollo}
\input{sections/03-aplicacion}
\input{sections/04-referencias}
\end{document}
```

## Estructura pedagógica canónica

1. `01-introduccion.tex`: propósito, resultado de aprendizaje, conocimientos
   previos, tiempo estimado y ruta de estudio dentro de `softblock`.
2. Secciones de teoría: cada concepto debe incluir explicación, ejemplo,
   contraste o decisión y una actividad breve.
3. `03-aplicacion.tex`: escenario o estudio de caso con un problema concreto,
   criterios de decisión y evidencia esperada.
4. `04-referencias.tex`: `\printbibliography[heading=bibintoc]`.

## Gramática visual de bloques

- `softblock`: orientación, contexto y metadatos de la semana.
- `accentblock`: activación del problema o principio central.
- `mintblock`: guía de aplicación o procedimiento.
- `sandblock`: advertencia, trade-off o cierre reflexivo.
- `roseblock`: error crítico, falacia o mala práctica con impacto severo.

Usa un bloque con una intención clara; no conviertas toda la página en cajas.
Las macros disponibles son `\guidesection`, `\coursemeta`, `\conceptline`,
`\editorialtitle`, `\keyterm`, `\iconcheck` e `\iconidea`.

## Introducción mínima

```latex
\chapter{{{TOPIC}}}
\guidesection{Semana {{WEEK}}: propósito y ruta de estudio}
\coursemeta{Tiempo estimado: {{HOURS}} horas · Modalidad: autoinstruccional}
\conceptline{Al finalizar esta semana podrás aplicar el concepto en un escenario verificable.}

\begin{softblock}
\textbf{Resultado de aprendizaje.} {{LEARNING_OUTCOME}}

\textbf{Ruta.} Revisa los conceptos, contrasta el ejemplo, resuelve la práctica
y entrega la evidencia indicada.
\end{softblock}
```

No insertes logotipos, nombres de socios ni referencias institucionales
específicas si no están definidos en la configuración del curso.
