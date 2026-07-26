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
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ThinkingOrb } from "thinking-orbs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import claudeLogo from "./assets/claude-symbol.svg";
import notebookLmLogo from "./assets/notebooklm-logo.svg";
import latexLogo from "./assets/latex-logo.svg";
import geminiLogo from "./assets/gemini-icon.svg";
import googleGLogo from "./assets/google-g.svg";
import notebookLmWordmark from "./assets/notebooklm-wordmark.svg";

// Esquema de 5 pasos (v3 en el backend; ver migrate_status en onboarding.rs).
const TOTAL_STEPS = 5;
const LARGE_DEPENDENCIES = new Set(["Compilador LaTeX"]);
const STEP_META = [
  { title: "Bienvenida", subtitle: "Convierte el sílabo de tu curso en guías semanales en PDF.", icon: "graduation-cap" },
  { title: "Requisitos", subtitle: "Instalamos automáticamente lo que falte.", icon: "terminal" },
  { title: "Tu perfil", subtitle: "Institución, autoría y plantilla de tus documentos.", icon: "building-2" },
  { title: "Conexión", subtitle: "Verifica tu sesión de Google y elige dónde vas a trabajar.", icon: "notebook" },
  { title: "Prueba final", subtitle: "Generamos un documento de muestra para confirmar que todo funciona.", icon: "check-circle-2" },
];
let runtime = {
  status: null,
  dependencies: [],
  auth: null,
  setup: null,
  templates: [],
  activeTemplate: "",
  sitePalette: null,
  detectedSiteName: "",
  loads: new Map(),
  loadingStep: null,
  depFocusIndex: 0,
};
let onboardingActionInFlight = false;
let onboardingBusyMessage = "";

function loadOnce(key, loader, force = false) {
  const existing = runtime.loads.get(key);
  if (existing && (!force || existing.status === "pending")) {
    return existing.promise;
  }
  const entry = { status: "pending", promise: null };
  entry.promise = Promise.resolve()
    .then(loader)
    .then(value => {
      entry.status = "fulfilled";
      return value;
    })
    .catch(error => {
      if (runtime.loads.get(key) === entry) runtime.loads.delete(key);
      throw error;
    });
  runtime.loads.set(key, entry);
  return entry.promise;
}

function rememberSuccessfulLoad(key) {
  runtime.loads.set(key, {
    status: "fulfilled",
    promise: Promise.resolve(),
  });
}

async function prepareOnboardingStep(step, { force = false } = {}) {
  if (step >= 5) {
    await Promise.all([
      prepareOnboardingStep(2, { force }),
      prepareOnboardingStep(3, { force }),
      prepareOnboardingStep(4, { force }),
    ]);
  }
  if (step === 2) {
    await loadOnce("dependencies", async () => {
      runtime.dependencies = await checkDependencies();
    }, force);
  }
  if (step === 3) {
    await loadOnce("templates", async () => {
      [runtime.templates, runtime.activeTemplate] = await Promise.all([
        listTemplates(),
        getActiveTemplate(),
      ]);
    }, force);
  }
  if (step === 4) {
    await loadOnce("notebooklm-auth", async () => {
      runtime.auth = await checkNotebookLMAuth();
    }, force);
    await loadOnce("setup", async () => {
      runtime.setup = await getSetupStatus();
    }, force);
  }
}

function warmOnboardingData(currentStep) {
  const warm = [];
  if (currentStep < 2) warm.push(prepareOnboardingStep(2));
  if (currentStep < 3) warm.push(prepareOnboardingStep(3));
  // El destino tarda varios segundos (npx/MCP); se calienta aparte de NotebookLM.
  if (currentStep < 4) warm.push(loadOnce("setup", async () => { runtime.setup = await getSetupStatus(); }));
  void Promise.allSettled(warm);
}

const BTN_PRIMARY = "w-full h-11 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 border-0 cursor-pointer";
const BTN_SECONDARY = "h-9 px-4 rounded-md bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer";
const SCROLL_THIN = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
const CARD_LEAD = "max-w-md mx-auto mb-5 text-center text-gray-600 text-sm leading-relaxed";
const CALLOUT = "flex gap-2.5 items-start max-w-lg mx-auto mt-4 p-3.5 rounded-xl bg-gray-100 text-gray-600 text-xs leading-relaxed";
const INLINE_ERROR = "max-w-lg mx-auto mt-3 p-3 rounded-lg bg-red-50 border border-red-300 text-red-600 text-xs flex items-center gap-2";
const DEP_ROW_CHECKING = "border-gray-200";
const DEP_ROW_READY = "border-gray-900 bg-gray-50";
const DEP_ROW_MISSING = "border-red-300 bg-red-50";
// Paso 2: una tarjeta grande por herramienta (ver dependenciesStep), no una cuadrícula.
const DEP_CARD_BASE = "flex flex-col gap-2.5 p-4 rounded-xl bg-white border transition-colors min-w-0";
const DEP_CARD_STATUS_BASE = "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center";
const LOADING_PALETTE = [
  { hex: "#4285f4", rgb: [66, 133, 244] },
  { hex: "#ea4335", rgb: [234, 67, 53] },
  { hex: "#fbbc05", rgb: [251, 188, 5] },
  { hex: "#34a853", rgb: [52, 168, 83] },
];

function onboardingAmbientBackground() {
  return `<div class="onboarding-ambient" aria-hidden="true">
    ${LOADING_PALETTE.map(({ hex }, index) => `<span class="onboarding-blob onboarding-blob--${index + 1}" style="--blob-color:${hex}"></span>`).join("")}
  </div>`;
}

