# Hooks locales

Los hooks son opt-in y no modifican archivos automáticamente. Se pueden
invocar desde un editor, CI o una integración de agente:

```bash
npx jintia hook post-edit --changed curso/README.md guia.tex
npx jintia hook pre-compile guia.tex
```

`post-edit` revisa archivos compatibles y `pre-compile` aplica las reglas en
modo estricto antes de iniciar una compilación.
