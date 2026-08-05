# Generar una guía semanal

El flujo completo desde el sílabo hasta el PDF tiene cuatro pasos. Cada paso se puede ejecutar desde Claude Code, ChatGPT o la terminal.

---

## 1. Planificar antes de escribir

Antes de generar contenido, Jíntia presenta una propuesta con el resultado de aprendizaje, las evidencias disponibles en NotebookLM y la estructura de secciones.

### Claude Code

```
/jintia guía semana 3
```

### ChatGPT

```
Actúa como Jíntia. Planifica la guía didáctica para la semana 3 del curso adjunto.
Muestra: resultado de aprendizaje, evidencias sugeridas y estructura de secciones
antes de generar el contenido.
```

### Cursor

```
/jintia guía semana 3
```

La propuesta incluye:

- Resultado de aprendizaje derivado del sílabo
- Evidencia verificable consultada en NotebookLM
- Tipos de sección sugeridos (orientación, teoría, práctica, evaluación)
- Tema HTML recomendado según la asignatura

Confirma o ajusta la propuesta antes de continuar.

---

## 2. Crear o editar el `guide.json`

La fuente canónica de cada guía es `semanas/semana-03/guide.json`. Jíntia lo genera automáticamente; también puedes editarlo a mano.

### Terminal

```bash
# Crear la carpeta si no existe
mkdir -p semanas/semana-03
```

### Sin terminal

1. Abre `semanas/` en tu explorador de archivos
2. Crea la carpeta `semana-03`
3. Dentro, crea el archivo `guide.json` con tu editor de texto:

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
    { "type": "practice",    "title": "Ejercicio guiado",      "content": "..." },
    { "type": "assessment",  "content": "..." }
  ]
}
```

> **Temas disponibles:** `jintia-clasico`, `jintia-tecnico`, `jintia-cuaderno`. Consulta [Temas HTML](./templates.md).

---

## 3. Validar y renderizar

### Terminal

```bash
# Validar la estructura pedagógica
npx @charlie.act7/jintia validate semanas/semana-03/guide.json

# Renderizar a HTML
npx @charlie.act7/jintia render semanas/semana-03/guide.json

# Compilar a PDF (requiere Vivliostyle)
npx @charlie.act7/jintia compile semanas/semana-03/guide.json
```

### Claude Code

```
/jintia render semanas/semana-03/guide.json
```

### ChatGPT

Para validar el contenido sin CLI, pega el `guide.json` en el chat y escribe:

```
Revisa este guide.json y verifica que tenga las cuatro secciones requeridas
(orientación, teoría, práctica, evaluación) y que el resultado de aprendizaje
sea verificable y medible.
```

---

## 4. Preflight del PDF

El preflight detecta problemas de diagramación antes de imprimir o distribuir.

### Terminal

```bash
npx @charlie.act7/jintia preflight semanas/semana-03/guia-semana-03.pdf
```

### Sin terminal

Abre el PDF en tu visor habitual y verifica manualmente:

- Encabezados no separados de su párrafo (sin "huérfanos")
- Figuras acompañadas de su caption en la misma página
- Tablas que no desbordan el margen
- Sin páginas casi vacías al final de sección

---

## Estructura de archivos generados

```
semanas/semana-03/
├── guide.json          ← fuente canónica (editable)
├── guide.html          ← HTML renderizado
├── guide.pdf           ← PDF A4 final
└── figures/            ← imágenes del pipeline visual
```

---

## Diferencias por plataforma

| Acción | Claude Code | ChatGPT | Terminal |
|---|---|---|---|
| Planificar semana | `/jintia guía semana N` | Prompt con sílabo adjunto | — |
| Validar guide.json | `/jintia render archivo` | Pegar JSON en chat | `jintia validate` |
| Generar HTML | Automático tras confirmar | Exportar manualmente | `jintia render` |
| Compilar PDF | Automático | Requiere CLI local | `jintia compile` |
| Preflight | — | Manual | `jintia preflight` |

> ChatGPT no accede al sistema de archivos local. Para generar el PDF necesitas ejecutar `jintia compile` en tu terminal después de obtener el `guide.json` desde ChatGPT.
