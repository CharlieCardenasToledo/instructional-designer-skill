# Plantilla LaTeX — Preamble, Bloques y Patrones Canónicos

Referencia de la skill `instructional-designer-skill`. Leer cuando la tarea implique crear o editar el archivo principal, la introducción, secciones de teoría, el estudio de caso o tablas comparativas.

---

## Plantilla Principal: `guia-semanaXX.tex`

Este archivo es el orquestador del documento. **Nunca contiene contenido didáctico**: solo preamble, definiciones y secuencia de `\input`. El patrón base es la primera semana compilada del curso; sin embargo, **la semana compilada más reciente del mismo curso manda** sobre este documento si difieren (ver Regla de plantilla de facto en SKILL.md). Adiciones específicas de curso ya observadas: clase compartida en `semanas/_shared/latex/`, paquete `siunitx` con separadores en español, y `\fancyfoot` con logo institucional y número de página.

### Clase de documento y opciones

```latex
% Variante A — clase compartida del curso (preferida si existe semanas/_shared/latex/):
\documentclass[11pt,oneside,lang=es,color=blue,citestyle=apa,bibstyle=apa]{../../_shared/latex/elegantbook}

% Variante B — clase local (cursos sin carpeta compartida):
\documentclass[11pt,oneside,lang=es,color=blue,citestyle=apa,bibstyle=apa]{elegantbook}
```

- `lang=es` — texto en español (capítulos, índices).
- `color=blue` — esquema base de ElegantBook (sobrescrito por `structurecolor`).
- `citestyle=apa,bibstyle=apa` — habilita `\parencite{}` y `\textcite{}` de biblatex.
- En la variante B, la clase `elegantbook.cls` debe estar en la misma carpeta `latex/`.

### Paquetes requeridos

```latex
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{microtype}
\usepackage{csquotes}
\setquotestyle{american}

\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,shapes.geometric,fit,babel,shadows,backgrounds,calc}
\usepackage{tabularx}
\usepackage{array}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{pifont}
\usepackage{hyperref}
\usepackage{float}
\addbibresource{reference.bib}
```

> **Nota:** `tcolorbox` (usado por los entornos de bloque), `fancyhdr` (cabeceras) y `xcolor` no se cargan aquí porque `elegantbook.cls` ya los carga internamente. No agregarlos al preamble: duplicarlos puede producir warnings de opciones en conflicto.

### Metadatos institucionales ElegantBook

Leer `config/institution.json` y el `README.md` del curso. Sustituir los marcadores al generar el archivo; no editar esta referencia para guardar datos personales.

```latex
\renewcommand{\spanishchaptername}{Unidad}

\title{Guía Didáctica Semanal}
\subtitle{Semana XX\\[Título del tema de la semana]}

\author{[Tu nombre completo con grado académico]}
\institute{Carrera de\\[Nombre de la carrera]}
\date{Periodo académico ordinario\\[Periodo]}
\version{Semana XX}
\bioinfo{Asignatura}{[CÓDIGO]\\[Nombre de la asignatura]}
\extrainfo{[Facultad o Escuela]\\[Nombre de tu institución]}

\logo{figure/logo-institution.png} % Omitir si branding.logoPath está vacío.
% \cover{figure/cover.png}   % Descomentar SOLO si latex/figure/cover.png existe.
                             % Si el archivo no existe, dejar comentado para
                             % evitar error de compilación.
```

### Paleta de colores institucional

Convertir `branding.primaryColor` de `config/institution.json` a RGB. Si no existe configuración, solicitar el color antes de generar una guía final.

```latex
\definecolor{weekaccent}{RGB}{0,121,107}      % ⚙️ Color primario institucional
\definecolor{weekaccentsoft}{RGB}{232,245,243}
\definecolor{ink}{RGB}{36,44,53}
\definecolor{softbg}{RGB}{250,251,253}
\definecolor{softline}{RGB}{212,220,230}
\definecolor{mintbg}{RGB}{248,252,250}
\definecolor{mintline}{RGB}{61,139,112}
\definecolor{sandbg}{RGB}{252,249,244}
\definecolor{sandline}{RGB}{211,144,42}
\definecolor{rosebg}{RGB}{253,248,248}
\definecolor{roseline}{RGB}{184,77,77}
\definecolor{slateline}{RGB}{103,119,138}

\definecolor{structurecolor}{RGB}{0,121,107}  % ⚙️ Igual que weekaccent
\definecolor{main}{RGB}{0,121,107}            % ⚙️ Igual que weekaccent
\definecolor{second}{RGB}{36,44,53}
```

> **Regla:** Usa el mismo valor de RGB para `weekaccent`, `structurecolor` y `main`. El color de acento debe mantenerse constante en todas las semanas del curso.

