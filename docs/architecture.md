# Arquitectura de Jintia Skill

```text
SKILL.md
  ├─ references/   conocimiento cargado bajo demanda
  ├─ agents/       contratos de delegación
  ├─ templates/    plantillas y recursos LaTeX
  ├─ scripts/      validación, compilación y pipeline visual
  ├─ runtime/      curso, estado e integración con harnesses
  ├─ config/       configuración y catálogos versionados
  └─ schemas/      contratos JSON
```

La skill es autocontenida: una instalación no depende de este checkout ni de
Jintia Desktop. `packages/` expone fachadas de compatibilidad para la CLI y las
pruebas sin duplicar la implementación canónica de `skill/runtime/core`.

## Distribución

El repositorio publica dos vistas del mismo contenido:

- `jintia-skill-X.Y.Z.zip`, con raíz `jintia-skill`, para Claude;
- `jintia-openai-plugin-X.Y.Z.zip`, con raíz `jintia`, para ChatGPT y Codex.

`jintia-release-manifest.json` declara compatibilidad, versión mínima de
Desktop, contrato MCP, tamaños y SHA-256. Jintia Desktop consume únicamente
este contrato público y nunca importa el árbol fuente.

## Versionado

`skill/package.json`, los manifiestos Claude/OpenAI y el tag `vX.Y.Z` comparten
la versión de la skill. La aplicación se versiona por separado en
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).
