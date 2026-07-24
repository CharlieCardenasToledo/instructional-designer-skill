import { appLocalDataDir } from "@tauri-apps/api/path";
import {
  advanceOnboarding,
  applyInstitutionConfig,
  checkDependencies,
  checkNotebookLMAuth,
  compileSyllabusPdf,
  configureMcp,
  completeOnboarding,
  exportSkillZip,
  extractSitePalette,
  generateSyllabus,
  getActiveTemplate,
  getOnboardingStatus,
  getSetupStatus,
  getSkillPath,
  goToOnboardingStep,
  installDependency,
  installSkill,
  listTemplates,
  pickDirectory,
  runNotebookLMAuth,
  setActiveTemplate,
} from "./api.js";
import { escapeHtml } from "./dom.js";
import { state, saveConfig } from "./state.js";
import { toast } from "./toast.js";
import { ic, refreshIcons } from "./icons.js";
import { renderTemplatePreview } from "./templatePreview.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import claudeLogo from "./assets/claude-symbol.svg";
import notebookLmLogo from "./assets/notebooklm-logo.svg";
import latexLogo from "./assets/latex-logo.svg";
import geminiLogo from "./assets/gemini-icon.svg";
import googleGLogo from "./assets/google-g.svg";
import notebookLmWordmark from "./assets/notebooklm-wordmark.svg";

const TOTAL_STEPS = 9;
const LARGE_DEPENDENCIES = new Set(["WSL 2", "TeX Live (pdflatex)", "Docker"]);
const STEP_META = [
  { title: "Bienvenido", subtitle: "Un vistazo rápido a lo que esta aplicación hace por ti.", icon: "graduation-cap" },
  { title: "Tecnología", subtitle: "Las herramientas sobre las que se construyen tus guías.", icon: "network" },
  { title: "Marcos pedagógicos", subtitle: "El respaldo académico detrás de cada guía que generas.", icon: "brain-circuit" },
  { title: "Verificación del entorno", subtitle: "Confirmamos que tu equipo tenga todo lo necesario para crear tus guías.", icon: "terminal" },
  { title: "Identidad institucional", subtitle: "Estos datos personalizan las guías que genera la skill.", icon: "building-2" },
  { title: "Plantilla de tus guías", subtitle: "Elige el diseño que tendrán tus guías.", icon: "layout-template" },
  { title: "Evidencia verificable", subtitle: "Conecta tu cuenta de Google para contrastar fuentes bibliográficas.", icon: "notebook" },
  { title: "Destino de instalación", subtitle: "Decide dónde vivirá la skill: Claude Code, Claude Desktop o ambos.", icon: "download" },
  { title: "Revisión final", subtitle: "Generamos un documento de prueba para confirmar que todo funciona.", icon: "check-circle-2" },
];
let runtime = { status: null, dependencies: [], auth: null, setup: null, templates: [], activeTemplate: "", sitePalette: null, detectedSiteName: "" };

const BTN_PRIMARY = "w-full h-11 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 border-0 cursor-pointer";
const BTN_SECONDARY = "h-9 px-4 rounded-md bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer";
const SCROLL_THIN = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent";
const CARD_LEAD = "max-w-md mx-auto mb-5 text-center text-gray-600 text-sm leading-relaxed";
const CALLOUT = "flex gap-2.5 items-start max-w-lg mx-auto mt-4 p-3.5 rounded-xl bg-gray-100 text-gray-600 text-xs leading-relaxed";
const INLINE_ERROR = "max-w-lg mx-auto mt-3 p-3 rounded-lg bg-red-50 border border-red-300 text-red-600 text-xs flex items-center gap-2";
const DEP_ROW_BASE = "flex flex-col gap-1.5 p-2.5 rounded-xl bg-white border transition-colors min-w-0";
const DEP_ROW_CHECKING = "border-gray-200";
const DEP_ROW_READY = "border-gray-900 bg-gray-50";
const DEP_ROW_MISSING = "border-red-300 bg-red-50";
const DEP_STATUS_BASE = "w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center";

/**
 * Dibuja una pequeña red de nodos conectados que pulsan entre sí, en un
 * <canvas> 2D monocromático — sin librerías externas. Devuelve una función
 * para detener la animación y liberar el frame.
 */