export async function renderOnboarding() {
  const root = document.getElementById("onboarding-root");
  if (!root) return;
  root.className = "fixed top-0 right-0 bottom-0 left-0 z-[10000] flex items-center justify-center overflow-hidden bg-gray-50";
  root.innerHTML = `${onboardingAmbientBackground()}
  <div class="relative z-[1] w-full max-w-3xl mx-auto h-full max-h-screen flex flex-col items-center justify-center gap-4 p-6">
    <div id="loading-orbs"></div>
  </div>`;
  // Monta ThinkingOrb en un root React aislado (el resto de la app es JS vanilla).
  const orbRoot = createRoot(document.getElementById("loading-orbs"));
  orbRoot.render(createElement(ThinkingOrb, { state: "working", size: 64 }));
  const stopOrbs = () => orbRoot.unmount();

  try {
    runtime.status = await getOnboardingStatus();
    const currentStep = Number(runtime.status?.currentStep || 1);
    await prepareOnboardingStep(currentStep);
    stopOrbs();
    if (runtime.status.regressionReason) toast(runtime.status.regressionReason, "error", 12000);
    renderCurrentStep();
    warmOnboardingData(currentStep);
  } catch (error) {
    stopOrbs();
    root.innerHTML = `${onboardingAmbientBackground()}
    <div class="relative z-[1] w-full max-w-3xl mx-auto h-full max-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-2xl font-semibold text-gray-900 mb-2">No se pudo iniciar el onboarding</h1>
      <p class="text-gray-600 mb-5">${escapeHtml(error)}</p>
      <button class="${BTN_PRIMARY} max-w-xs" data-onboarding-action="retry"><span>Reintentar</span></button>
    </div>`;
    root.querySelector("[data-onboarding-action=retry]").addEventListener("click", () => runOnboardingOperation(
      "Reintentando el inicio…",
      renderOnboarding,
    ));
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
    ${onboardingAmbientBackground()}
    <div class="absolute top-3 right-3 flex z-10" data-tauri-drag-region>
      <button class="inline-flex h-7 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-900/5" id="onb-win-minimize" aria-label="Minimizar" title="Minimizar"><span class="material-symbols-outlined">remove</span></button>
      <button class="inline-flex h-7 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-600 hover:text-white" id="onb-win-close" aria-label="Cerrar" title="Cerrar"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="relative z-[1] w-full max-w-3xl mx-auto h-full flex flex-col p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div class="flex-1 min-h-0 overflow-y-auto pr-2 flex flex-col items-center ${SCROLL_THIN}">
        <div class="w-full my-auto">
          <div class="text-center mb-4 w-full">
            <h1 id="onboarding-title" class="text-4xl font-semibold text-gray-900 tracking-tight animate-[fade-in-up_0.5s_ease-out_forwards]">${escapeHtml(meta.title)}</h1>
            <p class="mt-3 text-base text-gray-600 max-w-md mx-auto leading-relaxed animate-[fade-in-up_0.5s_ease-out_forwards] [animation-delay:75ms]">${escapeHtml(meta.subtitle)}</p>
          </div>
          <div id="onboarding-step-content" class="w-full"></div>
        </div>
      </div>
      <div id="onboarding-bottom-nav" class="flex-shrink-0"></div>
    </div>`;

  document.getElementById("onb-win-minimize")?.addEventListener("click", () => getCurrentWindow().minimize());
  document.getElementById("onb-win-close")?.addEventListener("click", () => getCurrentWindow().close());

  const content = document.getElementById("onboarding-step-content");
  if (runtime.loadingStep === current) {
    content.innerHTML = loadingStep(current);
  } else {
    if (current === 1) content.innerHTML = welcomeStep();
    if (current === 2) content.innerHTML = dependenciesStep();
    if (current === 3) content.innerHTML = profileStep();
    if (current === 4) content.innerHTML = connectStep();
    if (current === 5) content.innerHTML = finalStep();
  }
  document.getElementById("onboarding-bottom-nav").innerHTML = renderBottomNav(current);
  bindStepEvents(current);
  refreshIcons();
  syncOnboardingBusyState();
}

// En el paso 2, el punto único se expande a un punto por herramienta (verde
// si está instalada), sobre la misma pista de 5 pasos. El área de clic de
// cada punto es más grande que el punto visual (Ley de Fitts).
function progressDots(current) {
  const maxDone = Number(runtime.status.maxCompletedStep || 0);
  const stepAvailable = step => step <= maxDone + 1;

  const macroDot = step => {
    const isActive = step === current;
    const isCompleted = !isActive && step <= maxDone;
    const available = stepAvailable(step);
    const color = isCompleted ? "bg-green-600" : isActive ? "bg-gray-900" : "bg-gray-300";
    const interactive = available ? "cursor-pointer hover:opacity-80" : "cursor-default";
    return `<button type="button" class="onboarding-progress-dot-hit w-8 h-8 flex items-center justify-center border-0 bg-transparent p-0 ${interactive}" data-step-index="${step}" ${available ? `data-onboarding-step="${step}"` : "disabled"} aria-label="Ir al paso ${step}" aria-current="${isActive ? "step" : "false"}">
      <span class="onboarding-progress-dot w-2.5 h-2.5 rounded-full ${color} transition-transform duration-200 ${isActive ? "scale-110 ring-4 ring-gray-900/10" : ""}"></span>
    </button>`;
  };

  const toolDots = sequence => {
    const available = stepAvailable(2);
    return sequence.map((dep, index) => {
      const isActive = current === 2 && index === runtime.depFocusIndex;
      const color = dep.installed ? "bg-green-600" : isActive ? "bg-gray-900" : "bg-gray-300";
      const interactive = available ? "cursor-pointer hover:opacity-80" : "cursor-default";
      return `<button type="button" class="onboarding-progress-dot-hit w-8 h-8 flex items-center justify-center border-0 bg-transparent p-0 ${interactive}" data-dep-step-index="${index}" ${available ? "data-onboarding-dep-step" : "disabled"} aria-label="Ver ${escapeHtml(dep.name)}" aria-current="${isActive ? "step" : "false"}">
        <span class="onboarding-progress-dot w-2 h-2 rounded-full ${color} transition-transform duration-200 ${isActive ? "scale-110 ring-4 ring-gray-900/10" : ""}"></span>
      </button>`;
    }).join("");
  };

  const parts = [];
  for (let step = 1; step <= TOTAL_STEPS; step++) {
    if (step === 2) {
      const sequence = dependencySequence();
      parts.push(sequence.length > 0 ? toolDots(sequence) : macroDot(2));
    } else {
      parts.push(macroDot(step));
    }
  }
  return parts.join("");
}

function actionButton(label, action, disabled = false, secondary = false, iconHtml = "") {
  return `<button class="${secondary ? BTN_SECONDARY : BTN_PRIMARY}" data-onboarding-action="${action}" ${disabled ? "disabled" : ""}>${iconHtml}<span>${escapeHtml(label)}</span></button>`;
}

// La barra de navegación es fija al final de la tarjeta, no parte del contenido de cada paso.
let footerConfig = { label: "Continuar", action: "advance", disabled: false };
function setFooter(label, action = "advance", disabled = false) {
  footerConfig = { label, action, disabled };
}

function renderBottomNav(current) {
  const canBack = current > 1;
  const skipLink = current >= 2
    ? `<button type="button" class="mt-3 text-[11px] text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline border-0 bg-transparent cursor-pointer transition-colors" data-onboarding-action="skip-onboarding" title="Saltar el asistente de configuración">
        Saltar configuración y acceder al dashboard →
      </button>`
    : "";
  return `<div class="flex flex-col items-center pt-2 flex-shrink-0">
    <div id="onboarding-operation-status" class="h-5 mb-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-500 transition-opacity ${onboardingActionInFlight ? "opacity-100" : "opacity-0"}" role="status" aria-live="polite" aria-atomic="true">
      <span class="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
      <span data-operation-message>${escapeHtml(onboardingBusyMessage || "Procesando…")}</span>
    </div>
    <div class="flex items-center justify-center gap-3">
      <button type="button" class="onboarding-nav-arrow onboarding-nav-arrow--back ${canBack ? "" : "opacity-0 pointer-events-none"}" data-onboarding-action="back" aria-label="Paso anterior" title="Paso anterior">${ic("chevron-left", 18)}</button>
      <div class="onboarding-progress relative flex items-center gap-1.5">${progressDots(current)}</div>
      <button type="button" class="h-10 pl-4 pr-3 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 border-0 cursor-pointer" data-onboarding-action="${footerConfig.action}" ${footerConfig.disabled ? "disabled" : ""}><span>${escapeHtml(footerConfig.label)}</span>${ic("chevron-right", 16)}</button>
    </div>
    ${skipLink}
  </div>`;
}


function syncOnboardingBusyState() {
  const root = document.getElementById("onboarding-root");
  if (!root) return;
  root.setAttribute("aria-busy", String(onboardingActionInFlight));

  const status = root.querySelector("#onboarding-operation-status");
  const message = status?.querySelector("[data-operation-message]");
  status?.classList.toggle("opacity-0", !onboardingActionInFlight);
  status?.classList.toggle("opacity-100", onboardingActionInFlight);
  if (message) message.textContent = onboardingBusyMessage || "Procesando…";

  const controls = root.querySelectorAll(
    "button:not(#onb-win-minimize):not(#onb-win-close), input, textarea, select",
  );
  controls.forEach(control => {
    if (onboardingActionInFlight) {
      if (!control.disabled) {
        control.dataset.disabledByOperation = "true";
        control.disabled = true;
      }
    } else if (control.dataset.disabledByOperation === "true") {
      control.disabled = false;
      delete control.dataset.disabledByOperation;
    }
  });
}

async function runOnboardingOperation(message, operation) {
  if (onboardingActionInFlight) return;
  onboardingActionInFlight = true;
  onboardingBusyMessage = message;
  syncOnboardingBusyState();
  try {
    return await operation();
  } finally {
    onboardingActionInFlight = false;
    onboardingBusyMessage = "";
    syncOnboardingBusyState();
  }
}

function actionBusyMessage(action, current) {
  const messages = {
    retry: "Reintentando el inicio…",
    back: "Volviendo al paso anterior…",
    "start-auth": "Abriendo el inicio de sesión de Google…",
    "verify-auth": "Verificando la sesión de NotebookLM…",
    "save-profile-and-template": "Guardando tu institución, perfil y plantilla…",
    "export-zip": "Exportando el archivo…",
    "install-local": "Instalando en tu proyecto local…",
    "configure-code": "Conectando tu proyecto local…",
    "configure-desktop": "Conectando la app de Claude…",
    "advance-target": "Comprobando el destino seleccionado…",
    complete: "Finalizando la configuración…",
  };
  if (action === "advance") {
    return current === 2
      ? "Confirmando las herramientas del entorno…"
      : `Preparando el paso ${Math.min(TOTAL_STEPS, current + 1)}…`;
  }
  return messages[action] || "Procesando la solicitud…";
}

function loadingStep(step) {
  const messages = {
    2: "Verificando las herramientas…",
    3: "Preparando tu institución, perfil y plantillas…",
    4: "Comprobando tu sesión de Google y dónde trabajarás…",
    5: "Preparando la prueba final…",
  };
  setFooter("Preparando el siguiente paso", "advance", true);
  return `<section class="flex flex-col items-center justify-center py-10" aria-live="polite">
    <span class="material-symbols-outlined text-[26px] text-gray-700 animate-spin">progress_activity</span>
    <p class="mt-3 text-sm font-medium text-gray-700">${messages[step] || "Preparando el siguiente paso…"}</p>
    <p class="mt-1 text-xs text-gray-400">Puedes continuar en cuanto termine esta comprobación.</p>
  </section>`;
}

function animateStepTransition(fromStep, toStep) {
  const track = document.querySelector(".onboarding-progress");
  const origin = stepperDotFor(track, fromStep);
  const destination = stepperDotFor(track, toStep);
  return animateDotWorm(track, origin, destination);
}

// En el paso 2, el punto de entrada es la herramienta enfocada (runtime.depFocusIndex).
function stepperDotFor(track, step) {
  if (!track) return null;
  if (step === 2 && dependencySequence().length > 0) {
    return track.querySelector(`[data-dep-step-index="${runtime.depFocusIndex}"]`);
  }
  return track.querySelector(`[data-step-index="${step}"]`);
}

// Anima el indicador entre dos puntos del stepper (paso macro o herramienta).
function animateDotWorm(track, origin, destination) {
  if (!track || !origin || !destination || origin === destination || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return Promise.resolve();
  }

  const trackRect = track.getBoundingClientRect();
  const originRect = origin.getBoundingClientRect();
  const destinationRect = destination.getBoundingClientRect();
  const start = originRect.left + originRect.width / 2 - trackRect.left;
  const end = destinationRect.left + destinationRect.width / 2 - trackRect.left;
  const distance = Math.abs(end - start);
  const worm = document.createElement("span");
  const direction = end > start ? "forward" : "backward";
  worm.className = `onboarding-progress-worm onboarding-progress-worm--${direction}`;
  worm.setAttribute("aria-hidden", "true");
  worm.innerHTML = `
    <span class="onboarding-worm-segment onboarding-worm-segment--tail"></span>
    <span class="onboarding-worm-segment"></span>
    <span class="onboarding-worm-segment"></span>
    <span class="onboarding-worm-segment onboarding-worm-segment--head"></span>`;
  worm.style.left = `${start}px`;
  track.appendChild(worm);
  origin.style.opacity = "0";

  const keyframes = [
    { left: `${start}px`, transform: "translate(-50%, -50%) scaleX(.92)" },
    { left: `${start + (end - start) * 0.45}px`, transform: "translate(-50%, -50%) scaleX(1.1)", offset: 0.48 },
    { left: `${end}px`, transform: "translate(-50%, -50%) scaleX(.92)" },
  ];
  const animation = worm.animate(keyframes, {
    duration: Math.min(760, 430 + distance * 2.4),
    easing: "cubic-bezier(.45, .05, .25, 1)",
    fill: "forwards",
  });
  return animation.finished.catch(() => {}).finally(() => worm.remove());
}

async function showPreparedStep(fromStep, destination, { force = false, depFocusIndex } = {}) {
  // Entrar al 2 desde antes enfoca la primera herramienta; desde después, la última.
  if (destination === 2 && fromStep !== 2) {
    const sequence = dependencySequence();
    if (sequence.length > 0) {
      runtime.depFocusIndex = depFocusIndex ?? (fromStep < 2 ? 0 : sequence.length - 1);
    }
  }
  const preparation = prepareOnboardingStep(destination, { force });
  await animateStepTransition(fromStep, destination);

  let prepared = false;
  preparation.then(() => { prepared = true; }, () => { prepared = true; });
  await Promise.resolve();
  if (!prepared) {
    runtime.loadingStep = destination;
    renderCurrentStep();
  }

  try {
    await preparation;
  } catch (error) {
    runtime.loadingStep = null;
    renderCurrentStep();
    toast(`No se pudo preparar el paso: ${error}`, "error", 9000);
    return;
  } finally {
    runtime.loadingStep = null;
  }
  renderCurrentStep();
}

// Git es opcional y no se muestra en el onboarding (solo en Configuración > Entorno).
function dependencySequence() {
  return runtime.dependencies.filter(dep => dep.required);
}

function dependencyCardShell(dep) {
  return `
    <div class="${DEP_CARD_BASE} ${DEP_ROW_CHECKING}" data-dep-row data-dep-name="${escapeHtml(dep.name)}">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="${DEP_CARD_STATUS_BASE} bg-neutral-100 text-neutral-400" data-dep-status><span class="animate-spin flex">${ic("loader-2", 18)}</span></div>
        <div class="min-w-0">
          <strong class="text-[15px] font-semibold text-gray-900 truncate block">${escapeHtml(dep.name)}</strong>
          <span class="dep-detail text-xs text-gray-500 leading-snug">Verificando…</span>
        </div>
      </div>
    </div>`;
}

// Dibuja solo la tarjeta de la herramienta enfocada; la navegación entre
// herramientas vive en la barra inferior (ver progressDots/animateStepTransition).
function dependenciesStep() {
  // Node.js, Python y el compilador LaTeX son obligatorios (required=true
  // desde el backend); Git es opcional y no bloquea el avance.
  const missing = runtime.dependencies.filter(dep => dep.required && !dep.installed);
  const sequence = dependencySequence();

  if (sequence.length === 0) {
    setFooter("Continuar", "advance", true);
    return `<section class="flex items-center justify-center py-10" aria-live="polite">
      <span class="material-symbols-outlined text-[26px] text-gray-700 animate-spin">progress_activity</span>
    </section>`;
  }

  runtime.depFocusIndex = Math.min(Math.max(runtime.depFocusIndex, 0), sequence.length - 1);
  const focusIndex = runtime.depFocusIndex;
  const isLast = focusIndex === sequence.length - 1;
  // La flecha "Continuar" solo debe frenarte en la última herramienta: antes
  // de eso, avanzar significa "ver la siguiente tarjeta", no salir del paso.
  // El motivo del bloqueo puede estar en una tarjeta que ya no estás viendo,
  // así que el aviso siempre nombra la causa real por su nombre.
  const blockReason = missing.length > 0 ? `Falta instalar: ${missing.map(dep => dep.name).join(", ")}.` : null;
  const nextBlocked = isLast && blockReason !== null;
  setFooter("Continuar", "advance", nextBlocked);

  return `<section>
    <div class="max-w-xl mx-auto mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
      <p class="text-xs text-gray-600 leading-relaxed">Estas herramientas permiten generar tus guías en PDF.</p>
    </div>
    <div class="max-w-xl mx-auto">${dependencyCardShell(sequence[focusIndex])}</div>
    ${nextBlocked ? `<div class="${INLINE_ERROR} !max-w-xl">${ic("alert-circle", 14)} ${escapeHtml(blockReason)}</div>` : ""}
  </section>`;
}

// Winget no reporta porcentaje; mostramos un indicador indeterminado en bucle.
const DEP_PROGRESS_DOTS = 6;
function beginDependencyInstallProgress(row, statusEl, detailEl, installButton) {
  if (statusEl) {
    statusEl.className = `${DEP_CARD_STATUS_BASE} bg-neutral-100 text-neutral-400`;
    statusEl.innerHTML = `<span class="animate-spin flex">${ic("loader-2", 18)}</span>`;
  }
  if (detailEl) detailEl.textContent = "Instalando…";
  installButton?.remove();

  const track = document.createElement("div");
  track.className = "dep-progress-track mt-1 self-start";
  track.setAttribute("role", "status");
  track.setAttribute("aria-label", "Instalando…");
  const dots = Array.from({ length: DEP_PROGRESS_DOTS }, () => `<span class="dep-progress-dot"></span>`).join("");
  track.innerHTML = `${dots}<span class="dep-progress-worm" aria-hidden="true">
    <span class="onboarding-worm-segment onboarding-worm-segment--tail"></span>
    <span class="onboarding-worm-segment"></span>
    <span class="onboarding-worm-segment"></span>
    <span class="onboarding-worm-segment onboarding-worm-segment--head"></span>
  </span>`;
  row.appendChild(track);
}

// Revela el estado final de la tarjeta enfocada tras un pequeño retardo
// cosmético (el chequeo real ya terminó antes de entrar al paso 2; esto solo
// mantiene la sensación de "verificando" al cambiar de herramienta).
function animateDependencyFocus(dep) {
  const card = document.querySelector("#onboarding-step-content [data-dep-row]");
  if (!card) return;
  setTimeout(() => {
    card.className = `${DEP_CARD_BASE} ${dep.installed ? DEP_ROW_READY : DEP_ROW_MISSING}`;
    const statusEl = card.querySelector("[data-dep-status]");
    const detailEl = card.querySelector(".dep-detail");
    if (statusEl) {
      statusEl.className = `${DEP_CARD_STATUS_BASE} ${dep.installed ? "bg-gray-200 text-green-700" : "bg-red-100 text-red-500"}`;
      statusEl.innerHTML = dep.installed ? ic("check-circle-2", 20) : ic("alert-circle", 20);
    }
    if (detailEl) detailEl.textContent = dep.note || (dep.installed ? "Listo" : "No encontrado");

    if (!dep.installed) {
      const btn = document.createElement("button");
      btn.className = BTN_SECONDARY + " mt-1 self-start";
      btn.dataset.installDependency = dep.name;
      btn.innerHTML = "<span>Instalar</span>";
      btn.addEventListener("click", () => requestDependencyInstall(dep.name, btn));
      card.appendChild(btn);
    } else {
      const badge = document.createElement("span");
      badge.className = "inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0 self-start mt-1";
      badge.textContent = "Listo";
      card.appendChild(badge);
    }

    if (dep.command) {
      const details = document.createElement("details");
      details.className = "mt-1";
      const summary = document.createElement("summary");
      summary.className = "flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden";
      summary.innerHTML = `<span class="material-symbols-outlined text-[13px]">terminal</span> Ver detalle avanzado`;
      details.appendChild(summary);
      const term = document.createElement("div");
      term.className = "mt-1 px-2.5 py-2 rounded-md bg-gray-900 font-mono text-[10.5px] leading-snug";
      const resultText = dep.installed ? (dep.version || "OK") : (dep.version || "No encontrado");
      term.innerHTML = `<span class="block text-gray-400 whitespace-pre-wrap break-words"><span class="text-green-400 mr-1">$</span>${escapeHtml(dep.command)}</span><span class="block text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(resultText)}</span>`;
      details.appendChild(term);
      card.appendChild(details);
    }
    refreshIcons();
    syncOnboardingBusyState();
  }, 260);
}

