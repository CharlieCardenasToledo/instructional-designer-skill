# Changelog — instructional-designer-skill

## 10.3.1 — 2026-07-17

- Agregado `package.json` con engines, scripts npm y metadatos del paquete.
- Agregado `requirements.txt` con dependencia `pymupdf>=1.24.0`.
- Agregadas issue templates de GitHub: bug report, feature request, institution config.
- README: aclarado `[SKILL_PATH]` con rutas concretas por OS; agregado `pip install` previo al script Python.
- CHANGELOG: corregido titulo (era `instructional-designer-uide`, debe ser `instructional-designer-skill`).

## 10.3 — 2026-06-16

- Integración completa con notebooklm-mcp (roomi-fields/notebooklm-mcp).
- Paso 2 del Flujo de Arranque: se agrega `re_auth` como segundo intento de autenticación (antes del Flujo manual); se usa `select_notebook` para activar el notebook por defecto y evitar repetir `notebook_id`; se agrega `search_notebooks` como alternativa a `list_notebooks` cuando el id no está en la tabla.
- `ask_question`: ahora se solicita `source_format: "footnotes"` en todas las consultas de respaldo bibliográfico para obtener fuentes citadas al pie.
- `references/bibliografia.md`: mismos cambios en Paso A/B/C del workflow; se agrega Paso E opcional con `add_source` para ingestar URLs y texto plano nuevos al notebook del curso.

## 10.2 — 2026-06-10

- Validada con generación real (IFT200 Semana 07: compilación exitosa, validación NotebookLM contra Elmasri 7.ª ed.).
- Paso 2 del Flujo de Arranque: consulta a NotebookLM obligatoria en todo arranque; ante `authenticated: false`, intentar `setup_auth` antes del flujo manual.
- Cierre de Tarea: verificación obligatoria de recortes PDF en `bibliografia/recortes_por_semana/semana-XX/`; se cortan si faltan.
- Regla de plantilla de facto: la semana compilada más reciente del mismo curso manda sobre la referencia canónica (clase compartida `semanas/_shared/latex/`, `siunitx`, footer con logo).
- Tabla de Registros NotebookLM: columna de URL de compartir (IFT200 registrada) y nota de recuperación ante biblioteca local vacía.
- `latex-validator.js`: ejecuta `figure/screenshot.mjs` automáticamente si existe, antes de compilar.

## 10.1 — 2026-06-10

- Reestructuración con disclosure progresivo: SKILL.md compacto (~260 líneas) + 6 archivos en `references/` (plantilla-latex, figuras-tikz, figuras-html, bibliografia, compilacion-wsl, checklist).
- Resueltas contradicciones internas: política única sobre `[Pendiente de Verificación]` (prohibida como salida), numeración de bibliografía estrictamente secuencial, `\cover{}` comentado por defecto.
- Scripts alineados con la documentación: `latex-validator.js` con secuencia completa de 3 pasadas via WSL y conversión de rutas; `pdf_cutter_template.py` con salida a `bibliografia/recortes_por_semana/semana-XX/`.
- Checklist ampliado: figuras HTML, `\cover{}`, numeración secuencial.
- Fusionado el contenido único del antiguo `.claude/commands/instructional-designer-uide.md` (Recursos Visuales HTML, Captura de Screenshots, Compilación WSL, Paso de confirmación de plan).

## 10.0 — versión previa

- Versión monolítica del SKILL.md (~1.160 líneas) con flujo de arranque, plantilla ElegantBook, gramática de bloques, TikZ/ER Chen, citas APA y workflow NotebookLM como fallback.
