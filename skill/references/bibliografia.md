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

La aplicación y esta skill usan la versión verificada:

```text
npx -y @charlie.act7/gemini-notebook-mcp@2.3.3
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

## Citas en guide.json

**Sintaxis canónica única** (en campos `content` de cualquier nodo):

```
La normalización reduce anomalías {{cite:date2004}}.
Según {{cite:date2004|narrative}}, el modelo relacional...
```

| Sintaxis | Resultado |
|---|---|
| `{{cite:clave}}` | Cita parentética: *(Apellido, año)* |
| `{{cite:clave|narrative}}` | Cita narrativa: *Apellido (año)* |

El nodo `{ "type": "citation" }` está **DEPRECADO**. No crear nuevos nodos `citation`;
usar exclusivamente la sintaxis inline. El validador JIN-CNT-012 reporta advertencia
cuando encuentra nodos `citation`.

El nodo `{ "type": "bibliography" }` al final de `sections` genera la lista de referencias.
Debe ser siempre el último nodo (JIN-CNT-011).

## Fuente bibliográfica única

Declarar en `metadata.bibliography` la ruta relativa al archivo `.bib`:

```json
{
  "metadata": {
    "bibliography": "reference.bib",
    "citationStyle": "apa"
  }
}
```

Mantener una entrada BibLaTeX en `reference.bib` por cada clave citada:

```bibtex
@book{newman2021,
  author    = {Sam Newman},
  title     = {Building Microservices},
  edition   = {2},
  year      = {2021},
  publisher = {O'Reilly Media}
}
```

En el HTML final, las citas se procesan con Citation.js. El nodo `bibliography` al final de `sections` genera la lista formateada. No combinar nodos `citation` con HTML bibliográfico manual.

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