### Entornos de bloque (copy-paste exacto)

```latex
\newtcolorbox{softblock}[1][]{
  enhanced, breakable, colback=softbg, colframe=softline, boxrule=0.6pt, arc=2mm,
  left=3mm, right=3mm, top=2.5mm, bottom=2.5mm, #1}

\newtcolorbox{accentblock}[1][]{
  enhanced, breakable, colback=white, colframe=weekaccent, boxrule=1pt,
  borderline west={2pt}{0pt}{weekaccent}, arc=2mm,
  left=3mm, right=3mm, top=2.5mm, bottom=2.5mm, #1}

\newtcolorbox{mintblock}[1][]{
  enhanced, breakable, colback=mintbg, colframe=mintline, boxrule=0.6pt, arc=2mm,
  left=3mm, right=3mm, top=2.5mm, bottom=2.5mm, #1}

\newtcolorbox{sandblock}[1][]{
  enhanced, breakable, colback=sandbg, colframe=sandline, boxrule=0.6pt, arc=2mm,
  left=3mm, right=3mm, top=2.5mm, bottom=2.5mm, #1}

\newtcolorbox{roseblock}[1][]{
  enhanced, breakable, colback=rosebg, colframe=roseline, boxrule=0.6pt, arc=2mm,
  left=3mm, right=3mm, top=2.5mm, bottom=2.5mm, #1}
```

### Macros editoriales y tipográficos (copy-paste exacto)

```latex
\newcommand{\iconcheck}{\ding{51}}
\newcommand{\iconidea}{\ding{72}}
\newcommand{\keyterm}[1]{{\bfseries\color{weekaccent}#1}}

\newcommand{\editorialtitle}[2]{%
  {\Large\bfseries\color{ink} #1\par}%
  \vspace{0.2em}%
  {\small\color{weekaccent}\rule{3.2cm}{0.8pt}\hspace{0.6em}\textsc{#2}\par}%
}
\newcommand{\conceptline}[1]{{\large\itshape\color{ink} #1\par}}
\newcommand{\coursemeta}[1]{{\small\color{slateline}#1\par}}
\newcommand{\guidesection}[1]{\section*{#1}\addcontentsline{toc}{section}{#1}}

\newcolumntype{Y}{>{\centering\arraybackslash}X}
```

### Configuración tipográfica global

```latex
\setlist[itemize]{leftmargin=*,topsep=3pt,itemsep=3pt}
\setlist[enumerate]{leftmargin=*,topsep=3pt,itemsep=3pt}
\renewcommand{\arraystretch}{1.2}
\setlength{\parindent}{0pt}
```

### Cabecera institucional y secuencia de `\input`

```latex
\begin{document}

\frontmatter
\fancyhead{}
\fancyhead[LO]{\color{structurecolor}\small Elaborado por: [Tu nombre con grado académico]}
\fancyhead[RO]{\color{structurecolor}\small Carrera: [Nombre de la carrera]}
\renewcommand{\headrulewidth}{0.8pt}
\fancypagestyle{plain}{
  \fancyhead{}
  \fancyhead[LO]{\color{structurecolor}\small Elaborado por: [Tu nombre con grado académico]}
  \fancyhead[RO]{\color{structurecolor}\small Carrera: [Nombre de la carrera]}
  \renewcommand{\headrulewidth}{0.8pt}
}
\mainmatter

\input{sections/01-introduccion}
\input{sections/02-[nombre-tema]}
\input{sections/03-[nombre-tema]}
% ... secciones de desarrollo temático
\input{sections/XX-escenario}
\input{sections/YY-aplicacion}
\input{sections/NN-bibliografia}

\end{document}
```

> **Regla crítica:** `\frontmatter` y `\mainmatter` son obligatorios. `\frontmatter` desactiva la numeración de páginas para la portada ElegantBook. `\mainmatter` la reactiva.

---

## Patrón Canónico de `01-introduccion.tex`

Este archivo abre el capítulo con 4 zonas exactas. No añadir contenido temático aquí: la introducción orienta, no enseña.

```latex
\chapter{Nombre del Tema Principal}

\guidesection{Semana XX: Descripción breve}

\editorialtitle{Nombre de la Asignatura}{Subtítulo descriptivo del tema}

\vspace{0.4em}
\conceptline{\enquote{Principio o cita técnica central de la semana.}}
\vspace{0.25em}
\coursemeta{Unidad X · Semana XX · Tema central}

\vspace{0.8em}

\begin{softblock}
Párrafo de orientación: qué va a entender el estudiante y por qué importa
desde la perspectiva de la ingeniería. No usar listas. Máximo 3 párrafos.

\vspace{0.5em}
\coursemeta{Tiempo estimado: X horas de estudio y práctica.}

\vspace{0.8em}
% Integración opcional. Incluir solo cuando integrations.partnerName,
% partnerModule y partnerLogoPath estén configurados.
{\small \textbf{Internacionalización:} Este contenido se alinea con
\textit{Nombre del módulo} de Nombre del socio.
\hfill \includegraphics[height=0.4cm]{figure/logo-partner.png}}
\end{softblock}
```

