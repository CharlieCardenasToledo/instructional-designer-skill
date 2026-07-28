# `/jintia audit`

Realiza una revisión global sin modificar archivos mediante reglas deterministas.

```bash
npx jintia audit curso/README.md
npx jintia audit semanas/semana-03/latex/guia-semana-03.tex --json
npx jintia audit guia.tex --strict
```

Cada incidencia conserva código, categoría, severidad, archivo, línea y
recomendación implícita en el catálogo `rules/catalog.json`.
