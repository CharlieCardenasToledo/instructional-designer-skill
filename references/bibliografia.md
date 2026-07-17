# Bibliografía — Citas, Política de Evidencia y Workflow NotebookLM

Referencia de la skill `instructional-designer-uide`. Leer siempre que la tarea implique redactar contenido con respaldo bibliográfico o construir la sección de referencias.

---

## Convenciones de Citas

### Criterio `\textcite{}` vs `\parencite{}`

| Situación | Comando | Ejemplo en texto |
|---|---|---|
| El autor es **sujeto gramatical** de la oración | `\textcite{}` | `\textcite{newman2021} sostiene que los microservicios...` |
| La cita respalda una afirmación (al final o entre paréntesis) | `\parencite{}` | `...despliegue independiente \parencite{newman2021}.` |

**PROHIBIDO:** Usar `\cite{}` simple. Usar siempre `\parencite{}` o `\textcite{}`. Mezclar ambos en la misma oración.

### Respaldo obligatorio

Toda afirmación teórica central debe tener `\parencite{}` o `\textcite{}`. Las elaboraciones propias no llevan cita, pero deben distinguirse del contenido referenciado.

---

## Política de Evidencia (ÚNICA Y VINCULANTE)

- **OBLIGATORIO** consultar NotebookLM del curso en el arranque de toda guía (Paso 2 del Flujo de Arranque en SKILL.md), aunque existan fuentes locales. Las fuentes locales respaldan las citas; la consulta valida la cobertura.
- **OBLIGATORIO** al cierre: verificar que los recortes PDF de la semana existan en `bibliografia/recortes_por_semana/semana-XX/` y cortarlos si faltan (ver Cierre de Tarea en SKILL.md).
- **PROHIBIDO** inventar citas textuales, autores, años, páginas o referencias.
- **PROHIBIDO** usar la etiqueta `[Pendiente de Verificación]` como salida. La etiqueta no resuelve el problema: si una fuente no se puede verificar, se ejecuta el workflow NotebookLM completo; si el workflow tampoco la resuelve, se detiene la redacción del párrafo afectado y se consulta al usuario (ver Flujo manual). Nunca se entrega una guía con esa etiqueta.

> Esta es la única política sobre fuentes no verificadas. Si otra parte de la skill o una versión anterior sugiere "marcar [Pendiente de Verificación] y continuar", esa indicación está obsoleta y no debe seguirse.

### Workflow cuando la fuente no está disponible en contexto

1. Buscar en orden: README del curso → carpeta `bibliografia/recortes_por_semana/semana-XX/` → archivos PDF en `bibliografia/`.
2. Si la fuente sigue sin estar disponible, consultar NotebookLM mediante el servidor MCP:

**Paso A — Verificar el servidor MCP:**
Llamar a `mcp__notebooklm__get_health`. Si `authenticated: true`, continuar al Paso B. Si `authenticated: false`:
  1. Llamar a `mcp__notebooklm__setup_auth` (recupera cookies guardadas o abre navegador para login, hasta 10 minutos) y re-verificar.
  2. Si sigue fallando, llamar a `mcp__notebooklm__re_auth` (fuerza sesión limpia) y re-verificar.
  3. Solo si ambos fallan, ir al **Flujo manual**.

**Paso B — Identificar el notebook del curso:**
Usar la tabla de Registros de NotebookLM (abajo) para obtener el `notebook_id`. En orden:
  1. Si el `notebook_id` está en la tabla: llamar a `mcp__notebooklm__select_notebook` con ese id para activarlo como notebook por defecto (las llamadas siguientes no necesitan `notebook_id`).
  2. Si el id no es reconocido: llamar a `mcp__notebooklm__search_notebooks` con el nombre del curso para localizarlo.
  3. Si tampoco aparece: la tabla incluye la URL de compartir; pasarla a `mcp__notebooklm__add_notebook` para re-registrar, o usarla como `notebook_url` directo en `ask_question`.

**Paso C — Ejecutar la consulta:**
Llamar a `mcp__notebooklm__ask_question` con:
- `question`: la pregunta específica sobre el contenido del párrafo afectado.
- `notebook_id`: el id del notebook del curso (omitir si ya se activó con `select_notebook`).
- `source_format: "footnotes"`: obligatorio cuando la respuesta respalda citas bibliográficas; devuelve fuentes al pie para identificar la referencia exacta.
- Guardar el `session_id` devuelto y reutilizarlo en todas las consultas sucesivas de la misma sesión.

**Paso D — Redactar con la respuesta obtenida:**
Usar la respuesta del MCP para redactar el párrafo con `\parencite{}` o `\textcite{}` sobre la fuente verificada.

