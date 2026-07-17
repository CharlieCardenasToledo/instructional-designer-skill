---
name: instructional-designer-skill
description: "Evidence-based self-paced instructional design for higher education. Guides the model to create asynchronous courses, weekly guides in LaTeX, self-instructional modules, micro-content and aligned assessments (UDL 3.0, Backward Design, QM 7th Ed). Triggers: course, week, guide, module, self-instructional, pedagogical, instructional, unit, learning outcome, evidence, asynchronous, self-paced, rubric, assessment."
license: MIT
metadata:
  version: "10.3"
  changelog: CHANGELOG.md
  category: pedagogy-design
  audience:
    - instructional designers
    - faculty
    - academic coordinators
institutional_context:
  # ⚙️ CONFIGURE: Replace with your institution's details
  institution: "YOUR_INSTITUTION_NAME"
  campus: "YOUR_CAMPUS"
  frameworks:
    - UDL 3.0 (CAST, 2024)
    - Backward Design
    - Quality Matters 7th Ed
    - WCAG 2.2
---

# SKILL: Evidence-Based Self-Paced Instructional Design

## Propósito

Este skill guía al modelo para producir guías didácticas semanales en LaTeX con un estándar de calidad consistente, estructura modular y estética institucional configurable. El resultado debe ser un conjunto de archivos `.tex` modulares listos para compilar, con paleta de colores institucional, diagramas TikZ semánticos y contenido autoinstruccional.

> ⚙️ **Configuración inicial requerida.** Antes de usar esta skill por primera vez, completa los valores marcados con `⚙️ CONFIGURE` en `references/bibliografia.md` (tabla de notebooks de NotebookLM) y en `references/plantilla-latex.md` (metadatos institucionales). Sin esa configuración, la skill funcionará pero no podrá consultar tu base de conocimiento bibliográfica ni generar metadatos correctos.

## Referencias por Tarea (leer bajo demanda)

Este archivo contiene el flujo de trabajo y las reglas editoriales. El detalle técnico vive en `references/`; leer **solo** el archivo que la tarea requiera:

| Si la tarea implica... | Leer |
|---|---|
| Crear/editar el preamble, la introducción, secciones de teoría, estudio de caso, bloques o tablas | `references/plantilla-latex.md` |
| Diagramas TikZ, modelos ER (Chen), exportar figuras como PNG | `references/figuras-tikz.md` |
| Mock-ups de interfaz (HCI): HTML Tailwind, captura con Puppeteer | `references/figuras-html.md` |
| Redactar contenido con citas, resolver fuentes, NotebookLM, sección de referencias | `references/bibliografia.md` |
| Compilar la guía, rutas WSL, scripts auxiliares (`latex-validator`, `legacy-manager`, `pdf_cutter`) | `references/compilacion-wsl.md` |
| Verificación final antes de entregar (SIEMPRE al cerrar la tarea) | `references/checklist.md` |

---

## Flujo de Arranque — Lectura del Sílabo y Creación desde Cero

Este flujo es obligatorio cada vez que se genera o edita una guía semanal, independientemente de si la carpeta ya existe.

### Paso 1: Leer el sílabo canónico

**Antes de generar cualquier contenido**, leer el archivo `README.md` en la raíz de la carpeta del curso. Este archivo es la fuente canónica del sílabo: contiene temas, resultados de aprendizaje, actividades calificadas y bibliografía por semana. Las carpetas raíz por asignatura están en la tabla de Registros de NotebookLM (`references/bibliografia.md`).

**Ruta:**
```
[CARPETA_RAIZ_CURSO]/README.md
```

Ejemplo: `01 MI_ASIGNATURA_001/README.md`

No pedir al usuario datos que ya estén en el README. Si el README no existe, solicitarlo explícitamente antes de continuar.

### Paso 2: Consultar NotebookLM del curso (OBLIGATORIO)

Este paso no es opcional ni un fallback: se ejecuta en **todo** arranque, aunque existan fuentes locales. La consulta valida que el contenido planeado coincida con la bibliografía indexada del curso.

