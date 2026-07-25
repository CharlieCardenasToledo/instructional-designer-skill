import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el sistema visual no declara degradados CSS', async () => {
  const css = await readFile(new URL('src/styles.css', root), 'utf8');
  assert.doesNotMatch(css, /gradient\s*\(/i);
});

test('el onboarding mantiene diez pasos y la llamada de finalización', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /TOTAL_STEPS\s*=\s*10/);
  assert.match(source, /completeOnboarding/);
  assert.match(source, /advanceOnboarding/);
});

test('el onboarding no bloquea la carga inicial con NotebookLM', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('export async function renderOnboarding');
  const end = source.indexOf('function stepNumber', start);
  const initialRender = source.slice(start, end);
  assert.match(initialRender, /await getOnboardingStatus\(\)/);
  assert.match(initialRender, /prepareOnboardingStep\(currentStep/);
  assert.doesNotMatch(initialRender, /await checkNotebookLMAuth\(\)/);
  assert.match(source, /if \(step === 8\)[\s\S]*runtime\.auth = await checkNotebookLMAuth\(\)/);
});

test('la identidad institucional se divide en institución y perfil académico', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const institutionStart = source.indexOf('function institutionStep');
  const profileStart = source.indexOf('function academicProfileStep');
  const analysisStart = source.indexOf('function renderOnboardingSiteAnalysis');
  const institution = source.slice(institutionStart, profileStart);
  const profile = source.slice(profileStart, analysisStart);
  assert.match(institution, /onb-institution/);
  assert.match(institution, /onb-faculty/);
  assert.match(institution, /onb-career/);
  assert.doesNotMatch(institution, /onb-author/);
  assert.match(profile, /onb-author/);
  assert.match(profile, /onb-ecosystem/);
});

test('el onboarding presenta el flujo de producción editorial aprobado', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /Del sílabo a una guía lista para publicar/);
  assert.match(source, /Sílabo[\s\S]*Evidencia[\s\S]*Diseño pedagógico[\s\S]*LaTeX[\s\S]*PDF validado/);
  assert.match(source, /No diseña la guía ni reemplaza tu criterio docente/);
  assert.match(source, /Iniciando prueba de producción/);
  assert.match(source, /Guías modulares[\s\S]*Bibliografía APA\/Biber[\s\S]*Diagramas TikZ/);
});

test('el stepper mueve un gusanito literal sin convertir las flechas en recuadros', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src/styles.css', root), 'utf8'),
  ]);
  const bottomNavStart = source.indexOf('function renderBottomNav');
  const bottomNavEnd = source.indexOf('function loadingStep', bottomNavStart);
  const bottomNav = source.slice(bottomNavStart, bottomNavEnd);
  assert.match(source, /function animateStepTransition/);
  assert.match(source, /onboarding-progress-worm/);
  assert.match(source, /onboarding-worm-segment--head/);
  assert.match(source, /onboarding-progress-worm--\$\{direction\}/);
  assert.match(source, /function showPreparedStep/);
  assert.doesNotMatch(bottomNav, /data-tauri-drag-region/);
  assert.match(css, /\.onboarding-nav-arrow[\s\S]*background:\s*transparent/);
  assert.match(css, /\.onboarding-progress-worm/);
  assert.match(css, /@keyframes onboarding-worm-walk/);
  assert.match(css, /\.onboarding-worm-segment--head::before/);
});

test('el onboarding bloquea clics repetidos y explica la operación activa', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /async function runOnboardingOperation/);
  assert.match(source, /if \(onboardingActionInFlight\) return/);
  assert.match(source, /root\.setAttribute\("aria-busy"/);
  assert.match(source, /id="onboarding-operation-status"/);
  assert.match(source, /data-disabled-by-operation|disabledByOperation/);
  assert.match(source, /Instalando \$\{name\}[\s\S]*performDependencyInstall/);
  assert.match(source, /Ejecutando la prueba de producción[\s\S]*animateFinalStep/);
});

