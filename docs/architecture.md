# Arquitectura

## Visión general

```text
Usuario
  └─ Instructional Designer Manager
       ├─ configura institución y NotebookLM
       ├─ crea estructura y sílabo del curso
       ├─ instala skill → ~/.claude/skills/instructional-designer-skill
       └─ exporta ZIP → Claude Customize / Skills

Claude + instructional-designer-skill
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
| Skill local | `~/.claude/skills/instructional-designer-skill` |

## Red

Las operaciones locales no usan un backend del proyecto. Sí acceden a red la
autenticación y consultas NotebookLM, la extracción de paleta, la instalación
de dependencias y las operaciones de GitHub.

## Decisiones canónicas

- README principal en español y traducción inglesa separada.
- Una plantilla embebida: `elegantbook-clasico`.
- Archivo semanal: `guia-semana-XX.tex`.
- NotebookLM MCP: `@charlie.act7/gemini-notebook-mcp@2.0.0`.
- La configuración generada debe validar contra los esquemas de `skill/config`.
