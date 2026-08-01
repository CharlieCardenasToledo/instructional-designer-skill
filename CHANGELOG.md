# Changelog — Jintia

Este archivo sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado semántico.

## Sin publicar

- Separada la distribución de la skill mediante ZIPs reproducibles, manifiesto
  versionado, SHA-256 y attestations de procedencia para que Jintia Desktop la
  consuma sin importar archivos fuente entre repositorios.
- Actualizada la integración oficial con
  `@charlie.act7/gemini-notebook-mcp@2.3.3` y Node.js `>=22.13.0`.
- Preparada `jintia-skill` 10.9.0 con un pipeline visual único que renderiza,
  inspecciona, valida, actualiza el manifiesto y entrega el bloque LaTeX.
- Implementados fallbacks ejecutables para Matplotlib, GeoPandas y TikZ, más
  generadores PlantUML, Circuitikz, Chemfig y Forest desde modelos neutrales.
- Ampliados los gráficos Vega-Lite, las métricas de complejidad, la captura
  selectiva de HTML y la conversión segura de SVG a PDF.
- Endurecidos accesibilidad, procedencia, tablas equivalentes, contraste por
  series, plantillas y pruebas recursivas multiplataforma.
- Extendida la matriz real de motores para comprobar Graphviz, Mermaid,
  PlantUML, D2, Vega-Lite, LaTeX, Python, Chrome y WaveDrom.

## 10.7.0 — 2026-07-28

### Añadido

- Incorporado un sistema visual neutral con especificaciones JSON, manifiesto,
  selector pedagógico, fallbacks registrados y adaptadores para motores
  generales y disciplinares.
- Añadidos renderizado, inspección, accesibilidad, previsualizaciones,
  regresión exacta y perceptual, imágenes diff y tablas CSV equivalentes.
- Añadidos generadores para redes, flujos, gráficos, mapas GeoJSON, forest
  plots, cronologías, señales digitales, estructuras RDKit y figuras
  progresivas.
- Añadidos perfiles visuales `Mínimo`, `Visual general` y `Completo` en Jintia
  Desktop, con versiones objetivo y capacidades deshabilitadas visibles.
- Incorporada la plantilla `Kaohandt Marginal` junto a `ElegantBook Clásico`
  mediante contratos portables para figuras y tablas.
- Añadida una matriz de integración continua para comprobar motores reales y
  renderizado con Chrome en Windows, macOS y Linux.

### Corregido

- Unificados los contratos de documentación, configuración y nombres de
  archivos entre la aplicación y la skill.
- Corregidos el sitio web institucional, el comportamiento sin logotipo y los
  metadatos de invocación de la skill.
- Corregido el detector de Chrome en Windows para evitar que una consulta de
  versión abra ventanas `newtab`.
- Corregidas las referencias que todavía exigían flotantes LaTeX directos en
  lugar de `guidefigure` y `guidetable`.

### Cambiado

- Adoptada **Jintia** como identidad del producto, con **Jintia Desktop** para
  la aplicación y `jintia-skill` para el motor instalable.
- Añadida compatibilidad para detectar instalaciones anteriores y conservar
  su configuración al instalar la nueva ruta `~/.claude/skills/jintia-skill`.
- Renombrados los metadatos de aplicación, instaladores, workflows y
  documentación sin alterar el contenido académico existente.
- Reescritas las guías públicas, técnicas y de integración con Claude.
- Sustituidas las plantillas Markdown de issues por formularios YAML.
- Normalizada la dependencia NotebookLM MCP verificada.
- Preparada la política, privacidad y automatización condicional requeridas
  para solicitar firma gratuita mediante SignPath Foundation.
- Publicada `jintia-skill` 10.7.0 con una matriz reproducible de pruebas
  multiplataforma como puerta de calidad del sistema visual.

## 10.4.0 — 2026-07-27

- Incorporada **Instructional Designer Manager 1.0.0**, aplicación de
  escritorio para configurar dependencias, institución, NotebookLM, cursos y
  la instalación o exportación de la skill.
