# Arquitectura

## Visión general

```text
Usuario
  └─ Jintia Desktop
       ├─ configura institución y NotebookLM
       ├─ crea estructura y sílabo del curso
       ├─ instala skill → ~/.claude/skills/jintia-skill
       └─ exporta ZIP → Claude Customize / Skills

Claude + jintia-skill
  ├─ lee README del curso
  ├─ consulta evidencia local o NotebookLM
  ├─ genera LaTeX modular
  └─ valida y compila la guía
```

La app administra el entorno; la skill ejecuta el razonamiento instruccional.

## Límites de componentes

### `app/desktop`

Frontend Vite/Tailwind y backend Tauri/Rust. `src/api.js` desacopla las páginas
de los comandos Rust. El modo mock sustituye únicamente esa frontera.

### `skill`

Paquete autocontenido con:

- `SKILL.md`: flujo y reglas centrales;
- `references/`: conocimiento cargado bajo demanda;
- `templates/`: contrato y assets LaTeX;
- `scripts/`: validación, compilación y utilidades;
- `config/`: ejemplos y esquemas.

`agents/` y `.claude-plugin/` describen integraciones, pero no forman parte del
payload mínimo exportado por la app.

## Persistencia

| Dato | Ubicación |
|---|---|
| Cursos del panel | `localStorage` de la WebView |
| Onboarding y preferencias | Directorio de configuración de la app |
| Institución y notebooks | Directorio de configuración y skill instalada |
| Curso, sílabo y guías | Carpeta elegida por el usuario |
| Skill local | `~/.claude/skills/jintia-skill` |

## Red

Las operaciones locales no usan un backend del proyecto. Sí acceden a red la
autenticación y consultas NotebookLM, la extracción de paleta, la instalación
de dependencias y las operaciones de GitHub.

## Decisiones canónicas

- README principal en español y traducción inglesa separada.
- Catálogo de plantillas embebidas: `elegantbook-clasico` y
  `kaohandt-marginal`. La plantilla activa se conserva en la configuración
  institucional y se aplica al generar o compilar documentos.
- Archivo semanal: `guia-semana-XX.tex`.
- NotebookLM MCP: `@charlie.act7/gemini-notebook-mcp@2.0.0`.
- La configuración generada debe validar contra los esquemas de `skill/config`.

## Versionado

La skill y la aplicación se versionan de forma independiente:

- `skill/package.json` contiene la versión distribuible de `jintia-skill`
  (`10.8.0` en la versión actual).
- `package.json`, `app/desktop/package.json` y Tauri contienen la versión de
  la aplicación (`1.0.0` en la versión actual).

Esta separación permite actualizar el paquete de instrucciones sin obligar a
publicar una nueva aplicación de escritorio, o actualizar la aplicación sin
cambiar el contenido de la skill.
