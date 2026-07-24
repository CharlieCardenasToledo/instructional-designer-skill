/**
 * main.js — Composition Root (Clean Architecture)
 */
import "./styles.css";

import { state }              from "./state.js";
import { refreshIcons }       from "./icons.js";
import { navigate, registerPage } from "./router.js";

import { renderCourses }      from "./pages/courses.js";
import { renderSyllabus }     from "./pages/syllabus.js";
import { renderTemplates }    from "./pages/templates.js";
import { renderSettings }     from "./pages/settings.js";
import { renderDocs }         from "./pages/docs.js";
import { toast }              from "./toast.js";
import { getOnboardingStatus } from "./api.js";
import { renderOnboarding }  from "./onboarding.js";
import { getCurrentWindow }  from "@tauri-apps/api/window";

registerPage("courses",   renderCourses);
registerPage("syllabus",  renderSyllabus);
registerPage("templates", renderTemplates);
registerPage("settings",  renderSettings);
registerPage("docs",      renderDocs);

function renderShell() {
  document.getElementById("app").innerHTML = `

    <!-- SIDEBAR -->
    <aside class="sidebar" role="navigation" aria-label="Menú principal">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <span class="material-symbols-outlined">school</span>
        </div>
        <div class="sidebar-logo-text">
          <h1>AcademiaOS</h1>
          <span>Claude Skill Architect</span>
        </div>
      </div>

      <div class="sidebar-cta">
        <button class="btn btn-primary btn-sm" data-page="courses" style="width:100%;justify-content:center">
          <span class="material-symbols-outlined" style="font-size:15px">add</span>
          Nueva configuración
        </button>
      </div>

      <nav class="sidebar-nav">
        <button class="nav-item" data-page="courses" aria-label="Cursos">
          <span class="material-symbols-outlined">school</span> Cursos
        </button>
        <button class="nav-item" data-page="templates" aria-label="Plantillas">
          <span class="material-symbols-outlined">dashboard_customize</span> Plantillas
        </button>
        <button class="nav-item" data-page="docs" aria-label="Documentación">
          <span class="material-symbols-outlined">description</span> Documentación
        </button>
        <button class="nav-item" data-page="settings" aria-label="Configuración">
          <span class="material-symbols-outlined">settings</span> Configuración
        </button>
      </nav>

      <div class="sidebar-footer" style="flex-direction:column;gap:0;padding:0;border:none">
        <button class="nav-item" data-page="docs" aria-label="Centro de ayuda" style="width:100%;border-radius:0;padding:10px 20px">
          <span class="material-symbols-outlined">help</span> Centro de ayuda
        </button>
        <div class="sidebar-footer" style="border-top:1px solid rgba(195,198,213,0.25)">
          <span class="material-symbols-outlined">package_2</span>
          v10.4 · instructional-designer-skill
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="main" role="main">
      <header class="topbar" data-tauri-drag-region>
        <div class="topbar-left">
          <h2>Instructional Design Studio</h2>
          <div class="topbar-sub"></div>
        </div>
        <div class="topbar-right-static">
          <div class="topbar-status">
            <div class="topbar-status-dot"></div>
            <span class="topbar-mcp-label">MCP: Conectado</span>
            <span class="topbar-version">v10.4</span>
          </div>
          <div class="topbar-actions" id="topbar-actions">
            <button class="btn btn-primary btn-sm" id="btn-deploy">
              <span class="material-symbols-outlined" style="font-size:14px">rocket_launch</span>
              Deploy Skill
            </button>
          </div>
          <div class="topbar-win-controls">
            <button class="win-btn" id="app-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
            <button class="win-btn win-btn--close" id="app-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
          </div>
        </div>
      </header>

      <div class="content">
        <section id="p-courses"   class="page" aria-label="Cursos"></section>
        <section id="p-syllabus"  class="page" aria-label="Editor de sílabo"></section>
        <section id="p-templates" class="page" aria-label="Plantillas"></section>
        <section id="p-settings"  class="page" aria-label="Configuración"></section>
        <section id="p-docs"      class="page" aria-label="Documentación"></section>
      </div>
    </main>
  `;
}

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-item[data-page], .sidebar-cta button[data-page]");
  if (nav) { navigate(nav.dataset.page); return; }

  const deploy = event.target.closest("#btn-deploy");
  if (deploy) { window.deploySkill?.(); return; }
});

// El onboarding es una página independiente: la app principal (sidebar,
// topbar, páginas) ni siquiera se construye hasta que el onboarding termine.
async function boot() {
  try {
    const onboarding = await getOnboardingStatus();
    if (onboarding.completed) {
      renderShell();
      refreshIcons();
      navigate(state.page || "courses");
      document.getElementById("app-win-minimize")?.addEventListener("click", () => getCurrentWindow().minimize());
      document.getElementById("app-win-close")?.addEventListener("click", () => getCurrentWindow().close());
    } else {
      await renderOnboarding();
    }
  } catch {
    await renderOnboarding();
  }
}

boot();
