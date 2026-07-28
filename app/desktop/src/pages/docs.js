import { navigate } from "../router.js";
import { ui, cx } from "../uiClasses.js";

const QUICK_ACTIONS = [
  {
    icon: "person_edit",
    title: "Completar mi perfil",
    description: "Configura autoría, institución, carrera y color editorial.",
    page: "settings",
    section: "inst-profile",
  },
  {
    icon: "add_circle",
    title: "Crear una asignatura",
    description: "Registra el curso, su carpeta y el número de semanas.",
    page: "courses",
  },
  {
    icon: "picture_as_pdf",
    title: "Probar una plantilla",
    description: "Compila un PDF real antes de activar el formato.",
    page: "templates",
  },
  {
    icon: "construction",
    title: "Revisar herramientas",
    description: "Comprueba Node.js, Python y el compilador LaTeX.",
    page: "settings",
    section: "environment",
  },
];

const FAQS = [
  {
    question: "¿Qué diferencia hay entre Jintia Desktop y jintia-skill?",
    answer: "Jintia Desktop configura el entorno, administra asignaturas, estructura el sílabo y prepara archivos. La skill es el motor de diseño instruccional que Claude, ChatGPT y Codex pueden utilizar para redactar, validar y compilar guías académicas completas.",
  },
  {
    question: "¿Qué herramientas son obligatorias?",
    answer: "El flujo completo requiere Node.js, Python y un compilador LaTeX. Git es opcional. Jintia muestra su estado en Configuración → Entorno.",
  },
  {
    question: "¿Jintia instala automáticamente los componentes LaTeX que falten?",
    answer: "En Windows, la compilación nativa con MiKTeX intenta localizar e instalar automáticamente los paquetes LaTeX faltantes. La instalación inicial de herramientas siempre solicita confirmación. En macOS y Linux, Jintia muestra las instrucciones correspondientes al sistema.",
  },
  {
    question: "¿Por qué la primera vista previa de una plantilla puede tardar?",
    answer: "La vista previa no es una imagen simulada: Jintia construye una guía de muestra y ejecuta una compilación LaTeX real. La primera ejecución puede preparar clases, estilos o paquetes; las siguientes pueden reutilizar un PDF validado si nada cambió.",
  },
  {
    question: "¿Activar una plantilla modifica guías que ya existen?",
    answer: "No. La plantilla activa se utilizará al generar o compilar documentos nuevos. Los archivos académicos existentes no se reescriben automáticamente.",
  },
  {
    question: "¿Necesito NotebookLM para usar Jintia?",
    answer: "No para organizar asignaturas o editar el sílabo. NotebookLM es el método preferido para contrastar bibliografía y evidencia cuando la skill redacta contenido académico. Si no está disponible, deben existir fuentes locales verificables.",
  },
  {
    question: "¿Qué información se envía a Internet?",
    answer: "Jintia no tiene telemetría ni un backend propio. Solo usan red las acciones que la requieren: NotebookLM, extracción de una paleta web, instalación de dependencias, descargas desde GitHub o la subida manual de una skill exportada.",
  },
  {
    question: "¿Dónde se guardan mis cursos y configuraciones?",
    answer: "Los archivos académicos permanecen en la carpeta que eliges. El panel conserva la lista de asignaturas localmente, y la configuración institucional, notebooks y onboarding se guardan en el directorio de configuración de la aplicación.",
  },
  {
    question: "¿Cuál es la diferencia entre instalar y exportar la skill?",
    answer: "Para Claude Code se instala una skill local. Para ChatGPT y Codex se instala un plugin universal que aparece en Plugins después de reiniciar ChatGPT. Exportar crea un paquete transportable; no lo publica automáticamente en el directorio público.",
  },
  {
    question: "¿Jintia funciona en ChatGPT web?",
    answer: "La misma skill puede distribuirse mediante el plugin universal. El uso público en ChatGPT web depende de que el plugin sea enviado, revisado y publicado por OpenAI, además de la disponibilidad del plan y las políticas del workspace. La instalación local prepara ChatGPT desktop y Codex, pero no equivale a publicación pública.",
  },
  {
    question: "Claude Code no detecta la skill. ¿Qué reviso?",
    answer: "Confirma que la carpeta se llame jintia-skill y que SKILL.md esté directamente en su raíz. Después reinstala desde Jintia y reinicia Claude Code si ya estaba abierto.",
  },
  {
    question: "¿Por qué el PDF falla aunque el compilador esté instalado?",
    answer: "Puede faltar un paquete LaTeX, una clase de la plantilla, biber o un archivo citado. Reintenta para permitir la preparación automática y copia el diagnóstico si vuelve a fallar. Los errores como “File .sty not found” identifican el componente ausente.",
  },
  {
    question: "¿Necesito WSL para compilar?",
    answer: "La aplicación usa el compilador LaTeX nativo para pruebas y vistas previas. En Windows la skill prefiere pdflatex y biber nativos y recurre a WSL solo cuando no están disponibles; en macOS y Linux utiliza la instalación local.",
  },
  {
    question: "¿Qué ocurre si vuelvo a mostrar el onboarding?",
    answer: "Solo se reactiva el recorrido inicial. No se eliminan el perfil, las asignaturas, los notebooks ni los archivos generados.",
  },
  {
    question: "¿Puedo compartir un ZIP exportado?",
    answer: "Sí, pero revísalo primero. Puede contener institution.json y notebooks.json con nombres, rutas o referencias reales. No compartas identificadores privados, datos de estudiantes ni información institucional sensible.",
  },
];

