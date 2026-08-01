# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Docentes universitarios que diseñan cursos desde cero o rediseñan asignaturas existentes. Trabajan con sílabos documentados, necesitan convertir contenido en estructuras pedagógicas verificables, y quieren generar guías semanales listas para publicar.

**Context:** Educación superior con énfasis en currículo intercultural y pedagógico. Usuarios manejan herramientas variadas (archivos, textos) pero no necesariamente tienen experiencia técnica avanzada. Trabajar en equipos educativos, revisar con pares, iterar por semestre.

## Product Purpose

Convertir un sílabo universitario en una ruta conectada de resultados, contenidos, actividades, evaluaciones y guías semanales listas para publicar. La aplicación elimina la fricción de instalar y configurar manualmente un entorno de diseño instruccional, integrando herramientas (Node.js, Python, LaTeX) y servicios (NotebookLM) en una sola aplicación de escritorio con interfaz clara.

**Success means:** Un docente puede instalar la aplicación, completar el onboarding en minutos, crear una asignatura, subir un sílabo o contenido existente, y generar guías semanales LaTeX compiladas a PDF con criterios pedagógicos verificables (UDL 3.0, Backward Design, Quality Matters 7, WCAG 2.2).

## Positioning

Jintia es la única herramienta que integra:
- **Instalador + configurador visual** (Tauri + React) para docentes sin experiencia técnica.
- **Skill para Claude Code** como motor que interpreta pedagógicamente el curso.
- **Plantillas LaTeX editables** con renderizado reproducible local, sin vendor lock-in.
- **NotebookLM MCP** para investigación de fuentes integrada.
- **Privacidad por diseño:** compilación y archivos completamente locales.

Competidores ofrecen LMS genéricos (Moodle, Canvas) o herramientas pedagógicas sin automatización; Jintia automatiza todo desde un sílabo.

## Operating Context

**Workflow canónico:**
1. Instalar aplicación Tauri + completar onboarding (verificar Node, Python, Git, LaTeX).
2. Configurar datos institucionales (docente, institución, carrera, paleta visual).
3. Crear asignatura y estructurar su contenido (sílabo, temas, actividades).
4. Consultar fuentes mediante NotebookLM MCP (investigación integrada).
5. Generar guías LaTeX modulares por semana.
6. Compilar a PDF localmente y revisar.
7. Iterar y regresar a Claude (via skill) para refinamientos.

**Environments:** Windows 10/11, macOS (Apple Silicon y Intel), Linux. Aplicación de escritorio con acceso local a archivos, ejecución de compiladores, integración con MCP.

**Tools & Materials:**
- Sílabos escritos (PDF, Word, texto plano, Google Docs).
- NotebookLM notebooks (para curación de fuentes).
- Plantillas LaTeX (ElegantBook Clásico, Kaohandt Marginal).
- Claude Code + jintia-skill (para generación y validación).

## Capabilities and Constraints

**Verified Capabilities:**
- Verifica presencia de Node.js, Python, Git, compilador LaTeX (xelatex).
- En Windows: instala vía `winget` con solicitud de autorización.
- En macOS/Linux: muestra instrucciones manuales para herramientas.
- Crea estructura canónica de asignatura (carpetas, `README.md` estructurado).
- Conecta NotebookLM MCP sin sobrescribir otras configuraciones.
- Permite previsualizar plantilla LaTeX dentro de la app.
- Instala jintia-skill localmente o la exporta como ZIP.
- Mantiene todos los archivos, compilación y datos localmente (sin servidores).

**Constraints:**
- Aplicación requiere conexión para descargar dependencias e instalarlas.
- DMG actual (macOS) no está firmado ni notarizado (Gatekeeper warning).
- Instaladores Windows aún no están firmados (SignPath en trámite).
- Dos plantillas incluidas (expansible en futuro).
- LaTeX requiere compilador local (xelatex con soporte UTF-8 para es, quechua, shuar).

**Product Facts (undecided):**
- Mobile companion app: no confirmado; web responsive vs. desktop-only a decidir.
- Soporte para cursos en progreso: actualmente por semestre; histórico indefinido.

## Brand Commitments

**Name:** _Jintia_ — palabra del Shuar Chicham (lengua indígena ecuatoriana) que significa "camino". Expresa el propósito: convertir un sílabo en una ruta coherente.

**Attribution:** Uso reconocido explícitamente en docs y about view. Sin representación, aprobación ni vinculación institucional con comunidades Shuar (requisito cultural).

**Voice:** Educativo, claro, técnicamente honesto. Explicaciones sin jerga; advertencias visibles (ej: "No firmado" en DMG). Compromiso con privacidad.

**Visual Identity:** Glassmorphic con liquid control elements (ver DESIGN.md). Paleta: teal oceánico moderno (#0f766e) para acciones, neutros suaves, sombras translúcidas. Tipografía: Inter, legible en 13px, minimalista.

**Legal:**
- MIT License.
- Código abierto, repositorio público GitHub.
- Privacidad: sin telemetría, sin envío de cursos a servidores Jintia. NotebookLM consultas van a Google; otros datos locales.

## Evidence on Hand

**Published artifacts:**
- Aplicación v10.8.0 (descargable: Windows .exe/.msi, macOS .dmg).
- README principal: propósito, instalación, uso, estructura.
- Documentación técnica: guía Claude Desktop, arquitectura, design system, proceso de release.
- DESIGN.md: sistema visual completo (colores, tipografía, componentes glassmorphic).
- CHANGELOG.md: historial de versiones.
- THIRD_PARTY_NOTICES.md: atribuciones.

**Repository:** `github.com/CharlieCardenasToledo/instructional-designer-skill`

**Absent or undecided:**
- User research data (testing con docentes reales).
- Analytics (ni planeado; privacidad por diseño).
- Marketing copy (fuera de scope de docs técnicas).

## Product Principles

1. **Accesibilidad pedagógica:** La herramienta no sustituye el juicio del docente; amplifica su intención pedagógica mediante UDL, Backward Design, Quality Matters. Guías verificables y reproducibles.

2. **Privacidad y soberanía:** Todos los datos, compilación y output del usuario se procesan localmente. Sin telemetría, sin vendor lock-in. Herramientas estándar (Git, LaTeX, Python).

3. **Honestidad técnica:** Advertencias visibles (unsigned installers, requisitos), no ocultar fricción. Documentación clara sobre qué requiere conexión y qué no.

4. **Coherencia visual y conceptual:** Interfaz minimalista glassmorphic refleja el enfoque del producto (claridad, ligereza, enfoque en contenido). Cada control es intencional.

5. **Integración sin silos:** La app instala y configura; la skill en Claude Code es el motor. Ambas comunican limpiamente. Exportación en ZIP preserva independencia.

## Accessibility & Inclusion

**Required standards:**
- WCAG 2.2 AA: interfaz accesible (contraste, navegación por teclado, lectores de pantalla).
- Tipografía: Inter a 13px línea 1.5 para densidad y legibilidad.
- Soporte UTF-8: español, quechua, shuar, otras lenguas indígenas.

**Pedagogical inclusion (UDL 3.0):**
- Múltiples modos de presentación (gráficos, texto, datos).
- Flexibilidad en acciones (CLI, MCP, UI).
- Engagement claro: propósito visible, feedback inmediato.
