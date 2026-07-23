/**
 * main.js — Composition Root (Clean Architecture)
 * Solo ensambla módulos: no contiene lógica de negocio ni de UI.
 * Principios: SRP, DIP, OCP — cada módulo es intercambiable.
 */
import "./styles.css";

import { state }              from "./state.js";
import { refreshIcons }       from "./icons.js";
import { navigate, registerPage } from "./router.js";

import { renderSetup }        from "./pages/setup.js";
import { renderInstitution }  from "./pages/institution.js";
import { renderCourses }      from "./pages/courses.js";
import { renderSyllabus }     from "./pages/syllabus.js";
import { renderNotebookLM }   from "./pages/notebooklm.js";
import { renderActivate }     from "./pages/activate.js";
import { renderTemplates }   from "./pages/templates.js";
import { toast }              from "./toast.js";
import { getOnboardingStatus } from "./api.js";
import { renderOnboarding } from "./onboarding.js";

// ── Registrar páginas en el router (OCP: agregar página = 2 líneas) ──────
registerPage("setup",       renderSetup);
registerPage("institution", renderInstitution);
registerPage("courses",     renderCourses);
registerPage("syllabus",    renderSyllabus);
registerPage("notebooklm",  renderNotebookLM);
registerPage("templates",   renderTemplates);
registerPage("activate",    renderActivate);

