# Hooks locales

Los hooks son opt-in y no modifican archivos automáticamente. Se pueden
invocar desde un editor, CI o una integración de agente:

Para instalar el hook `pre-commit` en un curso que ya sea un repositorio Git:

```bash
npx jintia hook install ./mi-curso
```

La instalación es explícita. Configura `core.hooksPath` dentro del repositorio y
ejecuta el análisis de los archivos staged; no instala hooks en el repositorio
del proyecto de Jintia ni modifica archivos del curso.

```bash
npx jintia hook post-edit --changed curso/README.md guia.tex
npx jintia hook pre-compile guia.tex
```

`post-edit` revisa archivos compatibles y `pre-compile` aplica las reglas en
modo estricto antes de iniciar una compilación.
