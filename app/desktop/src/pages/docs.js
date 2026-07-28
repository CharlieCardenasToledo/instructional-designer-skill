import { navigate } from "../router.js";

export function renderDocs() {
  const el = document.getElementById("p-docs");
  if (!el) return;

  el.innerHTML = `
    <div class="max-w-3xl">
      <div class="rounded-app-lg border border-slate-200 bg-white p-6 text-[13.5px] leading-[1.7] shadow-sm [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h2]:mb-2.5 [&_h2]:mt-6 [&_h2]:text-[17px] [&_h2]:font-bold [&_p]:mb-3 [&_p]:text-app-text-2">
        <h1 class="text-app-text">Ayuda</h1>
        <p class="mb-5 border-b border-slate-300/30 pb-4 text-sm text-app-muted">
          Lo esencial para dejar la app funcionando y resolver los problemas más comunes.
        </p>

        <h2>Requisitos</h2>
        <p>Necesitas Node.js, Python y un compilador LaTeX instalados. Revisa su estado en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="environment">Configuración → Entorno</button>. En Windows la app puede iniciar la instalación con tu confirmación; en macOS y Linux muestra los comandos recomendados para completarla manualmente.</p>

        <h2>Conexión</h2>
        <p>Para usar NotebookLM y elegir dónde trabajar (proyecto local, app de Claude, o ambos), ve a <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="mcp-config">Configuración → Conexiones</button>.</p>
        <div class="my-3.5 flex items-start gap-3 rounded-lg border-l-[3px] border-teal-600 bg-brand/[0.05] px-3.5 py-3">
          <span class="material-symbols-outlined mt-px shrink-0 text-lg text-teal-600">info</span>
          <div>
            <div class="mb-1 text-[13px] font-bold text-brand">Antes de generar tu primera guía</div>
            <p class="m-0 text-[12.5px] text-slate-700">Completa tu perfil institucional en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 underline hover:text-teal-700 inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="inst-profile">Configuración → Perfil institucional</button>: esos datos se incrustan automáticamente en cada documento generado.</p>
          </div>
        </div>

        <h2>Instalar o exportar la skill</h2>
        <p>Para Claude Code, instala la skill en tu carpeta local desde la app. Para Claude en la web o escritorio, exporta el ZIP y súbelo desde <strong>Customize → Skills</strong>. El ZIP puede incluir tu configuración institucional y las referencias de tus notebooks; revísalo antes de compartirlo.</p>

        <h2>Solución de problemas</h2>
        <p><strong>Un botón de conexión falla:</strong> vuelve a <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="mcp-config">Configuración → Conexiones</button> y pulsa "Verificar". Si el problema persiste, cierra sesión de Google y vuelve a iniciarla.</p>
        <p><strong>No se genera el PDF:</strong> confirma en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="environment">Configuración → Entorno</button> que el compilador LaTeX esté instalado; sin él no es posible compilar el documento final.</p>
        <p><strong>Quieres empezar de nuevo:</strong> en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="app-prefs">Configuración → Preferencias</button> hay un botón para reiniciar el onboarding.</p>

        <div class="mt-7 border-t border-slate-200 pt-4">
          <button type="button" class="inline-flex items-center gap-1.5 rounded-lg font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" data-doc-nav="about">
            <span class="material-symbols-outlined text-lg">info</span>
            Acerca de Jintia, autoría y licencias
          </button>
        </div>
      </div>
    </div>`;

  el.querySelectorAll("[data-doc-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.docNav;
      const section = btn.dataset.section;
      navigate(page);
      if (section) {
        setTimeout(() => {
          const target = document.getElementById(section);
          if (target) target.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    });
  });
}