1. Llamar a `mcp__notebooklm__get_health`. Si `authenticated: true`, continuar al punto 3.
2. Si `authenticated: false`, **intentar autenticar antes de rendirse**:
   - Llamar a `mcp__notebooklm__setup_auth` (recupera cookies guardadas o abre navegador para login, hasta 10 min) y re-verificar con `get_health`.
   - Si sigue fallando, llamar a `mcp__notebooklm__re_auth` (fuerza sesión limpia) y re-verificar.
   - Solo si ambos fallan, emitir el bloque del **Flujo manual** (ver `references/bibliografia.md`) y no continuar hasta recibir la respuesta del usuario.
3. Identificar el notebook del curso con la tabla de Registros de NotebookLM (`references/bibliografia.md`). En orden de preferencia:
   - Si el `notebook_id` está en la tabla: llamar a `mcp__notebooklm__select_notebook` con ese id (activa el notebook como defecto; las llamadas siguientes omiten `notebook_id`).
   - Si el id no se reconoce: llamar a `mcp__notebooklm__search_notebooks` con el nombre del curso para localizarlo.
   - Si no aparece: la tabla incluye la URL de compartir; usarla con `mcp__notebooklm__add_notebook` para re-registrar, o pasarla como `notebook_url` directamente en `ask_question`.
4. Llamar a `mcp__notebooklm__ask_question` con `source_format: "footnotes"`, preguntando por los capítulos y secciones que el README asigna a la semana: conceptos centrales, definiciones formales y ejemplos del texto. Guardar el `session_id` devuelto y reutilizarlo en todas las consultas sucesivas de la misma sesión.
5. Usar la respuesta (con fuentes citadas en footnotes) para contrastar el plan de secciones y respaldar las citas junto con las fuentes locales (recortes y PDFs en `bibliografia/`).

### Paso 3: Extraer los datos de la semana solicitada

Mapear los campos del README a los elementos LaTeX correspondientes:

| Campo en `README.md` | Uso en la guía LaTeX |
|---|---|
| `**Asignatura:**` (encabezado del README) | `\bioinfo{Asignatura}{CÓDIGO\\Nombre}` y primer argumento de `\editorialtitle{}{}` |
| `**Periodo académico ordinario:**` | `\date{Periodo académico ordinario\\Mes–Mes AAAA}` |
| `**Unidad:**` de la semana | `\coursemeta{Unidad X · Semana XX · Tema central}` en `01-introduccion.tex` |
| `**Tema / contenido semanal:**` — bullets de primer nivel | Un archivo `.tex` de teoría por cada bullet (ver Paso 5) |
| `[ASU CÓDIGO]: Module X: Nombre` | Línea ASU al final del `softblock` de `01-introduccion.tex` |
| `**Horas:** Autónomo: X` | `\coursemeta{Tiempo estimado: X horas de estudio y práctica.}` |
| `**Resultado de aprendizaje:**` — componente de docencia | Orienta el párrafo del `softblock` de introducción. No copiar como lista; redactar en prosa autoinstruccional. |
| `**Herramienta de aprendizaje:**` — referencias bibliográficas | Entradas `\bibitem` en `NN-bibliografia.tex`. Los ítems no bibliográficos (herramientas, laboratorios) se ignoran en la bibliografía. |
| `**Actividades calificadas:**` — códigos y pesos | Sección de actividades en `YY-aplicacion.tex`, con código, nombre y puntaje. |

**Regla:** Los tres componentes de `**Resultado de aprendizaje:**` (docencia, práctica, autónomo) no se listan ni se enumeran en la guía. Informan el argumento técnico de la introducción y los cierres de sección, pero el documento no los menciona explícitamente.

### Paso 4: Verificar y crear la estructura de carpetas

Verificar si existe la carpeta de la semana:

```
[CARPETA_RAIZ_CURSO]/semanas/semana-XX/
```

**Si la carpeta no existe**, crear el scaffolding completo antes de escribir cualquier `.tex`:

```
semanas/
  semana-XX/
    latex/
      sections/
      figure/
```

**Regla de plantilla de facto:** Antes de escribir el preamble, localizar la semana compilada más reciente **del mismo curso** (la que tenga PDF generado y estructura `sections/`) y calcar su archivo principal, cambiando solo los metadatos de la semana. Esa semana refleja la convención vigente del curso (clase compartida, paquetes extra como `siunitx`, footer con logo). Solo si el curso no tiene ninguna semana previa compilada, usar el patrón de `references/plantilla-latex.md` como base.

Luego verificar la presencia de los archivos obligatorios:

