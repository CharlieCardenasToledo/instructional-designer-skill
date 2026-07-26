import { navigate } from "../router.js";

export function renderDocs() {
  const el = document.getElementById("p-docs");
  if (!el) return;

  el.innerHTML = `
    <div class="max-w-3xl">
      <div class="docs-content rounded-app-lg border border-slate-900/10 bg-white/65 shadow-glass backdrop-blur-xl">
        <h1>Ayuda</h1>
        <p style="color:var(--muted);font-size:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(195,198,213,0.30)">
          Lo esencial para dejar la app funcionando y resolver los problemas más comunes.
        </p>

        <h2>Requisitos</h2>
        <p>Necesitas Node.js, Python y un compilador LaTeX instalados. Revisa su estado en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="environment">Configuración → Entorno</button>; desde ahí puedes instalar lo que falte con un clic.</p>

        <h2>Conexión</h2>
        <p>Para usar NotebookLM y elegir dónde trabajar (proyecto local, app de Claude, o ambos), ve a <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="mcp-config">Configuración → Conexiones</button>.</p>
        <div class="docs-admonition">
          <span class="material-symbols-outlined">info</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--teal);margin-bottom:4px">Antes de generar tu primera guía</div>
            <p style="margin:0;font-size:12.5px;color:var(--text-2)">Completa tu perfil institucional en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="inst-profile">Configuración → Perfil institucional</button>: esos datos se incrustan automáticamente en cada documento generado.</p>
          </div>
        </div>

        <h2>Solución de problemas</h2>
        <p><strong>Un botón de conexión falla:</strong> vuelve a <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="mcp-config">Configuración → Conexiones</button> y pulsa "Verificar". Si el problema persiste, cierra sesión de Google y vuelve a iniciarla.</p>
        <p><strong>No se genera el PDF:</strong> confirma en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="environment">Configuración → Entorno</button> que el compilador LaTeX esté instalado; sin él no es posible compilar el documento final.</p>
        <p><strong>Quieres empezar de nuevo:</strong> en <button type="button" class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-600 hover:text-teal-700 underline inline-flex items-center gap-0.5" data-doc-nav="settings" data-section="app-prefs">Configuración → Preferencias</button> hay un botón para reiniciar el onboarding.</p>
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
