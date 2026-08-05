# Tu primer curso

Esta guía crea un curso desde cero con sílabo, configuración institucional y primera guía semanal. Se muestra el camino tanto por terminal como sin terminal (explorador de archivos + editor de texto).

---

## 1. Crear la carpeta del proyecto

### Terminal

```bash
mkdir mi-curso
cd mi-curso
npx @charlie.act7/jintia init . --code IFT200 --name "Fundamentos de Bases de Datos"
```

### Sin terminal

1. Abre tu **explorador de archivos** (Windows Explorer / Finder en Mac)
2. Navega a donde quieras guardar el curso (por ejemplo, `Documentos/cursos/`)
3. Crea una carpeta nueva llamada `mi-curso`
4. Dentro de `mi-curso`, crea manualmente estas subcarpetas y archivos:

```
mi-curso/
├── README.md              ← sílabo del curso
├── JINTIA.md              ← decisiones pedagógicas
├── reference.bib          ← bibliografía
├── semanas/               ← carpeta vacía por ahora
└── figures/               ← carpeta vacía por ahora
```

Para crear los archivos `.md` y `.bib`: abre el Bloc de notas (Windows) o TextEdit (Mac), escribe el contenido y guarda con la extensión correspondiente (desactiva "guardar como .txt" si es necesario).

---

## 2. Completar el sílabo

Abre `README.md` con cualquier editor de texto (VS Code, Bloc de notas, TextEdit) e incluye:

- Datos del curso (código, nombre, créditos, modalidad)
- Resultado de aprendizaje general
- Unidades con resultados por semana
- Bibliografía con claves BibTeX

**Validar el sílabo (terminal):**

```bash
npx @charlie.act7/jintia audit README.md
```

**Sin terminal:** puedes pedirle a Claude Code o ChatGPT que revise el sílabo pegándolo directamente en el chat.

---

## 3. Configurar la institución

### Terminal

El archivo `skill/config/institution.json` se crea automáticamente con `jintia init`. Solo edítalo:

```bash
# Abre con VS Code
code ~/.claude/skills/jintia-skill/config/institution.json
```

### Sin terminal (explorador de archivos)

1. Ve a tu carpeta de inicio:
   - **Windows:** `C:\Users\TuNombre\.claude\skills\jintia-skill\config\`
   - **Mac/Linux:** `~/.claude/skills/jintia-skill/config/`
2. Abre el archivo `institution.json` con tu editor de texto preferido
3. Edita los valores y guarda:

```json
{
  "schemaVersion": 1,
  "institution": {
    "name": "Universidad Internacional del Ecuador",
    "website": "https://www.uide.edu.ec/",
    "faculty": "Facultad de Ingeniería",
    "career": "Ingeniería de Software",
    "author": "Tu Nombre",
    "degree": "Mgtr."
  },
  "branding": {
    "primaryColor": "#00796B",
    "logoPath": "assets/logo.png"
  },
  "activeTemplate": "jintia-clasico",
  "options": {
    "evidenceMode": "notebooklm-preferred"
  }
}
```

> **Plantillas disponibles:** `jintia-clasico`, `jintia-tecnico`, `jintia-cuaderno`. Consulta [Temas HTML](./templates.md) para ver diferencias visuales.

---

## 4. Configurar NotebookLM (opcional)

NotebookLM mejora la calidad de las evidencias pedagógicas consultando fuentes reales del curso.

### Terminal

```bash
npx @charlie.act7/jintia doctor
```

El doctor guía la autenticación con Google y el registro del notebook del curso paso a paso.

### Sin terminal

1. Ve a [notebooklm.google.com](https://notebooklm.google.com) e inicia sesión con tu cuenta de Google
2. Crea un notebook nuevo y ponle el nombre de tu curso
3. Sube el sílabo del curso como fuente
4. Copia la URL del notebook (aparece en la barra del navegador)
5. En Claude Code escribe:
   ```
   /jintia configurar notebooklm [pega aquí la URL]
   ```

---

## 5. Crear la carpeta de la primera semana

### Terminal

```bash
mkdir -p semanas/semana-01
```

### Sin terminal

1. Abre `mi-curso/semanas/` en tu explorador de archivos
2. Crea una carpeta nueva llamada `semana-01`
3. Dentro de `semana-01`, crea un archivo `guide.json` con este contenido inicial:

```json
{
  "metadata": {
    "course": "IFT200",
    "week": 1,
    "topic": "Introducción a Bases de Datos",
    "outcome": "El estudiante comprende el rol de las bases de datos en sistemas modernos.",
    "theme": "jintia-clasico"
  },
  "sections": []
}
```

---

## 6. Generar la primera guía

### Claude Code

```
/jintia guía semana 1
```

### ChatGPT

En el chat con tu GPT Jíntia, adjunta el sílabo y escribe:

```
Genera la guía didáctica para la semana 1. Usa el sílabo adjunto.
Secciones requeridas: orientación, teoría, práctica, evaluación.
```

### CLI

```bash
npx @charlie.act7/jintia render semanas/semana-01/guide.json
npx @charlie.act7/jintia compile semanas/semana-01/guide.json
```

El PDF queda en `semanas/semana-01/guide.pdf`.

---

## JINTIA.md

Usa `JINTIA.md` para decisiones duraderas de pedagogía y estilo editorial del curso. No reemplaza al sílabo; lo complementa con contexto que Jíntia consulta en cada sesión.

Ejemplo de contenido:

```markdown
# Decisiones pedagógicas — IFT200

- Las prácticas son siempre con datos reales del sector financiero
- El nivel asumido es segundo año de ingeniería
- Evitar teoría sin ejemplo aplicado en la misma página
```
