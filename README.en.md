# Instructional Designer

<p align="right">
  <a href="README.md">🇪🇸 Español</a>
</p>

Desktop application and skill for turning a university syllabus into a
structured course and publication-ready weekly learning guides.

[![Version](https://img.shields.io/badge/version-10.4.0-00796b.svg)](CHANGELOG.md)
[![Windows](https://img.shields.io/badge/Windows-EXE%20%7C%20MSI-2563eb.svg)](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases)
[![macOS](https://img.shields.io/badge/macOS-DMG-111827.svg)](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-f59e0b.svg)](LICENSE)

## Project goal

Preparing an instructional-design environment often requires installing
several tools, editing configuration files, connecting NotebookLM, and
organizing every course by hand. This project brings that workflow together
in one product:

- **Instructional Designer Manager** installs and configures the environment
  through a desktop interface.
- **`instructional-designer-skill`** guides Claude Code in producing syllabi,
  LaTeX guides, activities, and assessments based on explicit pedagogical and
  editorial criteria.

The application does not replace the skill. It is the installer, configuration
assistant, and course-management surface. The skill remains the engine that
interprets course information and produces the academic material.

```text
Download and install the application
                ↓
Configure the institution, tools, and NotebookLM
                ↓
Create a course and structure its syllabus
                ↓
Install or export the skill
                ↓
Work with Claude Code
                ↓
Generate and validate weekly PDF guides
```

## Application tour

### 1. Guided setup

The onboarding explains the expected outcome and verifies every requirement
before the main dashboard becomes available.

![Instructional Designer Manager onboarding](docs/images/app/onboarding.png)

### 2. Course management

The dashboard registers courses and creates their folder structure. It shows a
local `Draft` or `With content` summary based on saved weekly data; it is not
an editorial production tracker.

![Course dashboard](docs/images/app/dashboard.png)

### 3. Institutional identity

The application stores the instructor, institution, academic program, and
visual palette used by generated documents.

![Institution settings](docs/images/app/settings.png)

### 4. Editorial template

The current release includes `ElegantBook Clásico`, a technical LaTeX template
whose primary color follows the institution settings. The architecture can
support additional templates in future releases.

![LaTeX template selector](docs/images/app/templates.png)

## What the application handles

- Checks Node.js, Python, Git, and a LaTeX compiler.
- On Windows, requests permission before starting an installation through
  `winget`; on macOS and Linux it provides manual instructions.
- Configures institutional metadata and visual identity.
- Connects NotebookLM MCP without overwriting other MCP configuration.
- Installs the skill for Claude Code or exports it for other targets.
- Creates the canonical course structure.
- Converts weekly syllabus content into a structured `README.md`.
- Activates and previews the included LaTeX template.
- Keeps course data, configuration, files, and compilation local.

## What the skill produces

Once installed, the skill guides the creation of:

- modular weekly guides in LaTeX;
- aligned outcomes, activities, and assessments;
- semantic TikZ diagrams;
- APA 7 bibliographies with `biblatex` and `biber`;
- retrieval, transfer, and professional-application sections;
- documents validated before final compilation.

The editorial workflow applies UDL 3.0, Backward Design, Quality Matters 7,
WCAG 2.2, Mayer's multimedia principles, and spacing and interleaving
practices.

## Installation

### Recommended: desktop application

Direct downloads for version 10.4.0:

| Platform | Installer | Download |
|---|---|---|
| Windows 10/11 x64 | NSIS `.exe` — recommended | [Download EXE](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/download/v10.4.0/Instructional.Designer.Manager_1.0.0_x64-setup.exe) |
| Windows 10/11 x64 | Windows Installer `.msi` | [Download MSI](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/download/v10.4.0/Instructional.Designer.Manager_1.0.0_x64_en-US.msi) |
| Apple Silicon macOS | `.dmg` disk image | [Download DMG](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/download/v10.4.0/Instructional.Designer.Manager_1.0.0_aarch64.dmg) |

You can also browse the
[latest release](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/latest).
After installing the application, complete the onboarding and choose whether
to install the skill locally or export it.

> The current DMG is not signed or notarized and may trigger a Gatekeeper
> warning. Signing requires Apple credentials and is not yet part of the
> public workflow.

### Advanced: manual installation

This path is intended for development or users who prefer to manage the skill
directly.

```bash
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill.git
```

Copy or link **the contents of `skill/`** into:

```text
Windows: %USERPROFILE%\.claude\skills\instructional-designer-skill
macOS:   ~/.claude/skills/instructional-designer-skill
Linux:   ~/.claude/skills/instructional-designer-skill
```

The installed directory must contain `SKILL.md`, `config/`, `references/`,
`scripts/`, and `templates/` directly at its root. `agents/` and
`.claude-plugin/` are repository metadata and are not required by Claude Code
at runtime. The `app/` directory should not be copied.

## Usage

After installation, Claude Code can activate the skill automatically when a
request matches its scope:

```text
Create the week 3 guide for Database Systems.
Generate the self-paced module for unit 2.
Structure the syllabus and its weekly activities.
Validate and compile the guide as a PDF.
```

It can also be invoked explicitly as `/instructional-designer-skill`.

## Editorial workflow

1. Read the canonical course `README.md`.
2. Identify the week's topics, outcomes, activities, and bibliography.
3. Query available sources through NotebookLM MCP.
4. Propose the section structure and confirm missing information.
5. Generate modular LaTeX files.
6. Apply editorial and accessibility rules.
7. Compile and review the PDF.

The resulting structure follows a predictable sequence:

```text
semanas/semana-XX/latex/
├── guia-semana-XX.tex
├── sections/
│   ├── 01-introduccion.tex
│   ├── 02-tema-principal.tex
│   ├── 03-tema-relacionado.tex
│   ├── 04-escenario.tex
│   ├── 05-aplicacion.tex
│   └── 06-bibliografia.tex
└── figure/
```

## Application development

The application uses Tauri 2, Rust, Vite, and Tailwind CSS 4.

```bash
cd app/desktop
npm ci
npm test
npm run tauri:dev
```

To generate installers locally:

```bash
npm run tauri:build
```

Tauri writes platform artifacts to
`app/desktop/src-tauri/target/release/bundle/`.

## Automated releases

The GitHub Actions workflows run tests before packaging:

- `release-windows.yml` generates an NSIS `.exe` and Windows Installer `.msi`.
- `release-macos.yml` generates a `.dmg`.

When a `v*` tag is created, the artifacts are attached to the corresponding
GitHub Release. A manual run validates the build and retains workflow
artifacts, but does not publish a Release.

## Repository structure

```text
instructional-designer-skill/
├── app/
│   └── desktop/            Tauri application and frontend
├── skill/                  Installable skill package
│   ├── SKILL.md            Main workflow
│   ├── agents/             Configuration for other agents
│   ├── config/             Configuration schemas
│   ├── references/         Pedagogical and editorial rules
│   ├── scripts/            Linters, validators, and utilities
│   └── templates/          LaTeX editorial templates
├── docs/                   Guides and application screenshots
└── .github/workflows/      Installer build automation
```

## Privacy

The application includes no telemetry and does not send courses to a
project-owned server. File operations, validation, and compilation run
locally. NotebookLM queries are sent to Google services through the MCP
configured by the user. Website palette extraction and dependency
installation also require network access. An exported ZIP may contain
institution settings and notebook references; inspect it before sharing.

## Additional documentation

- [Application technical guide](app/desktop/README.md)
- [Using the project with Claude Code, Claude Skills, Projects, and Cowork](docs/guia-claude-desktop.md)
- [Architecture](docs/architecture.md)
- [Release process](docs/releasing.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Version history](CHANGELOG.md)
- [MIT License](LICENSE)

MIT © 2026 Charlie Cárdenas Toledo.
