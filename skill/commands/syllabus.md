# `/jintia syllabus`

Gestiona el sílabo canónico. La primera operación disponible valida el contrato
antes de generar materiales:

```bash
node "<skill-root>/bin/jintia.js" syllabus validate ./curso/README.md
```

La validación comprueba los campos que la skill usa para resolver semanas,
resultados, actividades, horas y bibliografía.