**Paso E (opcional) — Ingestar fuentes nuevas al notebook:**
Si la bibliografía del curso incluye una URL pública (artículo, documentación técnica, página oficial) que todavía no está en el notebook, se puede agregar con `mcp__notebooklm__add_source`. Pasar `type: "url"` y la URL completa; NotebookLM indexa la fuente en 5-30 s y queda disponible en la misma sesión. Para fuentes en texto plano (extractos, resúmenes), usar `type: "text"` con el contenido. No ingestar archivos locales (no están soportados en v2.0).

### Flujo manual — solo si el MCP no está disponible

Si `authenticated: false` o el servidor MCP no responde, detener la redacción del párrafo afectado y emitir el siguiente bloque para el usuario:

```
CONSULTA NOTEBOOKLM REQUERIDA
(El servidor MCP no está autenticado — ejecuta la consulta manualmente)

Notebook:  [Nombre del notebook del curso]
Fuente:    [Autor, Año — Título completo]
Capítulo:  [Cap. X: Nombre exacto del capítulo]
Pregunta:  [Qué necesito saber para redactar este párrafo — ser específico]

Pega la respuesta de NotebookLM aquí para continuar.
```

No continuar con el párrafo hasta recibir la respuesta del usuario.

---

## Registros de NotebookLM por Curso

> ⚙️ **CONFIGURE — PASO OBLIGATORIO ANTES DE USAR LA SKILL**
>
> Esta tabla vincula cada asignatura con su notebook de NotebookLM. **Sin esta configuración el Paso 2 del Flujo de Arranque no puede ejecutarse automáticamente.**
>
> **Cómo obtener el `notebook_id`:**
> 1. Abre [NotebookLM](https://notebooklm.google.com/) y crea un notebook para el curso.
> 2. Agrega tus fuentes bibliográficas (PDFs de libros, artículos, documentación técnica). **NotebookLM necesita estas fuentes para responder consultas bibliográficas; sin ellas el Paso 2 devolverá respuestas vacías.**
> 3. Haz clic en "Compartir" → "Copiar enlace" para obtener la URL de compartir.
> 4. Ejecuta `mcp__notebooklm__list_notebooks` para ver el `notebook_id` asignado por el servidor MCP.
> 5. Completa la tabla de abajo con los datos de cada curso.

| Asignatura | Carpeta raíz | `notebook_id` | URL de compartir |
|---|---|---|---|
| ASIGNATURA_001 — Nombre del Curso | `01 ASIGNATURA_001/` | `tu-notebook-id-aqui` | `https://notebooklm.google.com/notebook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| ASIGNATURA_002 — Nombre del Curso | `02 ASIGNATURA_002/` | `tu-notebook-id-aqui` | (solicitar al usuario) |

> Con la URL de esta tabla, el notebook puede re-registrarse con `add_notebook` sin pedirla al usuario, o consultarse directamente con `ask_question(notebook_url=...)`. Cuando el usuario proporcione una URL nueva, agregarla aquí de inmediato.

> **Nota:** Estos ids viven en la biblioteca local del servidor MCP y pueden quedar huérfanos si esa biblioteca se reinicia. Si `list_notebooks` no los muestra, solicitar al usuario la URL de compartir del notebook del curso y re-registrarlo con `add_notebook`; luego actualizar esta tabla.



---

## Gestión Bibliográfica (archivo de referencias)

La plantilla usa `thebibliography` para las referencias en el archivo de sección, independientemente de que la clase tenga `citestyle=apa,bibstyle=apa` habilitado. Las citas en el texto usan `\parencite{}` y `\textcite{}` de biblatex.

```latex
% En sections/NN-bibliografia.tex
\renewcommand{\bibname}{Referencias bibliográficas}
\begin{thebibliography}{9}
\bibitem{clave}
    Apellido, N. (Año). \textit{Título}. Editorial. Cap. X.
\bibitem{clave2}
    Apellido, N., \& Apellido, N. (Año). \textit{Título} (X.\textsuperscript{a} ed.). Editorial.
\end{thebibliography}
```

**Reglas APA 7.ª ed.:**
- Edición: `(2.\textsuperscript{a} ed.)` — no omitir si el libro tiene edición.
- Capítulos: incluir `Cap. X` o `Cap. X y Cap. Y` al final de la referencia cuando la guía solo trabaja esas partes.
- No usar `\guidesection{}` antes de `\renewcommand{\bibname}` — la bibliografía no lleva encabezado de sección extra.

**Recordatorio:** `reference.bib` debe existir en `latex/` con entradas `@book` para todas las claves `\bibitem` usadas en el texto. Sin él, biber falla y las citas no se resuelven.
