# `/jintia guide`

Genera o revisa una guía semanal siguiendo el flujo principal de `SKILL.md`.
La guía se expresa como `guide.json` (fuente canónica neutral) y se convierte
en HTML semántico + PDF mediante el motor editorial HTML de Jintia.

## Ejemplos de intención

```text
/jintia guide week 3
/jintia guide revise week 4
/jintia guide week 5 --theme jintia-tecnico
```

## Formato de salida esperado

El modelo debe generar un `guide.json` válido según `schemas/guide.schema.json`.
No generar HTML libre directamente. La estructura mínima:

```json
{
  "metadata": {
    "course": "Nombre del Curso",
    "week": 3,
    "topic": "Tema de la semana",
    "outcome": "Resultado de aprendizaje canónico",
    "theme": "jintia-clasico",
    "bibliography": "reference.bib"
  },
  "sections": [
    { "type": "orientation", "title": "...", "content": "..." },
    { "type": "theory",      "title": "...", "content": "..." },
    { "type": "practice",    "title": "...", "content": "..." },
    { "type": "assessment",  "title": "...", "items": [] }
  ]
}
```

## Flujo de cierre obligatorio

La operación termina cuando:

1. `jintia validate guide.json` pasa sin errores.
2. `jintia render guide.json` genera `guide.html`.
3. `jintia compile guide.json` genera `guide.pdf` (si Vivliostyle está disponible).
4. `jintia preflight guide.pdf` verifica la paginación.
