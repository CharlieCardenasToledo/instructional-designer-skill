# Arquitectura

Jíntia convierte contenido pedagógico estructurado en documentos HTML y PDF
mediante un pipeline editorial propio.

## Visión general

```
guide.json  →  guide-renderer.js  →  guide.html
                                          │
                              vivliostyle-adapter.js
                                          │
                                      guide.pdf
```

La fuente canónica es siempre `guide.json`. El HTML se genera a partir de ella;
el PDF se genera a partir del HTML. Nunca se edita el HTML directamente.

## Componentes principales

### `skill/scripts/guide-renderer.js`

Motor de renderizado central. Lee `guide.json`, aplica el tema HTML
seleccionado y produce un HTML semántico con atributos `data-pagination`
que controlan el comportamiento de paginación en impresión.

Cada tipo de sección pedagógica se renderiza con su propio componente:

| Tipo | Clase CSS | Comportamiento de página |
|---|---|---|
| `orientation` | `jintia-orientation` | `atomic` (no se divide) |
| `theory` | `jintia-theory` | `splittable` |
| `concept` | `jintia-concept` | `atomic` |
| `practice` | `jintia-practice` | `splittable` |
| `warning` | `jintia-warning` | `atomic` |
| `critical-error` | `jintia-critical-error` | `atomic` |
| `figure` | `jintia-figure` | `atomic` |
| `assessment` | `jintia-assessment` | `page-contained` |
| `bibliography` | `jintia-bibliography` | `splittable` |

### `skill/scripts/vivliostyle-adapter.js`

Invoca Vivliostyle CLI como proceso externo mediante `spawnSync`. Nunca importa
la API interna de Vivliostyle (eso violaría la licencia AGPL). El adaptador
acepta las opciones `--theme`, `--output` y `--engine`.

### `skill/scripts/content-linter.js`

Valida `guide.json` contra `skill/schemas/guide.schema.json` antes de renderizar.
Aplica las reglas `JIN-CNT-*`: orientación obligatoria, alt en figuras, claves
bibliográficas existentes, etc.

### `skill/scripts/html-linter.js`

Valida el HTML generado mediante análisis DOM. Aplica las reglas `JIN-HTM-*`:
imágenes con alt, bloques con `data-pagination`, tablas con caption y thead.

### `skill/scripts/pdf-preflight.js`

Analiza el PDF post-renderizado con Playwright. Detecta encabezados huérfanos,
figuras separadas de su caption, tablas desbordadas y páginas con menos del 20 %
de contenido.

### `skill/scripts/bibliography-manager.js`

Integra Citation.js para leer archivos `.bib` y resolver citas inline. Reemplaza
el sistema anterior basado en `biber`.

## Temas HTML

Los temas viven en `skill/themes/`. Cada tema es un directorio con:

```
jintia-clasico/
├── meta.json              ← contrato del tema
├── tokens.css             ← design tokens
├── components.css         ← bloques pedagógicos
├── print.css              ← @page y break-*
├── theme.css              ← punto de entrada
└── vivliostyle.config.js  ← configuración para Vivliostyle
```

El tema activo se declara en `guide.json` (`metadata.theme`) o en
`skill/config/institution.json` (`activeTemplate`).

## Esquemas JSON

| Archivo | Valida |
|---|---|
| `skill/schemas/guide.schema.json` | Estructura de `guide.json` |
| `skill/schemas/visual-spec.schema.json` | Especificaciones de figuras |
| `skill/schemas/visual-manifest.schema.json` | Manifiesto del pipeline visual |
| `skill/config/institution.schema.json` | Configuración institucional |

## Distribución

```
packages/
├── core/       ← fachada de skill/runtime/core
├── cli/        ← punto de entrada npx
├── rules/      ← reglas exportables
├── templates/  ← temas exportables
└── skill/      ← skill completa empaquetada
```

El paquete npm `@charlie.act7/jintia` expone el binario `jintia` que orquesta
todos los scripts anteriores desde un único punto de entrada.
