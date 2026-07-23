# instructional-designer-skill

> **Claude Code skill** for evidence-based, self-paced instructional design.  
> Creates weekly LaTeX guides, self-instructional modules, and aligned assessments for higher education — with NotebookLM MCP integration.

[![Version](https://img.shields.io/badge/version-10.3-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Category](https://img.shields.io/badge/category-pedagogy--design-green.svg)]()
[![Frameworks](https://img.shields.io/badge/frameworks-UDL%203.0%20%7C%20Backward%20Design%20%7C%20QM%207th%20Ed-purple.svg)]()

<p align="center">
  <img src="docs/images/preview.png" alt="Instructional Designer Skill — notebook with equations, diagrams and pedagogical schemas" width="100%">
</p>

---

## What This Skill Does

This skill guides Claude Code to produce **weekly self-instructional guides in LaTeX** at a consistent quality standard. Each guide is a set of modular `.tex` files, ready to compile, with:

- Institutional color palette via the **ElegantBook** LaTeX class
- Semantic **TikZ diagrams** that reduce cognitive load
- **APA 7th ed.** bibliography with `biblatex` + `biber`
- **NotebookLM MCP** integration for bibliographic validation at every session start
- Five pedagogical block environments (`softblock`, `accentblock`, `mintblock`, `sandblock`, `roseblock`)
- Evidence-based writing rules (Flesch-Kincaid, Mayer's Multimedia Principles, Spacing/Interleaving research)

**14+ months** of real classroom use across multiple courses, refined through iterative feedback from actual guide production cycles.

---

## Pedagogical Frameworks

| Framework | Role |
|---|---|
| **UDL 3.0** (CAST, 2024) | Multiple means of representation, engagement, action & expression |
| **Backward Design** (Wiggins & McTighe) | Learning outcomes first, then assessment, then content |
| **Quality Matters 7th Ed.** | Alignment of outcomes, activities, and materials |
| **WCAG 2.2** | Accessibility in digital and printed materials |
| **Mayer's Multimedia Principles** | Coherence, Signaling, Spatial Contiguity, Segmenting |
| **Spacing / Interleaving Research** | Explicit cross-section narrative connectors |

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Claude Code** | [docs.anthropic.com/claude-code](https://docs.anthropic.com/en/docs/claude-code/overview) |
| **NotebookLM MCP** | [PleasePrompto/notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp) — required for bibliographic validation |
| **TeX Live** (via WSL on Windows) | `pdflatex` + `biber` — install in WSL/Debian: `sudo apt install texlive-full` |
| **ElegantBook class** | Included in your course repository or available at [ElegantBook releases](https://github.com/ElegantLaTeX/ElegantBook/releases) |
| **Node.js** | For `latex-validator.js` and `legacy-manager.js` scripts |
| **Python 3 + PyMuPDF** | For `pdf_cutter_template.py`: `pip install pymupdf` |
| **WSL** (Windows only) | Windows Subsystem for Linux — required for LaTeX compilation on Windows |

> **NotebookLM Knowledge Base**: Before using this skill, upload your course bibliography (PDFs of textbooks, articles, technical documentation) to a NotebookLM notebook. The skill queries this knowledge base at every session start to validate bibliographic content. Without sources in NotebookLM, Step 2 of the startup flow will return empty responses.

---

## Installation

### 1. Clone the repository

```bash
# Option A: Personal skills (available across ALL your projects)
# macOS / Linux
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill \
  ~/.claude/skills/instructional-designer-skill

# Windows (PowerShell)
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill `
  "$env:USERPROFILE\.claude\skills\instructional-designer-skill"
```

```bash
# Option B: Project-scoped (only this project's .claude/skills/)
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill \
  .claude/skills/instructional-designer-skill
```

> **After installation**, Claude Code detects the skill automatically — no restart needed if the `~/.claude/skills/` directory already existed.

### Usage

Once installed, you can invoke the skill in two ways inside Claude Code:

- **Automatic**: Claude loads it when your request matches the `description` (e.g. "Create the week 3 guide for my database course")
- **Manual slash command**: type `/instructional-designer-skill` in the chat


### 2. Configure your institution (required)

Open these files and fill in the `⚙️ CONFIGURE` markers:

**`references/bibliografia.md`** — NotebookLM registry:
```markdown
| MY_COURSE_001 — Course Name | `01 MY_COURSE_001/` | `your-notebook-id` | https://notebooklm.google.com/notebook/... |
```

**`references/plantilla-latex.md`** — institutional metadata:
```latex
\author{Your Full Name, Degree}
\extrainfo{Your Faculty\\Your Institution Name}
\logo{figure/logo-institution.png}
\definecolor{weekaccent}{RGB}{R,G,B}  % Your institution's primary color
```

### 3. Set up NotebookLM MCP

Follow the [notebooklm-mcp setup guide](https://github.com/PleasePrompto/notebooklm-mcp) to authenticate and configure the MCP server in Claude Code.

### 4. Prepare your course repository structure

```
01 MY_COURSE_001/
├── README.md              ← Canonical syllabus (topics, learning outcomes, bibliography by week)
├── bibliografia/
│   ├── *.pdf              ← Source textbooks
│   └── recortes_por_semana/
│       └── semana-XX/     ← PDF excerpts cited in each guide
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

## How It Works

### Startup Flow (every session)

```
1. Read course README.md  →  extract week data (topics, LOs, bibliography, activities)
2. Authenticate NotebookLM MCP  →  query the course notebook for bibliographic validation
3. Extract week fields  →  map README fields to LaTeX elements
4. Verify/create folder structure  →  scaffold semana-XX/latex/sections/
5. Determine theory sections  →  one file per bullet in "Tema / contenido semanal"
6. Confirm plan with user  →  section list, sources, missing data
```

### Document Structure

```
sections/
  01-introduccion.tex       ← Editorial opening, ASU alignment, no LO lists
  02-[topic-1].tex          ← Theory: one concept/pattern per file
  03-[topic-2].tex          ← Theory: cross-section interleaving connector
  ...
  N+1-escenario.tex         ← Synthesis case study (always after ALL theory)
  N+2-aplicacion.tex        ← Retrieval practice + professional transfer
  N+3-bibliografia.tex      ← References (always last, sequential numbering)
```

### CLI Scripts

| Script | Usage |
|---|---|
| `latex-linter.js` | Performs static analysis checking for sentence length (R1), forbidden AI tropes, invalid LaTeX syntax, placeholder presence, and signaling consistency (R2). |
| `latex-validator.js` | Executes `latex-linter.js` first, then performs the full 3-pass LaTeX compilation sequence via WSL (`pdflatex → biber → pdflatex → pdflatex`) and captures HTML screenshots if applicable. |
| `legacy-manager.js` | Archives current week content to a timestamped subfolder under `legacy/` (e.g. `legacy/archive_YYYY-MM-DD_HH-MM-SS`) to prevent collisions before restructuring. |
| `pdf_cutter_template.py` | Extracts page ranges from source PDFs into `bibliografia/recortes_por_semana/semana-XX/`. |

Replace `[SKILL_PATH]` with the path where you cloned the skill:
- macOS/Linux: `~/.claude/skills/instructional-designer-skill`
- Windows: `$env:USERPROFILE\.claude\skills\instructional-designer-skill`

```powershell
# Run the style linter on a LaTeX guide
node [SKILL_PATH]/scripts/latex-linter.js "01 MY_COURSE/semanas/semana-03/latex/guia-semana-03.tex"

# Compile a guide (runs the linter first, then runs full 3-pass sequence)
node [SKILL_PATH]/scripts/latex-validator.js "01 MY_COURSE/semanas/semana-03/latex/guia-semana-03.tex"

# Archive a week to a timestamped folder before restructuring
node [SKILL_PATH]/scripts/legacy-manager.js "01 MY_COURSE/semanas/semana-03"

# Cut bibliography excerpts (edit cuts[] array first)
pip install -r [SKILL_PATH]/requirements.txt   # first time only
python [SKILL_PATH]/scripts/pdf_cutter_template.py
```

---

## Trigger Examples

The skill activates automatically when you mention:

```
"Create the week 3 guide for MY_COURSE_001"
"Generate the self-instructional module for unit 2, week 5"
"Write the weekly guide for the topic of database normalization"
"Add a TikZ diagram to semana-04/sections/03-normalization.tex"
```

---

## Skill Configuration Reference

| Setting | Location | Default |
|---|---|---|
| Institution name & campus | `SKILL.md` frontmatter | `YOUR_INSTITUTION_NAME` |
| NotebookLM notebook registry | `references/bibliografia.md` | Empty template |
| Author name & institutional metadata | `references/plantilla-latex.md` | Configurable placeholders |
| Institutional color (RGB) | `references/plantilla-latex.md` | `RGB{0,121,107}` (example) |
| Week accent color | `weekaccent` in preamble | Same as institutional color |
| Institutional digital ecosystem | `SKILL.md` — "Anclaje Institucional" | Generic categories |

---

## Repository Structure

```
instructional-designer-skill/
├── SKILL.md                    ← Skill definition (frontmatter + full workflow)
├── README.md                   ← This file
├── CHANGELOG.md                ← Version history
├── LICENSE                     ← MIT
├── references/
│   ├── plantilla-latex.md      ← LaTeX preamble, blocks, canonical patterns
│   ├── figuras-tikz.md         ← TikZ diagrams, ER models (Chen notation)
│   ├── figuras-html.md         ← HTML UI mockups + Puppeteer PNG capture
│   ├── bibliografia.md         ← Citation policy, NotebookLM workflow, registry
│   ├── compilacion-wsl.md      ← WSL compilation guide + script docs
│   └── checklist.md            ← 75-point final verification checklist
└── scripts/
    ├── latex-validator.js      ← Full compilation sequence (Node.js)
    ├── legacy-manager.js       ← Week archiving utility (Node.js)
    └── pdf_cutter_template.py  ← Bibliography excerpt cutter (Python + PyMuPDF)
```

---

## Writing Standards Enforced by This Skill

The skill enforces evidence-based writing rules in every generated guide:

- **R1 — Sentence length** (Flesch-Kincaid / USU Engineering Writing Center): max ~20 words per sentence in running text; sentences over 35 words must be split with an explicit causal connector.
- **R2 — Terminological consistency**: each technical term is defined once with `\keyterm{}` and used without variation throughout the guide (no decorative synonyms).
- **P4 — Interleaving** (Spacing research): the first paragraph of each theory section (except the first) explicitly connects to the previous section — establishing *why* the current section is needed.
- **D1 — Coherence Principle** (Mayer): one TikZ figure OR one comparative table per section — never both.
- **D2 — Spatial Contiguity** (Mayer): every figure is mentioned by `\ref{}` in the paragraph immediately preceding it.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**v10.3** — NotebookLM MCP full integration (`re_auth`, `select_notebook`, `search_notebooks`, `source_format: "footnotes"`)  
**v10.1** — Progressive disclosure architecture: compact SKILL.md + 6 reference files  
**v10.0** — Previous monolithic version (~1,160 lines)

---

## Privacy Policy

This plugin runs **entirely locally** on your computer. It does not collect, track, store, or transmit any personal data, telemetry, or codebase context to third-party servers.

- **NotebookLM Queries**: All queries sent to NotebookLM are routed through your own configured NotebookLM MCP server instance. The plugin does not intercept, log, or forward these requests.
- **Local Scripts**: All validation and utility scripts run locally on your machine (or within your local WSL environment) and do not connect to external APIs.

---

## License

MIT © 2026 — See [LICENSE](LICENSE) for details.

Contributions welcome. If you adapt this skill for your institution, consider opening a PR with your configuration example.
