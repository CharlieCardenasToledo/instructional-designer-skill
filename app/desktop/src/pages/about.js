import { APP_META } from "../appMeta.js";
import { getRuntimeAppMeta, openExternal } from "../api.js";
import { toast } from "../toast.js";
import { ui, cx } from "../uiClasses.js";
import { ic } from "../icons.js";
import { BrandMark } from "../components/BrandMark.js";

const technologyGroups = [
  {
    title: "Aplicación de escritorio",
    icon: "monitor",
    items: ["Tauri 2", "Rust", "React", "Vite", "Tailwind CSS 4"],
  },
  {
    title: "Documentos académicos",
    icon: "file-text",
    items: ["LaTeX", "ElegantBook", "Jintia Skill"],
  },
  {
    title: "Interfaz y tipografía",
    icon: "palette",
    items: ["Lucide", "Inter", "Tailwind CSS"],
  },
];

export async function renderAbout() {
  const el = document.getElementById("p-about");
  if (!el) return;

  el.innerHTML = `
    <div class="mx-auto max-w-5xl space-y-5 pb-10" aria-busy="true">
      <div class="${cx(ui.surface.card, "relative overflow-hidden p-7")}">
        <div class="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 opacity-60 md:block" aria-hidden="true">
          <svg viewBox="0 0 420 220" class="h-full w-full" fill="none">
            <path d="M24 176C104 176 85 54 171 54c80 0 63 108 139 108 45 0 62-42 86-86" stroke="#0fa3a3" stroke-opacity=".18" stroke-width="2"/>
            <circle cx="24" cy="176" r="5" fill="#0fa3a3" fill-opacity=".22"/>
            <circle cx="171" cy="54" r="5" fill="#0fa3a3" fill-opacity=".22"/>
            <circle cx="310" cy="162" r="5" fill="#0fa3a3" fill-opacity=".22"/>
          </svg>
        </div>
        <div class="relative max-w-2xl">
          <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            ${BrandMark({ className: "h-9 w-9", size: 36 })}
          </div>
          <p class="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">Acerca del producto</p>
          <h1 class="text-3xl font-black tracking-tight text-slate-950">${APP_META.brandName}</h1>
          <p class="mt-1 text-base font-medium text-slate-600">${APP_META.tagline}</p>
          <p class="mt-5 max-w-xl text-sm leading-6 text-slate-600">
            Un entorno abierto de diseño instruccional que conecta el sílabo, la planificación semanal,
            las actividades, la evidencia y los documentos listos para publicar.
          </p>
          <div class="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Desktop <span data-about-app-version>…</span></span>
            <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Skill v${APP_META.skillVersion}</span>
            <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">${APP_META.license}</span>
          </div>
          <p class="mt-5 text-sm text-slate-700">Creado y mantenido por <strong>${APP_META.creator}</strong>.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="${cx(ui.button.base, ui.button.primary, ui.button.sm)}" data-external-url="${APP_META.repository}">
              <span class="material-symbols-outlined text-lg">code</span> Ver proyecto
            </button>
            <button type="button" class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-external-url="${APP_META.issues}">
              <span class="material-symbols-outlined text-lg">bug_report</span> Informar un problema
            </button>
          </div>
        </div>
      </div>

      <nav class="${cx(ui.liquid.control, "sticky top-[76px] z-20 flex w-fit max-w-full gap-1 p-1")}" aria-label="Secciones de Acerca de">
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-about-section="about-project">Proyecto</button>
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-about-section="about-origin">Origen del nombre</button>
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-about-section="about-authorship">Autoría</button>
        <button class="${cx(ui.button.base, ui.button.ghost, ui.button.sm)}" data-about-section="about-technology">Tecnologías</button>
      </nav>

      <section id="about-project" class="${cx(ui.surface.card, "p-6")}">
        <h2 class="text-lg font-extrabold text-slate-900">Proyecto</h2>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          Jintia ayuda a convertir una estructura académica compleja en un recorrido claro y verificable.
          La aplicación administra la configuración y los cursos; la skill aporta el método, las plantillas
          y las validaciones para producir materiales consistentes.
        </p>
      </section>

      <section id="about-origin" class="${cx(ui.surface.card, "p-6")}">
        <h2 class="text-lg font-extrabold text-slate-900">El origen de nuestro nombre</h2>
        <p class="mt-2 text-sm leading-6 text-slate-700">${APP_META.originAttribution}</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">La elección expresa el propósito de la aplicación: ayudar a docentes a convertir un sílabo en una ruta de aprendizaje coherente, conectando resultados, contenidos, actividades, evaluaciones y recursos.</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">En el Currículo Nacional Intercultural Bilingüe de la Nacionalidad Shuar, la expresión <em>Aarma jintia</em> se emplea para referirse a “textos instructivos”.</p>
        <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Reconocimiento:</strong> ${APP_META.originDisclaimer}</div>
        <div class="mt-5 border-t border-slate-200 pt-4"><h3 class="text-sm font-bold text-slate-900">Fuentes</h3><ul class="mt-2 space-y-2 text-xs leading-5 text-slate-600"><li>Ministerio de Educación del Ecuador. <em>Currículo Nacional Intercultural Bilingüe de la Nacionalidad Shuar</em>, 2017, p. 106.</li><li>Pellizzaro, S. M. y Náwech, F. O. <em>Chicham: Diccionario shuar-castellano</em>, 2005.</li></ul></div>
      </section>

      <section id="about-authorship" class="${cx(ui.surface.card, "p-6")}">
        <h2 class="text-lg font-extrabold text-slate-900">Autoría y licencia</h2>
        <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt class="font-semibold text-slate-500">Autor y mantenedor</dt><dd class="mt-1 font-bold text-slate-900">${APP_META.creator}</dd></div>
          <div><dt class="font-semibold text-slate-500">Licencia del proyecto</dt><dd class="mt-1 font-bold text-slate-900">${APP_META.license}</dd></div>
          <div><dt class="font-semibold text-slate-500">Aplicación</dt><dd class="mt-1 text-slate-800" data-about-runtime>${APP_META.desktopName}</dd></div>
          <div><dt class="font-semibold text-slate-500">Motor académico</dt><dd class="mt-1 text-slate-800">${APP_META.skillName} v${APP_META.skillVersion}</dd></div>
        </dl>
        <p class="mt-5 text-xs leading-5 text-slate-500">${APP_META.copyright}. Los nombres y marcas de terceros pertenecen a sus respectivos titulares.</p>
      </section>

      <section id="about-technology" class="${cx(ui.surface.card, "p-6")}">
        <h2 class="text-lg font-extrabold text-slate-900">Tecnologías y atribuciones</h2>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          ${technologyGroups.map(group => `
            <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span class="text-brand-600" aria-hidden="true">${ic(group.icon, 22)}</span>
              <h3 class="mt-2 text-sm font-bold text-slate-900">${group.title}</h3>
              <p class="mt-1 text-xs leading-5 text-slate-600">${group.items.join(" · ")}</p>
            </article>`).join("")}
        </div>
        <p class="mt-4 text-xs leading-5 text-slate-500">
          Jintia no está afiliado ni patrocinado por Anthropic, Google, Gemini o NotebookLM.
          Consulta los avisos incluidos con la aplicación para conocer licencias y marcas.
        </p>
      </section>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-slate-500">
        <button type="button" class="font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" data-external-url="${APP_META.licenseUrl}">Licencia MIT</button>
        <button type="button" class="font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" data-external-url="${APP_META.privacyUrl}">Privacidad</button>
        <span>${APP_META.copyright}</span>
      </div>
    </div>`;

  el.querySelectorAll("[data-about-section]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.aboutSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  el.querySelectorAll("[data-external-url]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        await openExternal(button.dataset.externalUrl);
      } catch {
        toast("No se pudo abrir el enlace externo.", "error");
      }
    });
  });

  const runtime = await getRuntimeAppMeta();
  el.querySelector("[data-about-app-version]")?.replaceChildren(document.createTextNode(`v${runtime.version}`));
  el.querySelector("[data-about-runtime]")?.replaceChildren(document.createTextNode(`${runtime.name} v${runtime.version} · Tauri ${runtime.tauriVersion}`));
  el.querySelector("[aria-busy]")?.setAttribute("aria-busy", "false");
}