// ── Shell HTML (layout estático) ─────────────────────────────────────────
function renderShell() {
  document.getElementById("app").innerHTML = `

    <!-- SIDEBAR -->
    <aside class="sidebar" role="navigation" aria-label="Menú principal">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <i data-lucide="graduation-cap" width="16" height="16"></i>
        </div>
        <div class="sidebar-logo-text">
          <h1>IDS Manager</h1>
          <span>instructional-designer-skill</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Configuración</div>
        <button class="nav-item" data-page="setup" aria-label="Dependencias del sistema">
          <i data-lucide="settings"     width="15" height="15"></i> Dependencias
          <span class="nav-badge" id="dep-missing-badge" style="display:none" aria-live="polite"></span>
        </button>
        <button class="nav-item" data-page="institution" aria-label="Datos institucionales">
          <i data-lucide="building-2"   width="15" height="15"></i> Institución
        </button>
        <button class="nav-item" data-page="templates" aria-label="Plantillas LaTeX">
          <i data-lucide="layout-template" width="15" height="15"></i> Plantilla LaTeX
        </button>
        <button class="nav-item" data-page="activate" aria-label="Activar en Claude">
          <i data-lucide="zap"          width="15" height="15"></i> Integraciones
        </button>

        <div class="sidebar-section-label">Contenido</div>
        <button class="nav-item" data-page="courses" aria-label="Mis cursos">
          <i data-lucide="book-open"    width="15" height="15"></i> Cursos
        </button>
        <button class="nav-item" data-page="syllabus" aria-label="Editor de sílabo">
          <i data-lucide="file-text"    width="15" height="15"></i> Editor de sílabo
        </button>
        <button class="nav-item" data-page="notebooklm" aria-label="NotebookLM">
          <i data-lucide="link-2"       width="15" height="15"></i> NotebookLM
        </button>

      </nav>

      <div class="sidebar-footer">
        <i data-lucide="package" width="12" height="12"></i>
        v10.4 · instructional-designer-skill
      </div>
    </aside>

    <!-- MAIN -->
    <main class="main" role="main">
      <header class="topbar">
        <div class="topbar-left">
          <h2>Cargando…</h2>
          <div class="topbar-sub"></div>
        </div>
        <div class="topbar-actions" id="topbar-actions"></div>
      </header>

      <div class="content">

        <!-- SETUP -->
        <section id="p-setup" class="page" aria-label="Dependencias del sistema">
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="settings" width="15" height="15"></i> Estado del entorno
              </div>
              <div class="row">
                <button class="btn btn-secondary btn-sm" data-action="render-setup" title="Recargar estado de dependencias">
                  <i data-lucide="refresh-cw" width="13" height="13"></i> Recargar
                </button>
                <button class="btn btn-primary btn-sm" id="btn-install-all" data-action="install-all" title="Instalar dependencias requeridas">
                  <i data-lucide="download" width="13" height="13"></i> Instalar todo
                </button>
              </div>
            </div>
            <div class="summary-bar">
              <span class="summary-count" id="dep-ok-count">–</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">
                  de <span id="dep-tot-count">–</span> dependencias instaladas
                </div>
                <div class="progress-track" style="width:200px;margin-top:5px">
                  <div class="progress-fill" id="dep-progress" style="width:0%"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:12px">
              <i data-lucide="package" width="15" height="15"></i> Dependencias requeridas
            </div>
            <div class="item-list" id="dep-list">Cargando…</div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:10px">
              <i data-lucide="info" width="15" height="15"></i> ¿Para qué sirve cada una?
            </div>
            <div class="text-muted">
              <strong style="color:var(--text-2)">Git</strong> — opcional para versionar tus cursos; la app ya incluye la skill.<br>
              <strong style="color:var(--text-2)">Node.js</strong> — ejecuta NotebookLM MCP y los validadores.<br>
              <strong style="color:var(--text-2)">Python</strong> — extrae recortes de PDF con PyMuPDF.<br>
              <strong style="color:var(--text-2)">WSL 2</strong> — subsistema Linux para compilar LaTeX en Windows.<br>
              <strong style="color:var(--text-2)">TeX Live</strong> — compilador opcional dentro de WSL; requiere confirmación por su tamaño.
            </div>
          </div>
        </section>

        <!-- INSTITUTION — layout 2 columnas: formulario + preview en vivo -->
        <section id="p-institution" class="page" aria-label="Datos institucionales">
          <div class="inst-layout">

            <!-- Columna izquierda: formulario -->
            <div class="inst-form">
              <div class="card">
                <div class="card-title" style="margin-bottom:14px">
                  <i data-lucide="graduation-cap" width="15" height="15"></i> Datos del docente
                </div>
                <div class="form-grid">
                  <div class="form-group" style="grid-column:1/-1">
                    <label for="cfg-author">Nombre completo <span style="color:var(--red)">*</span></label>
                    <input id="cfg-author" placeholder="Ej: Charlie Cárdenas Toledo" autocomplete="name">
                  </div>
                  <div class="form-group" style="grid-column:1/-1">
                    <label for="cfg-degree">Grado académico</label>
                    <select id="cfg-degree">
                      <option value="">Seleccionar grado…</option>
                      <option value="Lic.">Licenciado/a (Lic.)</option>
                      <option value="Ing.">Ingeniero/a (Ing.)</option>
                      <option value="Arq.">Arquitecto/a (Arq.)</option>
                      <option value="Mg.">Magíster (Mg.)</option>
                      <option value="M.Sc.">Master of Science (M.Sc.)</option>
                      <option value="MBA">Master in Business Administration (MBA)</option>
                      <option value="Esp.">Especialista (Esp.)</option>
                      <option value="Ph.D.">Doctor en Filosofía (Ph.D.)</option>
                      <option value="Dr.">Doctor/a (Dr.)</option>
                      <option value="Prof.">Profesor/a (Prof.)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-title" style="margin-bottom:14px">
                  <i data-lucide="building-2" width="15" height="15"></i> Datos institucionales
                </div>
                <div class="form-grid">
                  <div class="form-group" style="grid-column:1/-1">
                    <label for="cfg-institution">Institución <span style="color:var(--red)">*</span></label>
                    <input id="cfg-institution" placeholder="Ej: Universidad Internacional del Ecuador">
                  </div>
                  <div class="form-group">
                    <label for="cfg-faculty">Facultad</label>
                    <input id="cfg-faculty" placeholder="Ej: Facultad de Ingeniería">
                  </div>
                  <div class="form-group">
                    <label for="cfg-career">Carrera</label>
                    <input id="cfg-career" placeholder="Ej: Ingeniería en Sistemas">
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-title" style="margin-bottom:12px">
                  <i data-lucide="info" width="15" height="15"></i> Color institucional
                </div>
                <div class="form-group">
                  <label for="cfg-color">Selecciona el color de tu institución</label>
                  <div class="color-picker-row">
                    <input id="cfg-color" type="color" value="#0d9488">
                    <span class="color-picker-label" id="cfg-color-label">#0d9488</span>
                    <span class="text-muted" style="font-size:11px">· Se usa en títulos y decoraciones de las guías LaTeX</span>
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-title" style="margin-bottom:12px">
                  <i data-lucide="network" width="15" height="15"></i> Ecosistema digital
                </div>
                <div class="form-group">
                  <label for="cfg-ecosystem">Sistemas o procesos reconocibles <span class="text-muted">(uno por línea)</span></label>
                  <textarea id="cfg-ecosystem" placeholder="Canvas LMS&#10;Sistema académico&#10;Servicio de identidad"></textarea>
                </div>
              </div>

              <div class="row-end" style="padding-bottom:4px">
                <button class="btn btn-primary" data-action="save-institution" title="Guardar configuración estructurada">
                  <i data-lucide="save" width="14" height="14"></i> Guardar configuración
                </button>
              </div>
            </div>

            <!-- Columna derecha: preview en vivo de la portada LaTeX -->
            <div class="inst-preview-col">
              <div style="position:sticky;top:0">
                <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                  <i data-lucide="eye" width="12" height="12"></i> Vista previa en vivo
                </div>
                <div id="inst-preview"></div>
              </div>
            </div>

          </div>
        </section>

        <!-- COURSES -->
        <section id="p-courses" class="page" aria-label="Mis cursos">
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="book-open" width="15" height="15"></i> Mis asignaturas
              </div>
            </div>
            <div class="item-list" id="courses-list"></div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:14px">
              <i data-lucide="plus" width="15" height="15"></i> Agregar asignatura
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label for="new-code">Código <span style="color:var(--red)">*</span></label>
                <input id="new-code" placeholder="Ej: IFT200">
              </div>
              <div class="form-group">
                <label for="new-name">Nombre <span style="color:var(--red)">*</span></label>
                <input id="new-name" placeholder="Ej: Bases de Datos">
              </div>
              <div class="form-group">
                <label for="new-credits">Créditos</label>
                <input id="new-credits" type="number" value="4" min="1" max="10">
              </div>
              <div class="form-group">
                <label for="new-weeks">Semanas</label>
                <input id="new-weeks" type="number" value="16" min="1" max="32">
              </div>
              <div class="form-group">
                <label for="new-semester">Semestre</label>
                <input id="new-semester" placeholder="Ej: 2026-II">
              </div>
            </div>
            <div class="row-end" style="margin-top:12px">
              <button class="btn btn-primary" data-action="add-course" title="Guardar nueva asignatura">
                <i data-lucide="plus" width="14" height="14"></i> Agregar asignatura
              </button>
            </div>
          </div>
        </section>

        <!-- SYLLABUS -->
        <section id="p-syllabus" class="page" aria-label="Editor de sílabo">
          <div class="card">
            <div class="card-title" style="margin-bottom:14px">
              <i data-lucide="file-text" width="15" height="15"></i> Datos del curso
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label for="syl-code">Código</label>
                <input id="syl-code" placeholder="IFT200">
              </div>
              <div class="form-group">
                <label for="syl-name">Nombre del curso</label>
                <input id="syl-name" placeholder="Bases de Datos">
              </div>
              <div class="form-group">
                <label for="syl-period">Periodo académico ordinario</label>
                <input id="syl-period" placeholder="Abril–Agosto 2026">
              </div>
              <div class="form-group">
                <label for="syl-semester">Semestre</label>
                <input id="syl-semester" placeholder="Tercero">
              </div>
              <div class="form-group">
                <label for="syl-credits">Créditos</label>
                <input id="syl-credits" type="number" value="4" min="1" max="20">
              </div>
              <div class="form-group">
                <label for="syl-weeks">N.º de semanas</label>
                <input id="syl-weeks" type="number" value="16" min="1" max="52">
              </div>
            </div>
            <div class="form-group mt-3">
              <label for="syl-desc">Descripción general del curso</label>
              <textarea id="syl-desc" placeholder="Este curso introduce los fundamentos de…"></textarea>
            </div>
            <div class="row-end mt-3">
              <button class="btn btn-secondary btn-sm" data-action="init-syllabus" title="Regenerar el acordeón de semanas">
                <i data-lucide="refresh-cw" width="13" height="13"></i> Regenerar semanas
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:12px">
              <i data-lucide="file-text" width="15" height="15"></i> Contenido semanal
            </div>
            <div id="syl-weeks-container"></div>
          </div>

          <div class="row-end" style="padding-bottom:24px">
            <button class="btn btn-primary" data-action="save-syllabus" title="Generar el archivo README.md del sílabo">
              <i data-lucide="download" width="14" height="14"></i> Generar README.md del curso
            </button>
          </div>
        </section>

        <!-- NOTEBOOKLM -->
        <section id="p-notebooklm" class="page" aria-label="NotebookLM">
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="key-round" width="15" height="15"></i> Sesión Google (requerida)
              </div>
              <div class="row">
                <button class="btn btn-secondary btn-sm" data-action="verify-notebooklm" title="Verificar sesión de NotebookLM">
                  <i data-lucide="refresh-cw" width="13" height="13"></i> Verificar
                </button>
                <button class="btn btn-primary btn-sm" data-action="auth-notebooklm" title="Autenticar cuenta Google para NotebookLM MCP">
                  <i data-lucide="key-round" width="13" height="13"></i> Iniciar sesión
                </button>
              </div>
            </div>

            <div id="auth-warning" class="warn-box" role="alert">
              <i data-lucide="alert-triangle" width="14" height="14"></i>
              <div><strong>Sin sesión activa.</strong> El skill fallará al consultar NotebookLM en el Paso 2. Inicia sesión antes de usar el skill.</div>
            </div>

            <div class="list-item">
              <div class="list-item-left">
                <div class="dot dot-loading" id="auth-dot"></div>
                <div>
                  <div class="list-item-label">Estado de sesión</div>
                  <div class="list-item-sub" id="auth-text">Verificando…</div>
                </div>
              </div>
            </div>
            <div class="text-muted" style="margin-top:10px">
              Al hacer clic se abre Chrome. Completa el acceso dentro de 10 minutos.
              El perfil y las cookies se guardan localmente por <code>notebooklm-mcp</code>.
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="notebook" width="15" height="15"></i> Notebooks registrados
              </div>
              <button class="btn btn-secondary btn-sm" data-action="save-notebooks" title="Guardar registro estructurado">
                <i data-lucide="save" width="13" height="13"></i> Guardar registro
              </button>
            </div>
            <div class="item-list" id="notebook-list"></div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:14px">
              <i data-lucide="plus" width="15" height="15"></i> Registrar notebook
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label for="nb-code">Código <span style="color:var(--red)">*</span></label>
                <input id="nb-code" placeholder="IFT200">
              </div>
              <div class="form-group">
                <label for="nb-course-name">Asignatura <span style="color:var(--red)">*</span></label>
                <input id="nb-course-name" placeholder="Interacción Persona Computador">
              </div>
              <div class="form-group">
                <label for="nb-root">Carpeta raíz <span style="color:var(--red)">*</span></label>
                <input id="nb-root" placeholder="01 IFT200">
              </div>
              <div class="form-group">
                <label for="nb-id">Notebook ID <span class="text-muted">(opcional)</span></label>
                <input id="nb-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono">
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label for="nb-url">URL de compartir <span class="text-muted" style="font-weight:400">(opcional)</span></label>
                <input id="nb-url" placeholder="https://notebooklm.google.com/notebook/…">
              </div>
            </div>
            <div class="row-end mt-3">
              <button class="btn btn-primary" data-action="add-notebook" title="Registrar notebook en la lista">
                <i data-lucide="plus" width="14" height="14"></i> Registrar
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:10px">
              <i data-lucide="info" width="15" height="15"></i> ¿Dónde está el Notebook ID?
            </div>
            <div class="text-muted">
              1. Abre <strong style="color:var(--text-2)">notebooklm.google.com</strong><br>
              2. Entra al notebook de tu asignatura<br>
              3. Copia la URL — el ID es la cadena entre <code>/notebook/</code> y el <code>?</code><br>
              Ejemplo: <code>notebooklm.google.com/notebook/<strong>abc123def456</strong></code>
            </div>
          </div>
        </section>

        <!-- TEMPLATES -->
        <section id="p-templates" class="page" aria-label="Plantillas LaTeX"></section>

        <!-- ACTIVATE -->
        <section id="p-activate" class="page" aria-label="Activar en Claude">
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="zap" width="15" height="15"></i> Activar el skill en Claude
              </div>
              <div class="row">
                <button class="btn btn-secondary btn-sm" data-action="render-activate" title="Verificar estado actual de los pasos">
                  <i data-lucide="refresh-cw" width="13" height="13"></i> Verificar
                </button>
                <button class="btn btn-primary btn-sm" data-action="run-all-steps" title="Ejecutar la configuración local completa">
                  <i data-lucide="play" width="13" height="13"></i> Configurar todo
                </button>
              </div>
            </div>

            <div class="summary-bar mb-3">
              <span class="summary-count" id="activate-count" aria-live="polite">–</span>
            </div>
            <div class="progress-track mb-3">
              <div class="progress-fill" id="activate-progress" style="width:0%"></div>
            </div>

            <div id="activate-steps">Verificando…</div>
            <div id="activate-status" aria-live="polite"></div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:12px">
              <i data-lucide="info" width="15" height="15"></i> ¿Qué hace cada paso?
            </div>
            <div class="text-muted" style="line-height:2">
              <strong style="color:var(--text-2)">1. Claude Code</strong> — instala la skill local en
              <code>~/.claude/skills/instructional-designer-skill/</code>.<br>
              <strong style="color:var(--text-2)">2. Claude/Cowork</strong> — genera un ZIP que debes subir en <code>Customize → Skills</code>.<br>
              <strong style="color:var(--text-2)">3. MCP</strong> — combina la entrada oficial de NotebookLM con la configuración existente y crea un respaldo.<br>
              <strong style="color:var(--text-2)">4. Configuración</strong> — guarda tus datos en JSON y los conserva al actualizar.<br>
              <strong style="color:var(--text-2)">4. Sesión NotebookLM</strong> — Autentica tu cuenta Google para que el MCP pueda consultar tus notebooks.
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:10px">
              <i data-lucide="zap" width="15" height="15"></i> Después de activar
            </div>
            <ol style="color:var(--muted);padding-left:20px;line-height:2.4;font-size:13px">
              <li>Para Claude/Cowork, sube el ZIP desde <code>Customize → Skills</code></li>
              <li>Para Claude Code, abre una sesión nueva tras la instalación local</li>
              <li>Reinicia el cliente donde configuraste MCP</li>
              <li>Solicita una guía indicando curso y semana</li>
            </ol>
          </div>
        </section>

      </div><!-- /content -->
    </main><!-- /main -->

    <div id="toast" role="status" aria-live="polite"></div>
    <div id="onboarding-root"></div>
  `;
}

// ── Inicialización ───────────────────────────────────────────────────────
renderShell();
refreshIcons();

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-item[data-page]");
  if (nav) {
    navigate(nav.dataset.page);
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  const actions = {
    "render-setup": renderSetup,
    "install-all": () => window.installAll?.(),
    "save-institution": () => window.saveInstitutionConfig?.(),
    "add-course": () => window.addCourse?.(),
    "init-syllabus": () => window.initSyllabus?.(),
    "save-syllabus": () => window.saveSyllabus?.(),
    "auth-notebooklm": () => window.triggerNotebookLMAuth?.(),
    "verify-notebooklm": () => window.verifyNotebookLMAuth?.(),
    "save-notebooks": () => window.persistNotebooks?.(),
    "add-notebook": () => window.addNotebook?.(),
    "render-activate": renderActivate,
    "run-all-steps": () => window.runAllSteps?.(),
  };
  actions[action]?.();
});

document.addEventListener("change", event => {
  if (event.target.id === "syl-weeks") window.initSyllabus?.();
});

async function boot() {
  try {
    const onboarding = await getOnboardingStatus();
    if (onboarding.completed) navigate(state.page);
    else await renderOnboarding();
  } catch {
    await renderOnboarding();
  }
}

boot();
