# `/jintia audit`

Realiza una revisión global sin modificar archivos mediante reglas deterministas.

```bash
node "<skill-root>/bin/jintia.js" audit curso/README.md
node "<skill-root>/bin/jintia.js" audit semanas/semana-03/latex/guia-semana-03.tex --json
node "<skill-root>/bin/jintia.js" audit guia.tex --strict
```

Cada incidencia conserva código, categoría, severidad, archivo, línea y
recomendación implícita en el catálogo `rules/catalog.json`.
