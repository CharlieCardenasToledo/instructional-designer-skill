---
id: BHV-SEM-004
name: visual-by-cognitive-function
severity: medium
category: visual
description: El agente elige la representación visual basándose en la operación cognitiva que debe soportar, no en la decoración.
heuristic: none
---

# BHV-SEM-004 — Visual por función cognitiva

## Hipótesis de comportamiento

Cada figura en la guía debe responder a una necesidad cognitiva concreta
(comparar, clasificar, secuenciar, identificar partes, ver tendencias).
El agente no añade figuras por completitud visual ni elige un tipo de gráfico
sin justificar su función pedagógica.

## Escenario de activación

El agente genera una guía que incluye al menos un nodo `figure`. Se evalúa:
1. El contenido teórico inmediatamente previo a cada figura.
2. El campo `alt` de la figura.
3. El campo `caption` de la figura.
4. Si existe un `visual-spec.json` asociado, su campo `cognitiveFunction`.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| El `alt` describe QUÉ muestra la figura (no "diagrama" genérico) | 30 | `alt` identifica entidades, relaciones o datos específicos del tema |
| El `caption` conecta la figura con el RA o el argumento previo | 25 | `caption` usa palabras del RA o nombra el concepto que ilustra |
| El párrafo previo menciona explícitamente la figura por su `id` | 25 | El `content` del nodo previo contiene `[fig-<id>]` |
| La figura no es decorativa (no ilustra algo ya cubierto completamente en texto) | 20 | La figura añade información que el texto no transmite solo con palabras |

**Puntuación mínima para pasar: 70 / 100**

## Output que pasa ✓

```json
{
  "type": "theory",
  "content": "La Figura [fig-normalizacion] muestra el proceso completo: un esquema con redundancias se transforma en 1FN eliminando grupos repetidos, en 2FN eliminando dependencias parciales y en 3FN eliminando dependencias transitivas.",
  "pagination": "splittable"
},
{
  "type": "figure",
  "id": "fig-normalizacion",
  "src": "figure/normalizacion-proceso.svg",
  "alt": "Diagrama de flujo con tres columnas: esquema sin normalizar (atributos multivaluados), esquema en 1FN (valores atómicos) y esquema en 3FN (sin dependencias transitivas). Flechas muestran las transformaciones entre cada estado.",
  "caption": "Proceso de normalización: de un esquema con redundancias a 3FN."
}
```

## Output que falla ✗

```json
{
  "type": "figure",
  "id": "fig-decorativa",
  "src": "figure/bd-icon.png",
  "alt": "Imagen ilustrativa de una base de datos.",
  "caption": "Figura 1."
}
```

Falla porque:
1. El `alt` es genérico ("ilustrativa").
2. El `caption` no identifica qué información transmite.
3. Ningún párrafo previo menciona `[fig-decorativa]`.
4. La imagen no añade información cognitiva al texto.
