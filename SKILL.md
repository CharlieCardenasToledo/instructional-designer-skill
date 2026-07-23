---
name: instructional-designer-skill
description: Diseña, redacta, edita y valida cursos, guías semanales LaTeX, módulos autoinstruccionales, rúbricas y evaluaciones de educación superior con UDL 3.0, Backward Design, Quality Matters y evidencia verificable mediante NotebookLM.
---

# Diseño instruccional autoinstruccional basado en evidencia

## Objetivo

Producir materiales académicos autosuficientes, accesibles y alineados. Priorizar la trazabilidad entre sílabo, resultados, práctica, evaluación y fuentes. Generar guías LaTeX modulares cuando el entregable solicitado sea una guía semanal.

## Cargar contexto bajo demanda

Leer únicamente las referencias necesarias para la tarea. Leer siempre `references/checklist.md` antes de cerrar.

| Necesidad | Archivo |
|---|---|
| Configuración institucional, notebooks y plantilla activa | `references/configuracion.md` |
| Contrato del `README.md` canónico del curso | `references/esquema-silabo.md` |
| Preamble, macros, bloques y estructura LaTeX | `references/plantilla-latex.md` |
| Citas, `reference.bib` y NotebookLM MCP | `references/bibliografia.md` |
| Figuras TikZ y notación Chen | `references/figuras-tikz.md` |
| Mock-ups HTML y captura PNG | `references/figuras-html.md` |
| Compilación y scripts auxiliares | `references/compilacion-wsl.md` |
| Validación final obligatoria | `references/checklist.md` |

Si `config/institution.json` existe, leerlo antes de redactar. Si `config/notebooks.json` existe, usarlo para resolver el notebook del curso. No editar archivos de `references/` para guardar datos del usuario.

## Flujo de trabajo

### 1. Resolver curso, semana y configuración

1. Identificar la carpeta del curso y el número de semana solicitado.
2. Leer el `README.md` de la raíz del curso. Tratarlo como sílabo canónico.
3. Validar su estructura con `references/esquema-silabo.md`.
4. Leer `config/institution.json` si está disponible.
5. Resolver `activeTemplate` y leer `templates/<activeTemplate>/template.md`.
6. Pedir únicamente datos ausentes que cambien materialmente el resultado.

No solicitar información que el sílabo o la configuración ya proporcionan.

### 2. Verificar evidencia

Usar este orden:

1. `README.md` del curso.
2. Recortes en `bibliografia/recortes_por_semana/semana-XX/`.
3. Fuentes locales verificables en `bibliografia/`.
4. NotebookLM MCP del curso.

NotebookLM es el método preferido para contrastar la cobertura bibliográfica:

1. Llamar `get_health`.
2. Si `authenticated` es falso, llamar `setup_auth` y volver a verificar. La autenticación puede abrir Chrome y permanecer disponible hasta 10 minutos.
3. Si la sesión guardada es inválida, usar `re_auth` y volver a verificar.
4. Resolver el notebook desde `config/notebooks.json`. Usar `select_notebook`, `search_notebooks` o `list_notebooks`.
5. Antes de `add_notebook`, solicitar confirmación explícita al usuario.
6. Consultar con `ask_question` y `source_format: "footnotes"`.
7. Reutilizar el `session_id` en consultas relacionadas.
8. Conservar la procedencia devuelta por el servidor para verificar las citas.

Si NotebookLM no está disponible, continuar solo cuando las fuentes locales permitan verificar las afirmaciones. Si tampoco existe evidencia local suficiente, detener el párrafo afectado y pedir la fuente o una respuesta manual de NotebookLM. Nunca inventar autores, años, páginas, citas o resultados.

### 3. Extraer el contrato semanal

Mapear los campos canónicos:

| Campo del sílabo | Uso |
|---|---|
| `**Asignatura:**` | Metadatos y apertura editorial |
| `**Periodo académico ordinario:**` | Fecha del documento |
| `### Semana XX — ...` | Semana y tema |
| `**Unidad:**` | `\coursemeta` |
| `**Tema / contenido semanal:**` | Una sección teórica por viñeta principal |
| `**Resultado de aprendizaje:**` | Orientación, práctica y alineación |
| `**Herramienta de aprendizaje:**` | Fuentes y recursos |
| `**Horas:**` | Tiempo estimado |
| `**Actividades calificadas:**` | Alineación evaluativa |

