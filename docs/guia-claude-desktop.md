# Guía de uso con Claude Desktop y CoWork

Esta guía explica cómo configurar y usar el **instructional-designer-skill** desde **Claude Desktop** (app de escritorio) y desde **Claude Cowork** — la interfaz de escritorio orientada a tareas con archivos locales.

> Para la versión CLI, consulta el [README principal](../README.es.md).

---

## Tabla de contenidos

1. [¿Qué superficie usar?](#1-qué-superficie-usar)
2. [Configuración en Claude Desktop (Projects)](#2-configuración-en-claude-desktop-projects)
3. [Configuración en Claude Cowork](#3-configuración-en-claude-cowork)
4. [Flujo de trabajo paso a paso](#4-flujo-de-trabajo-paso-a-paso)
5. [Compartir con tu equipo (Team / Enterprise)](#5-compartir-con-tu-equipo)
6. [Limitaciones y diferencias con Claude Code CLI](#6-limitaciones-y-diferencias)

---

## 1. ¿Qué superficie usar?

Claude ofrece tres formas distintas de trabajo. Esta tabla te ayuda a elegir:

| Característica | Claude Code CLI | Claude Desktop (Projects) | Claude Cowork |
|---|---|---|---|
| **Edita archivos locales** | ✅ Sí | ❌ No | ✅ Sí (acceso a carpeta) |
| **Ejecuta scripts Node/Python** | ✅ Sí | ❌ No | ✅ Sí (VM aislada) |
| **Compila LaTeX (WSL)** | ✅ Sí | ❌ No | ⚠️ Solo con WSL configurado |
| **Compartir con equipo** | ❌ No | ✅ Sí (Team/Enterprise) | ⚠️ Solo artefactos en vivo |
| **NotebookLM MCP** | ✅ Sí | ✅ Sí (si MCP configurado) | ✅ Sí (si MCP configurado) |
| **Carga automática de skills** | ✅ `~/.claude/skills/` | ⚠️ Requiere copiar instrucciones | ✅ `~/.claude/skills/` |
| **Plataforma** | Windows/Mac/Linux | Navegador + Desktop | Desktop (+ web/mobile beta) |

**Recomendación general:**

- Usa **Claude Code CLI** para el flujo de producción completo (edición, compilación, validación).
- Usa **Claude Cowork** para tareas de escritura y revisión con acceso a tus archivos, sin compilación.
- Usa **Claude Desktop Projects** para coordinar con colegas o compartir instrucciones del skill.

---

## 2. Configuración en Claude Desktop (Projects)

### 2.1 Requisitos

- Cuenta Claude con plan **Pro**, **Team** o **Enterprise**
- Claude Desktop instalado ([descargar aquí](https://claude.ai/download))
- NotebookLM MCP configurado (ver [instrucciones oficiales](https://github.com/PleasePrompto/notebooklm-mcp))

### 2.2 Crear un Proyecto

1. Abre **Claude Desktop** o ve a [claude.ai](https://claude.ai)
2. En el panel lateral, haz clic en **"Proyectos"** → **"Nuevo proyecto"**
3. Asigna un nombre descriptivo, por ejemplo: `Diseño Instruccional — IFT200`

### 2.3 Agregar las instrucciones del skill al Proyecto

Los Projects no cargan automáticamente `SKILL.md`, pero puedes pegar las instrucciones como **Project Instructions**:

1. Abre tu proyecto → haz clic en **"Editar instrucciones del proyecto"**
2. Copia el contenido de `SKILL.md` desde este repositorio (el cuerpo, sin el frontmatter YAML)
3. Pégalo en el campo de instrucciones (límite: 8 000 caracteres)

> **Tip**: Si el contenido supera el límite, incluye solo el **Flujo de arranque** y los **bloques de referencia más usados**. El resto lo puedes subir como archivos de conocimiento.

### 2.4 Agregar archivos de conocimiento

1. En el proyecto → sección **"Conocimiento"** → **"Añadir archivos"**
2. Sube estos archivos de la carpeta `references/`:

   | Archivo | Propósito |
   |---|---|
   | `plantilla-latex.md` | Preámbulo ElegantBook y bloques pedagógicos |
   | `figuras-tikz.md` | Patrones TikZ y notación Chen |
   | `figuras-html.md` | Maquetas HTML + Puppeteer |
   | `bibliografia.md` | Política de citas y flujo NotebookLM |
   | `compilacion-wsl.md` | Referencia de comandos de compilación |
   | `checklist.md` | Lista de verificación de 75 puntos |

3. También puedes subir el **README.md de tu curso** como archivo de contexto permanente.

### 2.5 Configurar el MCP de NotebookLM en Claude Desktop

Para que NotebookLM MCP funcione en Claude Desktop (no solo en Claude Code CLI):

1. Abre la configuración de Claude Desktop: **Configuración → Servidores MCP**
2. Agrega la entrada del servidor `notebooklm-mcp`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp"],
      "env": {}
    }
  }
}
```

3. Guarda y reinicia Claude Desktop
4. Verifica la conexión escribiendo en el chat:
   ```
   /instructional-designer-skill
   ```
   Claude debería confirmar que NotebookLM MCP está disponible.

### 2.6 Invocar el skill desde Claude Desktop

Una vez configurado el proyecto, el skill se activa de dos formas:

**Automático** — cuando tu mensaje coincide con el skill:
```
Crea la guía de la semana 4 para el curso IFT200
```

**Manual** — escribiendo el comando en el chat:
```
/instructional-designer-skill
```

---

## 3. Configuración en Claude Cowork

Claude Cowork es la app de escritorio orientada a **tareas con acceso a archivos locales** y ejecución de código. Es la superficie más cercana al comportamiento del CLI.

### 3.1 Requisitos

- Claude Desktop instalado (Cowork está integrado)
- Plan **Pro**, **Team** o **Enterprise**
- Skill instalado en `~/.claude/skills/instructional-designer-skill/`

### 3.2 Instalar el skill para Cowork

```powershell
# Windows (PowerShell)
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill `
  "$env:USERPROFILE\.claude\skills\instructional-designer-skill"
```

```bash
# macOS / Linux
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill \
  ~/.claude/skills/instructional-designer-skill
```

> Cowork lee automáticamente la carpeta `~/.claude/skills/`. No se necesita configuración adicional para que detecte el skill.

### 3.3 Crear un proyecto Cowork

1. Abre **Claude Desktop**
2. Selecciona **"Cowork"** en el selector de modo (esquina superior izquierda)
3. Haz clic en **"Nuevo proyecto Cowork"**
4. Selecciona la **carpeta raíz** del curso cuando se solicite:
   ```
   D:\Proyectos\01 IFT200\
   ```

Claude Cowork tendrá acceso de lectura y escritura a esa carpeta y sus subcarpetas.

### 3.4 Verificar el skill en Cowork

En el chat del proyecto Cowork, escribe:

```
/instructional-designer-skill
```

Si el skill está correctamente instalado, Claude cargará el flujo de arranque y comenzará con el Paso 0 (verificar configuración institucional).

### 3.5 Configurar NotebookLM MCP en Cowork

Cowork comparte la configuración MCP con Claude Desktop. Si ya configuraste el MCP en el paso 2.5, funcionará automáticamente en Cowork.

Para verificar:
```
Ejecuta el Paso 2 del flujo de arranque y consulta el notebook del curso IFT200
```

### 3.6 Usar el /skill-creator para personalizar

Cowork incluye un asistente interactivo para crear o adaptar skills:

```
/skill-creator
```

Claude te hará preguntas sobre lo que quieres que haga el skill, escribirá un borrador y lo guardará automáticamente en `~/.claude/skills/`.

---

## 4. Flujo de trabajo paso a paso

### Ejemplo completo: Crear la guía de la Semana 5

#### En Claude Cowork (recomendado para producción):

**1. Abrir el proyecto Cowork con la carpeta del curso**

**2. Invocar el skill:**
```
/instructional-designer-skill
Crea la guía de la semana 5 del curso IFT200
```

**3. El skill ejecuta el flujo de arranque automáticamente:**
```
Paso 0 ✓ — Configuración institucional verificada
Paso 1 ✓ — README.md del curso leído
         Semana 5: Normalización (1NF, 2NF, 3NF)
         RA: El estudiante aplicará formas normales...
Paso 2 ✓ — NotebookLM consultado
         Fuente encontrada: Silberschatz (2020), Cap. 8, pp. 301-320
Paso 3 ✓ — Campos mapeados a LaTeX
Paso 4 ✓ — Estructura de carpetas creada
Paso 5 ✓ — Secciones identificadas: 3 secciones de teoría
Paso 6   — Plan confirmado ¿Continuar?
```

**4. Confirmar y generar:**
```
Sí, continúa con la generación
```

Claude genera los archivos `.tex` directamente en tu carpeta local.

**5. Validar la guía:**
```
Ejecuta el linter y el validador de compilación en la guía de la semana 5
```

Cowork ejecutará:
```
node ~/.claude/skills/instructional-designer-skill/scripts/latex-linter.js ...
node ~/.claude/skills/instructional-designer-skill/scripts/latex-validator.js ...
```

#### En Claude Desktop Projects (para colaboración):

El flujo es idéntico al anterior, pero **Claude no puede editar archivos locales directamente**. En su lugar:

- Claude genera el contenido LaTeX como **artefactos en el chat**
- Tú copias el contenido a tus archivos `.tex` locales
- Los miembros del equipo pueden ver los artefactos en tiempo real (plan Team/Enterprise)

---

## 5. Compartir con tu equipo

### 5.1 Compartir un Proyecto (claude.ai Projects — Team/Enterprise)

1. Abre el proyecto → **"Gestionar miembros"**
2. Haz clic en **"Agregar miembros"**
3. Ingresa el correo del colega
4. Asigna el nivel de permiso:
   - **"Puede usar"**: Ve el proyecto y chatea, no puede editar instrucciones
   - **"Puede editar"**: Modifica instrucciones, sube archivos, agrega miembros

Los miembros del equipo verán el mismo skill configurado y los mismos archivos de conocimiento, garantizando consistencia en la producción de guías.

### 5.2 Plantilla de instrucciones para compartir

Si tu equipo usa el skill, crea un documento de configuración compartido:

```markdown
# Configuración del Instructional Designer Skill — [Tu Institución]

## Datos institucionales
- Autor: [Nombre Completo], [Grado Académico]
- Institución: [Nombre de la institución]
- Facultad: [Nombre de la facultad]
- Color institucional (RGB): [R], [G], [B]

## Cursos activos y notebooks
| Curso | Notebook ID |
|---|---|
| [Sigla] — [Nombre] | [id del notebook] |

## Ubicación de archivos del skill
- Windows: `%USERPROFILE%\.claude\skills\instructional-designer-skill\`
- macOS/Linux: `~/.claude/skills/instructional-designer-skill/`
```

### 5.3 CoWork — Compartir artefactos en vivo

En proyectos Cowork con plan Team/Enterprise, puedes compartir **artefactos en vivo** (fragmentos de código, documentos generados) con tu organización directamente desde Cowork. Los archivos locales NO se comparten automáticamente — solo los artefactos generados en el chat.

---

## 6. Limitaciones y diferencias

| Característica | Claude Code CLI | Claude Cowork | Claude Desktop Projects |
|---|---|---|---|
| **Linter LaTeX** (`latex-linter.js`) | ✅ Automático | ✅ Bajo petición | ❌ No disponible |
| **Compilación WSL** (`latex-validator.js`) | ✅ Automático | ✅ Si WSL disponible | ❌ No disponible |
| **Archivado** (`legacy-manager.js`) | ✅ Automático | ✅ Bajo petición | ❌ No disponible |
| **Extracción PDF** (`pdf_cutter_template.py`) | ✅ Automático | ✅ Bajo petición | ❌ No disponible |
| **Edición directa de `.tex`** | ✅ Sí | ✅ Sí | ❌ Solo artefactos |
| **Detección automática de skill** | ✅ Sí | ✅ Sí | ⚠️ Requiere pegar instrucciones |
| **NotebookLM MCP** | ✅ Sí | ✅ Sí | ✅ Si MCP configurado |
| **Compartir con equipo** | ❌ No | ⚠️ Solo artefactos | ✅ Sí (Team/Enterprise) |

### Flujo híbrido recomendado para equipos

```
Claude Desktop Projects (coordinación y revisión pedagógica)
        ↕  compartir instrucciones y estándares
Claude Code CLI / Cowork (producción individual de cada docente)
        ↕  sincronizar via git
Repositorio compartido del curso (fuente de verdad)
```

---

## Recursos adicionales

- [Documentación oficial de Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Gestión de proyectos compartidos en Claude](https://support.claude.com/en/articles/13455879-use-claude-cowork-on-team-and-enterprise-plans)
- [Documentación de Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Configuración de NotebookLM MCP](https://github.com/PleasePrompto/notebooklm-mcp)
- [README principal del skill](../README.es.md)