**Reglas:**
- `\editorialtitle` recibe dos argumentos: nombre de la asignatura y subtítulo descriptivo del tema específico.
- `\conceptline` contiene un principio técnico, no una frase motivacional.
- El `softblock` describe **qué** se aprende y **por qué** importa. No anticipa el contenido, no lista RA ni temas de las secciones.
- La línea de internacionalización es opcional. Omitirla por completo cuando no exista una integración configurada.

---

## Patrón Canónico de las Secciones de Teoría

Cada sección de desarrollo temático sigue este esquema. Los elementos son combinables; no todos son obligatorios en cada sección.

```latex
\guidesection{Título de la Sección}
\coursemeta{Conceptos clave: término1, término2, término3.}

% Párrafo de apertura: conecta con la sección anterior (P4 — ver Conectores de interleaving)
% y establece la necesidad técnica que justifica esta sección. 1-2 párrafos.
Párrafo introductorio. La primera ocurrencia de cada término técnico central
usa \keyterm{término} (R2 — ver Consistencia terminológica y tabla de Macros).

% Activación inline: principio o problema central de la sección
\begin{accentblock}
{\bfseries \iconidea\hspace{0.5em}Título del Principio o Concepto}\par
Desarrollo del principio o distinción técnica. Puede incluir listas si el contexto
lo justifica técnicamente. Sin metáforas.
\end{accentblock}

\vspace{0.8em}

% Contenido técnico: párrafos, listas, UNA figura TikZ OR UNA tabla
% (Coherence Principle — ver Densidad óptima en Firma Editorial)
...

% Cierre: aplicación operativa (mintblock) o juicio técnico (sandblock)
\begin{mintblock}
Guía operativa: cómo aplica el ingeniero este conocimiento.
\end{mintblock}

% — O bien —

\begin{sandblock}
Juicio técnico de alto nivel: trade-off, advertencia de diseño o conclusión
que sintetiza la sección. Debe surgir del argumento técnico precedente.
\end{sandblock}

% Retrieval practice opcional — P1 (30-50% mejora retención)
% Añadir al cierre de secciones con 3+ conceptos nuevos:
\begin{sandblock}
\textbf{Pregunta de recuperación:} [1 pregunta que obligue al estudiante a
recuperar activamente el concepto central sin releer la sección.]
\end{sandblock}
```

**Reglas:**
- `\coursemeta{Conceptos clave:}` va siempre en la segunda línea, justo debajo de `\guidesection{}`.
- El `accentblock` activa el problema o principio **antes** del desarrollo.
- El cierre es `mintblock` cuando la sección entrega una guía de aplicación; es `sandblock` cuando entrega un juicio técnico o trade-off.
- La pregunta de retrieval practice es opcional pero recomendada en secciones con 3+ conceptos nuevos.

---

## Gramática Visual de Bloques

Cada bloque cumple una función cognitiva específica. No usar como decoración. **Solo un bloque de cada tipo por sección**, salvo necesidad técnica justificada.

### `softblock` — Orientación y contexto
Metadatos académicos, tiempo estimado, descripción de la semana y alineación institucional opcional. Solo en `01-introduccion.tex`.
```latex
\begin{softblock}
Texto de orientación general o metadatos académicos.
\end{softblock}
```

### `accentblock` — Activación del problema o principio crítico
Principio técnico central de una sección, o análisis institucional en el estudio de caso. Siempre con título interno usando `\iconidea`.
```latex
\begin{accentblock}
{\bfseries \iconidea\hspace{0.5em}Título del principio o análisis}\par
Desarrollo del principio. Puede incluir listas si el contexto lo justifica.
\end{accentblock}
```

### `mintblock` — Aplicación práctica o guía operativa
Criterio de ingeniería, síntesis de transferencia. Puede ir con `[title=...]` o con título interno.
```latex
% Con title= como opción del entorno
\begin{mintblock}[title=\iconidea\hspace{0.5em}Guía de Aplicación]
Instrucciones o criterios operativos para el ingeniero.
\end{mintblock}

% Con título interno (equivalente)
\begin{mintblock}
{\bfseries \iconidea\hspace{0.5em}Guía de Aplicación}\par
Instrucciones o criterios operativos para el ingeniero.
\end{mintblock}
```