| Archivo | Fuente si no existe |
|---|---|
| Clase elegantbook | **Primero** verificar si existe `[CURSO]/semanas/_shared/latex/elegantbook.cls`: en ese caso el documentclass la referencia como `../../_shared/latex/elegantbook` y NO se copia localmente. Si no existe la carpeta compartida, copiar `elegantbook.cls` a `latex/` desde otra semana compilada del mismo curso o desde la fuente oficial. |
| `latex/figure/logo-institution.png` | Copiar desde la semana más reciente del mismo curso o proveer el logo de tu institución |
| `latex/figure/logo-partner.png` (opcional) | Copiar desde la semana más reciente del mismo curso si aplica |

Si alguno de estos archivos no está disponible localmente, notificarlo al usuario con la ruta exacta que falta antes de continuar.

### Paso 5: Determinar el número de secciones de teoría

El número de secciones de teoría surge **directamente** de los bullets de `**Tema / contenido semanal:**` en el README. Cada bullet de primer nivel es una sección de teoría. No crear secciones de relleno.

**Ejemplo:** Si el README lista 3 bullets de tema para la semana, la secuencia de archivos es:

```
sections/
  01-introduccion.tex
  02-[slug-tema-1].tex
  03-[slug-tema-2].tex
  04-[slug-tema-3].tex
  05-escenario.tex
  06-aplicacion.tex
  07-bibliografia.tex
```

El slug del nombre de archivo es kebab-case del tema principal del bullet (sin artículos ni preposiciones).

**Regla de numeración:** La numeración es estrictamente secuencial. La bibliografía siempre es el último archivo y toma el número siguiente al de aplicación (en el ejemplo, `07-`). No existe un número fijo reservado para la bibliografía.

### Paso 6: Confirmar el plan al usuario

Antes de generar los archivos, mostrar al usuario:
- Semana y tema derivados del README.
- Lista de secciones `.tex` planeadas (con nombre de archivo y título de sección).
- Fuentes bibliográficas identificadas.
- Si falta algún dato, solicitarlo aquí.

---

## Entradas Mínimas Requeridas

La mayoría de los datos necesarios se obtienen automáticamente del `README.md` del curso (ver **Flujo de Arranque**). El usuario solo debe proporcionar:

- **Curso y número de semana** — para localizar la carpeta y el bloque correcto del README.
- **Nombre de la carrera** — no siempre está en el README; confirmar con el usuario si no aparece.
- Cualquier dato ausente o incompleto en el README que el usuario quiera especificar (p. ej., una cita adicional, un enfoque particular del tema).

**No solicitar** al usuario información que ya esté en el README: unidad, tema, RA, bibliografía, actividades calificadas, módulo ASU o período académico.

## Salidas Esperadas

- `guia-semanaXX.tex` — archivo principal listo para compilar con la secuencia de 3 pasadas (ver `references/compilacion-wsl.md`).
- `reference.bib` — **obligatorio**. La clase `elegantbook` con `citestyle=apa,bibstyle=apa` invoca biber, que busca este archivo por nombre exacto. Sin él, biber falla y las citas `\parencite{}`/`\textcite{}` no se resuelven.
- Archivos `.tex` modulares en `latex/sections/`.
- Diagramas TikZ embebidos en los archivos de sección correspondientes.
- Archivos HTML en `latex/figure/` (si la guía incluye figuras de interfaz UI).
- PNG capturados desde los HTML (ejecutar `node screenshot.mjs` antes de compilar LaTeX).
- Reporte de cambios (si la tarea es edición quirúrgica de archivos existentes).

> **Nota sobre `cover.png`:** Si la portada ElegantBook es necesaria, añadir una imagen en `latex/figure/cover.png` y descomentar `\cover{figure/cover.png}` en el main file. Si el archivo no existe, dejar la línea comentada para evitar error de compilación.

---

## Decisiones por Defecto

| Decisión | Valor por defecto |
|---|---|
| Ruta de trabajo | `[CURSO]/semanas/semana-[XX]/latex/` |
| Clase elegantbook | Local en `latex/elegantbook.cls` |
| Color de acento semanal | `weekaccent` = ⚙️ configurar en `references/plantilla-latex.md` con el color institucional |
| Estrategia pedagógica | Teoría con activación inline → estudio de caso síntesis → aplicación |
| Posición del escenario | Después de toda la teoría, antes de aplicación |
| Evaluación | Integrada en `YY-aplicacion.tex` salvo indicación explícita |
| Diagramas TikZ | Solo si reducen carga cognitiva o clarifican una relación estructural |
| Citas sin fuente disponible | Ejecutar el workflow de la Política de Evidencia (`references/bibliografia.md`). Nunca inventar; nunca entregar con `[Pendiente de Verificación]`. |
| Numeración de bibliografía | Secuencial: siempre el último archivo, número siguiente al de aplicación |
| Compilación | 3 pasadas via WSL: `pdflatex → biber → pdflatex → pdflatex` |

