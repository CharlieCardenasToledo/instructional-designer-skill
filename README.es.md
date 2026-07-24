# instructional-designer-skill

<p align="right">
  <a href="README.md">🇺🇸 Read in English</a> &nbsp;|&nbsp;
  <a href="docs/guia-claude-desktop.md">📖 Guía Claude Desktop y CoWork</a>
</p>

> **Skill de Claude Code** para diseño instruccional autodirigido basado en evidencia.  
> Crea guías didácticas semanales en LaTeX, módulos de autoaprendizaje y evaluaciones alineadas para educación superior — con integración de NotebookLM MCP.

[![Versión](https://img.shields.io/badge/version-10.4-blue.svg)](CHANGELOG.md)
[![Licencia: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Categoría](https://img.shields.io/badge/categoría-diseño--pedagógico-green.svg)]()
[![Marcos](https://img.shields.io/badge/marcos-UDL%203.0%20%7C%20Backward%20Design%20%7C%20QM%207ª%20Ed-purple.svg)]()

<p align="center">
  <img src="docs/images/preview.png" alt="Instructional Designer Skill — cuaderno con ecuaciones, diagramas y esquemas pedagógicos" width="100%">
</p>

---

## ¿Qué hace este skill?

Este skill guía a Claude Code para producir **guías de autoaprendizaje semanales en LaTeX** con un estándar de calidad consistente. Cada guía es un conjunto de archivos `.tex` modulares, listos para compilar, que incluyen:

- Paleta de colores institucional configurable mediante la clase LaTeX **ElegantBook**
- **Diagramas TikZ** semánticos que reducen la carga cognitiva
- Bibliografía en **APA 7ª ed.** con `biblatex` + `biber`
- Integración de **NotebookLM MCP** para validación bibliográfica al inicio de cada sesión
- Cinco entornos de bloques pedagógicos (`softblock`, `accentblock`, `mintblock`, `sandblock`, `roseblock`)
- Reglas de escritura basadas en evidencia (Flesch-Kincaid, Principios Multimedia de Mayer, investigación de Espaciado/Intercalado)

**14+ meses** de uso real en aulas universitarias en múltiples cursos, refinado mediante retroalimentación iterativa de ciclos de producción de guías reales.

---

## Marcos pedagógicos

| Marco | Función |
|---|---|
| **UDL 3.0** (CAST, 2024) | Múltiples medios de representación, participación, acción y expresión |
| **Backward Design** (Wiggins & McTighe) | Primero resultados de aprendizaje, luego evaluación, luego contenido |
| **Quality Matters 7ª Ed.** | Alineación de resultados, actividades y materiales |
| **WCAG 2.2** | Accesibilidad en materiales digitales e impresos |
| **Principios Multimedia de Mayer** | Coherencia, Señalización, Contigüidad Espacial, Segmentación |
| **Investigación de Espaciado/Intercalado** | Conectores narrativos explícitos entre secciones |

---

## Requisitos previos

| Requisito | Detalles |
|---|---|
| **Claude Code** | [docs.anthropic.com/claude-code](https://docs.anthropic.com/en/docs/claude-code/overview) |
| **NotebookLM MCP** | [PleasePrompto/notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp) — recomendado; la skill conserva un modo local verificable |
| **TeX Live** (vía WSL en Windows) | `pdflatex` + `biber` — instalar en WSL/Debian: `sudo apt install texlive-full` |
| **Clase ElegantBook** | Incluida en tu repositorio de curso o disponible en [ElegantBook releases](https://github.com/ElegantLaTeX/ElegantBook/releases) |
| **Node.js ≥18** | Para los scripts `latex-validator.js` y `legacy-manager.js` |
| **Python 3 + PyMuPDF** | Para `pdf_cutter_template.py`: `pip install pymupdf` |
| **WSL** (solo Windows) | Windows Subsystem for Linux — requerido para compilación LaTeX en Windows |

> **Base de conocimiento en NotebookLM**: Antes de usar este skill, sube la bibliografía de tu curso (PDFs de libros de texto, artículos, documentación técnica) a un notebook de NotebookLM. El skill consulta esa base al inicio de cada sesión para validar el contenido bibliográfico. Sin fuentes en NotebookLM, el Paso 2 del flujo de arranque devolverá respuestas vacías.

---

## Instalación

### Opción A — Descarga directa (sin Git, recomendado para usuarios sin experiencia técnica)

1. Ve a la página de [Releases](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/latest)
2. Descarga el archivo `instructional-designer-skill-v10.3.0.zip` (o el Source code ZIP)
3. Descomprime el ZIP en la carpeta de skills de Claude:
   - **Windows:** `%USERPROFILE%\.claude\skills\instructional-designer-skill\`
   - **macOS / Linux:** `~/.claude/skills/instructional-designer-skill/`

### Opción B — Instalación automática en Windows (recomendado)

En Windows, el onboarding de la aplicación verifica cada dependencia y pide confirmación antes de instalarla. `setup.ps1 -Install` solo prepara Node.js y Git mediante `winget`; WSL y TeX Live son opcionales y requieren pasos explícitos:

1. Descarga el ZIP desde [Releases](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/latest)
2. Descomprime y ejecuta `setup.ps1`:
   - Clic derecho sobre `setup.ps1` → **Ejecutar con PowerShell**
   - Acepta ejecutar como Administrador cuando se solicite
3. Abre la aplicación y completa el onboarding secuencial; no podrás usar el panel hasta validar Node.js, institución, plantilla, NotebookLM y el destino de instalación.

> **Nota:** la autenticación de NotebookLM abre Chrome y utiliza la sesión local del usuario. Las consultas se envían al servidor MCP configurado por ti.

### Opción C — Clonar con Git (para usuarios técnicos)

```bash
# macOS / Linux
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill \
  ~/.claude/skills/instructional-designer-skill

# Windows (PowerShell)
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill `
  "$env:USERPROFILE\.claude\skills\instructional-designer-skill"
```

> **Tras la instalación**, Claude Code detecta el skill automáticamente — no se necesita reiniciar si el directorio `~/.claude/skills/` ya existía.

### Uso

Una vez instalado, puedes invocar el skill de dos formas dentro de Claude Code:

- **Automático**: Claude lo carga cuando tu solicitud coincide con la `description` (ej. "Crea la guía de la semana 3 de mi curso de bases de datos")
- **Comando manual**: escribe `/instructional-designer-skill` en el chat

### 2. Configurar tu institución (obligatorio)

Abre estos archivos y completa los marcadores `⚙️ CONFIGURE`:

**`references/bibliografia.md`** — Registro de NotebookLM:
```markdown
| MI_CURSO_001 — Nombre del curso | `01 MI_CURSO_001/` | `tu-notebook-id` | https://notebooklm.google.com/notebook/... |
```

**`references/plantilla-latex.md`** — Metadatos institucionales:
```latex
\author{Tu nombre completo, Grado académico}
\extrainfo{Tu facultad\\Tu institución}
\logo{figure/logo-institucion.png}
\definecolor{weekaccent}{RGB}{R,G,B}  % Color primario de tu institución
```

### 3. Configurar NotebookLM MCP

Sigue la [guía de configuración de notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp) para autenticarte y configurar el servidor MCP en Claude Code.

### 4. Preparar la estructura del repositorio de tu curso

```
01 MI_CURSO_001/
├── README.md              ← Sílabo canónico (temas, RA, bibliografía por semana)
├── bibliografia/
│   ├── *.pdf              ← Libros de texto fuente
│   └── recortes_por_semana/
│       └── semana-XX/     ← Recortes PDF citados en cada guía
└── semanas/
    ├── _shared/
    │   └── latex/
    │       └── elegantbook.cls
    └── semana-XX/
        └── latex/
            ├── sections/
            └── figure/
```

---

## Cómo funciona

### Flujo de arranque (cada sesión)

```
0. Verificar configuración institucional
   ↓ (si es primera vez)
   Solicitar: nombre autor, carrera, facultad, institución, color RGB, ecosistema digital

1. Leer README.md del curso  →  extraer datos de la semana (temas, RA, bibliografía, actividades)

2. Autenticar NotebookLM MCP  →  consultar el notebook del curso para validación bibliográfica

3. Extraer campos de la semana  →  mapear campos del README a elementos LaTeX

4. Verificar/crear estructura de carpetas  →  construir andamiaje semana-XX/latex/sections/

5. Determinar secciones de teoría  →  un archivo por bullet en "Tema / contenido semanal"

6. Confirmar plan con el usuario  →  lista de secciones, fuentes, datos faltantes
```

### Estructura del documento

```
sections/
  01-introduccion.tex       ← Apertura editorial, alineación RA, sin listas de LO
  02-[tema-1].tex           ← Teoría: un concepto/patrón por archivo
  03-[tema-2].tex           ← Teoría: conector de intercalado entre secciones
  ...
  N+1-escenario.tex         ← Caso de síntesis (siempre después de TODA la teoría)
  N+2-aplicacion.tex        ← Práctica de recuperación + transferencia profesional
  N+3-bibliografia.tex      ← Referencias (siempre al final, numeración secuencial)
```

### Scripts CLI

| Script | Uso |
|---|---|
| `latex-linter.js` | Análisis estático: longitud de oraciones (R1), expresiones IA prohibidas, sintaxis LaTeX inválida, presencia de marcadores y consistencia de señalización (R2). |
| `latex-validator.js` | Ejecuta `latex-linter.js` primero, luego realiza la secuencia completa de compilación LaTeX de 3 pasadas vía WSL (`pdflatex → biber → pdflatex → pdflatex`) y captura capturas HTML si aplica. |
| `legacy-manager.js` | Archiva el contenido de la semana actual en una subcarpeta con marca de tiempo bajo `legacy/` (ej. `legacy/archive_YYYY-MM-DD_HH-MM-SS`) para prevenir colisiones antes de reestructurar. |
| `pdf_cutter_template.py` | Extrae rangos de páginas de PDFs fuente en `bibliografia/recortes_por_semana/semana-XX/`. |

Reemplaza `[RUTA_SKILL]` con la ruta donde clonaste el skill:
- macOS/Linux: `~/.claude/skills/instructional-designer-skill`
- Windows: `$env:USERPROFILE\.claude\skills\instructional-designer-skill`

```powershell
# Ejecutar el linter de estilo en una guía LaTeX
node [RUTA_SKILL]/scripts/latex-linter.js "01 MI_CURSO/semanas/semana-03/latex/guia-semana-03.tex"

# Compilar una guía (ejecuta el linter primero, luego la secuencia completa de 3 pasadas)
node [RUTA_SKILL]/scripts/latex-validator.js "01 MI_CURSO/semanas/semana-03/latex/guia-semana-03.tex"

# Archivar una semana en carpeta con marca de tiempo antes de reestructurar
node [RUTA_SKILL]/scripts/legacy-manager.js "01 MI_CURSO/semanas/semana-03"

# Cortar extractos bibliográficos (editar el array cuts[] primero)
pip install -r [RUTA_SKILL]/requirements.txt   # solo la primera vez
python [RUTA_SKILL]/scripts/pdf_cutter_template.py
```

---

## Uso con Claude Desktop (modo Proyecto / CoWork)

Para usar este skill desde **Claude Desktop** en lugar del CLI de Claude Code, consulta la guía detallada:

📄 **[docs/guia-claude-desktop.md](docs/guia-claude-desktop.md)**

Esa guía cubre:
- Configuración del skill en Claude Desktop
- Creación y gestión de Proyectos compartidos (CoWork)
- Flujo de trabajo completo desde la interfaz gráfica
- Diferencias con el flujo de Claude Code CLI

---

## Ejemplos de activación

El skill se activa automáticamente cuando mencionas:

```
"Crea la guía de la semana 3 de MI_CURSO_001"
"Genera el módulo de autoaprendizaje para la unidad 2, semana 5"
"Escribe la guía semanal sobre normalización de bases de datos"
"Agrega un diagrama TikZ a semana-04/sections/03-normalizacion.tex"
```

---

## Referencia de configuración del skill

| Parámetro | Ubicación | Valor por defecto |
|---|---|---|
| Nombre e institución | Frontmatter de `SKILL.md` | `YOUR_INSTITUTION_NAME` |
| Registro de notebooks NotebookLM | `references/bibliografia.md` | Plantilla vacía |
| Nombre del autor y metadatos institucionales | `references/plantilla-latex.md` | Marcadores configurables |
| Color institucional (RGB) | `references/plantilla-latex.md` | `RGB{0,121,107}` (ejemplo) |
| Color de acento semanal | `weekaccent` en el preámbulo | Igual que color institucional |
| Ecosistema digital institucional | `SKILL.md` — "Anclaje Institucional" | Categorías genéricas |

---

## Estructura del repositorio

```
instructional-designer-skill/
├── SKILL.md                    ← Definición del skill (frontmatter + flujo completo)
├── README.md                   ← README en inglés
├── README.es.md                ← Este archivo (README en español)
├── CHANGELOG.md                ← Historial de versiones
├── LICENSE                     ← MIT
├── docs/
│   └── guia-claude-desktop.md  ← Guía de uso con Claude Desktop y CoWork
├── references/
│   ├── plantilla-latex.md      ← Preámbulo LaTeX, bloques, patrones canónicos
│   ├── figuras-tikz.md         ← Diagramas TikZ, modelos ER (notación Chen)
│   ├── figuras-html.md         ← Maquetas UI HTML + captura PNG con Puppeteer
│   ├── bibliografia.md         ← Política de citas, flujo NotebookLM, registro
│   ├── compilacion-wsl.md      ← Guía de compilación WSL + documentación de scripts
│   └── checklist.md            ← Lista de verificación final de 75 puntos
└── scripts/
    ├── latex-linter.js         ← Análisis estático de estilo (Node.js)
    ├── latex-validator.js      ← Secuencia completa de compilación (Node.js)
    ├── legacy-manager.js       ← Utilidad de archivado de semanas (Node.js)
    └── pdf_cutter_template.py  ← Extractor de extractos bibliográficos (Python + PyMuPDF)
```

---

## Estándares de escritura aplicados por este skill

El skill aplica reglas de escritura basadas en evidencia en cada guía generada:

- **R1 — Longitud de oraciones** (Flesch-Kincaid / USU Engineering Writing Center): máx. ~20 palabras por oración en texto corrido; oraciones de más de 35 palabras deben dividirse con un conector causal explícito.
- **R2 — Consistencia terminológica**: cada término técnico se define una sola vez con `\keyterm{}` y se usa sin variación en toda la guía (sin sinónimos decorativos).
- **P4 — Intercalado** (Spacing research): el primer párrafo de cada sección de teoría (excepto la primera) conecta explícitamente con la sección anterior — estableciendo *por qué* se necesita la sección actual.
- **D1 — Principio de Coherencia** (Mayer): una figura TikZ O una tabla comparativa por sección — nunca ambas.
- **D2 — Contigüidad Espacial** (Mayer): cada figura se menciona con `\ref{}` en el párrafo inmediatamente anterior.

---

## Changelog

Consulta [CHANGELOG.md](CHANGELOG.md) para el historial completo de versiones.

**v10.3** — Integración completa de NotebookLM MCP (`re_auth`, `select_notebook`, `search_notebooks`, `source_format: "footnotes"`)  
**v10.1** — Arquitectura de divulgación progresiva: SKILL.md compacto + 6 archivos de referencia  
**v10.0** — Versión monolítica anterior (~1160 líneas)

---

## Política de privacidad

Este plugin se ejecuta **completamente de forma local** en tu computadora. No recopila, rastrea, almacena ni transmite ningún dato personal, telemetría ni contexto del código a servidores de terceros.

- **Consultas a NotebookLM**: Todas las consultas a NotebookLM se enrutan a través de tu propia instancia configurada del servidor MCP de NotebookLM. El plugin no intercepta, registra ni reenvía estas solicitudes.
- **Scripts locales**: Todos los scripts de validación y utilidad se ejecutan localmente en tu máquina (o dentro de tu entorno WSL local) y no se conectan a APIs externas.

---

## Licencia

MIT © 2026 — Consulta [LICENSE](LICENSE) para más detalles.

Las contribuciones son bienvenidas. Si adaptas este skill para tu institución, considera abrir un PR con tu ejemplo de configuración.
