# Kaobook Marginal — guía semanal

Implementar la gramática visual común de Jintia sobre `kaohandt`, la clase de
Kaobook destinada a informes y handouts. Mantener la estructura pedagógica,
evidencia, bibliografía y archivos canónicos definidos por `SKILL.md`.

## Contrato de compilación

- Colocar `kaohandt.cls`, `kao.sty` y los estilos Kaobook incluidos junto al
  archivo principal. No depender de una instalación global.
- Usar `10pt`, `oneside`, `\pagelayout{margin}` y contenido modular con
  `\input`.
- Usar `biblatex` + `biber`, `reference.bib`, `\textcite`, `\parencite` y
  `\printbibliography`.
- Sustituir los marcadores institucionales y `{{PRIMARY_RGB}}`. Omitir el logo
  cuando no esté configurado.

## Gramática visual común

Usar `\guidesection`, `\coursemeta`, `\conceptline`, `\editorialtitle`,
`\keyterm` y los entornos `softblock`, `accentblock`, `mintblock`,
`sandblock` y `roseblock` con las mismas intenciones que ElegantBook.

## Capacidades marginales

Usar estas extensiones solo para información complementaria:

- `\marginconcept{término}{definición}`: definición breve.
- `\marginquestion{pregunta}`: recuperación sin releer.
- `\marginevidence{criterio}`: recordatorio breve de evidencia.
- `\widecontent{contenido}`: tabla o figura que necesita el ancho completo.

No colocar en el margen resultados completos, instrucciones indispensables,
pasos obligatorios, criterios de calificación, advertencias críticas ni
contenido superior a 60 palabras. La guía debe seguir siendo comprensible si
se omiten todas las notas marginales. Evitar notas consecutivas que compitan
verticalmente y no usar notas marginales dentro de cajas.

## Figuras y tablas seguras

Usar exclusivamente `guidefigure` con
`\guidefigurecaption{texto}{fig:clave}` y `guidetable` con
`\guidetablecaption{texto}{tab:clave}`. No usar `figure`, `table` ni
`\caption` directamente: pueden colisionar con el layout marginal.

## Introducción mínima

```latex
\guidesection{Semana {{WEEK}}: propósito y ruta de estudio}
\editorialtitle{{{COURSE}}}{{{TOPIC}}}
\conceptline{Principio técnico central de la semana.}
\coursemeta{Unidad {{UNIT}} · Tiempo estimado: {{HOURS}} horas}

\begin{softblock}
\textbf{Resultado de aprendizaje.} {{LEARNING_OUTCOME}}

\textbf{Ruta.} Revisa los conceptos, contrasta el ejemplo, resuelve la práctica
y entrega la evidencia indicada.
\end{softblock}
```

`kaohandt` deriva de `scrartcl`: no exigir `\chapter`, `\frontmatter`,
`\mainmatter` ni `\backmatter`.