---

## Macrosecuencia Académica (Estructura LTI Canónica)

El orden de `\input` en el archivo principal define el flujo pedagógico. El nombre del archivo no determina su posición.

| Posición en el flujo | Archivo `sections/` | Función |
|---|---|---|
| 1 | `01-introduccion.tex` | Apertura editorial, contexto, alineación ASU. Sin RA ni listas de objetivos. |
| 2 … N | `02-[tema].tex`, `03-[tema].tex`, … | Desarrollo teórico. Cada archivo aborda una distinción, patrón o concepto. Activación inline mediante `accentblock`. |
| N+1 | `XX-escenario.tex` | Estudio de caso síntesis: los conceptos de la semana aplicados al ecosistema UIDE. Siempre **después** de toda la teoría. |
| N+2 | `YY-aplicacion.tex` | Preguntas de recuperación (retrieval practice) y guía de transferencia profesional. Sin actividades calificadas. |
| N+3 | `NN-bibliografia.tex` | Referencias. Numeración secuencial (ver Paso 5). |

> **Regla:** El estudio de caso va siempre **después de la teoría**, nunca antes. La activación del problema técnico ocurre **inline** dentro de cada sección de teoría mediante `accentblock`. No crear archivos de relleno para completar una numeración fija.

Los patrones canónicos de cada archivo (introducción, teoría, escenario, bloques, tablas) están en `references/plantilla-latex.md`.

---

## Vocabulario de Macros Editoriales (OBLIGATORIO)

Estos macros son parte de la plantilla institucional. El modelo **debe usarlos en lugar de equivalentes LaTeX genéricos**.

| Macro | Función | Posición habitual |
|---|---|---|
| `\guidesection{Título}` | Encabezado de sección dentro del capítulo | Primera línea de cada archivo `.tex` (excepto `01-introduccion.tex`) |
| `\editorialtitle{Asignatura}{Subtítulo descriptivo}` | Bloque de apertura editorial visual | Solo en `01-introduccion.tex`, tras `\guidesection` |
| `\conceptline{\enquote{Cita o principio central}}` | Línea destacada con cita o aforismo técnico | Inmediatamente después de `\editorialtitle` |
| `\coursemeta{Texto de metadatos}` | Metadato de unidad/semana o tiempo estimado | Después de `\conceptline` y dentro del `softblock` |
| `\iconidea` | Ícono de idea/activación (`\ding{72}`) | Inicio del título interno en `accentblock` y `mintblock` con título |
| `\iconcheck` | Ícono de verificación (`\ding{51}`) | Listas de criterios o checklists dentro del documento |
| `\enquote{texto}` | Comillas tipográficas | Citas cortas integradas en el texto |
| `\keyterm{término}` | Señalización de término técnico clave (bold + color weekaccent). Primera y única ocurrencia del término en la guía. Implementa el Signaling Principle de Mayer (ver R2). | Primera ocurrencia de cada término técnico central. |

---

## Firma Editorial: Tono y Restricciones de Escritura

### Tono académico técnico
El registro es directo, causal y autosuficiente. El estudiante no necesita al docente para entender el material.

- **Preferir causalidad técnica:** "La separación de responsabilidades favorece...", "El cumplimiento de estos principios garantiza...", "La necesidad de escalamiento independiente justifica el despliegue de...".
- **PROHIBIDO — muletillas de IA:** "Querido estudiante", "A continuación veremos", "Es importante destacar", "Recuerda que", "La regla de oro", "En resumen".
- **PROHIBIDO — metáforas no técnicas:** "Bajo la lupa", "El corazón del sistema", "Como si fuera una caja negra". Las transiciones deben surgir de la lógica del argumento técnico.
- **PROHIBIDO — rayas dobles como inciso:** No usar el patrón `---frase---` ni `—frase—` (inciso entre rayas, en cualquiera de sus formas Unicode o LaTeX) dentro de una oración. Si la aclaración es breve, usar paréntesis `(frase)`. Si es extensa, romper en dos oraciones con conector causal explícito.

