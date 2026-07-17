# Checklist Final Obligatorio

Referencia de la skill `instructional-designer-uide`. Ejecutar esta verificación completa antes de entregar cualquier guía generada o editada.

**Flujo de arranque**
- [ ] El `README.md` del curso fue leído antes de comenzar la generación.
- [ ] NotebookLM del curso fue consultado en el arranque (Paso 2, obligatorio). Si el MCP no estaba autenticado, se ejecutó el flujo manual y se obtuvo la respuesta del usuario.
- [ ] Los datos de la semana (temas, RA, bibliografía, actividades) se extrajeron del README, no se solicitaron al usuario.

**Archivo principal (`guia-semanaXX.tex`)**
- [ ] Clase `elegantbook` con opciones `lang=es,color=blue,citestyle=apa,bibstyle=apa`.
- [ ] Paleta de 13 colores institucionales definida (weekaccent…slateline + structurecolor, main, second).
- [ ] Los 5 entornos (`softblock`, `accentblock`, `mintblock`, `sandblock`, `roseblock`) definidos.
- [ ] Macros `\iconidea`, `\iconcheck`, `\editorialtitle`, `\conceptline`, `\coursemeta`, `\guidesection` definidos.
- [ ] `\newcolumntype{Y}` definido.
- [ ] `\frontmatter`, cabecera con `\fancyhead`, `\fancypagestyle{plain}`, `\mainmatter` presentes.
- [ ] `\cover{}` comentado salvo que `latex/figure/cover.png` exista.
- [ ] La secuencia `\input` refleja el orden: introducción → secciones de teoría → escenario → aplicación → bibliografía.

**Estructura y secuencia**
- [ ] El estudio de caso (`XX-escenario.tex`) aparece **después** de todas las secciones de teoría.
- [ ] No existen secciones de relleno creadas para completar una numeración fija.
- [ ] La activación del problema técnico ocurre inline (dentro de las secciones de teoría), no en un archivo de activación previo a la teoría.
- [ ] La bibliografía es el último archivo y su número NN es el siguiente al de la última sección (numeración secuencial, sin saltos).

**`01-introduccion.tex`**
- [ ] Sigue el patrón canónico de 4 zonas: `\chapter` → `\guidesection` → `\editorialtitle` → `\conceptline` + `\coursemeta` + `softblock`.
- [ ] El `softblock` cierra con tiempo estimado y línea ASU con `\hfill`.
- [ ] No lista RA, códigos de RA (RA-X.X), ni enumera los temas de las secciones.

**Escritura y tono**
- [ ] No hay muletillas de IA ni metáforas no técnicas.
- [ ] Las transiciones entre secciones surgen de causalidad técnica.
- [ ] El documento es autoinstruccional: se entiende sin la presencia del docente.
- [ ] Las oraciones no superan ~20 palabras. Las que superan 35 palabras están partidas en dos proposiciones causales (R1).
- [ ] El primer párrafo de cada sección (excepto la primera) conecta con la sección anterior — interleaving explícito (P4).
- [ ] Cada término técnico central se usa con el mismo nombre canónico en toda la guía — sin sinónimos decorativos (R2).

**Control de redundancia**
- [ ] Ningún concepto o distinción técnica se explica en más de una sección. Si aparece en dos, consolidar en la primera y referenciar desde la segunda.
- [ ] El primer párrafo de una sección de teoría conecta con la anterior pero **no repite** su contenido — solo menciona el resultado que crea la necesidad de la nueva sección.
- [ ] Los ejemplos en el estudio de caso no repiten los mismos ejemplos ya usados en las secciones de teoría.
- [ ] Los criterios de clasificación aparecen en una sola sección; el escenario los aplica sin redefinirlos.

**Macros y bloques**
- [ ] Todos los encabezados de sección usan `\guidesection{}` seguido de `\coursemeta{Conceptos clave: ...}`.
- [ ] `\keyterm{término}` se usa exactamente una vez por término, en su primera ocurrencia (R2/Signaling Principle).
- [ ] Los `accentblock` con principio o análisis institucional usan título interno con `\iconidea`.
- [ ] El `sandblock` de cierre contiene un juicio técnico deducible del contenido precedente.
- [ ] `roseblock` solo cuando hay una mala práctica o error con impacto operativo severo. Usa los cuatro campos: Supuesto incorrecto → Consecuencia operativa → Mecanismo causal → Respuesta de ingeniería.
- [ ] `roseblock` con `[title={\textbf{Nombre}}]` cuando identifica una falacia o mala práctica nombrable.
- [ ] Las secciones con 3+ conceptos nuevos incluyen una pregunta de retrieval practice en `sandblock` al cierre (P1, opcional).

**Figuras y tablas**
- [ ] Las figuras usan `\begin{figure}[H]`, `\caption{}` y `\label{fig:...}`.
- [ ] El párrafo previo a cada figura la menciona explícitamente con `Figura~\ref{fig:...}` (D2/Spatial Contiguity).
- [ ] Los diagramas TikZ usan exclusivamente variables semánticas de la paleta.
- [ ] Los estilos TikZ locales se definen dentro de `\tikzset{...}` al inicio del `tikzpicture`.
- [ ] Las tablas comparativas usan `tabularx` + `booktabs`. PROHIBIDO `\hline`.
- [ ] Cada sección tiene figura TikZ OR tabla comparativa, nunca ambas (D1/Coherence Principle).

**Figuras HTML (solo si la guía las incluye)**
- [ ] Cada vista de interfaz es un archivo HTML separado en `latex/figure/`, con contenedor raíz `w-[390px]` y sin carcasa de teléfono.
- [ ] Los colores usan el config Tailwind del branding correspondiente (Banco de Loja para banca móvil HCI).
- [ ] Los PNG fueron generados con `node screenshot.mjs` **antes** de compilar LaTeX.
- [ ] El log de compilación confirma que todos los PNG fueron cargados.

**Citas y bibliografía**
- [ ] `\textcite{}` solo cuando el autor es sujeto gramatical.
- [ ] `\parencite{}` en todos los demás casos. PROHIBIDO `\cite{}`.
- [ ] No se inventaron referencias. Toda fuente pasó por el workflow de la Política de Evidencia (`bibliografia.md`); el documento NO contiene etiquetas `[Pendiente de Verificación]`.
- [ ] La bibliografía usa `thebibliography` con formato APA 7.ª ed. y clave `\bibitem` coherente con las citas del texto.
- [ ] El archivo `reference.bib` existe en `latex/` con entradas `@book` para todas las claves `\bibitem` usadas en el texto.
- [ ] Los recortes PDF de la semana existen en `bibliografia/recortes_por_semana/semana-XX/` para cada fuente citada (convención `Autor_Año_CapX_SecYY-ZZ_ppNNN-MMM.pdf`). Si faltaban, fueron cortados desde el libro fuente.