function revealFocusedDependency() {
  const sequence = dependencySequence();
  if (sequence.length > 0) animateDependencyFocus(sequence[runtime.depFocusIndex]);
}

// Mueve el foco entre herramientas del paso 2 sin llamar al backend.
async function moveDependencyFocus(toIndex) {
  // Guardia de reentrancia: evita animaciones superpuestas con doble clic.
  if (onboardingActionInFlight) return;
  const sequence = dependencySequence();
  const clamped = Math.min(Math.max(toIndex, 0), sequence.length - 1);
  if (clamped === runtime.depFocusIndex) return;
  onboardingActionInFlight = true;
  syncOnboardingBusyState();
  try {
    const track = document.querySelector(".onboarding-progress");
    const origin = track?.querySelector(`[data-dep-step-index="${runtime.depFocusIndex}"]`);
    const destination = track?.querySelector(`[data-dep-step-index="${clamped}"]`);
    await animateDotWorm(track, origin, destination);
    runtime.depFocusIndex = clamped;
    renderCurrentStep();
  } finally {
    onboardingActionInFlight = false;
    syncOnboardingBusyState();
  }
}

// Saltar directo a una herramienta desde otro paso macro (clic en su punto
// en la pista general estando, por ejemplo, en el paso 4): primero navega
// el backend al paso 2 y luego enfoca esa herramienta puntual.
async function jumpToDependencyTool(fromStep, toolIndex) {
  const result = await goToOnboardingStep(2);
  if (!result.success) {
    toast(result.message, "error");
    return;
  }
  runtime.status = result.status;
  await showPreparedStep(fromStep, 2, { depFocusIndex: toolIndex });
}

