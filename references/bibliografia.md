# Bibliografía, evidencia y NotebookLM MCP

Leer cuando una tarea redacte contenido académico, resuelva fuentes o construya referencias.

## Política vinculante

- Verificar toda afirmación teórica central.
- No inventar citas, autores, años, páginas, claves o referencias.
- No entregar marcadores como `[Pendiente de Verificación]`.
- Distinguir una elaboración propia de una afirmación respaldada.
- Conservar recortes de las páginas citadas cuando las fuentes estén en PDF.

## Orden de resolución

1. `README.md` del curso.
2. `bibliografia/recortes_por_semana/semana-XX/`.
3. Fuentes locales en `bibliografia/`.
4. NotebookLM MCP.

NotebookLM contrasta la cobertura y facilita localizar fuentes. No sustituye la comprobación de la referencia original.

## NotebookLM MCP 2.0

El servidor oficial del proyecto se ejecuta con:

```text
npx notebooklm-mcp@latest
```

Flujo:

1. Llamar `get_health`.
2. Si `authenticated` es falso, llamar `setup_auth`. El navegador puede permanecer abierto hasta 10 minutos.
3. Si las cookies no son válidas, llamar `re_auth`.
4. Resolver el curso desde `config/notebooks.json`.
5. Usar `select_notebook` cuando exista un id válido.
6. Si el id no está disponible, usar `search_notebooks` o `list_notebooks`.
7. Antes de llamar `add_notebook`, mostrar la URL y pedir confirmación explícita.
8. Llamar `ask_question` con una pregunta específica y `source_format: "footnotes"`.
9. Guardar y reutilizar el `session_id`.
10. Revisar la procedencia devuelta por el servidor antes de redactar.

`add_source` admite URLs y texto. No asumir que puede subir archivos locales. La indexación puede tardar varios segundos.

## Flujo manual

Si el MCP no responde y no existen fuentes locales suficientes, detener únicamente el fragmento afectado y emitir:

```text
CONSULTA NOTEBOOKLM REQUERIDA
Notebook: [nombre]
Fuente prevista: [autor, año, título]
Sección: [capítulo o apartado]
Pregunta: [pregunta verificable y concreta]

Pega la respuesta con sus fuentes para continuar.
```

## Citas en LaTeX

| Situación | Comando |
|---|---|
| El autor es sujeto gramatical | `\textcite{clave}` |
| La referencia respalda una afirmación | `\parencite{clave}` |

No usar `\cite{}` genérico. No mezclar `\textcite{}` y `\parencite{}` para la misma referencia en una oración.

## Fuente bibliográfica única

Usar `biblatex` y `reference.bib`:

```latex
% En el preamble
\addbibresource{reference.bib}

% En la última sección
\printbibliography[heading=bibintoc,title={Referencias bibliográficas}]
```

Ejemplo:

```bibtex
@book{newman2021,
  author    = {Sam Newman},
  title     = {Building Microservices},
  edition   = {2},
  year      = {2021},
  publisher = {O'Reilly Media}
}
```

No combinar `\printbibliography` con `thebibliography` o `\bibitem`.

## Recortes

Guardar cada recorte en:

```text
bibliografia/recortes_por_semana/semana-XX/
```

Usar nombres trazables, por ejemplo:

```text
Autor_2024_Cap3_Sec31-34_pp80-96.pdf
```

Verificar que las páginas físicas extraídas correspondan a las páginas impresas de la fuente.