test('instalar una dependencia siempre pide autorización explícita antes de tocar el sistema', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const fnStart = source.indexOf('async function requestDependencyInstall');
  const fnEnd = source.indexOf('\n}', fnStart);
  const fn = source.slice(fnStart, fnEnd);
  assert.match(fn, /await confirmInOnboarding\(dependencyInstallConfirmMessage\(name\)\)/);
  assert.match(fn, /if \(!confirmed\) return/);
  assert.match(source, /function dependencyInstallConfirmMessage/);
});

test('la confirmación de instalar dependencias es un modal propio, no un diálogo nativo del SO', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.doesNotMatch(source, /@tauri-apps\/plugin-dialog/);
  assert.match(source, /function confirmInOnboarding/);
  assert.match(source, /document\.getElementById\("onboarding-root"\)/);
});

test('la app no muestra ni instala Docker/WSL: solo Node, Git, Python y el compilador LaTeX', async () => {
  const [onboarding, settings, course, onboardingRs] = await Promise.all([
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/onboarding.rs', root), 'utf8'),
  ]);
  assert.doesNotMatch(onboarding, /Docker|WSL/);
  assert.doesNotMatch(settings, /Docker|WSL/);
  // course.rs ya no declara DependencyStatus para Docker ni WSL 2 (los
  // motores de compilación de reserva se eliminaron junto con ellos), y el
  // nombre visible del compilador ya no es el técnico "TeX Live (pdflatex)".
  assert.doesNotMatch(course, /name:\s*"Docker"|name:\s*"WSL 2"|compile_via_docker|compile_via_wsl|docker_available|"TeX Live \(pdflatex\)"/);
  assert.match(course, /name:\s*"Compilador LaTeX"/);
  // La validación del onboarding exige Node.js, Python y el compilador
  // LaTeX explícitamente; Docker ya no es una alternativa aceptada.
  assert.doesNotMatch(onboardingRs, /"Docker" \| "TeX Live|"TeX Live \(pdflatex\)"/);
  assert.match(onboardingRs, /installed\("Python"\)/);
  assert.match(onboardingRs, /installed\("Compilador LaTeX"\)/);
  // "Instalar todo" del panel de Configuración > Entorno fue reemplazado.
  assert.doesNotMatch(settings, />Instalar todo</);
  assert.match(settings, /Instalar herramientas necesarias/);
  assert.match(settings, /BULK_INSTALL_TARGETS/);
});

test('el onboarding reutiliza validaciones y artefactos correctos', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const navigationStart = source.indexOf('function bindStepEvents');
  const navigationEnd = source.indexOf('function hexToRgb', navigationStart);
  const navigation = source.slice(navigationStart, navigationEnd);
  assert.match(source, /existing\.status === "pending"/);
  assert.match(source, /rememberSuccessfulLoad\("notebooklm-auth"\)/);
  assert.match(source, /prepareOnboardingStep\(8, \{ force: true \}\)/);
  assert.doesNotMatch(navigation, /force:\s*(?:dest|destination|next)/);
  assert.match(source, /reuseIfValid:\s*true/);
});

test('el backend evita reescrituras, reinstalaciones y recompilaciones idénticas', async () => {
  const [paths, payload, course, mcp] = await Promise.all([
    readFile(new URL('src-tauri/src/paths.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/payload.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/mcp.rs', root), 'utf8'),
  ]);
  assert.match(paths, /pub fn atomic_write_if_changed/);
  assert.match(payload, /installed_payload_matches/);
  assert.match(payload, /export_record_matches/);
  assert.match(course, /\.production-validation\.json/);
  assert.match(course, /reuse_if_valid && valid_pdf\(\) && manifest_matches\(\)/);
  assert.match(mcp, /AUTH_VALIDATION_TTL/);
  assert.match(mcp, /root == previous/);
});

test('la ventana sin marco permite minimizar, cerrar y arrastrar', async () => {
  const capability = JSON.parse(await readFile(new URL('src-tauri/capabilities/default.json', root), 'utf8'));
  const permissions = new Set(capability.permissions);
  assert.ok(permissions.has('core:window:allow-minimize'));
  assert.ok(permissions.has('core:window:allow-close'));
  assert.ok(permissions.has('core:window:allow-start-dragging'));
});