// Beneficios concretos por defecto; el detalle técnico/pedagógico queda en
// secciones plegables que no bloquean el avance.
function welcomeStep() {
  setFooter("Continuar", "advance", false);
  const feature = (icon, title, desc) => `
    <article class="p-4 rounded-xl border border-gray-200 bg-white">
      <div class="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center mb-2.5">${ic(icon, 18)}</div>
      <h3 class="text-[13px] font-semibold text-gray-900 mb-1">${title}</h3>
      <p class="text-xs text-gray-500 leading-relaxed">${desc}</p>
    </article>`;
  const techCard = (name, src, icon) => `
    <div class="flex items-center justify-center w-11 h-11 text-gray-700" title="${escapeHtml(name)}">
      ${src ? `<img src="${src}" alt="${escapeHtml(name)}" class="w-full h-full object-contain">` : ic(icon, 40)}
    </div>`;
  const framework = (name, source, desc) => `
    <article class="p-3.5 rounded-xl border border-gray-200 bg-white">
      <div class="flex items-baseline gap-1.5 mb-1">
        <h3 class="text-[13px] font-semibold text-gray-900">${escapeHtml(name)}</h3>
        <span class="text-[10.5px] text-gray-400 font-medium">${escapeHtml(source)}</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">${escapeHtml(desc)}</p>
    </article>`;
  const disclosure = (summaryText, bodyHtml) => `
    <details class="max-w-2xl mx-auto group">
      <summary class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden py-2 border-t border-gray-100">
        <span class="material-symbols-outlined text-[15px] transition-transform group-open:rotate-90">chevron_right</span>
        ${summaryText}
      </summary>
      <div class="pt-2 pb-1">${bodyHtml}</div>
    </details>`;

  return `<section>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto mb-3">
      ${feature("brain-circuit", "Convierte tu sílabo", "Sube el sílabo de tu materia y quedará estructurado como guía.")}
      ${feature("layout-template", "Organiza por semanas", "Cada semana queda con sus temas, actividades y bibliografía.")}
      ${feature("quote", "Genera el PDF", "Descarga la guía lista para publicar, con tu identidad institucional.")}
    </div>

    ${disclosure("Ver el recorrido", `
      <div class="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-gray-700 mb-4">
        <span class="rounded-lg border border-gray-200 bg-white px-3 py-2">Sílabo</span>
        ${ic("chevron-right", 14)}
        <span class="rounded-lg border border-gray-200 bg-white px-3 py-2">Fuentes</span>
        ${ic("chevron-right", 14)}
        <span class="rounded-lg border border-gray-200 bg-white px-3 py-2">Guía</span>
        ${ic("chevron-right", 14)}
        <span class="rounded-lg border border-gray-900 bg-gray-900 text-white px-3 py-2">PDF</span>
      </div>
      <div class="flex flex-wrap justify-center gap-4 mb-4">
        ${techCard("Claude", claudeLogo)}
        ${techCard("Gemini", geminiLogo)}
        ${techCard("NotebookLM", notebookLmLogo)}
        ${techCard("LaTeX", latexLogo)}
      </div>
      <div class="${CALLOUT}">${ic("shield-check", 16)} <span>Todo lo que configures se guarda en tu computadora. Las búsquedas bibliográficas solo se comparten con NotebookLM cuando tú lo autorizas.</span></div>
    `)}

    ${disclosure("Ver fundamentos pedagógicos", `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        ${framework("UDL 3.0", "CAST, 2024", "Múltiples medios de representación, participación, acción y expresión.")}
        ${framework("Backward Design", "Wiggins & McTighe", "Primero los resultados de aprendizaje, luego la evaluación, luego el contenido.")}
        ${framework("Quality Matters", "7ª ed.", "Alineación entre resultados, actividades y materiales.")}
      </div>
      <div class="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[11.5px] text-gray-600 leading-relaxed">
        <strong class="text-gray-900">Criterios complementarios:</strong> WCAG 2.2 para accesibilidad; principios multimedia de Mayer para reducir carga cognitiva; práctica espaciada e intercalada para reforzar la retención.
      </div>
    `)}
  </section>`;
}

