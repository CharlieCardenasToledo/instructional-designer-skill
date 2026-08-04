# Sistema Editorial HTML — Referencia técnica

## Visión general

El motor editorial HTML de Jintia convierte una guía semanal expresada como
`guide.json` (AST neutral) en un documento HTML semántico y, opcionalmente, en
un PDF imprimible a través de Vivliostyle CLI.

```
guide.json  →  guide-renderer.js  →  guide.html  →  vivliostyle-adapter.js  →  guide.pdf
```

Ningún paso escribe LaTeX ni invoca pdflatex. Todo el control tipográfico vive
en CSS Paged Media.

---

## 1. Formato fuente — `guide.json`

El esquema canónico está en `schemas/guide.schema.json`. La estructura mínima:

```json
{
  "metadata": {
    "course":      "Nombre del Curso",
    "week":        3,
    "topic":       "Tema de la semana",
    "outcome":     "Resultado de aprendizaje en infinitivo.",
    "theme":       "jintia-clasico",
    "bibliography":"reference.bib",
    "lang":        "es"
  },
  "sections": [
    { "type": "orientation", "title": "...", "content": "..." },
    { "type": "theory",      "title": "...", "content": "..." },
    { "type": "practice",    "title": "...", "content": "..." },
    { "type": "assessment",  "title": "...", "items":   [] }
  ]
}
```

### Tipos de nodo disponibles

| Tipo | Clase CSS | Uso |
|---|---|---|
| `orientation` | `.jintia-orientation` | Orientación inicial de la semana |
| `theory` | `.jintia-theory` | Contenido teórico expositivo |
| `concept` | `.jintia-concept` | Definición resaltada de un concepto |
| `practice` | `.jintia-practice` | Práctica guiada paso a paso |
| `warning` | `.jintia-warning` | Error frecuente o advertencia |
| `critical-error` | `.jintia-critical-error` | Error crítico que impide avanzar |
| `scenario` | `.jintia-scenario` | Caso o situación contextualizada |
| `assessment` | `.jintia-assessment` | Actividad evaluativa con ítems |
| `figure` | `.jintia-figure` | Imagen con alt y caption |
| `table` | `.jintia-table` | Tabla estructurada con headers |
| `margin-note` | `.jintia-margin-note` | Nota marginal complementaria |
| `bibliography` | `.jintia-bibliography` | Sección de referencias |
| `citation` | `.jintia-citation` | Cita inline (inline only) |

### Control de paginación por nodo (`data-pagination`)

| Valor | Comportamiento |
|---|---|
| `atomic` | `break-inside: avoid` — no se divide |
| `splittable` | Sin restricción — puede dividirse entre páginas |
| `keep-with-next` | `break-after: avoid` — va unido al siguiente bloque |
| `page-contained` | `break-before: page; break-after: page` — página propia |
| `repeatable-header` | `<thead>` se repite en cada página (tablas largas) |

---

## 2. Comandos CLI

```bash
# Validar pedagogía y estructura
jintia validate guide.json [--strict] [--json]

# Generar HTML
jintia render guide.json [--theme jintia-clasico] [--output guide.html]

# Generar PDF (requiere Vivliostyle CLI instalado)
jintia compile guide.json [--output guide.pdf] [--size A4]

# Vista previa en navegador
jintia preview guide.html [--port 13000]

# Verificar paginación
jintia preflight guide.html [--strict] [--json]
```

> Para compilar PDF necesitas Node.js ≥22.12.0 y:
> ```bash
> npm install --global @vivliostyle/cli
> ```

---

## 3. Sistema de temas

Los temas viven en `skill/themes/<id>/` y siguen esta estructura:

```
themes/
  jintia-clasico/
    meta.json          ← contrato del tema
    tokens.css         ← variables CSS
    components.css     ← clases de bloques pedagógicos
    print.css          ← @page, break-*, encabezados corridos
    theme.css          ← punto de entrada (importa los tres)
    vivliostyle.config.js
  jintia-tecnico/
    meta.json
    tokens.css         ← sobreescribe tokens.css de clasico
    theme.css          ← importa tokens propios + components/print de clasico
  jintia-cuaderno/
    meta.json
    tokens.css         ← tamaño A5, mayor espaciado para escritura manual
    print.css          ← márgenes A5 y configuraciones especiales
    theme.css
```

### Jerarquía de importación

```
theme.css
  ├── tokens.css          (paleta, fuentes, espaciado)
  ├── components.css      (bloques pedagógicos — reutilizable por temas hijos)
  └── print.css           (@page, break rules — reutilizable por temas hijos)
```

Los temas hijos solo sobreescriben `tokens.css` y, si necesitan reglas de
paginación distintas, su propio `print.css`. No duplican `components.css`.

### Cómo crear un tema nuevo

1. Crear `themes/<id>/meta.json` (copiar de `jintia-clasico/meta.json`).
2. Crear `themes/<id>/tokens.css` — `@import "../jintia-clasico/tokens.css"` y sobrescribir variables.
3. Crear `themes/<id>/theme.css` — importar `./tokens.css`, luego `../jintia-clasico/components.css` y `../jintia-clasico/print.css`.

---

## 4. Pipeline de figuras

El pipeline visual genera imágenes con `visual-renderer.js` y las registra en
`figure/manifest.json`. La salida JSON incluye ahora el campo `html` con el
fragmento `<figure>` listo para insertar en el `guide.json`:

```json
{
  "entry": { ... },
  "html":  "<figure class=\"jintia-figure\" ...>...</figure>",
  "latex": "\\begin{guidefigure}..."
}
```

La función `htmlFigure(spec, outputPath)` en `guide-renderer.js` genera ese
fragmento. El campo `html` en la salida del pipeline es el que debe copiarse al
nodo `figure` correspondiente del `guide.json`.

---

## 5. Pipeline de linting

```
guide.json  →  content-linter.js   (JIN-CNT-001…010)
guide.html  →  html-linter.js      (JIN-HTM-001…008)
guide.html  →  pdf-preflight.js    (JIN-PFG-001…006)
README.md   →  rules-runner.js     (JIN-SYL-*, JIN-ALN-*, JIN-ACC-*)
```

Ejecutar en cadena:

```bash
jintia validate guide.json && \
jintia render   guide.json --output guide.html && \
node skill/scripts/html-linter.js guide.html && \
jintia compile  guide.json && \
jintia preflight guide.html
```

---

## 6. Dependencias opcionales

| Paquete | Para qué | Instalación |
|---|---|---|
| `@vivliostyle/cli` | Compilar PDF | `npm install --global @vivliostyle/cli` |
| `@vivliostyle/theme-base` | Módulos CSS base (CC0-1.0) | `npm install @vivliostyle/theme-base` |
| `node-html-parser` | html-linter.js con cobertura total | `npm install node-html-parser` |
| `playwright` | pdf-preflight.js en modo real | `npm install -D playwright && npx playwright install chromium` |
| `@citation-js/core` | Citas APA desde .bib | `npm install @citation-js/core @citation-js/plugin-bibtex @citation-js/plugin-csl` |

Todas son opcionales. El sistema opera en modo degradado sin ninguna de ellas.

---

## 7. Licencias relevantes

- **Vivliostyle Core** — AGPL-3.0. Jintia lo invoca como proceso externo (`spawnSync`) y nunca lo importa. Esto evita que la licencia AGPL se propague al código de Jintia (MIT).
- **@vivliostyle/theme-base** — CC0-1.0. Se puede usar sin restricciones.
- **@citation-js/core** — MIT.
- **node-html-parser** — MIT.
- **Playwright** — Apache-2.0.