export function renderDocs() {
  const el = document.getElementById("p-docs");
  if (!el) return;

  el.innerHTML = `
    <div class="mx-auto flex min-h-full w-full max-w-[1180px] min-w-0 flex-col gap-5">
      <header class="rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <div class="max-w-[72ch]">
          <h1 class="text-[24px] font-extrabold tracking-tight text-app-text sm:text-[28px]">¿Cómo podemos ayudarte?</h1>
          <p class="mt-2 text-sm leading-6 text-app-muted">
            Encuentra el siguiente paso, resuelve un error o comprende cómo trabajan juntos Jintia Desktop, Claude, ChatGPT, Codex y la skill.
          </p>
        </div>
        <div class="relative mt-5 max-w-2xl">
          <span class="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" aria-hidden="true">search</span>
          <input class="min-h-12 w-full rounded-full border border-slate-300 bg-white py-3 pl-11 pr-24 text-sm text-app-text outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            id="help-search" type="search" placeholder="Buscar: PDF, NotebookLM, ChatGPT, Codex, Claude…" autocomplete="off"
            aria-describedby="help-search-status">
          <button class="absolute right-2 top-1/2 hidden min-h-11 -translate-y-1/2 rounded-full px-3 text-xs font-semibold text-teal-700 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            id="help-search-clear" type="button">Limpiar</button>
        </div>
        <p id="help-search-status" class="mt-2 min-h-5 text-xs text-app-muted" role="status" aria-live="polite">
          Busca en guías, solución de problemas y preguntas frecuentes.
        </p>
      </header>

      <div class="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside class="xl:sticky xl:top-0">
          <nav class="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm xl:flex-col" aria-label="Contenido de ayuda">
            ${helpNavButton("help-start", "Primeros pasos", "route")}
            ${helpNavButton("help-workflows", "Flujos principales", "account_tree")}
            ${helpNavButton("help-troubleshooting", "Resolver problemas", "build")}
            ${helpNavButton("help-faq", "Preguntas frecuentes", "quiz")}
            ${helpNavButton("help-privacy", "Datos y privacidad", "shield")}
          </nav>
        </aside>

        <main class="min-w-0 space-y-5" id="help-content">
          ${startSection()}
          ${workflowsSection()}
          ${troubleshootingSection()}
          ${faqSection()}
          ${privacySection()}
          <div id="help-no-results" class="hidden rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="status">
            <span class="material-symbols-outlined mb-2 block text-[34px] text-slate-400" aria-hidden="true">search_off</span>
            <h2 class="text-base font-bold text-app-text">No encontramos ese tema</h2>
            <p class="mt-2 text-sm text-app-muted">Prueba con “PDF”, “NotebookLM”, “plantilla”, “instalar” o “privacidad”.</p>
            <button class="${cx(ui.button.base, ui.button.secondary, "mt-4 min-h-11")}" type="button" data-clear-help-search>Mostrar toda la ayuda</button>
          </div>
        </main>
      </div>
    </div>`;

  bindDocsEvents(el);
}

function helpNavButton(target, label, icon) {
  return `
    <button class="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand xl:w-full"
      type="button" data-help-anchor="${target}">
      <span class="material-symbols-outlined text-[18px] text-teal-700" aria-hidden="true">${icon}</span>
      ${label}
    </button>`;
}