### `sandblock` — Advertencia técnica o cierre reflexivo
**Uso A — Advertencia o trade-off técnico** (mitad de sección): matiz, limitación, riesgo de diseño.
**Uso B — Cierre reflexivo** (fin de sección): juicio técnico que sintetiza la sección con una conclusión de ingeniería.
```latex
\begin{sandblock}
Juicio técnico o advertencia de diseño. Debe ser una conclusión deducible
del contenido precedente, no una afirmación flotante.
\end{sandblock}
```

### `roseblock` — Error crítico, falacia o mala práctica con impacto operativo severo
Errores de diseño con consecuencias graves. Usa el patrón de **Worked Example estructurado** (CLT — Cognitive Load Theory) con cuatro campos obligatorios. El campo **Mecanismo causal** explica *por qué* ocurre la consecuencia, activando el self-explanation effect.

```latex
% Con título identificador (recomendado para falacias y malas prácticas)
\begin{roseblock}[title={\textbf{Nombre del error o falacia}}]
\textbf{Supuesto incorrecto:} Descripción de la suposición falsa que el
desarrollador incorpora en el diseño.

\textbf{Consecuencia operativa:} Qué ocurre en producción cuando el supuesto falla.
Usar escenario concreto, no abstracto.

\textbf{Mecanismo causal:} Por qué ocurre esa consecuencia — la cadena técnica
que conecta el supuesto con el fallo. Este campo activa la comprensión profunda.

\textbf{Respuesta de ingeniería:} Qué implementa el ingeniero para mitigar el riesgo.
Específico y accionable.

% Figura TikZ opcional si ilustra el mecanismo del fallo
\end{roseblock}

% Sin título (para malas prácticas de diseño general)
\begin{roseblock}
Descripción técnica de la mala práctica y su impacto operativo concreto.
\end{roseblock}
```

---

## Patrón Canónico del Estudio de Caso (`XX-escenario.tex`)

El estudio de caso es una sección de **síntesis** que aparece **después de todas las secciones de teoría** y antes de la aplicación. Su función es demostrar cómo los conceptos de la semana resuelven un problema institucional concreto (usando el ecosistema configurado en el Paso 0 del flujo de arranque).

```latex
\guidesection{Estudio de Caso: [Título descriptivo del análisis]}

\begin{accentblock}
{\bfseries \iconidea\hspace{0.5em}[Título del análisis institucional]}\par
Descripción del contexto institucional concreto (matrícula, pagos, aulas virtuales,
autenticación, etc.). Nombrar el sistema o proceso específico de tu institución.

\textbf{[Evaluación o análisis técnico]:} Texto introductorio al análisis.
\begin{itemize}
    \item \textbf{Concepto 1 de la semana:} Aplicación específica al escenario.
    \item \textbf{Concepto 2 de la semana:} Aplicación específica al escenario.
    \item \textbf{Concepto 3 de la semana:} Aplicación específica al escenario.
\end{itemize}

\vspace{0.5em}
\textbf{Síntesis:} Conclusión técnica que vincula los conceptos con el impacto
operativo institucional. Máximo 2 oraciones.
\end{accentblock}
```

**Reglas:**
- La sección usa **un único `accentblock`** grande que concentra todo el análisis.
- Los bullets conectan cada concepto de la semana con una aplicación específica e identificable del ecosistema institucional configurado.
- Los ejemplos no repiten los ya usados en las secciones de teoría — deben ser casos nuevos o extensiones del mismo escenario con datos distintos.
- No usar `\begin{figure}` salvo que un diagrama sea indispensable para el análisis.
- El archivo puede llamarse `XX-escenario.tex` o `XX-estudio-de-caso.tex`.

---

## Estructura Canónica de Tabla Comparativa

Cuando se comparan 3 o más entidades con 2 o más atributos, usar `tabularx` con `booktabs`:

```latex
\begin{center}
\begin{tabularx}{\textwidth}{>{\raggedright\arraybackslash}p{3.4cm}
                              >{\raggedright\arraybackslash}X
                              >{\raggedright\arraybackslash}X}
\toprule
\textbf{Entidad / Patrón} & \textbf{Atributo 1} & \textbf{Atributo 2} \\
\midrule
Fila 1 & Descripción técnica. & Descripción técnica. \\
Fila 2 & Descripción técnica. & Descripción técnica. \\
\bottomrule
\end{tabularx}
\end{center}
```

**Reglas:**
- Primera columna con ancho fijo (`p{3.4cm}`); columnas de contenido con `X`.
- Usar `\toprule`, `\midrule`, `\bottomrule` de `booktabs`. **PROHIBIDO** usar `\hline`.
- El bloque `center` envuelve la tabla sin agregar número de figura.
- Para columna centrada, usar el tipo `Y` definido en el preamble: `>{\centering\arraybackslash}X`.
