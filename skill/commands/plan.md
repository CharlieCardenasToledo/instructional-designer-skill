# `/jintia plan`

Planifica una semana instruccional antes de escribir cualquier archivo.
El plan es un paso técnico obligatorio: `guide` no puede ejecutarse sin un plan aprobado.

## Cuándo usar este playbook

Cuando el usuario escribe `/jintia plan` o `$jintia-skill planifica la semana N`.

## Precondiciones

1. `README.md` existe y pasa `jintia syllabus validate`.
2. La semana solicitada existe en el sílabo (no se inventa).
3. La compuerta de evidencia se verificó: `jintia evidence check <curso> <semana>`.

Si alguna precondición falla, informar claramente y detener.

## Lo que hace `plan`

1. Extraer el contrato semanal del sílabo (tema, resultado, actividades, horas).
2. Verificar NotebookLM según el flujo de `references/bibliografia.md`.
3. Identificar evidencia disponible (verificada) y evidencia faltante.
4. Mostrar el plan al usuario para aprobación.
5. Guardar el plan: `jintia plan save <curso> <semana>`.
6. Esperar aprobación explícita del usuario.
7. Después de aprobación: `jintia plan approve <curso> <semana>`.

## Lo que `plan` NO hace

- NO crea archivos de guía (`guide.json`, `reference.bib`).
- NO genera contenido académico.
- NO inventa semanas que no estén en el sílabo.
- NO continúa si la evidencia está bloqueada.

## Salida normalizada del plan

```json
{
  "course": "CC05A_IFT200",
  "week": 1,
  "topic": "Introducción a bases de datos",
  "outcomes": {
    "teaching": "Diferenciar el enfoque de bases de datos...",
    "practice": "Diagnosticar redundancia...",
    "autonomous": "Investigar la evolución..."
  },
  "evidence": [
    {
      "source": "Beynon-Davies (2018)",
      "status": "verified",
      "location": "bibliografia/beynon-davies.pdf"
    }
  ],
  "missingEvidence": [
    "Material ASU IFT-200 Module 1"
  ],
  "plannedFiles": [
    "semanas/semana-01/guide.json",
    "semanas/semana-01/reference.bib",
    "semanas/semana-01/figure/"
  ],
  "status": "pending"
}
```

## Estados del plan

| Estado | Significado |
|---|---|
| `pending`   | Plan calculado, esperando aprobación del usuario |
| `blocked`   | Evidencia insuficiente; resolver fuentes primero |
| `approved`  | Usuario aprobó el plan; se puede generar guide.json |
| `generated` | guide.json fue creado con éxito |

## Flujo ante NotebookLM no disponible

```
get_health
↓
si falla → re_auth una vez
↓
si vuelve a fallar → registrar NotebookLM como no disponible
↓
revisar fuentes locales (reference.bib, recortes, bibliografía)
↓
si ninguna fuente → bloquear con JIN-EVD-001
```

Código JIN-EVD-002 si el agente intenta sustituir evidencia por conocimiento genérico.

## Uso determinista (CLI)

```bash
# Guardar plan desde JSON
node "<skill-root>/bin/jintia.js" plan save ./curso 01 --file plan.json

# Aprobar plan (después de que el usuario confirme)
node "<skill-root>/bin/jintia.js" plan approve ./curso 01

# Verificar estado antes de guide
node "<skill-root>/bin/jintia.js" plan check ./curso 01

# Ver detalle del plan
node "<skill-root>/bin/jintia.js" plan status ./curso 01
```

## Siguiente paso

Una vez aprobado (`plan approve`), procede con `commands/guide.md`.