const FIELD_INPUT = "bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-colors";
const FIELD_LABEL = "flex flex-col gap-1.5 text-gray-700 text-xs";

// Institución + perfil + plantilla en una pantalla con un único guardado
// (ver "save-profile-and-template" en performAction).
function profileStep() {
  const config = state.config;
  const value = key => escapeHtml(config[key] || "");
  const selectedTemplate = runtime.activeTemplate;
  const template = runtime.templates.find(item => item.id === selectedTemplate) || runtime.templates[0];
  const templateCards = runtime.templates.map(t => {
    const isSelected = t.id === selectedTemplate;
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

  const sectionHeading = (index, title) => `
    <div class="flex items-center gap-2 mb-2">
      <span class="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">${index}</span>
      <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-gray-500">${title}</h3>
      <span class="text-[10px] text-gray-300 font-medium ml-auto">${index} / 3</span>
    </div>`;

  setFooter("Guardar y continuar", "save-profile-and-template", !template);
  return `<section>
    <div class="max-w-lg mx-auto mb-5">
      ${sectionHeading(1, "Institución")}
      <p class="${CARD_LEAD} !max-w-lg !mb-3">Estos datos contextualizan las portadas, los casos y los metadatos de cada publicación.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
        <label class="${FIELD_LABEL}">Institución<input class="${FIELD_INPUT}" id="onb-institution" value="${value("institution")}" placeholder="Universidad Ejemplo"></label>
        <label class="${FIELD_LABEL}">Facultad<input class="${FIELD_INPUT}" id="onb-faculty" value="${value("faculty")}" placeholder="Facultad de Ingeniería"></label>
        <label class="${FIELD_LABEL}">Carrera<input class="${FIELD_INPUT}" id="onb-career" value="${value("career")}" placeholder="Ingeniería de Software"></label>
        <label class="${FIELD_LABEL}">Color institucional<div class="flex items-center gap-2"><input class="${FIELD_INPUT} h-9 p-1" id="onb-color" type="color" value="${escapeHtml(config.colorHex || "#00796b")}"><span id="onb-color-preview" class="inline-block h-5 w-5 shrink-0 rounded border border-black/20" style="background:${escapeHtml(config.colorHex || "#00796b")}" aria-hidden="true"></span><span id="onb-color-label" class="text-[11px] text-gray-500">${escapeHtml(config.colorHex || "#00796b")}</span></div></label>
      </div>
    </div>

    <div class="max-w-lg mx-auto mb-5 pt-5 border-t border-gray-200">
      ${sectionHeading(2, "Tu perfil")}
      <p class="${CARD_LEAD} !max-w-lg !mb-3">Tu nombre aparecerá como autor de tus publicaciones.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label class="${FIELD_LABEL}">Nombre completo<input class="${FIELD_INPUT}" id="onb-author" value="${value("author")}" placeholder="Ana López"></label>
        <label class="${FIELD_LABEL}">Grado académico <span class="text-gray-400 font-normal">(opcional)</span><input class="${FIELD_INPUT}" id="onb-degree" value="${value("degree")}" placeholder="Mgtr."></label>
      </div>
    </div>

    <div class="max-w-lg mx-auto pt-5 border-t border-gray-200">
      ${sectionHeading(3, "Formato del documento")}
      <p class="${CARD_LEAD} !max-w-lg !mb-3">Elige cómo se verá la guía final.</p>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">${templateCards}</div>
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
    syncOnboardingBusyState();
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
      if (onboardingActionInFlight) return;
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

// Sesión de Google + destino en una pantalla; avanzar exige ambas (ver
// advance-target en performAction).
function connectStep() {
  const authenticated = runtime.auth?.authenticated === true;
  const statusCls = authenticated ? "border-gray-900 bg-gray-50" : "border-amber-200 bg-amber-50 hover:border-amber-300";
  const iconCls = authenticated ? "text-gray-900" : "text-amber-600";

  const setup    = runtime.setup || {};
  const selected = runtime.status.selectedTarget || state.config.onboardingTarget || "claude-code";
  const zipOk    = Boolean(state.config.lastSkillZip);

  // Los ids internos (claude-code, claude-cowork, both) no cambian: solo el
  // título visible pasa de nombres de producto a lenguaje de tarea, para
  // usuario final que no necesita saber qué es "Claude Code" de antemano.
  const targets = [
    { id: "claude-code",    title: "Trabajar en proyectos locales", icon: "terminal",        desc: "Trabaja con los archivos de tu proyecto, con validaciones automáticas." },
    { id: "claude-cowork",  title: "Usar en la app de Claude",      icon: "desktop_windows",  desc: "Flujo visual dentro de la app, sin tocar archivos ni terminal." },
    { id: "both",           title: "Usar en ambos lugares",         icon: "devices",          desc: "Combina el proyecto local y la app de Claude." },
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
    checklist = checkItem("Instalado localmente", setup.skill_installed) +
                checkItem("Proyecto local conectado", setup.mcp_claude_code_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured);
    actions   = actionButton("1. Instalar", "install-local", setup.skill_installed, true) +
                actionButton("2. Conectar proyecto local", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true);

  } else if (selected === "claude-cowork") {
    checklist = checkItem("Archivo exportado", zipOk) +
                checkItem("App de Claude conectada", setup.mcp_desktop_configured);
    allReady  = !!(zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("1. Exportar archivo", "export-zip", zipOk, true) +
                actionButton("2. Conectar app de Claude", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);

  } else { // both
    checklist = checkItem("Instalado localmente", setup.skill_installed) +
                checkItem("Proyecto local conectado", setup.mcp_claude_code_configured) +
                checkItem("Archivo exportado", zipOk) +
                checkItem("App de Claude conectada", setup.mcp_desktop_configured);
    allReady  = !!(setup.skill_installed && setup.mcp_claude_code_configured && zipOk && setup.mcp_desktop_configured);
    actions   = actionButton("Instalar (proyecto local)", "install-local", setup.skill_installed, true) +
                actionButton("Exportar archivo (app de Claude)", "export-zip", zipOk, true) +
                actionButton("Conectar proyecto local", "configure-code", !setup.skill_installed || setup.mcp_claude_code_configured, true) +
                actionButton("Conectar app de Claude", "configure-desktop", !zipOk || setup.mcp_desktop_configured, true);
  }

  setFooter("Continuar al paso final", "advance-target", !authenticated || !allReady);
  return `<section>
    <div class="max-w-lg mx-auto mb-5">
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-gray-400">Fuentes del curso</h3>
        <img src="${notebookLmWordmark}" alt="NotebookLM" class="h-4 w-auto shrink-0">
      </div>
      <p class="${CARD_LEAD} !max-w-lg !mb-3">No diseña la guía ni reemplaza tu criterio docente: solo contrasta afirmaciones con las fuentes de tu curso.</p>
      <button class="flex items-start sm:items-center gap-3 w-full p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${statusCls}" data-onboarding-action="verify-auth" title="Volver a verificar">
        <div class="${iconCls} flex flex-shrink-0 mt-0.5 sm:mt-0">${authenticated ? ic("check-circle-2", 18) : ic("lock-keyhole", 18)}</div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <strong class="text-gray-900 text-sm">${authenticated ? "Sesión verificada" : "Sesión pendiente"}</strong>
          <span class="text-gray-500 text-xs">${escapeHtml(runtime.auth?.message || "Pulsa iniciar sesión y luego toca aquí para verificar.")}</span>
        </div>
        <div class="text-gray-400 flex-shrink-0">${ic("refresh-cw", 15)}</div>
      </button>
      <div class="flex justify-center mt-3">${actionButton("Iniciar sesión con Google", "start-auth", false, true, `<img src="${googleGLogo}" alt="" class="w-4 h-4">`)}</div>
    </div>

    <div class="max-w-lg mx-auto pt-5 border-t border-gray-200">
      <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-gray-400 mb-2">Dónde trabajarás</h3>
      <div class="grid gap-2">
        ${targets.map(t => `
          <label class="flex items-start sm:items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${t.id === selected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"}">
            <input type="radio" class="accent-gray-900 flex-shrink-0 mt-1 sm:mt-0" name="onboarding-target" value="${t.id}" ${t.id === selected ? "checked" : ""}>
            <span class="material-symbols-outlined text-[18px] flex-shrink-0 text-gray-500">${t.icon}</span>
            <span class="flex-1 min-w-0 flex flex-col gap-0.5"><strong class="text-gray-900 text-sm">${t.title}</strong><small class="text-gray-500 text-xs leading-snug">${t.desc}</small></span>
            <span class="material-symbols-outlined text-[18px] flex-shrink-0 ${targetReady(t.id) ? "text-green-600" : "text-gray-300"}">${targetReady(t.id) ? "check_circle" : "pending"}</span>
          </label>`).join("")}
      </div>

      <div class="my-4">
        <div class="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
          Pendiente para ${targets.find(t => t.id === selected)?.title || selected}
        </div>
        <div class="flex flex-col gap-1.5">${checklist}</div>
      </div>

      <div class="flex justify-center flex-wrap gap-2">${actions}</div>
      <div class="${INLINE_ERROR}" id="onb-target-message" hidden></div>
    </div>
  </section>`;
}

function finalStep() {
  const config = state.config || {};
  const setup  = runtime.setup || {};
  const target = runtime.status?.selectedTarget || config.onboardingTarget || "claude-code";
  const targetLabel = { "claude-code": "Trabajar en proyectos locales", "claude-cowork": "Usar en la app de Claude", "both": "Usar en ambos lugares" }[target] || target;

  // El checklist de conexión depende del destino elegido: a "claude-cowork"
  // no le corresponde "Instalado localmente" (usa un ZIP exportado, no una
  // instalación local), así que mostrar esa fila ahí sería una X roja falsa.
  const connectionChecks = {
    "claude-code": [
      { label: "Instalado localmente", ok: setup.skill_installed },
      { label: "Proyecto local conectado", ok: setup.mcp_claude_code_configured },
    ],
    "claude-cowork": [
      { label: "Archivo exportado", ok: Boolean(config.lastSkillZip) },
      { label: "App de Claude conectada", ok: setup.mcp_desktop_configured },
    ],
    both: [
      { label: "Instalado localmente", ok: setup.skill_installed },
      { label: "Proyecto local conectado", ok: setup.mcp_claude_code_configured },
      { label: "Archivo exportado", ok: Boolean(config.lastSkillZip) },
      { label: "App de Claude conectada", ok: setup.mcp_desktop_configured },
    ],
  };
  const checks = [
    { label: "Dependencias",        ok: runtime.dependencies.filter(d => d.required).every(d => d.installed) },
    { label: "Perfil institucional", ok: !!(config.author && config.institution) },
    { label: "Plantilla activa",     ok: !!runtime.activeTemplate },
    { label: "Sesión de Google",     ok: runtime.auth?.authenticated === true },
    ...(connectionChecks[target] || connectionChecks["claude-code"]),
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

        <div id="final-loading-msg" role="status" aria-live="polite" class="text-[13.5px] font-semibold text-gray-700 text-center">Iniciando prueba final…</div>
        <p class="text-[11px] text-gray-400 text-center -mt-2">Generamos un PDF real de prueba; puede tardar hasta un minuto.</p>

        <!-- Barra de progreso -->
        <div class="w-full max-w-xs h-[3px] rounded-full bg-gray-200 overflow-hidden">
          <div id="gen-progress-fill" class="h-full w-0 rounded-full bg-gray-900 transition-[width] duration-500"></div>
        </div>

        <div id="final-loading-steps" class="flex flex-col gap-1.5 w-full max-w-sm">
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="0">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Preparando datos…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="1">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Probando herramientas…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="2">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Generando ejemplo (2 semanas)…</span>
          </div>
          <div class="final-check-row flex items-center gap-2 text-xs text-gray-600 opacity-30" data-check="3">
            <span class="material-symbols-outlined text-[15px]">hourglass_empty</span>
            <span>Compilando PDF…</span>
          </div>
        </div>
      </div>

      <!-- Resultado — aparece solo tras éxito o fallo definitivo -->
      <div id="final-result-wrap" class="hidden">
        <div id="final-result-content"></div>
      </div>
    </div>

    <div class="max-w-md mx-auto mb-4">
      <div class="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 mb-2">Listo para crear</div>
      <div class="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600">
        ${["Guías semanales", "Bibliografía automática", "Casos y ejercicios", "PDF final"].map(item => `
          <div class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
            ${ic("check", 13)} <span>${item}</span>
          </div>`).join("")}
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
        <div class="flex justify-center gap-2 flex-wrap">
          <button class="${BTN_SECONDARY} text-[12.5px]" id="btn-retry-gen">
            <span class="material-symbols-outlined text-[15px]">refresh</span> Reintentar verificación
          </button>
          <button class="${BTN_SECONDARY} text-[12.5px]" id="btn-back-to-tools">
            <span class="material-symbols-outlined text-[15px]">terminal</span> Volver a herramientas
          </button>
        </div>
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
      void runOnboardingOperation(
        "Reintentando la prueba final…",
        animateFinalStep,
      );
    });
    document.getElementById("btn-back-to-tools")?.addEventListener("click", () => {
      void runOnboardingOperation("Abriendo el paso de herramientas…", async () => {
        const result = await goToOnboardingStep(2);
        if (result.success) {
          runtime.status = result.status;
          await showPreparedStep(5, 2);
        } else toast(result.message, "error");
      });
    });
    syncOnboardingBusyState();
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
    syncOnboardingBusyState();
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
  setMsg("Verificando instalación…");
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
    setMsg("No se encontró la instalación");
    showError(
      "No está instalado",
      "Vuelve al paso de conexión y pulsa 'Instalar' antes de continuar.",
      String(err)
    );
    return;
  }

  // ── 2 / 75 % — generar sílabo ───────────────────────────────────────────
  setRow(2, "active");
  setMsg("Generando sílabo de prueba…");
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
      "Está instalado pero no pudo crear el archivo. Reintenta o vuelve al paso de conexión para reinstalarlo.",
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
    pdfResult = await compileSyllabusPdf({
      coursePath: testBasePath,
      ...syllabusTestData,
      reuseIfValid: true,
    });
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
      "Vuelve al paso de herramientas y verifica que el compilador LaTeX esté instalado, luego vuelve a intentarlo.",
      String(err)
    );
    return;
  }

  showSuccess(testBasePath, pdfResult.message, pdfResult.path);
}


function bindStepEvents(current) {
  const root = document.getElementById("onboarding-root");
  root.querySelector("#onb-color")?.addEventListener("input", event => {
    if (!/^#[0-9a-fA-F]{6}$/.test(event.target.value)) return;
    const preview = root.querySelector("#onb-color-preview");
    const label = root.querySelector("#onb-color-label");
    if (preview) preview.style.background = event.target.value;
    if (label) label.textContent = event.target.value;
  });
  if (current === 2) revealFocusedDependency();
  if (current === 3) {
    root.querySelector("#onb-extract-palette")?.addEventListener("click", () => runOnboardingOperation(
      "Analizando el sitio institucional…",
      analyzeInstitutionWebsite,
    ));
    bindOnboardingPaletteButtons();
  }
  if (current === 5) {
    setTimeout(() => {
      void runOnboardingOperation(
        "Ejecutando la prueba final…",
        animateFinalStep,
      );
    }, 0);
  }
  root.querySelectorAll("[data-onboarding-step]").forEach(button => button.addEventListener("click", async () => {
    const dest = Number(button.dataset.onboardingStep);
    await runOnboardingOperation(`Abriendo el paso ${dest}…`, async () => {
      const dest = Number(button.dataset.onboardingStep);
      const result = await goToOnboardingStep(dest);
      if (result.success) {
        runtime.status = result.status;
        await showPreparedStep(current, dest);
      } else toast(result.message, "error");
    });
  }));
  root.querySelectorAll("[data-install-dependency]").forEach(button => button.addEventListener("click", () => requestDependencyInstall(button.dataset.installDependency, button)));
  root.querySelectorAll("[data-onboarding-dep-step]").forEach(dot => dot.addEventListener("click", () => {
    if (onboardingActionInFlight) return;
    const toolIndex = Number(dot.dataset.depStepIndex);
    if (current === 2) {
      moveDependencyFocus(toolIndex);
      return;
    }
    void runOnboardingOperation(`Abriendo el paso 2…`, () => jumpToDependencyTool(current, toolIndex));
  }));
  root.querySelectorAll("[data-template-id]").forEach(button => button.addEventListener("click", () => {
    if (onboardingActionInFlight) return;
    runtime.activeTemplate = button.dataset.templateId;
    renderCurrentStep();
  }));
  root.querySelectorAll("input[name=onboarding-target]").forEach(input => input.addEventListener("change", event => {
    if (onboardingActionInFlight) return;
    state.config.onboardingTarget = event.target.value;
    saveConfig();
    renderCurrentStep();
  }));
  root.querySelectorAll("[data-onboarding-action]").forEach(button => button.addEventListener("click", () => handleAction(button.dataset.onboardingAction, current)));
}

function dependencyInstallConfirmMessage(name) {
  return LARGE_DEPENDENCIES.has(name)
    ? `${name} puede descargar componentes grandes y requiere permisos del sistema. ¿Instalarlo ahora?`
    : `Vamos a instalar ${name} en tu sistema. ¿Continuar?`;
}

// Diálogo de confirmación propio del onboarding: la app no tiene barra de
// título del sistema (ventana sin marco), así que un confirm() nativo de
// Tauri se ve como una ventana ajena flotando encima. Este vive dentro del
// mismo #onboarding-root, con el estilo del resto de la app.
function confirmInOnboarding(message) {
  return new Promise(resolve => {
    const root = document.getElementById("onboarding-root");
    if (!root) {
      resolve(false);
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 px-6" role="alertdialog" aria-modal="true" aria-labelledby="onboarding-confirm-message">
        <div class="w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-2xl p-5 animate-[fade-in-up_0.2s_ease-out_forwards]">
          <p id="onboarding-confirm-message" class="text-sm text-gray-700 leading-relaxed">${escapeHtml(message)}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="${BTN_SECONDARY}" data-onboarding-confirm="cancel">Cancelar</button>
            <button type="button" class="${BTN_PRIMARY} !w-auto h-9 px-4" data-onboarding-confirm="ok">Continuar</button>
          </div>
        </div>
      </div>`;
    const overlay = wrapper.firstElementChild;
    root.appendChild(overlay);

    const cleanup = value => {
      overlay.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(value);
    };
    const onKeydown = event => {
      if (event.key === "Escape") cleanup(false);
    };
    overlay.querySelector('[data-onboarding-confirm="cancel"]').addEventListener("click", () => cleanup(false));
    overlay.querySelector('[data-onboarding-confirm="ok"]').addEventListener("click", () => cleanup(true));
    overlay.addEventListener("keydown", onKeydown);
    overlay.querySelector('[data-onboarding-confirm="ok"]').focus();
  });
}

