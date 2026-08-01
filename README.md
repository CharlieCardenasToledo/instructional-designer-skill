# Jintia Skill

Skill abierta de diseño instruccional para producir guías académicas completas,
verificables y compilables con Claude, ChatGPT y Codex.

La aplicación instaladora vive ahora en un repositorio independiente:
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).
Este repositorio contiene únicamente la skill, sus plantillas, runtime, pruebas
y artefactos de distribución.

## Qué hace

Jintia transforma el sílabo, la configuración institucional y fuentes
verificables en guías semanales LaTeX. Incluye:

- planificación instruccional y trazabilidad de evidencia;
- plantillas ElegantBook y Kaohandt;
- validación de esquemas, LaTeX y calidad visual;
- generación visual con fallbacks reproducibles;
- integración opcional con NotebookLM;
- contratos de agentes especializados para investigación, revisión y acabado.

## Instalación

### Con Jintia Desktop

Descarga el instalador desde las
[releases de Jintia Desktop](https://github.com/CharlieCardenasToledo/jintia-desktop/releases).
La aplicación instala y actualiza una release verificada de la skill, conservando
la configuración personal.

### Manual

Cada [release](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases)
publica tres archivos verificables:

- `jintia-skill-X.Y.Z.zip`, para Claude;
- `jintia-openai-plugin-X.Y.Z.zip`, para ChatGPT y Codex;
- `jintia-release-manifest.json`, con compatibilidad, versiones y SHA-256.

Extrae el primer ZIP como `~/.claude/skills/jintia-skill`, o importa el plugin
universal mediante el gestor de plugins compatible. `SKILL.md` debe quedar en
la raíz de la skill instalada.

## NotebookLM MCP

La integración usa la versión fijada de
[`@charlie.act7/gemini-notebook-mcp`](https://www.npmjs.com/package/@charlie.act7/gemini-notebook-mcp),
también mantenida por Charlie Cárdenas Toledo. La release 10.9.2 fija la versión
2.3.3 y requiere Node.js 22.13 o superior. No se usa `@latest`.

## Desarrollo

```bash
npm ci
npm run docs:check
npm run skill:check
npm run release:check
npm run release:skill
npm run release:skill:check
```

Validación estructural para Codex:

```bash
python -X utf8 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skill
```

Los tags `v*` ejecutan las pruebas, construyen los dos ZIP desde los blobs
canónicos de Git y publican el manifest, checksums y attestations de procedencia.

## Estructura

```text
skill/          Skill autocontenida, runtime, plantillas y pruebas
openai-plugin/  Empaque universal para ChatGPT y Codex
packages/       Fachadas y utilidades compartidas de la toolchain
release/        Esquema y configuración del contrato de publicación
scripts/        Verificación y construcción reproducible
```

## Origen del nombre

Jintia toma su nombre de **Jíntia**, palabra registrada en Shuar Chicham con el
significado de «camino». **Aarma jintia** aparece en el Currículo Nacional
Intercultural Bilingüe de la Nacionalidad Shuar para referirse a textos
instructivos. El uso del nombre no implica representación, aprobación ni
vinculación institucional con comunidades u organizaciones del pueblo Shuar.

Consulta [`docs/brand-guidelines.md`](docs/brand-guidelines.md) para la
atribución y fuentes completas.

## Licencia

MIT © 2026 Charlie Cárdenas Toledo. Las plantillas y recursos de terceros
conservan sus licencias propias; consulta [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
