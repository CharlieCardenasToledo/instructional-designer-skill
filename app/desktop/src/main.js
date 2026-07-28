/**
 * main.js — Composition Root (Clean Architecture)
 */
import "./styles.css";

import { state }              from "./state.js";
import { refreshIcons }       from "./icons.js";
import { navigate, registerPage } from "./router.js";

import { renderCourses }      from "./pages/courses.js";
import { renderPdfs }         from "./pages/pdfs.js";
import { renderSyllabus }     from "./pages/syllabus.js";
import { renderTemplates }    from "./pages/templates.js";
import { renderSettings }     from "./pages/settings.js";
import { renderDocs }         from "./pages/docs.js";
import { renderAbout }        from "./pages/about.js";
import { toast }              from "./toast.js";
import { getOnboardingStatus, getRuntimeAppMeta } from "./api.js";
import { mountGeminiLoading, renderOnboarding } from "./onboarding.js";
import { getCurrentWindow }  from "@tauri-apps/api/window";
import { ui, cx } from "./uiClasses.js";
import { APP_META } from "./appMeta.js";

registerPage("courses",   renderCourses);
registerPage("pdfs",      renderPdfs);
registerPage("syllabus",  renderSyllabus);
registerPage("templates", renderTemplates);
registerPage("settings",  renderSettings);
registerPage("docs",      renderDocs);
registerPage("about",     renderAbout);

function renderShell() {
  document.getElementById("app").innerHTML = `

    <!-- SIDEBAR -->
    <aside class="flex w-[188px] shrink-0 flex-col border-r border-slate-200 bg-white xl:w-[220px]" role="navigation" aria-label="Menú principal">
      <div class="flex items-center gap-2.5 border-b border-slate-900/10 px-4 py-4">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm" aria-hidden="true">
          <span class="material-symbols-outlined">route</span>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-[14px] font-extrabold tracking-tight text-slate-900">Jintia</h1>
          <span class="block max-w-[145px] text-[9px] leading-tight text-slate-500">Diseña el camino del aprendizaje</span>
        </div>
      </div>

      <div class="px-3 py-3">
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm, ui.button.xs, 'w-full border-dashed border-slate-300/60')}" data-page="courses" data-create-course>
          <span class="material-symbols-outlined" style="font-size:15px">add</span>
          Nueva asignatura
        </button>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button class="${ui.nav.item}" data-nav-item data-page="courses" aria-label="Cursos">
          <span class="material-symbols-outlined">school</span> Cursos
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="pdfs" aria-label="PDFs generados">
          <span class="material-symbols-outlined">picture_as_pdf</span> PDFs
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

      <div class="border-t border-slate-900/10 p-2">
        <button type="button" class="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" data-sidebar-page data-page="about" aria-label="Acerca de Jintia">
          <span class="material-symbols-outlined text-[19px] text-slate-400 group-hover:text-teal-700">route</span>
          <span class="min-w-0">
            <span class="block truncate text-[10px] font-bold text-slate-600" data-shell-version>${APP_META.brandName} · …</span>
            <span class="block truncate text-[9px] text-slate-400">Por ${APP_META.creator}</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="${ui.layout.appMain}" role="main">
      <header class="${cx(ui.liquid.control, 'absolute inset-x-4 top-3 z-30 flex h-[52px] items-center justify-between px-5')}" data-tauri-drag-region>
        <div>
          <h2 id="topbar-title" class="text-sm font-bold text-slate-800">Jintia Desktop</h2>
          <div id="topbar-sub" class="text-[11px] text-slate-500"></div>
        </div>
        <div class="flex items-center gap-1">
          <div class="${cx(ui.liquid.group, 'flex items-center gap-0.5 p-0.5')}" role="group" aria-label="Controles de ventana">
            <button class="${ui.windowControl.base}" id="app-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
            <button class="${ui.windowControl.base}" id="app-win-maximize" aria-label="Maximizar o restaurar" title="Maximizar o restaurar"><span class="material-symbols-outlined">crop_square</span></button>
            <button class="${cx(ui.windowControl.base, ui.windowControl.close)}" id="app-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
          </div>
        </div>
      </header>

      <div class="${cx(ui.surface.page, 'pt-[80px]')}">
        <section class="h-full min-h-0 min-w-0" id="p-courses" hidden aria-label="Cursos"></section>
        <section class="h-full min-h-0 min-w-0" id="p-pdfs" hidden aria-label="PDFs generados"></section>
        <section class="h-full min-h-0 min-w-0" id="p-syllabus" hidden aria-label="Editor de sílabo"></section>
        <section class="h-full min-h-0 min-w-0" id="p-templates" hidden aria-label="Plantillas"></section>
        <section class="h-full min-h-0 min-w-0" id="p-settings" hidden aria-label="Configuración"></section>
        <section class="h-full min-h-0 min-w-0" id="p-docs" hidden aria-label="Documentación"></section>
        <section class="h-full min-h-0 min-w-0" id="p-about" hidden aria-label="Acerca de Jintia"></section>
      </div>
    </main>
  `;
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-nav-item][data-page], [data-sidebar-page][data-page], [data-create-course][data-page], .sidebar-cta button[data-page]");
  if (nav) {
    navigate(nav.dataset.page);
    if (nav.hasAttribute("data-create-course")) {
      document.dispatchEvent(new CustomEvent("jintia:new-course", { detail: { opener: nav } }));
    }
  }
});

// El onboarding es una página independiente: la app principal (sidebar,
// topbar, páginas) ni siquiera se construye hasta que el onboarding termine.
async function boot() {
  const stopInitialLoading = mountGeminiLoading(
    document.getElementById("onboarding-root"),
    "Cargando Jintia…",
  );
  try {
    const onboarding = await getOnboardingStatus();
    stopInitialLoading();
    if (onboarding.completed) {
      await getCurrentWindow().maximize();
      renderShell();
      getRuntimeAppMeta().then(runtime => {
        const version = document.querySelector("[data-shell-version]");
        if (version) version.textContent = `${APP_META.brandName} · v${runtime.version}`;
      });
      refreshIcons();
      navigate(state.page || "courses");
      document.getElementById("app-win-minimize")?.addEventListener("click", () => getCurrentWindow().minimize());
      document.getElementById("app-win-maximize")?.addEventListener("click", () => getCurrentWindow().toggleMaximize());
      document.getElementById("app-win-close")?.addEventListener("click", () => getCurrentWindow().close());
    } else {
      await renderOnboarding();
    }
  } catch {
    stopInitialLoading();
    await renderOnboarding();
  }
}

boot();
