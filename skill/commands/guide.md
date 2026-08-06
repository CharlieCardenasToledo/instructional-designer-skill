# `/jintia guide`

Genera o revisa una guía semanal. Produce exclusivamente `guide.json` como fuente
canónica; el HTML y el PDF se obtienen después mediante `render` y `compile`.

## Precondición obligatoria

**`guide` NO puede ejecutarse si el plan no fue aprobado.**

Verificar antes de cualquier acción:

```bash
node "<skill-root>/bin/jintia.js" plan check <curso> <semana>
```

Si el resultado es `approved: false`, mostrar el mensaje de estado y detener.
No generar `guide.json` sin plan aprobado.

## Lo que genera `guide`

```text
semanas/semana-XX/
├── guide.json       ← fuente canónica (este playbook)
├── reference.bib    ← bibliografía (si no existe)
└── figure/          ← carpeta de figuras (si no existe)
```

`guide` NO genera:
- archivos `.tex`
- carpetas `latex/`
- HTML libre fuera del pipeline
- archivos en rutas distintas a `semanas/semana-XX/`

## Uso determinista

```text
Intenciones que invocan este playbook:
/jintia guide week 3
/jintia guide revise week 4
/jintia guide week 5 --theme jintia-tecnico
$jintia-skill genera la guía de la semana 3
```

## Estructura mínima de guide.json

```json
{
  "metadata": {
    "course": "CC05A_IFT200",
    "week": 1,
    "topic": "Introducción a bases de datos",
    "outcome": "Resultado canónico del sílabo",
    "theme": "jintia-clasico",
    "bibliography": "reference.bib",
    "citationStyle": "apa"
  },
  "sections": [
    { "type": "orientation", "id": "orientacion", "title": "Propósito de la semana", "content": "..." },
    { "type": "theory",      "id": "enfoque-bd",  "title": "Enfoque de bases de datos", "content": "... {{cite:clave}}" },
    { "type": "practice",    "id": "diagnostico", "title": "Diagnóstico de redundancia", "content": "..." },
    { "type": "assessment",  "id": "comprobacion","title": "Comprobación del aprendizaje", "items": [] },
    { "type": "bibliography","id": "referencias" }
  ]
}
```

## Validaciones antes de guardar guide.json

1. El resultado coincide con el sílabo canónico.
2. Las actividades calificadas coinciden exactamente con el sílabo.
3. Toda cita `{{cite:clave}}` existe en `reference.bib`.
4. Toda afirmación disciplinar relevante tiene procedencia verificable.
5. Toda figura tiene `src` o `visualSpec`, `alt` y `caption`.
6. La bibliografía queda como último nodo.
7. No hay contenido LaTeX (documentclass, entorno document, archivos .tex).
8. No hay rutas `latex/`.

## Sintaxis de citas inline

```
{{cite:clave}}           → cita parentética: (Apellido, año)
{{cite:clave|narrative}} → cita narrativa: Apellido (año)
```

El nodo `{ "type": "bibliography" }` genera la lista final. No usar el nodo
`citation` deprecado.

## Flujo de cierre obligatorio

```bash
# 1. Validar
node "<skill-root>/bin/jintia.js" validate semanas/semana-XX/guide.json

# 2. Renderizar HTML
node "<skill-root>/bin/jintia.js" render semanas/semana-XX/guide.json

# 3. Lint HTML
node "<skill-root>/scripts/html-linter.js" semanas/semana-XX/guide.html

# 4. Preflight
node "<skill-root>/bin/jintia.js" preflight semanas/semana-XX/guide.html

# 5. Compilar PDF (si Vivliostyle disponible)
node "<skill-root>/bin/jintia.js" compile semanas/semana-XX/guide.json

# 6. Actualizar estado
node "<skill-root>/bin/jintia.js" plan approve <curso> <semana>
```

## Después de generar guide.json

Informar exactamente:
- Archivos creados (rutas absolutas)
- Validaciones ejecutadas y resultado
- Limitaciones reales encontradas (NotebookLM no disponible, figuras pendientes, etc.)
