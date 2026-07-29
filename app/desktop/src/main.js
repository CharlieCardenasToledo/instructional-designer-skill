/**
 * main.js — Composition Root (Clean Architecture)
 */
import "./styles.css";

import { state }              from "./state.js";
import { refreshIcons, ic }       from "./icons.js";
import { navigate, registerPage } from "./router.js";

refreshIcons();

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
import { BrandLockup } from "./components/BrandLockup.js";
import { BrandMark } from "./components/BrandMark.js";

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
    <aside class="hidden flex-col bg-brand-950 text-slate-300 sm:flex sm:w-[216px] shrink-0 xl:w-[240px]" role="navigation" aria-label="Menú principal">
      <span class="sr-only">Jintia</span>
      <span class="sr-only">Diseña el camino del aprendizaje</span>
      ${BrandLockup()}

      <div class="p-3">
        <button class="${cx(ui.button.base, ui.button.primary, ui.button.xs, 'w-full !border-brand-600/30 !bg-brand-700 hover:!bg-brand-800')}" data-page="courses" data-create-course>
          ${ic("plus", 15)}
          Nueva asignatura
        </button>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button class="${ui.nav.item}" data-nav-item data-page="courses" aria-label="Cursos">
          ${ic("graduation-cap", 18)} Cursos
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="pdfs" aria-label="PDFs generados">
          ${ic("file-text", 18)} PDFs
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="templates" aria-label="Plantillas">
          ${ic("layout-template", 18)} Plantillas
        </button>
        <div class="mt-auto border-t border-white/10 pt-1" role="separator" aria-hidden="true"></div>
        <button class="${ui.nav.item}" data-nav-item data-page="docs" aria-label="Ayuda">
          ${ic("help-circle", 18)} Ayuda
        </button>
        <button class="${ui.nav.item}" data-nav-item data-page="settings" aria-label="Configuración">
          ${ic("settings", 18)} Configuración
        </button>
      </nav>

      <div class="sidebar-footer border-t border-white/10 p-2">
        <button type="button" class="group flex w-full items-center gap-2 rounded-lg bg-transparent px-2.5 py-2 text-left text-slate-300 transition hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60" data-sidebar-page data-page="about" aria-label="Acerca de Jintia">
          ${BrandMark({ mono: true, light: true, className: "h-5 w-5", size: 20 })}
          <span class="min-w-0">
            <span class="block truncate text-[10px] font-bold text-slate-300" data-shell-version>${APP_META.brandName} · …</span>
            <span class="block truncate text-[9px] text-slate-400">Por ${APP_META.creator}</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="${ui.layout.appMain}" role="main">
      <header class="${cx(ui.liquid.control, 'liquid-control-topbar absolute inset-x-4 top-3 z-30 flex h-[52px] items-center justify-between px-5')}" data-tauri-drag-region>
        <div class="min-w-0">
          <h2 id="topbar-title" class="title-medium text-slate-800">Jintia Desktop</h2>
          <div id="topbar-sub" class="truncate text-[11px] text-slate-600"></div>
        </div>
        <div class="flex items-center gap-1">
          <div class="${cx(ui.liquid.group, 'flex items-center gap-0.5 p-1')}" role="group" aria-label="Controles de ventana">
            <button class="relative isolate inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-transparent bg-white/10 text-slate-700 transition hover:border-white/55 hover:bg-white/55 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1" id="app-win-minimize" aria-label="Minimizar ventana (WCAG 44×44px touch target)" title="Minimizar">${ic("minus", 16)}</button>
            <button class="relative isolate inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-transparent bg-white/10 text-slate-700 transition hover:border-white/55 hover:bg-white/55 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1" id="app-win-maximize" aria-label="Maximizar o restaurar ventana (WCAG 44×44px touch target)" title="Maximizar o restaurar">${ic("square", 14)}</button>
            <button class="relative isolate inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-transparent bg-white/10 text-slate-700 transition hover:border-red-300/70 hover:bg-red-500/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1" id="app-win-close" aria-label="Cerrar ventana (WCAG 44×44px touch target)" title="Cerrar">${ic("x", 16)}</button>
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
  const nav = event.target.closest("[data-nav-item][data-page], [data-sidebar-page][data-page], [data-create-course][data-page], [data-create-course]");
  if (nav) {
    navigate(nav.dataset.page);
    if (nav.hasAttribute("data-create-course")) {
      document.dispatchEvent(new CustomEvent("jintia:new-course", { detail: { opener: nav } }));
    }
  }
});

// Alt+1..5 salta entre las secciones del sidebar en el orden en que aparecen
// (affordance mínima de power user; no compite con atajos del navegador/SO).
document.addEventListener("keydown", event => {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const index = Number(event.key) - 1;
  const items = document.querySelectorAll("[data-nav-item][data-page]");
  if (index < 0 || index >= items.length) return;
  event.preventDefault();
  navigate(items[index].dataset.page);
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