function startSection() {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="help-start"
      data-help-section data-help-searchable data-search="primeros pasos comenzar perfil asignatura plantilla herramientas configuración">
      ${sectionHeading("Empieza por tu objetivo", "Accesos directos", "Elige la tarea que quieres completar ahora.")}
      <div class="divide-y divide-slate-200 rounded-lg border border-slate-200">
        ${QUICK_ACTIONS.map(action => `
          <button class="group flex min-h-[72px] w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-4"
            type="button" data-doc-nav="${action.page}" ${action.section ? `data-section="${action.section}"` : ""}
            data-help-searchable data-search="${action.title} ${action.description}">
            <span class="material-symbols-outlined grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xl text-teal-700" aria-hidden="true">${action.icon}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-bold text-app-text">${action.title}</span>
              <span class="mt-0.5 block text-xs leading-5 text-app-muted">${action.description}</span>
            </span>
            <span class="material-symbols-outlined text-xl text-slate-400 transition group-hover:text-teal-700" aria-hidden="true">arrow_forward</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function workflowsSection() {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="help-workflows"
      data-help-section data-help-searchable data-search="flujos principales curso sílabo readme plantilla pdf notebooklm claude code skill exportar zip">
      ${sectionHeading("Flujos principales", "Del sílabo al PDF", "Jintia prepara el entorno y la skill desarrolla el contenido académico.")}
      <div class="space-y-5">
        ${workflowBlock(
          "Crear una asignatura y estructurar el sílabo",
          "school",
          [
            "Crea la asignatura y elige una carpeta raíz.",
            "Completa cada semana: unidad, temas, resultados, bibliografía, horas y actividades.",
            "Guarda el borrador o marca la semana como completa.",
            "Genera el README.md canónico del curso. La skill lo utilizará como fuente de verdad.",
          ],
          "Abrir asignaturas",
          "courses"
        )}
        ${workflowBlock(
          "Elegir una plantilla editorial",
          "dashboard_customize",
          [
            "Selecciona una plantilla del catálogo.",
            "Jintia construye una guía de muestra con tu información preliminar.",
            "El compilador LaTeX genera un PDF real sin cambiar todavía la plantilla activa.",
            "Pulsa “Usar esta plantilla” solo después de revisar el resultado.",
          ],
          "Comparar plantillas",
          "templates"
        )}
        ${workflowBlock(
          "Trabajar con Claude y jintia-skill",
          "smart_toy",
          [
            "Para Claude Code, instala la skill en la carpeta local y reinicia Claude Code.",
            "Abre Claude Code dentro de la carpeta de la asignatura.",
            "Pide una semana concreta; la skill leerá el README, la configuración y las fuentes.",
            "Para Claude Skills, exporta el ZIP y súbelo manualmente desde Customize → Skills.",
          ],
          "Instalar o exportar",
          "settings",
          "app-prefs"
        )}
        ${workflowCard(
          "Usar Jintia con ChatGPT y Codex",
          [
            "En Configuración, instala el plugin universal para ChatGPT y Codex.",
            "Reinicia ChatGPT desktop y abre Plugins desde ChatGPT Work o Codex.",
            "Activa Jintia y solicita una guía, revisión de sílabo o actividad evaluativa.",
            "Para ChatGPT web público, prepara el paquete y completa el proceso de envío y revisión de OpenAI.",
          ],
          "extension"
        )}
        ${workflowBlock(
          "Contrastar bibliografía con NotebookLM",
          "menu_book",
          [
            "Autentica NotebookLM desde Configuración → Conexiones.",
            "Registra el código, nombre, carpeta e ID o URL del notebook del curso.",
            "La skill consulta primero el sílabo y las fuentes locales; NotebookLM contrasta cobertura y procedencia.",
            "Jintia nunca debe inventar autores, años, páginas o referencias faltantes.",
          ],
          "Configurar NotebookLM",
          "settings",
          "notebooks-section"
        )}
      </div>
    </section>`;
}

function workflowBlock(title, icon, steps, actionLabel, page, section = "") {
  return `
    <article data-help-searchable data-search="${title} ${steps.join(" ")}">
      <div class="mb-3 flex items-start gap-3">
        <span class="material-symbols-outlined mt-0.5 text-xl text-teal-700" aria-hidden="true">${icon}</span>
        <div>
          <h3 class="text-[15px] font-bold text-app-text">${title}</h3>
          <ol class="mt-2 space-y-2 text-[13px] leading-5 text-app-muted">
            ${steps.map((step, index) => `<li class="flex gap-2.5"><span class="font-bold text-teal-700">${index + 1}.</span><span>${step}</span></li>`).join("")}
          </ol>
          <button class="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-teal-700 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            type="button" data-doc-nav="${page}" ${section ? `data-section="${section}"` : ""}>
            ${actionLabel}<span class="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span>
          </button>
        </div>
      </div>
    </article>`;
}

function troubleshootingSection() {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="help-troubleshooting"
      data-help-section data-help-searchable data-search="resolver problemas error pdf latex sty biber notebooklm autenticar claude skill diagnóstico">
      ${sectionHeading("Resolver problemas", "Diagnóstico", "Empieza por el síntoma. Conserva el diagnóstico técnico si necesitas reportarlo.")}
      <div class="overflow-hidden rounded-lg border border-slate-200 divide-y divide-slate-200">
        ${troubleRow(
          "No se genera el PDF",
          "Comprueba el compilador en Configuración → Entorno. Reintenta una vez para permitir que MiKTeX prepare paquetes faltantes. Si vuelve a fallar, copia el diagnóstico; “File .sty not found” indica el componente ausente.",
          "environment"
        )}
        ${troubleRow(
          "NotebookLM no autentica",
          "Verifica Node.js y npx. Ejecuta la autenticación desde Conexiones y completa el inicio de sesión en Chrome. Si la sesión caducó, vuelve a autenticar y después pulsa Verificar.",
          "mcp-config"
        )}
        ${troubleRow(
          "Claude Code no detecta jintia-skill",
          "Reinstala la skill, confirma que SKILL.md esté directamente dentro de ~/.claude/skills/jintia-skill y reinicia Claude Code.",
          "app-prefs"
        )}
        ${troubleRow(
          "Una plantilla no compila",
          "Cada vista previa usa la clase y los estilos reales de la plantilla. Abre los detalles técnicos, copia el diagnóstico y confirma que las herramientas necesarias estén listas antes de reintentar.",
          "environment"
        )}
      </div>
      <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-5 text-slate-700">
        <strong class="text-app-text">Validación rápida y validación final no son lo mismo.</strong>
        Jintia Desktop usa el compilador nativo para pruebas y vistas previas. La skill ejecuta además linter, biber y varias pasadas de LaTeX antes de entregar una guía final.
      </div>
    </section>`;
}

function troubleRow(title, description, section) {
  return `
    <article class="p-4" data-help-searchable data-search="${title} ${description}">
      <h3 class="text-sm font-bold text-app-text">${title}</h3>
      <p class="mt-1.5 text-[13px] leading-5 text-app-muted">${description}</p>
      <button class="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        type="button" data-doc-nav="settings" data-section="${section}">
        Abrir configuración relacionada<span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
      </button>
    </article>`;
}

function faqSection() {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="help-faq"
      data-help-section data-help-searchable data-search="preguntas frecuentes faq">
      ${sectionHeading("Preguntas frecuentes", "Respuestas directas", "Información basada en la aplicación, la skill y la documentación actual del proyecto.")}
      <div class="divide-y divide-slate-200 border-y border-slate-200" id="help-faq-list">
        ${FAQS.map((faq, index) => `
          <details class="group" data-help-searchable data-faq-item data-search="${faq.question} ${faq.answer}">
            <summary class="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
              <span class="min-w-0 flex-1 text-sm font-bold text-app-text">${faq.question}</span>
              <span class="material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
            </summary>
            <div class="max-w-[72ch] pb-4 pr-8 text-[13px] leading-6 text-app-muted" id="faq-answer-${index}">
              ${faq.answer}
            </div>
          </details>`).join("")}
      </div>
    </section>`;
}

function privacySection() {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="help-privacy"
      data-help-section data-help-searchable data-search="datos privacidad local telemetría red notebooklm zip estudiantes seguridad">
      ${sectionHeading("Datos y privacidad", "Control local", "Tus archivos académicos permanecen bajo tu control.")}
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <h3 class="text-sm font-bold text-app-text">Se mantiene local</h3>
          <ul class="mt-2 space-y-2 text-[13px] leading-5 text-app-muted">
            <li>• Asignaturas y estado del panel.</li>
            <li>• Perfil institucional y notebooks registrados.</li>
            <li>• Sílabos, guías, PDFs y carpetas elegidas.</li>
            <li>• Estado del onboarding y preferencias.</li>
          </ul>
        </div>
        <div>
          <h3 class="text-sm font-bold text-app-text">Usa red cuando lo solicitas</h3>
          <ul class="mt-2 space-y-2 text-[13px] leading-5 text-app-muted">
            <li>• Autenticación y consultas de NotebookLM.</li>
            <li>• Extracción de colores desde un sitio web.</li>
            <li>• Instalación o descarga de dependencias.</li>
            <li>• Subida manual del ZIP a un servicio de Claude.</li>
          </ul>
        </div>
      </div>
      <div class="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" type="button" data-doc-nav="about">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">info</span> Autoría, licencias y privacidad
        </button>
        <button class="${cx(ui.button.base, ui.button.secondary, "min-h-11")}" type="button" data-doc-nav="settings" data-section="app-prefs">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">restart_alt</span> Volver a mostrar el asistente
        </button>
      </div>
    </section>`;
}

function sectionHeading(title, kicker, description) {
  return `
    <div class="mb-4">
      <p class="mb-1 text-xs font-bold text-teal-700">${kicker}</p>
      <h2 class="text-lg font-extrabold tracking-tight text-app-text">${title}</h2>
      <p class="mt-1 max-w-[72ch] text-[13px] leading-5 text-app-muted">${description}</p>
    </div>`;
}

function bindDocsEvents(el) {
  const search = el.querySelector("#help-search");
  const clear = el.querySelector("#help-search-clear");

  el.querySelectorAll("[data-doc-nav]").forEach(button => {
    button.addEventListener("click", () => navigateFromHelp(button.dataset.docNav, button.dataset.section));
  });

  el.querySelectorAll("[data-help-anchor]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.helpAnchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const clearSearch = () => {
    if (search) search.value = "";
    filterHelp(el, "");
    search?.focus();
  };
  search?.addEventListener("input", () => filterHelp(el, search.value));
  clear?.addEventListener("click", clearSearch);
  el.querySelector("[data-clear-help-search]")?.addEventListener("click", clearSearch);
}

function filterHelp(root, rawQuery) {
  const query = normalizeSearch(rawQuery);
  const items = [...root.querySelectorAll("[data-help-searchable]")];
  const sections = [...root.querySelectorAll("[data-help-section]")];
  const clear = root.querySelector("#help-search-clear");
  const status = root.querySelector("#help-search-status");
  let matches = 0;

  items.forEach(item => {
    if (item.hasAttribute("data-help-section")) return;
    const visible = !query || matchesSearch(item.dataset.search, query);
    item.classList.toggle("hidden", !visible);
    if (visible && query) {
      matches += 1;
      if (item.hasAttribute("data-faq-item")) item.open = true;
    } else if (!query && item.hasAttribute("data-faq-item")) {
      item.open = false;
    }
  });

  sections.forEach(section => {
    if (!query) {
      section.classList.remove("hidden");
      return;
    }
    const ownMatch = matchesSearch(section.dataset.search, query);
    if (ownMatch) {
      section.querySelectorAll("[data-help-searchable]").forEach(item => item.classList.remove("hidden"));
    }
    const childMatch = [...section.querySelectorAll("[data-help-searchable]")].some(item => !item.classList.contains("hidden"));
    section.classList.toggle("hidden", !ownMatch && !childMatch);
    if (ownMatch) matches += 1;
  });

  const visibleSections = sections.filter(section => !section.classList.contains("hidden")).length;
  root.querySelector("#help-no-results")?.classList.toggle("hidden", visibleSections > 0);
  clear?.classList.toggle("hidden", !query);
  if (status) {
    status.textContent = query
      ? visibleSections > 0
        ? `${matches} ${matches === 1 ? "coincidencia" : "coincidencias"} en ${visibleSections} ${visibleSections === 1 ? "sección" : "secciones"}.`
        : "No encontramos coincidencias."
      : "Busca en guías, solución de problemas y preguntas frecuentes.";
  }
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchesSearch(content, query) {
  const normalized = normalizeSearch(content);
  return query.split(/\s+/).every(token => normalized.includes(token));
}

function navigateFromHelp(page, section) {
  navigate(page);
  if (!section) return;
  window.setTimeout(() => {
    const nav = document.querySelector(`[data-settings-nav][data-section="${section}"]`);
    if (nav) {
      nav.click();
      return;
    }
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}
