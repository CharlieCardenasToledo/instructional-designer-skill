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
import { ui, cx } from "./uiClasses.js";

registerPage("courses",   renderCourses);
registerPage("syllabus",  renderSyllabus);
registerPage("templates", renderTemplates);
registerPage("settings",  renderSettings);
registerPage("docs",      renderDocs);

function renderShell() {
  document.getElementById("app").innerHTML = `

    <!-- SIDEBAR -->
    <aside class="flex w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white" role="navigation" aria-label="Menú principal">
      <div class="flex items-center gap-2.5 border-b border-slate-900/10 px-4 py-4">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
          <span class="material-symbols-outlined">school</span>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-[14px] font-extrabold tracking-tight text-slate-900">AcademiaOS</h1>
          <span class="block truncate text-[10px] text-slate-500">Diseñador instruccional</span>
        </div>
      </div>

      <div class="px-3 py-3">
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm, ui.button.xs, 'w-full border-dashed border-slate-300/60')}" data-page="courses">
          <span class="material-symbols-outlined" style="font-size:15px">add</span>
          Nueva asignatura
        </button>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button class="${ui.nav.item}" data-nav-item data-page="courses" aria-label="Cursos">
          <span class="material-symbols-outlined">school</span> Cursos
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="templates" aria-label="Plantillas">
          <span class="material-symbols-outlined">dashboard_customize</span> Plantillas
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="docs" aria-label="Ayuda">
          <span class="material-symbols-outlined">help</span> Ayuda
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="settings" aria-label="Configuración">
          <span class="material-symbols-outlined">settings</span> Configuración
        </button>
      </nav>

      <div class="border-t border-slate-900/10 px-3 py-3 text-[10px] text-slate-400">
        <span class="material-symbols-outlined">package_2</span>
        v10.4 · instructional-designer-skill
      </div>
    </aside>

    <!-- MAIN -->
    <main class="${ui.layout.appMain}" role="main">
      <header class="${cx(ui.liquid.control, 'mx-4 mt-3 flex h-[48px] shrink-0 items-center justify-between px-5')}" data-tauri-drag-region>
        <div>
          <h2 id="topbar-title" class="text-sm font-bold text-slate-800">Instructional Design Studio</h2>
          <div id="topbar-sub" class="text-[11px] text-slate-500"></div>
        </div>
        <div class="flex items-center gap-1">
          <div class="flex items-center gap-1">
            <button class="${ui.windowControl.base}" id="app-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
            <button class="${cx(ui.windowControl.base, ui.windowControl.close)}" id="app-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
          </div>
        </div>
      </header>

      <div class="${ui.surface.page}">
        <section id="p-courses" hidden aria-label="Cursos"></section>
        <section id="p-syllabus" hidden aria-label="Editor de sílabo"></section>
        <section id="p-templates" hidden aria-label="Plantillas"></section>
        <section id="p-settings" hidden aria-label="Configuración"></section>
        <section id="p-docs" hidden aria-label="Documentación"></section>
      </div>
    </main>
  `;
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-nav-item][data-page], .sidebar-cta button[data-page]");
  if (nav) navigate(nav.dataset.page);
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