No copiar los resultados como una lista decorativa. Usarlos para decidir evidencia, práctica y evaluación.

### 4. Proponer el plan antes de escribir

Mostrar:

- semana y tema;
- archivos planeados;
- resultado de aprendizaje;
- evidencia identificada;
- plantilla activa;
- dependencias o datos faltantes.

Esperar confirmación cuando el plan implique crear una guía completa o reestructurar una existente.

### 5. Crear o reutilizar la estructura

Usar:

```text
semanas/semana-XX/latex/
├── guia-semanaXX.tex
├── reference.bib
├── figure/
└── sections/
```

Si existe una semana compilada reciente del mismo curso, reutilizar sus convenciones compatibles. No sobrescribir contenido existente sin copia recuperable. Para una reestructuración completa, usar `scripts/legacy-manager.js`.

La secuencia canónica es:

```text
01-introduccion.tex
02-[tema-1].tex
03-[tema-2].tex
...
NN-escenario.tex
NN-aplicacion.tex
NN-bibliografia.tex
```

Mantener numeración secuencial. Colocar el escenario después de toda la teoría y la bibliografía al final.

### 6. Redactar con alineación

Aplicar Backward Design:

1. Precisar qué desempeño demuestra el resultado.
2. Determinar evidencia observable.
3. Diseñar práctica guiada y recuperación.
4. Redactar teoría suficiente para ejecutar esa práctica.

La aplicación incluye recuperación y transferencia no calificadas. Incluir actividades calificadas solo cuando `options.includeGradedActivities` sea `true` o el usuario lo solicite. En ese caso, conservar código, nombre y ponderación del sílabo.

Aplicar UDL 3.0:

- ofrecer representación textual y visual cuando aporte comprensión;
- explicar el propósito y el criterio de éxito;
- reducir barreras de lenguaje y navegación;
- permitir alternativas de acción o expresión cuando el formato lo admita.

Aplicar Quality Matters:

- hacer visibles instrucciones, materiales y criterios;
- mantener alineación entre resultado, actividad y evaluación;
- evitar recursos sin función pedagógica.

## Reglas editoriales

- Escribir en registro académico directo, causal y autoinstruccional.
- Evitar “Querido estudiante”, “A continuación veremos”, “Es importante destacar”, “Recuerda que”, “La regla de oro” y “En resumen”.
- Evitar metáforas no técnicas y los incisos entre rayas.
- Preferir oraciones de hasta 20 palabras. Dividir las que superen 35.
- Usar un término técnico canónico de forma consistente.
- Marcar solo su primera aparición con `\keyterm{}`.
- Conectar el primer párrafo de cada sección con la necesidad creada por la anterior.
- Usar una figura o una tabla comparativa por sección, no ambas, salvo justificación explícita.
- Mencionar cada figura con `Figura~\ref{...}` en el párrafo previo.
- Usar los macros y bloques de la plantilla activa; no sustituirlos por formato LaTeX genérico.

## Bibliografía

Usar `biblatex` con `reference.bib` como única fuente bibliográfica:

- `\textcite{}` cuando el autor sea sujeto gramatical;
- `\parencite{}` para respaldo parentético;
- `\printbibliography` en la última sección;
- una entrada BibLaTeX por cada clave citada.

No mezclar `thebibliography` o `\bibitem` con `biblatex`.

## Integraciones opcionales

Tratar logos, socios, módulos internacionales y ecosistemas institucionales como opcionales. Incluirlos solo si la configuración los define. No exigir ASU, Banco de Loja ni otra institución específica en una instalación genérica.

## Cierre obligatorio

1. Ejecutar `node scripts/latex-linter.js <guia.tex>`.
2. Compilar con `node scripts/latex-validator.js <guia.tex>` cuando el entorno lo permita.
3. Verificar `reference.bib`, recortes, figuras y referencias cruzadas.
4. Ejecutar `references/checklist.md` punto por punto.
5. Informar archivos creados, validaciones ejecutadas y limitaciones reales.