### Longitud de oraciones — R1 (Flesch-Kincaid / USU Engineering Writing Center)
- **Máximo ~20 palabras por oración** en texto corrido. Las oraciones que superan 35 palabras deben partirse en dos proposiciones con conector causal explícito.
- Incorrecto: *"El middleware es una capa de software que reside entre las aplicaciones y los sistemas operativos locales y su función es ofrecer servicios comunes y abstraer la heterogeneidad del hardware, sistemas operativos y redes."*
- Correcto: *"El middleware reside entre las aplicaciones y los sistemas operativos locales. Su función es absorber la heterogeneidad del hardware, las redes y los sistemas operativos, y exponer una interfaz uniforme a los componentes que lo utilizan."*

### Consistencia terminológica — R2
- El término técnico canónico se define en el `accentblock` de la sección que lo introduce y se usa **sin variación** hasta el cierre de la guía. No usar sinónimos decorativos (*"capa de abstracción"*, *"capa de integración"*, *"integrador de contratos"* para el mismo concepto).
- La primera ocurrencia del término en la guía usa `\keyterm{término}`. A partir de ahí, texto normal o `\textbf{}` solo si el contexto lo exige.

### Conectores de interleaving entre secciones — P4 (Spacing/Interleaving research)
- El primer párrafo de cada sección de teoría (excepto la primera) debe establecer **cómo la sección anterior crea la necesidad de la actual**. Esta referencia cruzada narrativa implementa el interleaving en material escrito y mejora la retención a largo plazo.
- Incorrecto: comenzar la sección de middleware con *"El middleware es una capa de software..."* sin conectar con la sección de sistemas distribuidos.
- Correcto: *"La heterogeneidad entre nodos de un sistema distribuido hace que el contrato directo entre aplicaciones sea inviable. El middleware existe precisamente para absorber esa heterogeneidad..."*

### Densidad óptima por sección
- 2 a 4 párrafos conceptuales por sección. Preferir párrafos de 2-3 oraciones sobre párrafos de 4-5.
- **Una figura TikZ OR una tabla comparativa** por sección — nunca ambas en la misma sección (Coherence Principle, Mayer, effect size 0.86). Si ambas son necesarias, una va a la sección siguiente.
- Preferir una tabla comparativa a una lista larga cuando se contrastan 3 o más entidades.

---

## Anclaje Institucional

> ⚙️ **CONFIGURE**: Reemplaza los ejemplos de abajo con los sistemas digitales reales de tu institución. El estudio de caso debe usar procesos y nombres que tus estudiantes reconozcan como propios de su contexto laboral o académico.

El estudio de caso y los ejemplos en las secciones de teoría deben usar el ecosistema digital de **tu institución**. Ejemplos de categorías típicas:
- **Registro y pagos:** integración de sistemas, pasarelas, becas, cálculo de aranceles.
- **LMS / Aulas Virtuales:** Canvas, Moodle, reportes académicos, integración con sistemas externos.
- **Autenticación y seguridad:** gestión de identidad, sesiones, datos institucionales.
- **Servicios administrativos:** gestión de horarios, asistencia, reportes de gestión académica.

El escenario institucional no es decorativo: debe plantear el problema técnico de la semana de manera específica y verosímil, con nombres de sistemas o procesos reales de **tu institución**.

---

## Cierre de Tarea

Dos verificaciones obligatorias antes de entregar, sin excepciones (aplican tanto a generación desde cero como a ediciones quirúrgicas):

1. **Recortes bibliográficos de la semana.** Verificar que exista `[CURSO]/bibliografia/recortes_por_semana/semana-XX/` con el recorte PDF de cada fuente citada en la guía (las páginas exactas que respaldan el contenido). Si falta alguno, cortarlo desde el libro fuente en `bibliografia/` usando `scripts/pdf_cutter_template.py` o PyMuPDF directo. Convención de nombre: `Autor_Año_CapX_SecYY-ZZ_ppNNN-MMM.pdf` (ej. `Elmasri_2016_Cap4_Sec44-47_pp120-135.pdf`). La guía no se entrega sin sus recortes.
2. **Checklist completo.** Ejecutar `references/checklist.md` punto por punto.