function startLoadingNetwork(canvas) {
  const size = 168;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // Dos anillos concéntricos: cada uno se conecta consigo mismo formando un
  // círculo cerrado, y unos pocos radios (a ángulos fijos) los enlazan entre
  // sí. Así el grafo siempre se lee como una figura circular, nunca como una
  // estrella con picos.
  const OUTER_COUNT = 9;
  const OUTER_RADIUS = 58;
  const INNER_COUNT = 6;
  const INNER_RADIUS = 30;
  const SPOKE_COUNT = 4;

  // Paleta de colores de Google (azul, rojo, amarillo, verde), para que
  // el grafo se sienta más vivo que un simple gris.
  const PALETTE = [
    [66, 133, 244],  // Azul Google #4285F4
    [234, 67, 53],   // Rojo Google #EA4335
    [251, 188, 5],   // Amarillo Google #FBBC05
    [52, 168, 83],   // Verde Google #34A853
  ];
  let colorIndex = 0;
  const nextColor = () => PALETTE[colorIndex++ % PALETTE.length];

  const nodes = [];
  for (let i = 0; i < OUTER_COUNT; i++) {
    nodes.push({
      baseAngle: (i / OUTER_COUNT) * Math.PI * 2,
      radius: OUTER_RADIUS,
      wobble: 1.6 + (i % 3) * 0.5,
      phase: (i * 0.73) % (Math.PI * 2),
      pulseFreq: 0.3 + (i % 5) * 0.045,
      pulsePhase: i * 1.31,
      color: nextColor(),
    });
  }
  const innerStart = nodes.length;
  for (let i = 0; i < INNER_COUNT; i++) {
    nodes.push({
      baseAngle: (i / INNER_COUNT) * Math.PI * 2 + 0.3,
      radius: INNER_RADIUS,
      wobble: 1.1 + (i % 3) * 0.4,
      phase: (i * 0.91 + 1.7) % (Math.PI * 2),
      pulseFreq: 0.36 + (i % 5) * 0.05,
      pulsePhase: i * 2.07 + 3.1,
      color: nextColor(),
    });
  }

  const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
  const blend = (c1, c2) => [0, 1, 2].map(i => Math.round((c1[i] + c2[i]) / 2));

  function pos(node, t) {
    const a = node.baseAngle + Math.sin(t * 0.3 + node.phase) * 0.05;
    const r = node.radius + Math.sin(t * 0.6 + node.phase) * node.wobble;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r };
  }

  // Cada nodo "vive" y "muere" en su propio ciclo (frecuencias distintas para
  // que no queden sincronizados): la red nunca está toda conectada a la vez,
  // se va formando y disolviendo, como una red neuronal disparando.
  function presence(node, t) {
    return Math.max(0, Math.sin(t * node.pulseFreq + node.pulsePhase));
  }

  function nearestByAngle(start, count, angle) {
    let best = 0, bestDelta = Infinity;
    for (let i = 0; i < count; i++) {
      const delta = Math.abs(Math.atan2(Math.sin(angle - nodes[start + i].baseAngle), Math.cos(angle - nodes[start + i].baseAngle)));
      if (delta < bestDelta) { bestDelta = delta; best = i; }
    }
    return start + best;
  }

  const edges = [];
  const addEdge = (a, b) => edges.push([a, b, (a * 1.7 + b * 0.9) % (Math.PI * 2)]);
  for (let i = 0; i < OUTER_COUNT; i++) addEdge(i, (i + 1) % OUTER_COUNT);
  for (let i = 0; i < INNER_COUNT; i++) addEdge(innerStart + i, innerStart + ((i + 1) % INNER_COUNT));
  for (let k = 0; k < SPOKE_COUNT; k++) {
    const angle = (k / SPOKE_COUNT) * Math.PI * 2;
    addEdge(nearestByAngle(0, OUTER_COUNT, angle), nearestByAngle(innerStart, INNER_COUNT, angle));
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = null;
  function draw(t) {
    ctx.clearRect(0, 0, size, size);
    const positions = nodes.map(n => pos(n, t));
    const presences = nodes.map(n => presence(n, t));
    for (const [a, b, phase] of edges) {
      const linkP = Math.min(presences[a], presences[b]);
      if (linkP < 0.03) continue;
      const pa = positions[a], pb = positions[b];
      const pulse = (Math.sin(t * 1.1 + phase) + 1) / 2;
      const color = blend(nodes[a].color, nodes[b].color);
      ctx.shadowColor = rgba(color, 0.5 * linkP);
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = rgba(color, (0.15 + pulse * 0.45) * linkP);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const along = ((t * 0.55 + phase) % (Math.PI * 2)) / (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(pa.x + (pb.x - pa.x) * along, pa.y + (pb.y - pa.y) * along, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, (0.5 + pulse * 0.5) * linkP);
      ctx.fill();
    }
    positions.forEach((p, i) => {
      const np = presences[i];
      if (np < 0.03) return;
      const color = nodes[i].color;
      ctx.shadowColor = rgba(color, 0.6 * np);
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + np * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.9 * np);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  const SPEED = 2.2;
  if (reduceMotion) {
    draw(0);
    return () => {};
  }
  function frame(t) {
    draw((t / 1000) * SPEED);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => { if (raf) cancelAnimationFrame(raf); };
}

export async function renderOnboarding() {
  const root = document.getElementById("onboarding-root");
  if (!root) return;
  root.className = "fixed top-0 right-0 bottom-0 left-0 z-[10000] flex items-center justify-center overflow-hidden bg-gray-50";
  root.innerHTML = `<div class="w-full max-w-3xl mx-auto h-full max-h-screen flex flex-col items-center justify-center gap-4 p-6">
    <canvas id="loading-orbs"></canvas>
  </div>`;
  const stopOrbs = startLoadingNetwork(document.getElementById("loading-orbs"));

  try {
    runtime.status = await getOnboardingStatus();
    runtime.dependencies = await checkDependencies();
    runtime.templates = await listTemplates();
    runtime.activeTemplate = await getActiveTemplate();
    runtime.auth  = await checkNotebookLMAuth();
    runtime.setup = await getSetupStatus();
    stopOrbs();
    if (runtime.status.regressionReason) toast(runtime.status.regressionReason, "error", 12000);
    renderCurrentStep();
  } catch (error) {
    stopOrbs();
    root.innerHTML = `<div class="w-full max-w-3xl mx-auto h-full max-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-2xl font-semibold text-gray-900 mb-2">No se pudo iniciar el onboarding</h1>
      <p class="text-gray-600 mb-5">${escapeHtml(error)}</p>
      <button class="${BTN_PRIMARY} max-w-xs" data-onboarding-action="retry"><span>Reintentar</span></button>
    </div>`;
    root.querySelector("[data-onboarding-action=retry]").addEventListener("click", renderOnboarding);
  }
}

function stepNumber() {
  return Number(runtime.status?.currentStep || 1);
}

function renderCurrentStep() {
  const root = document.getElementById("onboarding-root");
  if (!root || !runtime.status) return;
  if (runtime.status.completed) {
    root.remove();
    return;
  }

  const current = stepNumber();
  const meta = STEP_META[current - 1];
  root.innerHTML = `
    <div class="absolute top-3 right-3 flex z-10" data-tauri-drag-region>
      <button class="win-btn" id="onb-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
      <button class="win-btn win-btn--close" id="onb-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="w-full max-w-3xl mx-auto h-full flex flex-col p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div class="flex-1 min-h-0 overflow-y-auto pr-2 flex flex-col items-center justify-center ${SCROLL_THIN}">
        <div class="text-center mb-4 flex-shrink-0 w-full">
          <h1 id="onboarding-title" class="text-4xl font-semibold text-gray-900 tracking-tight animate-[fade-in-up_0.5s_ease-out_forwards]">${escapeHtml(meta.title)}</h1>
          <p class="mt-3 text-base text-gray-600 max-w-md mx-auto leading-relaxed animate-[fade-in-up_0.5s_ease-out_forwards] [animation-delay:75ms]">${escapeHtml(meta.subtitle)}</p>
        </div>
        <div id="onboarding-step-content" class="w-full"></div>
      </div>
      <div id="onboarding-bottom-nav" class="flex-shrink-0"></div>
    </div>`;

  document.getElementById("onb-win-minimize")?.addEventListener("click", () => getCurrentWindow().minimize());
  document.getElementById("onb-win-close")?.addEventListener("click", () => getCurrentWindow().close());

  const content = document.getElementById("onboarding-step-content");
  if (current === 1) content.innerHTML = explanationStep();
  if (current === 2) content.innerHTML = technologyStep();
  if (current === 3) content.innerHTML = frameworksStep();
  if (current === 4) content.innerHTML = dependenciesStep();
  if (current === 5) content.innerHTML = institutionStep();
  if (current === 6) content.innerHTML = templateStep();
  if (current === 7) content.innerHTML = notebookStep();
  if (current === 8) content.innerHTML = targetStep();
  if (current === 9) content.innerHTML = finalStep();
  document.getElementById("onboarding-bottom-nav").innerHTML = renderBottomNav(current);
  bindStepEvents(current);
  refreshIcons();
}

function progressDots(current) {
  const maxDone = Number(runtime.status.maxCompletedStep || 0);
  return Array.from({ length: TOTAL_STEPS }, (_, index) => {
    const step = index + 1;
    const isActive = step === current;
    const isCompleted = !isActive && step <= maxDone;
    const isAvailable = step <= maxDone + 1;
    const size = isActive ? "w-6 h-2.5 rounded-full" : "w-2.5 h-2.5 rounded-full";
    const color = isCompleted ? "bg-green-600" : isActive ? "bg-gray-900" : "bg-gray-300";
    const interactive = isAvailable ? "cursor-pointer hover:opacity-80" : "cursor-default";
    return `<button class="${size} ${color} ${interactive} border-0 transition-all duration-300 p-0" ${isAvailable ? `data-onboarding-step="${step}"` : "disabled"} aria-label="Ir al paso ${step}" aria-current="${isActive ? "step" : "false"}"></button>`;
  }).join("");
}

function actionButton(label, action, disabled = false, secondary = false, iconHtml = "") {
  return `<button class="${secondary ? BTN_SECONDARY : BTN_PRIMARY}" data-onboarding-action="${action}" ${disabled ? "disabled" : ""}>${iconHtml}<span>${escapeHtml(label)}</span></button>`;
}

// Cada paso llama a esto en vez de devolver su propio footer: la barra de
// navegación (flechas + puntos) vive fija al final de la tarjeta, no dentro
// del contenido de cada paso.
let footerConfig = { label: "Continuar", action: "advance", disabled: false };
function setFooter(label, action = "advance", disabled = false) {
  footerConfig = { label, action, disabled };
}

function renderBottomNav(current) {
  const canBack = current > 1;
  return `<div class="flex items-center justify-center gap-4 pt-3 flex-shrink-0" data-tauri-drag-region>
    <button class="win-btn ${canBack ? "" : "opacity-0 pointer-events-none"}" data-onboarding-action="back" aria-label="Paso anterior" title="Paso anterior">${ic("chevron-left", 16)}</button>
    <div class="flex items-center gap-1.5">${progressDots(current)}</div>
    <button class="win-btn" data-onboarding-action="${footerConfig.action}" aria-label="${escapeHtml(footerConfig.label)}" title="${escapeHtml(footerConfig.label)}" ${footerConfig.disabled ? "disabled" : ""}>${ic("chevron-right", 16)}</button>
  </div>`;
}

function dependenciesStep() {
  const node = runtime.dependencies.find(dep => dep.name === "Node.js");
  const docker = runtime.dependencies.find(dep => dep.name === "Docker");
  const texlive = runtime.dependencies.find(dep => dep.name === "TeX Live (pdflatex)");
  const missing = runtime.dependencies.filter(dep => dep.required && !dep.installed);
  const compilationReady = Boolean(docker?.installed || texlive?.installed);

  const rows = runtime.dependencies.map(dep => `
    <div class="${DEP_ROW_BASE} ${DEP_ROW_CHECKING}" data-dep-row data-dep-name="${escapeHtml(dep.name)}">
      <div class="flex items-center gap-1.5 min-w-0">
        <div class="${DEP_STATUS_BASE} bg-neutral-100 text-neutral-400" data-dep-status><span class="animate-spin flex">${ic("loader-2", 13)}</span></div>
        <strong class="text-[12.5px] font-medium text-gray-900 truncate">${escapeHtml(dep.name)}</strong>
      </div>
      <span class="dep-detail text-[10.5px] text-gray-500 leading-snug">Verificando…</span>
    </div>`).join("");

  setFooter("Continuar", "advance", !node?.installed || missing.length > 0 || !compilationReady);
  return `<section>
    <div class="grid grid-cols-3 gap-2.5 max-w-xl mx-auto">${rows}</div>
    ${!compilationReady ? `<div class="${INLINE_ERROR} !max-w-xl">${ic("alert-circle", 14)} Instala Docker o TeX Live antes de continuar: sin uno de los dos no podemos crear el PDF de tu guía.</div>` : ""}
  </section>`;
}

function animateDependencyGroup() {
  const rows = document.querySelectorAll("#onboarding-step-content [data-dep-row]");
  rows.forEach((row, i) => {
    const dep = runtime.dependencies.find(d => d.name === row.dataset.depName);
    if (!dep) return;
    setTimeout(() => {
      row.className = `${DEP_ROW_BASE} ${dep.installed ? DEP_ROW_READY : DEP_ROW_MISSING}`;
      const statusEl = row.querySelector("[data-dep-status]");
      const detailEl = row.querySelector(".dep-detail");
      if (statusEl) {
        statusEl.className = `${DEP_STATUS_BASE} ${dep.installed ? "bg-gray-200 text-green-700" : "bg-red-100 text-red-500"}`;
        statusEl.innerHTML = dep.installed ? ic("check-circle-2", 13) : ic("alert-circle", 13);
      }
      if (detailEl) detailEl.textContent = dep.note || (dep.installed ? "Listo" : "No encontrado");

      if (!dep.installed) {
        const btn = document.createElement("button");
        btn.className = BTN_SECONDARY + " !h-6 !px-2 !text-[10.5px] mt-1 self-start";
        btn.dataset.installDependency = dep.name;
        btn.innerHTML = "<span>Instalar</span>";
        btn.addEventListener("click", () => installDependencyStep(dep.name));
        row.appendChild(btn);
      } else {
        const badge = document.createElement("span");
        badge.className = "inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 self-start mt-1";
        badge.textContent = "Listo";
        row.appendChild(badge);
      }

      if (dep.command) {
        const details = document.createElement("details");
        details.className = "mt-0.5";
        const summary = document.createElement("summary");
        summary.className = "flex items-center gap-1 text-[9.5px] text-gray-400 hover:text-gray-600 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden";
        summary.innerHTML = `<span class="material-symbols-outlined text-[11px]">terminal</span> Ver comando`;
        details.appendChild(summary);
        const term = document.createElement("div");
        term.className = "mt-1 px-2 py-1.5 rounded-md bg-gray-900 font-mono text-[9.5px] leading-snug";
        const resultText = dep.installed ? (dep.version || "OK") : (dep.version || "No encontrado");
        term.innerHTML = `<span class="block text-gray-400 whitespace-pre-wrap break-words"><span class="text-green-400 mr-1">$</span>${escapeHtml(dep.command)}</span><span class="block text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(resultText)}</span>`;
        details.appendChild(term);
        row.appendChild(details);
      }
      refreshIcons();
    }, 260 + i * 380);
  });
}

function explanationStep() {
  setFooter("Continuar", "advance", false);
  const feature = (icon, title, desc) => `
    <article class="p-4 rounded-xl border border-gray-200 bg-white">
      <div class="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center mb-2.5">${ic(icon, 18)}</div>
      <h3 class="text-[13px] font-semibold text-gray-900 mb-1">${title}</h3>
      <p class="text-xs text-gray-500 leading-relaxed">${desc}</p>
    </article>`;
  return `<section>
    <p class="${CARD_LEAD} !max-w-xl">Esta aplicación configura la <strong>skill de diseño instruccional</strong> que usa Claude para convertir el sílabo de tu materia en guías didácticas semanales, con evidencia pedagógica verificable en cada afirmación.</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
      ${feature("book-open", "Del sílabo a la guía", "Toma la información de tu curso y la organiza en secciones claras, semana por semana.")}
      ${feature("quote", "Con fuentes verificadas", "Contrasta la bibliografía con tus propias fuentes. Nunca inventa referencias.")}
      ${feature("layout-template", "Con tu propio estilo", "Usa el diseño y los colores de tu institución en cada guía que generes.")}
    </div>
  </section>`;
}

function technologyStep() {
  setFooter("Continuar", "advance", false);
  const techCard = (name, src, icon) => `
    <div class="flex items-center justify-center w-11 h-11 text-gray-700" title="${escapeHtml(name)}">
      ${src ? `<img src="${src}" alt="${escapeHtml(name)}" class="w-full h-full object-contain">` : ic(icon, 40)}
    </div>`;
  return `<section>
    <p class="${CARD_LEAD}">Se apoya en estas herramientas para generar y verificar tus guías.</p>
    <div class="flex flex-wrap justify-center gap-4 max-w-xl mx-auto mb-6">
      ${techCard("Claude", claudeLogo)}
      ${techCard("Gemini", geminiLogo)}
      ${techCard("NotebookLM", notebookLmLogo)}
      ${techCard("LaTeX", latexLogo)}
    </div>
    <div class="${CALLOUT}">${ic("shield-check", 16)} <span>Todo lo que configures se guarda en tu computadora. Las búsquedas bibliográficas solo se comparten con NotebookLM cuando tú lo autorizas.</span></div>
  </section>`;
}

function frameworksStep() {
  setFooter("Continuar", "advance", false);
  const card = (name, source, desc) => `
    <article class="p-3.5 rounded-xl border border-gray-200 bg-white">
      <div class="flex items-baseline gap-1.5 mb-1">
        <h3 class="text-[13px] font-semibold text-gray-900">${escapeHtml(name)}</h3>
        <span class="text-[10.5px] text-gray-400 font-medium">${escapeHtml(source)}</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">${escapeHtml(desc)}</p>
    </article>`;
  return `<section>
    <p class="${CARD_LEAD}">Cada guía se redacta sobre marcos con respaldo académico, no solo sobre un estilo visual.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
      ${card("UDL 3.0", "CAST, 2024", "Múltiples medios de representación, participación, acción y expresión.")}
      ${card("Backward Design", "Wiggins & McTighe", "Primero los resultados de aprendizaje, luego la evaluación, luego el contenido.")}
      ${card("Quality Matters", "7ª ed.", "Alineación entre resultados, actividades y materiales.")}
      ${card("WCAG", "2.2", "Accesibilidad en materiales digitales e impresos.")}
      ${card("Principios multimedia", "Mayer", "Coherencia, señalización, contigüidad espacial y segmentación.")}
    </div>
  </section>`;
}

const FIELD_INPUT = "bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-colors";
const FIELD_LABEL = "flex flex-col gap-1.5 text-gray-700 text-xs";

function institutionStep() {
  setFooter("Guardar y continuar", "save-institution", false);
  const config = state.config;
  const value = key => escapeHtml(config[key] || "");
  return `<section>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-lg mx-auto">
      <label class="${FIELD_LABEL} sm:col-span-2">
        Sitio web de la institución <span class="text-gray-400 font-normal">(opcional)</span>
        <div class="flex gap-2">
          <input class="${FIELD_INPUT}" id="onb-website" type="url" value="${value("website")}" placeholder="https://www.uide.edu.ec/">
          <button class="${BTN_SECONDARY} flex-shrink-0" id="onb-extract-palette" type="button">
            ${ic("palette", 15)} <span>Analizar</span>
          </button>
        </div>
        <span class="text-[10.5px] text-gray-400 font-normal">Usaremos el sitio para completar el nombre y proponer sus colores. Puedes omitir este paso.</span>
      </label>
      <div id="onb-site-analysis" class="sm:col-span-2" aria-live="polite">
        ${renderOnboardingSiteAnalysis()}
      </div>
      <label class="${FIELD_LABEL}">Nombre completo<input class="${FIELD_INPUT}" id="onb-author" value="${value("author")}" placeholder="Mgtr. Ana López"></label>
      <label class="${FIELD_LABEL}">Grado académico<input class="${FIELD_INPUT}" id="onb-degree" value="${value("degree")}" placeholder="Mgtr."></label>
      <label class="${FIELD_LABEL}">Institución<input class="${FIELD_INPUT}" id="onb-institution" value="${value("institution")}" placeholder="Universidad Ejemplo"></label>
      <label class="${FIELD_LABEL}">Facultad<input class="${FIELD_INPUT}" id="onb-faculty" value="${value("faculty")}" placeholder="Facultad de Ingeniería"></label>
      <label class="${FIELD_LABEL}">Carrera<input class="${FIELD_INPUT}" id="onb-career" value="${value("career")}" placeholder="Ingeniería de Software"></label>
      <label class="${FIELD_LABEL}">Color institucional<input class="${FIELD_INPUT} h-9 p-1" id="onb-color" type="color" value="${escapeHtml(config.colorHex || "#00796b")}"></label>
      <label class="${FIELD_LABEL} sm:col-span-2">Ecosistema digital <span class="text-gray-400 font-normal">uno por línea</span><textarea class="${FIELD_INPUT} min-h-20 resize-y" id="onb-ecosystem" placeholder="Canvas LMS&#10;Sistema académico">${value("ecosystem")}</textarea></label>
    </div>
    <div class="${INLINE_ERROR}" id="onb-form-error" hidden></div>
  </section>`;
}

function renderOnboardingSiteAnalysis() {
  if (!runtime.sitePalette?.length) return "";
  return `
    <div class="rounded-xl border border-gray-200 bg-white p-3">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <span class="text-[11.5px] font-semibold text-gray-700">Paleta detectada</span>
        ${runtime.detectedSiteName ? `<span class="text-[10.5px] text-green-600 truncate">${ic("check-circle-2", 12)} ${escapeHtml(runtime.detectedSiteName)}</span>` : ""}
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(105px,1fr))] gap-1.5">
        ${runtime.sitePalette.slice(0, 12).map(({ color, occurrences }) => `
          <button type="button" data-onb-palette-color="${escapeHtml(color)}"
            class="flex items-center gap-1.5 min-w-0 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-900 p-1.5 cursor-pointer text-left"
            title="Usar ${escapeHtml(color)}">
            <span class="w-7 h-7 rounded-md border border-black/10 flex-shrink-0" style="background:${escapeHtml(color)}"></span>
            <span class="min-w-0">
              <code class="block text-[9.5px] text-gray-700 truncate">${escapeHtml(color)}</code>
              <small class="block text-[9px] text-gray-400">${occurrences} usos</small>
            </span>
          </button>`).join("")}
      </div>
    </div>`;
}

async function analyzeInstitutionWebsite() {
  const input = document.getElementById("onb-website");
  const button = document.getElementById("onb-extract-palette");
  const area = document.getElementById("onb-site-analysis");
  const url = input?.value.trim();
  if (!url) {
    toast("Ingresa la URL de la institución o continúa sin analizarla", "error");
    input?.focus();
    return;
  }

  button.dataset.originalLabel = button.querySelector("span")?.textContent || "Analizar";
  setBusyState(button, true, "Analizando…");
  if (area) {
    area.innerHTML = `<div class="flex items-center gap-2 p-3 rounded-lg bg-gray-100 text-gray-500 text-xs">${ic("loader-2", 14)} Analizando el sitio y sus hojas de estilo…</div>`;
  }
  try {
    const result = await extractSitePalette(url);
    runtime.sitePalette = result.colors;
    runtime.detectedSiteName = result.site_name || "";
    const institution = document.getElementById("onb-institution");
    if (institution && result.site_name) institution.value = result.site_name;
    state.config.website = url;
    if (result.site_name) state.config.institution = result.site_name;
    saveConfig();
    if (area) area.innerHTML = renderOnboardingSiteAnalysis();
    bindOnboardingPaletteButtons();
    refreshIcons();
    toast(`Encontramos ${result.colors.length} colores${result.site_name ? " y completamos el nombre" : ""}`, "success", 4500);
  } catch (error) {
    if (area) area.innerHTML = `<div class="${INLINE_ERROR} !mt-0 !max-w-none">${ic("alert-circle", 14)} ${escapeHtml(String(error))}</div>`;
    toast(`No se pudo analizar el sitio: ${error}`, "error", 6000);
  } finally {
    setBusyState(button, false);
  }
}

function bindOnboardingPaletteButtons() {
  document.querySelectorAll("[data-onb-palette-color]").forEach(button => {
    button.addEventListener("click", () => {
      const hex = cssColorToHex(button.dataset.onbPaletteColor);
      if (!hex) return toast("No se pudo convertir este color", "error");
      const picker = document.getElementById("onb-color");
      if (picker) picker.value = hex;
      document.querySelectorAll("[data-onb-palette-color]").forEach(item => item.classList.remove("border-gray-900", "ring-2", "ring-gray-900/10"));
      button.classList.add("border-gray-900", "ring-2", "ring-gray-900/10");
      toast(`Color institucional: ${hex}`, "success", 2200);
    });
  });
}

function templateStep() {
  const selected = runtime.activeTemplate;
  const template = runtime.templates.find(item => item.id === selected) || runtime.templates[0];
  const cards = runtime.templates.map(t => {
    const isSelected = t.id === selected;
    const cardCls = isSelected
      ? "border-gray-900 bg-gray-50 shadow-[0_0_0_3px_rgba(17,24,39,0.08)]"
      : "border-gray-200 bg-white hover:border-gray-400";
    return `
    <button class="flex flex-col gap-1.5 p-4 rounded-xl border text-left cursor-pointer transition-all ${cardCls}" data-template-id="${escapeHtml(t.id)}">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px] transition-colors ${isSelected ? "text-green-600" : "text-gray-400"}">${isSelected ? "check_circle" : "radio_button_unchecked"}</span>
        <strong class="text-[13px] font-bold text-gray-900">${escapeHtml(t.name)}</strong>
      </div>
      <p class="text-[11.5px] text-gray-500 leading-relaxed m-0">${escapeHtml(t.description)}</p>
      ${t.features ? `<ul class="mt-1 pl-3.5 text-[11px] text-gray-400 leading-loose list-disc">${t.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
    </button>`;
  }).join("");
  setFooter("Confirmar plantilla", "save-template", !template);
  return `<section>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 max-w-lg mx-auto mb-1">${cards}</div>
  </section>`;
}

function notebookStep() {
  const authenticated = runtime.auth?.authenticated === true;
  const statusCls = authenticated ? "border-gray-900 bg-gray-50" : "border-amber-200 bg-amber-50 hover:border-amber-300";
  const iconCls = authenticated ? "text-gray-900" : "text-amber-600";
  setFooter("Continuar", "advance", !authenticated);
  return `<section>
    <img src="${notebookLmWordmark}" alt="NotebookLM" class="h-7 w-auto mx-auto mb-5 block">
    <button class="flex items-center gap-3 max-w-md mx-auto p-3.5 rounded-xl border w-full text-left cursor-pointer transition-colors ${statusCls}" data-onboarding-action="verify-auth" title="Volver a verificar">
      <div class="${iconCls} flex flex-shrink-0">${authenticated ? ic("check-circle-2", 18) : ic("lock-keyhole", 18)}</div>
      <div class="flex flex-col gap-0.5 flex-1 min-w-0">
        <strong class="text-gray-900 text-sm">${authenticated ? "Sesión verificada" : "Sesión pendiente"}</strong>
        <span class="text-gray-500 text-xs">${escapeHtml(runtime.auth?.message || "Pulsa iniciar sesión y luego toca aquí para verificar.")}</span>
      </div>
      <div class="text-gray-400 flex-shrink-0">${ic("refresh-cw", 15)}</div>
    </button>
    <div class="flex justify-center mt-4">${actionButton("Iniciar sesión con Google", "start-auth", false, true, `<img src="${googleGLogo}" alt="" class="w-4 h-4">`)}</div>
  </section>`;
}

function targetStep() {
  const setup    = runtime.setup || {};
  const selected = runtime.status.selectedTarget || state.config.onboardingTarget || "claude-code";
  const zipOk    = Boolean(state.config.lastSkillZip);

  const targets = [
    { id: "claude-code",    title: "Claude Code",              icon: "terminal",     desc: "La skill queda instalada y lista para usar desde Claude Code." },
    { id: "claude-cowork",  title: "Claude Desktop / Cowork",  icon: "desktop_windows", desc: "Prepara un archivo para subir la skill desde Claude Desktop." },
    { id: "both",           title: "Ambos destinos",           icon: "devices",      desc: "Deja todo listo para usar la skill desde cualquiera de los dos." },
  ];

  // Checklist de pasos para el destino seleccionado
  function checkItem(label, done) {
    return `<div class="flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs border ${done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}">
      <span class="material-symbols-outlined text-[15px] ${done ? "text-green-600" : "text-gray-400"}">${done ? "check_circle" : "radio_button_unchecked"}</span>
      <span class="${done ? "text-green-600" : "text-gray-600"}">${escapeHtml(label)}</span>
    </div>`;
  }

  let checklist = "";
  let allReady  = false;
  let actions   = "";

  if (selected === "claude-code") {
    checklist = checkItem("Skill instalada", setup.skill_installed) +
                checkItem("Conectada con Claude Code", setup.mcp_claude_code_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured);
    actions   = actionButton("1. Instalar skill", "install-local", setup.skill_installed, true) +
                actionButton("2. Conectar con Claude Code", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true);

  } else if (selected === "claude-cowork") {
    checklist = checkItem("Archivo de la skill exportado", zipOk) +
                checkItem("Conectada con Claude Desktop", setup.mcp_desktop_configured);
    allReady  = !!(zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("1. Exportar archivo de la skill", "export-zip", zipOk, true) +
                actionButton("2. Conectar con Claude Desktop", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);

  } else { // both
    checklist = checkItem("Skill instalada", setup.skill_installed) +
                checkItem("Conectada con Claude Code", setup.mcp_claude_code_configured) +
                checkItem("Archivo de la skill exportado", zipOk) +
                checkItem("Conectada con Claude Desktop", setup.mcp_desktop_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured && zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("Instalar skill (Claude Code)", "install-local", setup.skill_installed, true) +
                actionButton("Exportar archivo (Claude/Cowork)", "export-zip", zipOk, true) +
                actionButton("Conectar con Claude Code", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true) +
                actionButton("Conectar con Claude Desktop", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);
  }

  setFooter("Continuar al paso final", "advance-target", !allReady);
  return `<section>
    <p class="${CARD_LEAD}">Completa las acciones en orden: primero instala, luego conecta.</p>

    <!-- Selector de destino -->
    <div class="grid gap-2 max-w-lg mx-auto">
      ${targets.map(t => `
        <label class="flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${t.id === selected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"}">
          <input type="radio" class="accent-gray-900" name="onboarding-target" value="${t.id}" ${t.id === selected ? "checked" : ""}>
          <span class="material-symbols-outlined text-[18px] flex-shrink-0 text-gray-500">${t.icon}</span>
          <span class="flex-1 flex flex-col gap-0.5"><strong class="text-gray-900 text-sm">${t.title}</strong><small class="text-gray-500 text-xs leading-snug">${t.desc}</small></span>
          <span class="material-symbols-outlined text-[18px] ${targetReady(t.id) ? "text-green-600" : "text-gray-300"}">${targetReady(t.id) ? "check_circle" : "pending"}</span>
        </label>`).join("")}
    </div>

    <!-- Estado de instalación del destino seleccionado -->
    <div class="my-4 max-w-lg mx-auto">
      <div class="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
        Estado — ${targets.find(t => t.id === selected)?.title || selected}
      </div>
      <div class="flex flex-col gap-1.5">${checklist}</div>
    </div>

    <!-- Acciones secuenciales -->
    <div class="flex justify-center flex-wrap gap-2 mt-4">${actions}</div>
    <div class="${INLINE_ERROR}" id="onb-target-message" hidden></div>
  </section>`;
}

function finalStep() {
  const config = state.config || {};
  const setup  = runtime.setup || {};
  const target = runtime.status?.selectedTarget || config.onboardingTarget || "claude-code";
  const targetLabel = { "claude-code": "Claude Code", "claude-cowork": "Claude Desktop / Cowork", "both": "Ambos destinos" }[target] || target;

  const checks = [
    { label: "Dependencias",        ok: runtime.dependencies.filter(d => d.required).every(d => d.installed) },
    { label: "Perfil institucional", ok: !!(config.author && config.institution) },
    { label: "Plantilla activa",     ok: !!runtime.activeTemplate },
    { label: "Sesión de Google",     ok: runtime.auth?.authenticated === true },
    { label: "Skill instalada",      ok: setup.skill_installed },
    { label: "Conexión con Claude",  ok: setup.mcp_claude_code_configured || setup.mcp_desktop_configured },
  ];

  setFooter("Finalizar configuración", "complete", true);
  return `<section>
    <div id="final-gen-area" class="mx-auto mb-6 max-w-md">

      <!-- Carga (visible al inicio) -->
      <div id="final-loading" class="flex flex-col items-center gap-4 py-6">

        <!-- Spinner concéntrico animado -->
        <div class="relative w-[72px] h-[72px]">
          <div class="absolute inset-0 rounded-full border-[3px] border-transparent border-t-gray-900 animate-spin"></div>
          <div class="absolute inset-[9px] rounded-full border-[3px] border-transparent border-t-gray-400 [animation:spin_0.85s_linear_infinite_reverse]"></div>
          <div class="absolute inset-[18px] rounded-full bg-gray-100 flex items-center justify-center">
            <span id="gen-center-icon" class="material-symbols-outlined text-[18px] text-gray-900">auto_awesome</span>
          </div>
        </div>

        <div id="final-loading-msg" role="status" aria-live="polite" class="text-[13.5px] font-semibold text-gray-700 text-center">Iniciando verificación…</div>

        <!-- Barra de progreso -->
        <div class="w-full max-w-xs h-[3px] rounded-full bg-gray-200 overflow-hidden">
          <div id="gen-progress-fill" class="h-full w-0 rounded-full bg-gray-900 transition-[width] duration-500"></div>
        </div>

        <div id="final-loading-steps" class="flex flex-col gap-1.5 w-full max-w-sm">
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="0">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Leyendo perfil institucional…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="1">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Localizando skill instalado…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="2">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Generando sílabo de prueba (2 semanas)…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="3">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Generando el PDF de la guía…</span>
          </div>
        </div>
      </div>

      <!-- Resultado — aparece solo tras éxito o fallo definitivo -->
      <div id="final-result-wrap" class="hidden">
        <div id="final-result-content"></div>
      </div>
    </div>

    <!-- Checklist de estado de configuración -->
    <div class="max-w-md mx-auto mb-4 grid grid-cols-2 gap-1.5">
      ${checks.map(c => `
        <div class="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium border ${c.ok ? "bg-green-50 border-green-200 text-green-600" : "bg-red-50 border-red-200 text-red-500"}">
          <span class="material-symbols-outlined text-[15px]">${c.ok ? "check_circle" : "cancel"}</span>
          ${escapeHtml(c.label)}
        </div>`).join("")}
    </div>

    <div class="text-center text-[11.5px] text-gray-400 mb-4">
      Destino: <strong class="text-gray-700">${escapeHtml(targetLabel)}</strong>
    </div>

  </section>`;
}

async function animateFinalStep() {
  const checkRows = document.querySelectorAll(".final-check-row");
  const msgEl     = document.getElementById("final-loading-msg");
  const fillEl    = document.getElementById("gen-progress-fill");

  function setProgress(pct) {
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  function setRow(i, rowState) {
    if (!checkRows[i]) return;
    const row  = checkRows[i];
    const icon = row.querySelector(".material-symbols-outlined");
    row.style.opacity = "1";
    row.style.transition = "opacity .3s, color .3s";
    if (rowState === "active") {
      row.style.color  = "#111827";
      icon.textContent = "sync";
      icon.style.animation = "spin .7s linear infinite";
    } else if (rowState === "done") {
      row.style.color  = "#16a34a";
      icon.textContent = "check_circle";
      icon.style.animation = "none";
    } else if (rowState === "error") {
      row.style.color  = "#ef4444";
      icon.textContent = "cancel";
      icon.style.animation = "none";
    }
  }

  function setMsg(msg) {
    if (!msgEl) return;
    msgEl.style.opacity = "0";
    msgEl.style.transition = "opacity .2s";
    setTimeout(() => {
      msgEl.textContent = msg;
      msgEl.style.opacity = "1";
    }, 150);
  }

  function showError(title, detail, errStr) {
    const loadingEl = document.getElementById("final-loading");
    const wrapEl    = document.getElementById("final-result-wrap");
    const contentEl = document.getElementById("final-result-content");
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.innerHTML = `
      <div class="border-[1.5px] border-red-300/60 rounded-xl p-6 text-center bg-red-50/60">
        <span class="material-symbols-outlined text-[36px] text-red-500 block mb-2.5">error</span>
        <div class="text-[15px] font-bold text-red-500 mb-1.5">${escapeHtml(title)}</div>
        <div class="text-[12.5px] text-gray-700 mb-3">${escapeHtml(detail)}</div>
        ${errStr ? `<div class="text-[10.5px] font-mono text-gray-500 bg-black/5 px-3 py-2 rounded-md text-left whitespace-pre-wrap break-words max-h-[220px] overflow-y-auto mb-3.5">${escapeHtml(errStr)}</div>` : ""}
        <button class="${BTN_SECONDARY} text-[12.5px]" id="btn-retry-gen">
          <span class="material-symbols-outlined text-[15px]">refresh</span> Reintentar verificación
        </button>
      </div>`;
    if (wrapEl) {
      wrapEl.style.display = "block";
      wrapEl.style.opacity = "0";
      wrapEl.style.transition = "opacity .35s";
      requestAnimationFrame(() => { wrapEl.style.opacity = "1"; });
    }
    document.getElementById("btn-retry-gen")?.addEventListener("click", () => {
      if (wrapEl) wrapEl.style.display = "none";
      if (loadingEl) {
        loadingEl.style.display = "flex";
        checkRows.forEach((r, i) => {
          r.style.opacity = i <= 1 ? "1" : ".3";
          r.style.color = "";
          r.querySelector(".material-symbols-outlined").textContent = i <= 1 ? "check_circle" : "hourglass_empty";
          if (i === 1) r.querySelector(".material-symbols-outlined").style.color = "#16a34a";
        });
        if (fillEl) fillEl.style.width = "25%";
      }
      animateFinalStep();
    });
  }

  function showSuccess(basePath, message, pdfPath) {
    const loadingEl = document.getElementById("final-loading");
    const wrapEl    = document.getElementById("final-result-wrap");
    const contentEl = document.getElementById("final-result-content");
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.innerHTML = renderSyllabusDoc(pdfPath, message);
    if (wrapEl) {
      wrapEl.style.display = "block";
      wrapEl.style.opacity = "0";
      wrapEl.style.transition = "opacity .4s";
      requestAnimationFrame(() => { wrapEl.style.opacity = "1"; });
    }
    document.querySelector("[data-onboarding-action='complete']").disabled = false;

    const assetUrl = convertFileSrc(pdfPath);
    document.getElementById("btn-open-pdf")?.addEventListener("click", () => window.open(assetUrl));
    document.getElementById("btn-copy-pdf-path")?.addEventListener("click", () => {
      navigator.clipboard.writeText(pdfPath).then(() => toast("Ruta copiada", "success", 3000));
    });
  }

  function renderSyllabusDoc(pdfPath, message) {
    const assetUrl = convertFileSrc(pdfPath);
    return `
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <span class="material-symbols-outlined text-2xl text-green-600 flex-shrink-0">check_circle</span>
          <div>
            <div class="font-bold text-green-600 mb-1">Documento compilado exitosamente</div>
            <div class="text-[12.5px] text-gray-700">${escapeHtml(message)}</div>
          </div>
        </div>
        <div class="border-[1.5px] border-gray-200 rounded-xl overflow-hidden bg-white">
          <iframe src="${escapeHtml(assetUrl)}" class="w-full h-[500px] border-0 block"></iframe>
        </div>
        <div class="flex gap-2">
          <button class="${BTN_SECONDARY} flex-1" id="btn-open-pdf">
            <span class="material-symbols-outlined text-[15px]">open_in_new</span> Abrir en otra pestaña
          </button>
          <button class="${BTN_SECONDARY} flex-1" id="btn-copy-pdf-path">
            <span class="material-symbols-outlined text-[15px]">content_copy</span> Copiar ruta
          </button>
        </div>
        <div class="text-[11px] text-gray-400 p-3 bg-black/[0.03] rounded-lg break-all">
          <strong>Archivo:</strong> ${escapeHtml(pdfPath)}
        </div>
      </div>
    `;
  }

  // ── 0 / 25 % — leer perfil ──────────────────────────────────────────────
  setRow(0, "active");
  setMsg("Leyendo perfil institucional…");
  setProgress(5);
  await new Promise(r => setTimeout(r, 400));
  setRow(0, "done");
  setProgress(25);

  // ── 1 / 50 % — localizar skill ──────────────────────────────────────────
  setRow(1, "active");
  setMsg("Localizando skill instalado…");
  let skillPath;
  try {
    skillPath = await getSkillPath();
    setRow(1, "done");
    setProgress(50);
  } catch (err) {
    setRow(1, "error");
    setRow(2, "error");
    setRow(3, "error");
    setProgress(25);
    setMsg("Skill no encontrado");
    showError(
      "Skill no instalado",
      "Vuelve al Paso 8 con los puntos de progreso de arriba y pulsa 'Instalar skill' antes de continuar.",
      String(err)
    );
    return;
  }

  // ── 2 / 75 % — generar sílabo ───────────────────────────────────────────
  setRow(2, "active");
  setMsg("Generando sílabo de prueba con la skill…");
  setProgress(55);

  // Usar AppData como destino del test (no el directorio del skill, que puede no existir aún)
  let testBasePath;
  try {
    testBasePath = await appLocalDataDir();
  } catch {
    testBasePath = skillPath;
  }

  const cfg = state.config || {};
  const syllabusTestData = {
    courseCode: "TST-101",
    courseName: "Asignatura de Prueba",
    credits: 3,
    academicPeriod: cfg.academicPeriod || "Período de Verificación 2025-A",
    semester: "Primero",
    description: "Documento de verificación generado automáticamente por el onboarding.",
    weeksData: [
      {
        number: 1,
        title: "Introducción y fundamentos conceptuales",
        unit: "Unidad I: Bases Teóricas",
        topics: "Conceptos generales de la disciplina\nMarco teórico y epistemológico\nContexto histórico y evolución",
        outcomes: "Docencia: Identificar componentes esenciales del área de estudio\nPráctica: Analizar casos reales aplicando el marco teórico",
        bibliography: "Apellido, N. (2024). Fundamentos. Editorial Universitaria.\nApellido, M. (2023). Teoría y práctica. Pearson.",
        teachingHours: 2, practiceHours: 1, autonomousHours: 4, gradedActivity: null,
      },
      {
        number: 2,
        title: "Metodología y herramientas de análisis",
        unit: "Unidad I: Bases Teóricas",
        topics: "Métodos cuantitativos y cualitativos\nHerramientas digitales del área\nEstudios de caso comparativos",
        outcomes: "Docencia: Aplicar metodologías estándar a problemas complejos\nPráctica: Desarrollar soluciones con base en los métodos aprendidos",
        bibliography: "Autor, A. (2022). Metodología aplicada. McGraw-Hill.\nAutor, B. (2023). Análisis avanzado. Oxford.",
        teachingHours: 2, practiceHours: 2, autonomousHours: 4, gradedActivity: "Taller grupal: análisis de casos",
      },
    ],
  };

  let genResult;
  try {
    genResult = await generateSyllabus({ coursePath: testBasePath, ...syllabusTestData });

    if (genResult?.success) {
      setRow(2, "done");
      setProgress(75);
    } else {
      throw new Error(genResult?.message || "El backend indicó fallo sin detalles.");
    }
  } catch (err) {
    setRow(2, "error");
    setRow(3, "error");
    setProgress(50);
    setMsg("La generación falló");
    showError(
      "Error al generar el documento",
      "La skill está instalada pero no pudo crear el archivo. Reintenta o vuelve al paso 6 para reinstalar.",
      String(err)
    );
    return;
  }

  // ── 3 / 100 % — compilar PDF (requerido: es el objetivo de la skill) ────
  setRow(3, "active");
  setMsg("Generando el PDF de la guía…");
  setProgress(85);
  let pdfResult;
  try {
    pdfResult = await compileSyllabusPdf({ coursePath: testBasePath, ...syllabusTestData });
    if (pdfResult?.success) {
      setRow(3, "done");
      setProgress(100);
      setMsg("¡Verificación completada!");
    } else {
      throw new Error(pdfResult?.message || "El backend indicó fallo sin detalles.");
    }
  } catch (err) {
    setRow(3, "error");
    setProgress(85);
    setMsg("No se pudo generar el PDF");
    showError(
      "No pudimos generar el PDF de tu guía",
      "Vuelve al Paso 4 y confirma que Docker o TeX Live estén instalados y funcionando, luego vuelve a intentarlo.",
      String(err)
    );
    return;
  }

  showSuccess(testBasePath, pdfResult.message, pdfResult.path);
}


function bindStepEvents(current) {
  const root = document.getElementById("onboarding-root");
  if (current === 4) animateDependencyGroup();
  if (current === 5) {
    root.querySelector("#onb-extract-palette")?.addEventListener("click", analyzeInstitutionWebsite);
    bindOnboardingPaletteButtons();
  }
  if (current === 9) animateFinalStep();
  root.querySelectorAll("[data-onboarding-step]").forEach(button => button.addEventListener("click", async () => {
    const result = await goToOnboardingStep(Number(button.dataset.onboardingStep));
    if (result.success) {
      runtime.status = result.status;
      const dest = Number(button.dataset.onboardingStep);
      if (dest === 7) runtime.auth  = await checkNotebookLMAuth();
      if (dest >= 8)  runtime.setup = await getSetupStatus();
      renderCurrentStep();
    } else toast(result.message, "error");
  }));
  root.querySelectorAll("[data-install-dependency]").forEach(button => button.addEventListener("click", () => installDependencyStep(button.dataset.installDependency)));
  root.querySelectorAll("[data-template-id]").forEach(button => button.addEventListener("click", () => {
    runtime.activeTemplate = button.dataset.templateId;
    renderCurrentStep();
  }));
  root.querySelectorAll("input[name=onboarding-target]").forEach(input => input.addEventListener("change", event => {
    state.config.onboardingTarget = event.target.value;
    saveConfig();
    renderCurrentStep();
  }));
  root.querySelectorAll("[data-onboarding-action]").forEach(button => button.addEventListener("click", () => handleAction(button.dataset.onboardingAction, current)));
}

async function installDependencyStep(name) {
  const confirmed = !LARGE_DEPENDENCIES.has(name) || await confirm(`${name} puede descargar componentes grandes y requiere permisos del sistema. ¿Continuar?`);
  if (!confirmed) return;
  toast(`Instalando ${name}…`, "loading", 120000);
  const result = await installDependency(name, confirmed);
  toast(result.message, result.success ? "success" : "error", 9000);
  runtime.dependencies = await checkDependencies();
  renderCurrentStep();
}

async function handleAction(action, current) {
  if (["retry", "back"].includes(action)) return performAction(action, current);
  const buttons = [...document.querySelectorAll(`[data-onboarding-action="${action}"]`)].filter(button => !button.disabled);
  buttons.forEach(button => { button.dataset.originalLabel = button.querySelector("span")?.textContent || "Procesar"; setBusyState(button, true, "Procesando…"); });
  try { return await performAction(action, current); }
  finally { buttons.forEach(button => setBusyState(button, false)); }
}

function setBusyState(button, busy, label = "") {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const text = button.querySelector("span");
  if (text && busy) text.textContent = label;
  if (text && !busy) text.textContent = button.dataset.originalLabel || text.textContent;
}

async function performAction(action, current) {
  if (action === "retry") return renderOnboarding();
  if (action === "back") {
    const result = await goToOnboardingStep(Math.max(1, current - 1));
    if (result.success) { runtime.status = result.status; renderCurrentStep(); }
    else toast(result.message, "error");
    return;
  }
  if (action === "start-auth") {
    toast("Completa el inicio de sesión en Chrome. Esto puede tardar unos minutos…", "loading", 630000);
    const result = await runNotebookLMAuth();
    if (result.success) runtime.auth = await checkNotebookLMAuth();
    toast(result.message, result.success ? "success" : "error", 10000);
    renderCurrentStep();
    return;
  }
  if (action === "verify-auth") {
    runtime.auth = await checkNotebookLMAuth();
    renderCurrentStep();
    return;
  }
  if (action === "save-institution") {
    const color = document.getElementById("onb-color").value;
    const rgb = hexToRgb(color);
    const config = {
      author: document.getElementById("onb-author").value.trim(), degree: document.getElementById("onb-degree").value.trim(), institution: document.getElementById("onb-institution").value.trim(), faculty: document.getElementById("onb-faculty").value.trim(), career: document.getElementById("onb-career").value.trim(), ecosystem: document.getElementById("onb-ecosystem").value.trim(), website: document.getElementById("onb-website").value.trim(), colorR: rgb.r, colorG: rgb.g, colorB: rgb.b, colorHex: color,
    };
    const errorEl = document.getElementById("onb-form-error");
    const missingLabels = { author: "Nombre completo", institution: "Institución", faculty: "Facultad", career: "Carrera" };
    const missing = Object.keys(missingLabels).filter(key => !config[key]);
    if (missing.length > 0) {
      errorEl.hidden = false;
      errorEl.textContent = `Completa los campos obligatorios: ${missing.map(key => missingLabels[key]).join(", ")}.`;
      return;
    }
    errorEl.hidden = true;
    state.config = { ...state.config, ...config }; saveConfig();
    const result = await applyInstitutionConfig({ author: config.author, degree: config.degree, institution: config.institution, website: config.website, faculty: config.faculty, career: config.career, ecosystem: config.ecosystem, color_r: rgb.r, color_g: rgb.g, color_b: rgb.b });
    toast(result.message, result.success ? "success" : "error", 8000);
    if (!result.success) return;
    return advance(current);
  }
  if (action === "save-template") {
    const result = await setActiveTemplate(runtime.activeTemplate);
    toast(result.message, result.success ? "success" : "error", 7000);
    if (result.success) return advance(current);
    return;
  }
  if (action === "export-zip") {
    const destination = await pickDirectory("Carpeta para guardar el ZIP de Claude/Cowork");
    if (!destination) return;
    const result = await exportSkillZip(destination);
    toast(result.message, result.success ? "success" : "error", 9000);
    if (result.success && result.path) { state.config.lastSkillZip = result.path; saveConfig(); }
    await refreshTarget();
    renderCurrentStep();
    return;
  }
  if (action === "install-local") {
    const result = await installSkill(); toast(result.message, result.success ? "success" : "error", 9000); await refreshTarget(); renderCurrentStep(); return;
  }
  if (action === "configure-code" || action === "configure-desktop") {
    const result = await configureMcp(action === "configure-code" ? "claude-code" : "desktop"); toast(result.message, result.success ? "success" : "error", 9000); await refreshTarget(); renderCurrentStep(); return;
  }
  if (action === "advance-target") {
    await refreshTarget();
    const target = document.querySelector("input[name=onboarding-target]:checked")?.value;
    if (!target) return toast("Selecciona un destino", "error");
    const ready = targetReady(target);
    if (!ready) { document.getElementById("onb-target-message").hidden = false; document.getElementById("onb-target-message").textContent = "Completa las acciones del destino y vuelve a verificar."; return; }
    return advance(current, target);
  }
  if (action === "complete") {
    const result = await completeOnboarding();
    toast(result.message, result.success ? "success" : "error", 10000);
    if (result.success) { runtime.status = result.status; document.getElementById("onboarding-root")?.remove(); window.location.reload(); }
    else { runtime.status = result.status; renderCurrentStep(); }
    return;
  }
  if (action === "advance") return advance(current);
}

async function advance(step, selectedTarget) {
  const result = await advanceOnboarding(step, selectedTarget);
  toast(result.message, result.success ? "success" : "error", 7000);
  if (result.success) {
    runtime.status = result.status;
    const next = Number(result.status.currentStep);
    if (next === 7) runtime.auth  = await checkNotebookLMAuth();
    if (next >= 8)  runtime.setup = await getSetupStatus();
    renderCurrentStep();
  }
}

async function refreshTarget() {
  runtime.setup = await getSetupStatus();
}

function targetReady(target) {
  const setup = runtime.setup || {};
  if (target === "claude-code") return setup.skill_installed && setup.mcp_claude_code_configured;
  if (target === "claude-cowork") return Boolean(state.config.lastSkillZip) && setup.mcp_desktop_configured;
  return Boolean(state.config.lastSkillZip) && setup.skill_installed && setup.mcp_desktop_configured && setup.mcp_claude_code_configured;
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return match ? { r: Number.parseInt(match[1], 16), g: Number.parseInt(match[2], 16), b: Number.parseInt(match[3], 16) } : { r: 0, g: 121, b: 107 };
}

function cssColorToHex(color) {
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = color;
  if (!probe.style.color) return null;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = computed.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!match) return null;
  return `#${[match[1], match[2], match[3]].map(value => Number(value).toString(16).padStart(2, "0")).join("")}`;
}
