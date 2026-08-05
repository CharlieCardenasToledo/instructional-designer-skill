# Generar una guía semanal

El flujo completo desde el sílabo hasta el PDF tiene cuatro pasos.

## 1. Planificar antes de escribir

Pide a Jíntia que planifique la semana antes de crear archivos:

```
/jintia guía semana 3
```

Jíntia mostrará una propuesta con:

- Resultado de aprendizaje derivado del sílabo
- Evidencia verificable consultada en NotebookLM
- Tipos de sección sugeridos (orientación, teoría, práctica, evaluación)
- Tema HTML recomendado según la asignatura

Confirma o ajusta la propuesta antes de continuar.

## 2. Generar el `guide.json`

La fuente canónica de cada guía es un archivo `guide.json`. Jíntia lo genera
automáticamente, pero también puedes editarlo a mano:

```json
{
  "metadata": {
    "course": "IFT200",
    "week": 3,
    "topic": "Modelo Entidad-Relación",
    "outcome": "El estudiante diseña un MER para un dominio de negocio real.",
    "theme": "jintia-tecnico"
  },
  "sections": [
    { "type": "orientation", "content": "..." },
    { "type": "theory",      "title": "Entidades y atributos", "content": "..." },
    { "type": "practice",    "title": "Ejercicio guiado", "content": "..." },
    { "type": "assessment",  "content": "..." }
  ]
}
```

## 3. Validar y renderizar

```bash
# Validar la estructura pedagógica
npx @charlie.act7/jintia validate semanas/semana-03/guide.json

# Renderizar a HTML
npx @charlie.act7/jintia render semanas/semana-03/guide.json

# Compilar a PDF (requiere Vivliostyle)
npx @charlie.act7/jintia compile semanas/semana-03/guide.json
```

## 4. Preflight del PDF

```bash
npx @charlie.act7/jintia preflight semanas/semana-03/guia-semana-03.pdf
```

El preflight detecta encabezados huérfanos, figuras separadas de su caption,
tablas desbordadas y páginas casi vacías.

## Estructura de archivos generados

```
semanas/semana-03/
├── guide.json          ← fuente canónica
├── guide.html          ← HTML renderizado
├── guide.pdf           ← PDF A4 final
└── figures/            ← imágenes del pipeline visual
```
