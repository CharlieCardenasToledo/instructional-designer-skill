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
    <aside class="flex w-[220px] shrink-0 flex-col border-r border-slate-900/10 bg-white/55 backdrop-blur-xl" role="navigation" aria-label="Menú principal">
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
        <button class="nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800" data-page="courses" aria-label="Cursos">
          <span class="material-symbols-outlined">school</span> Cursos
        </button>
        <button class="nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800" data-page="templates" aria-label="Plantillas">
          <span class="material-symbols-outlined">dashboard_customize</span> Plantillas
        </button>
        <button class="nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800" data-page="docs" aria-label="Ayuda">
          <span class="material-symbols-outlined">help</span> Ayuda
        </button>
        <button class="nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800" data-page="settings" aria-label="Configuración">
          <span class="material-symbols-outlined">settings</span> Configuración
        </button>
      </nav>

      <div class="border-t border-slate-900/10 px-3 py-3 text-[10px] text-slate-400">
        <span class="material-symbols-outlined">package_2</span>
        v10.4 · instructional-designer-skill
      </div>
    </aside>

    <!-- MAIN -->
    <main class="flex min-w-0 flex-1 flex-col overflow-hidden" role="main">
      <header class="flex h-[54px] shrink-0 items-center justify-between border-b border-slate-900/10 bg-white/45 px-5 backdrop-blur-xl" data-tauri-drag-region>
        <div>
          <h2 class="text-[14px] font-bold text-slate-800">Instructional Design Studio</h2>
          <div class="text-[11px] text-slate-500"></div>
        </div>
        <div class="flex items-center gap-1">
          <div class="flex items-center gap-1">
            <button class="win-btn inline-flex h-7 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-900/5" id="app-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
            <button class="win-btn win-btn--close inline-flex h-7 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-600 hover:text-white" id="app-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
          </div>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-5">
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