- Reorganizado el repositorio como monorepo: `app/desktop/` contiene la
  aplicación Tauri y `skill/` contiene exclusivamente el paquete instalable.
- Añadidos workflows de GitHub Actions para generar instaladores NSIS/MSI en
  Windows y DMG en macOS al publicar un tag.
- Renovados los README en español e inglés con objetivo del producto,
  recorrido visual, capturas Full HD, instalación y arquitectura.
- Aplicado Liquid Glass únicamente a la capa flotante de controles, con
  contenido opaco, estados de foco y alternativas para reducir transparencia
  y movimiento.

## 10.3.1 — 2026-07-17

- Agregado `package.json` con engines, scripts npm y metadatos del paquete.
- Agregado `requirements.txt` con dependencia `pymupdf>=1.24.0`.
- Agregadas issue templates de GitHub: bug report, feature request, institution config.
- README: aclarado `[SKILL_PATH]` con rutas concretas por OS; agregado `pip install` previo al script Python.
- CHANGELOG: corregido titulo (era `instructional-designer-uide`, debe ser `instructional-designer-skill`).

## 10.3.0 — 2026-06-16

- Integración completa con notebooklm-mcp (roomi-fields/notebooklm-mcp).
- Paso 2 del Flujo de Arranque: se agrega `re_auth` como segundo intento de autenticación (antes del Flujo manual); se usa `select_notebook` para activar el notebook por defecto y evitar repetir `notebook_id`; se agrega `search_notebooks` como alternativa a `list_notebooks` cuando el id no está en la tabla.
- `ask_question`: ahora se solicita `source_format: "footnotes"` en todas las consultas de respaldo bibliográfico para obtener fuentes citadas al pie.
- `references/bibliografia.md`: mismos cambios en Paso A/B/C del workflow; se agrega Paso E opcional con `add_source` para ingestar URLs y texto plano nuevos al notebook del curso.

## 10.2.0 — 2026-06-10

- Validada con generación real (IFT200 Semana 07: compilación exitosa, validación NotebookLM contra Elmasri 7.ª ed.).
- Paso 2 del Flujo de Arranque: consulta a NotebookLM obligatoria en todo arranque; ante `authenticated: false`, intentar `setup_auth` antes del flujo manual.
- Cierre de Tarea: verificación obligatoria de recortes PDF en `bibliografia/recortes_por_semana/semana-XX/`; se cortan si faltan.
- Regla de plantilla de facto: la semana compilada más reciente del mismo curso manda sobre la referencia canónica (clase compartida `semanas/_shared/latex/`, `siunitx`, footer con logo).
- Tabla de Registros NotebookLM: columna de URL de compartir (IFT200 registrada) y nota de recuperación ante biblioteca local vacía.
- `latex-validator.js`: ejecuta `figure/screenshot.mjs` automáticamente si existe, antes de compilar.

## 10.1.0 — 2026-06-10

- Reestructuración con disclosure progresivo: SKILL.md compacto (~260 líneas) + 6 archivos en `references/` (plantilla-latex, figuras-tikz, figuras-html, bibliografia, compilacion-wsl, checklist).
- Resueltas contradicciones internas: política única sobre `[Pendiente de Verificación]` (prohibida como salida), numeración de bibliografía estrictamente secuencial, `\cover{}` comentado por defecto.
- Scripts alineados con la documentación: `latex-validator.js` con secuencia completa de 3 pasadas via WSL y conversión de rutas; `pdf_cutter_template.py` con salida a `bibliografia/recortes_por_semana/semana-XX/`.
- Checklist ampliado: figuras HTML, `\cover{}`, numeración secuencial.
- Fusionado el contenido único del antiguo `.claude/commands/instructional-designer-uide.md` (Recursos Visuales HTML, Captura de Screenshots, Compilación WSL, Paso de confirmación de plan).

## 10.0.0 — versión previa

- Versión monolítica del SKILL.md (~1.160 líneas) con flujo de arranque, plantilla ElegantBook, gramática de bloques, TikZ/ER Chen, citas APA y workflow NotebookLM como fallback.
