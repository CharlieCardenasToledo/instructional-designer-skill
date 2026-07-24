export function renderDocs() {
  const el = document.getElementById("p-docs");
  if (!el) return;

  el.innerHTML = `
    <div class="docs-layout">

      <!-- Left nav -->
      <aside>
        <div class="glass-pane" style="padding:14px;height:fit-content">
          <div class="docs-toc-title">Categorías</div>
          <nav>
            <div class="docs-nav-category">Primeros pasos</div>
            <a class="docs-nav-link" data-doc="overview" href="#">Descripción general</a>
            <a class="docs-nav-link active" data-doc="quickstart" href="#">Guía de inicio rápido</a>
            <a class="docs-nav-link" data-doc="requirements" href="#">Requisitos de instalación</a>

            <div class="docs-nav-category">Conceptos base</div>
            <a class="docs-nav-link" data-doc="schema" href="#">Esquema del sílabo</a>
            <a class="docs-nav-link" data-doc="modules" href="#">Módulos instruccionales</a>
            <a class="docs-nav-link" data-doc="assessment" href="#">Arquitectura de evaluación</a>

            <div class="docs-nav-category">Integración técnica</div>
            <a class="docs-nav-link" data-doc="mcp" href="#">Configuración MCP</a>
            <a class="docs-nav-link" data-doc="api" href="#">Referencias de API</a>

            <div class="docs-nav-category">Solución de problemas</div>
            <a class="docs-nav-link" data-doc="mcp-issues" href="#">Problemas de conexión MCP</a>
            <a class="docs-nav-link" data-doc="schema-errors" href="#">Errores de validación</a>
          </nav>
        </div>
      </aside>

      <!-- Center article -->
      <article class="docs-article">
        <div class="docs-breadcrumb">
          <span>Documentación</span>
          <span class="material-symbols-outlined">chevron_right</span>
          <span>Primeros pasos</span>
          <span class="material-symbols-outlined">chevron_right</span>
          <span style="color:var(--text);font-weight:500">Guía de inicio rápido</span>
        </div>
        <div class="glass-card docs-content">
          <h1>Guía de inicio rápido</h1>
          <p style="color:var(--muted);font-size:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(195,198,213,0.30)">
            Comienza a usar AcademiaOS en menos de 10 minutos. Esta guía cubre la inicialización básica y tu primer despliegue de skill.
          </p>

          <h2>1. Inicialización</h2>
          <p>Comienza instalando la skill en Claude Code. La skill se instala en <code>~/.claude/skills/</code> y estará disponible en tu próxima sesión.</p>
          <pre><code>## En Claude Code, ejecuta:
$ claude skill install instructional-designer-skill

## O desde este gestor:
Ve a Configuración → Preferencias → Instalar skill local</code></pre>

          <h2>2. Configuración del esquema</h2>
          <p>El núcleo de cualquier configuración de curso es el esquema del sílabo. Configura tus datos institucionales y la plantilla LaTeX activa.</p>
          <div class="docs-admonition">
            <span class="material-symbols-outlined">info</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--teal);margin-bottom:4px">Nota importante</div>
              <p style="margin:0;font-size:12.5px;color:var(--text-2)">Completa el perfil institucional antes de generar el primer README. Los datos del docente y la institución se incrustan automáticamente en todos los documentos generados.</p>
            </div>
          </div>
          <p>Accede a <strong>Configuración → Perfil institucional</strong> para configurar tus datos.</p>

          <h2>3. Crear tu primer curso</h2>
          <p>En la página de <strong>Cursos</strong>, haz clic en "Nueva asignatura" y completa el asistente de 2 pasos:</p>
          <pre><code>Paso 1: Información general
  - Nombre y código único (ej: IFT200)
  - Periodo académico
  - N.º de créditos y semanas

Paso 2: Estructura de carpetas
  - Vista previa de la estructura
  - Inicializar con README canónico</code></pre>

          <h2>4. Conectar MCP</h2>
          <p>Para habilitar la integración con NotebookLM, conecta el MCP desde <strong>Configuración → Configuración MCP</strong>.</p>
          <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(195,198,213,0.50);border-radius:8px;background:rgba(255,255,255,0.60);margin:14px 0">
            <span class="material-symbols-outlined" style="color:var(--teal)">power</span>
            <span style="font-size:13px;color:var(--text-2)">Haz clic en <strong>"Claude Code"</strong> en la sección MCP para configurar automáticamente.</span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:28px;padding-top:16px;border-top:1px solid rgba(195,198,213,0.30)">
            <div style="display:flex;flex-direction:column;gap:3px;color:var(--muted)">
              <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em">Anterior</span>
              <span style="font-size:13px;display:flex;align-items:center;gap:5px;color:var(--text-2)">
                <span class="material-symbols-outlined" style="font-size:17px">arrow_back</span> Descripción general
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;color:var(--muted);text-align:right">
              <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em">Siguiente</span>
              <span style="font-size:13px;display:flex;align-items:center;gap:5px;color:var(--text-2)">
                Requisitos de instalación <span class="material-symbols-outlined" style="font-size:17px">arrow_forward</span>
              </span>
            </div>
          </div>
        </div>
      </article>

      <!-- Right ToC -->
      <aside class="docs-toc">
        <div class="docs-toc-title">En esta página</div>
        <ul style="list-style:none;padding:0">
          <li><a class="docs-toc-link active" href="#">1. Inicialización</a></li>
          <li><a class="docs-toc-link" href="#">2. Configuración del esquema</a></li>
          <li><a class="docs-toc-link" href="#">3. Crear tu primer curso</a></li>
          <li><a class="docs-toc-link" href="#">4. Conectar MCP</a></li>
        </ul>
        <div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(195,198,213,0.30)">
          <a class="docs-toc-link" href="#" style="display:flex;align-items:center;gap:6px">
            <span class="material-symbols-outlined" style="font-size:16px">edit_note</span> Sugerir edición
          </a>
        </div>
      </aside>
    </div>`;

  // Bind doc nav links
  el.querySelectorAll(".docs-nav-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      el.querySelectorAll(".docs-nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
}
