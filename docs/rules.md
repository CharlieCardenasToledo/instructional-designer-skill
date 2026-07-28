# Reglas deterministas

El catálogo está en `skill/rules/catalog.json`. Cada regla tiene un ID estable,
categoría, severidad y descripción. El ejecutor es
`skill/scripts/rules-runner.js`.

Categorías actuales:

- `syllabus`: contrato y campos mínimos del sílabo;
- `alignment`: conexión entre resultado y evidencia semanal;
- `bibliography`: claves citadas y `reference.bib`;
- `latex`: estructura de figuras y referencias;
- `accessibility`: caption y texto alternativo;
- `template`: clase y archivos requeridos.

Uso:

```bash
npx jintia audit README.md
npx jintia audit guia.tex --json
npx jintia audit guia.tex --strict
```

`--strict` convierte también las advertencias en fallo de proceso. Las reglas
no sustituyen la revisión pedagógica del agente; aportan una base reproducible.