// Punto único de entrada para instalar una dependencia: nunca instala sin
// que el usuario lo autorice explícitamente en este diálogo, sin importar
// si es una descarga grande (MiKTeX) o liviana (Node, Git, Python).
async function requestDependencyInstall(name, button) {
  if (onboardingActionInFlight) return;
  const confirmed = await confirmInOnboarding(dependencyInstallConfirmMessage(name));
  if (!confirmed) return;
  const row = button?.closest("[data-dep-row]");
  if (row) {
    beginDependencyInstallProgress(row, row.querySelector("[data-dep-status]"), row.querySelector(".dep-detail"), button);
  }
  await runOnboardingOperation(`Instalando ${name}…`, () => performDependencyInstall(name));
}

async function performDependencyInstall(name) {
  toast(`Instalando ${name}…`, "loading", 120000);
  const result = await installDependency(name, true);
  toast(result.message, result.success ? "success" : "error", 9000);
  runtime.dependencies = await checkDependencies();
  renderCurrentStep();
}

// Dentro del paso 2, las flechas Atrás/Continuar del pie primero recorren
// las herramientas (sin tocar el backend) y solo al llegar al borde -primera
// o última- hacen lo que siempre hicieron: retroceder al paso 1 o avanzar al
// 3. Así la pista de abajo se siente como una sola secuencia continua.
async function handleAction(action, current) {
  if (current === 2 && (action === "advance" || action === "back")) {
    const sequence = dependencySequence();
    if (sequence.length > 0) {
      const nextIndex = runtime.depFocusIndex + (action === "advance" ? 1 : -1);
      if (nextIndex >= 0 && nextIndex < sequence.length) {
        return moveDependencyFocus(nextIndex);
      }
    }
  }
  return runOnboardingOperation(
    actionBusyMessage(action, current),
    () => performAction(action, current),
  );
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
    if (result.success) {
      runtime.status = result.status;
      const destination = Number(result.status.currentStep);
      await showPreparedStep(current, destination);
    }
    else toast(result.message, "error");
    return;
  }
  if (action === "start-auth") {
    toast("Completa el inicio de sesión en Chrome. Esto puede tardar unos minutos…", "loading", 630000);
    const result = await runNotebookLMAuth();
    if (result.success) {
      runtime.auth = {
        authenticated: true,
        message: result.message || "Sesión iniciada y verificada con NotebookLM.",
      };
      rememberSuccessfulLoad("notebooklm-auth");
    }
    toast(result.message, result.success ? "success" : "error", 10000);
    renderCurrentStep();
    return;
  }
  if (action === "verify-auth") {
    await prepareOnboardingStep(4, { force: true });
    renderCurrentStep();
    return;
  }
  if (action === "save-profile-and-template") {
    const color = document.getElementById("onb-color").value;
    const rgb = hexToRgb(color);
    const config = {
      ...state.config,
      website: document.getElementById("onb-website").value.trim(),
      institution: document.getElementById("onb-institution").value.trim(),
      faculty: document.getElementById("onb-faculty").value.trim(),
      career: document.getElementById("onb-career").value.trim(),
      colorHex: color,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      author: document.getElementById("onb-author").value.trim(),
      degree: document.getElementById("onb-degree").value.trim(),
    };
    const errorEl = document.getElementById("onb-form-error");
    const missingLabels = { author: "Nombre completo", institution: "Institución", faculty: "Facultad", career: "Carrera" };
    const missing = Object.keys(missingLabels).filter(key => !config[key]);
    if (missing.length > 0) {
      errorEl.hidden = false;
      errorEl.textContent = `Completa los campos obligatorios: ${missing.map(key => missingLabels[key]).join(", ")}.`;
      return;
    }
    if (!runtime.activeTemplate) {
      errorEl.hidden = false;
      errorEl.textContent = "Elige una plantilla para continuar.";
      return;
    }
    errorEl.hidden = true;
    state.config = config;
    saveConfig();
    const result = await applyInstitutionConfig({ author: config.author, degree: config.degree, institution: config.institution, website: config.website, faculty: config.faculty, career: config.career, ecosystem: config.ecosystem, color_r: config.colorR, color_g: config.colorG, color_b: config.colorB });
    if (!result.success) { toast(result.message, "error", 8000); return; }
    const templateResult = await setActiveTemplate(runtime.activeTemplate);
    toast(templateResult.message, templateResult.success ? "success" : "error", 7000);
    if (!templateResult.success) return;
    return advance(current);
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
    if (!runtime.auth?.authenticated) {
      document.getElementById("onb-target-message").hidden = false;
      document.getElementById("onb-target-message").textContent = "Verifica tu sesión de NotebookLM antes de continuar.";
      return;
    }
    await refreshTarget();
    const target = document.querySelector("input[name=onboarding-target]:checked")?.value;
    if (!target) return toast("Selecciona un destino", "error");
    const ready = targetReady(target);
    if (!ready) { document.getElementById("onb-target-message").hidden = false; document.getElementById("onb-target-message").textContent = "Completa las acciones del destino y vuelve a verificar."; return; }
    return advance(current, target);
  }
  if (action === "skip-onboarding") {
    const stepResult = await goToOnboardingStep(5);
    if (!stepResult.success) { toast(stepResult.message, "error"); return; }
    const result = await completeOnboarding();
    if (result.success) {
      toast("Saltando asistente...", "info", 3000);
      document.getElementById("onboarding-root")?.remove();
      window.location.reload();
    } else {
      toast(result.message, "error", 6000);
    }
    return;
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
    await showPreparedStep(step, next);
  }
}

async function refreshTarget() {
  runtime.setup = await getSetupStatus();
  rememberSuccessfulLoad("setup");
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
