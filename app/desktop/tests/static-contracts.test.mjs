import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../../', import.meta.url);

test('Jintia es la identidad canónica en la aplicación, la skill y los instaladores', async () => {
  const [main, onboarding, html, tauriText, appPackageText, skill, pluginText, paths, payload] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.conf.json', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
    readFile(new URL('skill/SKILL.md', repositoryRoot), 'utf8'),
    readFile(new URL('skill/.claude-plugin/plugin.json', repositoryRoot), 'utf8'),
    readFile(new URL('src-tauri/src/paths.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/payload.rs', root), 'utf8'),
  ]);
  const tauri = JSON.parse(tauriText);
  const appPackage = JSON.parse(appPackageText);
  const plugin = JSON.parse(pluginText);

  assert.match(main, />Jintia</);
  assert.match(main, /Diseña el camino del aprendizaje/);
  assert.match(onboarding, />Jintia</);
  assert.match(onboarding, /Diseña el camino del aprendizaje/);
  assert.match(html, /<title>Jintia/);
  assert.equal(tauri.productName, 'Jintia Desktop');
  assert.equal(tauri.identifier, 'com.charliecardenas.jintia');
  assert.equal(appPackage.name, 'jintia-desktop');
  assert.match(skill, /^name:\s*jintia-skill$/m);
  assert.equal(plugin.name, 'jintia-skill');
  assert.match(paths, /\.join\("jintia-skill"\)/);
  assert.match(paths, /legacy_skill_dir/);
  assert.match(payload, /jintia-skill-10\.4\.0\.zip/);
  assert.match(payload, /instructional-designer-skill\.backup-/);
});

test('la arquitectura separa la app de escritorio y el paquete instalable de la skill', async () => {
  const [payload, config, windowsWorkflow, macosWorkflow] = await Promise.all([
    readFile(new URL('app/desktop/src-tauri/src/payload.rs', repositoryRoot), 'utf8'),
    readFile(new URL('app/desktop/src-tauri/src/config.rs', repositoryRoot), 'utf8'),
    readFile(new URL('.github/workflows/release-windows.yml', repositoryRoot), 'utf8'),
    readFile(new URL('.github/workflows/release-macos.yml', repositoryRoot), 'utf8'),
  ]);

  assert.match(payload, /skill\/SKILL\.md/);
  assert.match(payload, /skill\/requirements\.txt/);
  assert.match(payload, /skill\/references/);
  assert.match(payload, /skill\/scripts/);
  assert.match(payload, /skill\/templates/);
  assert.match(payload, /skill\/config/);
  assert.match(config, /skill\/templates/);
  assert.match(windowsWorkflow, /working-directory:\s*app\/desktop/);
  assert.match(macosWorkflow, /working-directory:\s*app\/desktop/);

  for (const source of [payload, config, windowsWorkflow, macosWorkflow]) {
    assert.doesNotMatch(source, /desktop-manager/);
  }
});

test('el modo mock no anuncia plantillas que el backend no incorpora', async () => {
  const mock = await readFile(new URL('src/mocks/tauri-core.mock.js', root), 'utf8');
  assert.match(mock, /id:\s*"elegantbook-clasico"/);
  assert.doesNotMatch(mock, /minimal-mono|ieee-tecnico|cuaderno-taller/);
});

test('la firma SignPath solo publica artifacts verificados cuando está activada', async () => {
  const workflow = await readFile(
    new URL('.github/workflows/release-windows.yml', repositoryRoot),
    'utf8',
  );
  assert.match(workflow, /id:\s*upload-unsigned-artifact/);
  assert.match(workflow, /signpath\/github-action-submit-signing-request@v2/);
  assert.match(workflow, /vars\.SIGNPATH_ENABLED == 'true'/);
  assert.match(workflow, /Get-AuthenticodeSignature/);
  assert.match(workflow, /signature\.Status -ne 'Valid'/);
  assert.match(workflow, /Publish signed GitHub Release assets/);
  assert.match(workflow, /Publish unsigned GitHub Release assets/);
  assert.match(workflow, /Windows artifacts in this release are not digitally signed/);
});

test('la configuración institucional generada coincide con el esquema público', async () => {
  const [configSource, schemaText, exampleText] = await Promise.all([
    readFile(new URL('src-tauri/src/config.rs', root), 'utf8'),
    readFile(new URL('skill/config/institution.schema.json', repositoryRoot), 'utf8'),
    readFile(new URL('skill/config/institution.example.json', repositoryRoot), 'utf8'),
  ]);
  const schema = JSON.parse(schemaText);
  const example = JSON.parse(exampleText);
  assert.ok(schema.properties.institution.properties.website);
  assert.ok(schema.properties.institution.required.includes('website'));
  assert.equal(example.branding.logoPath, '');
  assert.match(configSource, /"website": clean\(&config\.website\)/);
  assert.match(configSource, /"logoPath": ""/);
});

test('el único degradado CSS es el highlight refractivo del control Liquid', async () => {
  const css = await readFile(new URL('src/styles.css', root), 'utf8');
  assert.match(css, /\.liquid-control::before\s*\{[\s\S]*linear-gradient\s*\(/i);
  assert.equal((css.match(/gradient\s*\(/gi) || []).length, 1);
});

test('todo ícono usado con ic(name) está registrado en icons.js (si no, Lucide no dibuja nada)', async () => {
  const icons = await readFile(new URL('src/icons.js', root), 'utf8');
  const registered = new Set(
    [...icons.matchAll(/\b([A-Z][a-zA-Z0-9]*)\b/g)].map(m => m[1])
  );
  const kebabToPascal = kebab => kebab.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');

  const files = ['src/onboarding.js', 'src/main.js', 'src/pages/courses.js', 'src/pages/syllabus.js',
    'src/pages/templates.js', 'src/pages/settings.js', 'src/pages/docs.js'];
  const missing = [];
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/\bic\(\s*["'`]([a-z0-9-]+)["'`]/g)) {
      const pascal = kebabToPascal(match[1]);
      if (!registered.has(pascal)) missing.push(`${file}: ic("${match[1]}") -> ${pascal}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('el onboarding colapsó a cinco pasos y conserva la llamada de finalización', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /TOTAL_STEPS\s*=\s*5/);
  assert.match(source, /completeOnboarding/);
  assert.match(source, /advanceOnboarding/);
  const metaStart = source.indexOf('const STEP_META');
  const metaEnd = source.indexOf('\n];', metaStart);
  const stepMeta = source.slice(metaStart, metaEnd);
  assert.equal((stepMeta.match(/\btitle:/g) || []).length, 5);
});

test('el onboarding no bloquea la carga inicial con NotebookLM', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('export async function renderOnboarding');
  const end = source.indexOf('function stepNumber', start);
  const initialRender = source.slice(start, end);
  assert.match(initialRender, /await getOnboardingStatus\(\)/);
  assert.match(initialRender, /prepareOnboardingStep\(currentStep/);
  assert.doesNotMatch(initialRender, /await checkNotebookLMAuth\(\)/);
  // NotebookLM ahora vive en el paso 4 (fusionado con destino), no en un
  // paso dedicado -sigue sin calentarse por adelantado (ver warmOnboardingData).
  assert.match(source, /if \(step === 4\)[\s\S]*runtime\.auth = await checkNotebookLMAuth\(\)/);
  assert.doesNotMatch(source, /warmOnboardingData[\s\S]*?checkNotebookLMAuth/);
});

test('institución, perfil académico y plantilla viven en un solo paso fusionado', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function profileStep');
  const end = source.indexOf('function renderOnboardingSiteAnalysis', start);
  assert.ok(start >= 0, 'profileStep debe existir');
  const profile = source.slice(start, end);
  assert.match(profile, /onb-institution/);
  assert.match(profile, /onb-faculty/);
  assert.match(profile, /onb-career/);
  assert.match(profile, /onb-author/);
  // El campo de ecosistema digital se quitó del onboarding por redundante
  // para la primera configuración; sigue existiendo en Configuración.
  assert.doesNotMatch(profile, /onb-ecosystem/);
  assert.match(profile, /data-template-id/);
  assert.match(profile, /"save-profile-and-template"/);
  // Un único guardado combinado: ya no existen las acciones separadas.
  assert.doesNotMatch(source, /"save-institution-basics"|"save-institution"|"save-template"/);
});

test('el onboarding presenta el flujo de producción editorial aprobado', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /Sílabo[\s\S]*Fuentes[\s\S]*Guía[\s\S]*PDF/);
  assert.match(source, /No diseña la guía ni reemplaza tu criterio docente/);
  assert.match(source, /Iniciando prueba final/);
  assert.match(source, /Guías semanales[\s\S]*Bibliografía automática[\s\S]*Casos y ejercicios[\s\S]*PDF final/);
});

test('el copy del onboarding no repite jerga técnica ni referencias obsoletas al esquema de 10 pasos', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  // Textos visibles: nada de "skill" expuesto al usuario final fuera de las
  // llamadas internas a la API (installSkill, getSkillPath, exportSkillZip).
  const stepMetaStart = source.indexOf('const STEP_META');
  const stepMetaEnd = source.indexOf('\n];', stepMetaStart);
  assert.doesNotMatch(source.slice(stepMetaStart, stepMetaEnd), /producción|publicar|sistema completo/i);
  assert.doesNotMatch(source, /los 10 pasos|10 pasos del onboarding/);
  assert.doesNotMatch(source, /dentro del paso 4/); // el mini-stepper de herramientas vive en el paso 2
  assert.doesNotMatch(source, /"Instalando la skill en Claude Code…"|"Conectando la skill con Claude/);
});

test('el copy visible no reintroduce jerga técnica ya eliminada por auditoría de UX', async () => {
  const [onboarding, settings] = await Promise.all([
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
  ]);
  const banned = /Sistema editorial|motor de producción|perfil editorial|Zona peligrosa|Instalando skill/;
  assert.doesNotMatch(onboarding, banned);
  assert.doesNotMatch(settings, banned);
});

test('el stepper conserva el gusanito y usa controles Liquid Glass', async () => {
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
  assert.match(bottomNav, /onboarding-nav-arrow[\s\S]*liquid-control/);
  assert.match(bottomNav, /ui\.liquid\.group/);
  assert.match(css, /\.liquid-control/);
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
  assert.match(source, /Ejecutando la prueba final[\s\S]*animateFinalStep/);
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
  assert.match(source, /prepareOnboardingStep\(4, \{ force: true \}\)/);
  assert.doesNotMatch(navigation, /force:\s*(?:dest|destination|next)/);
  assert.match(source, /reuseIfValid:\s*true/);
});

test('la barra inferior tiene un botón principal con texto visible y puntos con área de clic ampliada', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function renderBottomNav');
  const end = source.indexOf('function syncOnboardingBusyState', start);
  const bottomNav = source.slice(start, end);
  // El botón de avance ya no es solo un ícono con tooltip: el label de
  // footerConfig se ve como texto real dentro del botón (Ley de Fitts /
  // "qué puedo hacer ahora" de Norman), no solo en aria-label/title.
  assert.match(bottomNav, /<span>\$\{escapeHtml\(footerConfig\.label\)\}<\/span>/);
  const dotsStart = source.indexOf('function progressDots');
  const dotsEnd = source.indexOf('function actionButton', dotsStart);
  const dots = source.slice(dotsStart, dotsEnd);
  assert.match(dots, /onboarding-progress-dot-hit w-8 h-8/);
});

test('el paso de herramientas bloquea el avance nombrando la herramienta faltante', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const missing = source.indexOf("dep.required && !dep.installed");
  assert.ok(missing >= 0, 'dependenciesStep debe filtrar herramientas requeridas no instaladas');
  assert.match(source, /Falta instalar: \$\{missing\.map/);
});

test('Git no aparece como tarjeta en el onboarding (solo en Configuración > Entorno)', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function dependencySequence');
  const end = source.indexOf('\n}', start);
  const fn = source.slice(start, end);
  assert.match(fn, /runtime\.dependencies\.filter\(dep => dep\.required\)/);
});

test('los destinos usan lenguaje de tarea, no nombres de producto, en título visible', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function connectStep');
  const end = source.indexOf('function finalStep', start);
  const connect = source.slice(start, end);
  assert.match(connect, /id: "claude-code",\s*title: "Trabajar en proyectos locales"/);
  assert.match(connect, /id: "claude-cowork",\s*title: "Usar en la app de Claude"/);
  assert.match(connect, /id: "both",\s*title: "Usar en ambos lugares"/);
});

test('el checklist final depende del destino elegido (no asume Skill instalada siempre)', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function finalStep');
  const end = source.indexOf('function animateFinalStep', start);
  const final = source.slice(start, end);
  assert.match(final, /const connectionChecks = \{/);
  assert.match(final, /"claude-cowork":\s*\[/);
  assert.match(final, /Archivo exportado/);
});

test('el paso de perfil fusionado tiene divisores visuales numerados entre secciones', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function profileStep');
  const end = source.indexOf('function renderOnboardingSiteAnalysis', start);
  const profile = source.slice(start, end);
  assert.match(profile, /function sectionHeading|const sectionHeading/);
  assert.match(profile, /border-t border-gray-200/);
});

test('los botones de Conexiones en Settings usan los targets que el backend realmente acepta', async () => {
  const [settings, mcp] = await Promise.all([
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/mcp.rs', root), 'utf8'),
  ]);
  // configure_mcp() en mcp.rs solo reconoce "claude-code" y "desktop"; usar
  // "claude_code" (guion bajo), "cowork" o "all" hace que el botón siempre
  // falle con "Destino MCP no reconocido".
  assert.match(mcp, /"claude-code"\s*=>/);
  assert.match(mcp, /"desktop"\s*=>/);
  assert.doesNotMatch(settings, /data-target="claude_code"|data-target="cowork"|data-target="all"/);
  assert.match(settings, /data-target="claude-code"/);
  assert.match(settings, /data-target="desktop"/);
  assert.match(settings, /configureMcp\("claude-code"\)/);
  assert.match(settings, /configureMcp\("desktop"\)/);
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

test('el dashboard permite minimizar, maximizar, cerrar y arrastrar sin añadir maximizar al onboarding', async () => {
  const [capabilityText, main, onboarding, windowMock] = await Promise.all([
    readFile(new URL('src-tauri/capabilities/default.json', root), 'utf8'),
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src/mocks/tauri-window.mock.js', root), 'utf8'),
  ]);
  const capability = JSON.parse(capabilityText);
  const permissions = new Set(capability.permissions);
  assert.ok(permissions.has('core:window:allow-minimize'));
  assert.ok(permissions.has('core:window:allow-toggle-maximize'));
  assert.ok(permissions.has('core:window:allow-close'));
  assert.ok(permissions.has('core:window:allow-start-dragging'));
  assert.match(main, /id="app-win-maximize"/);
  assert.match(main, /getCurrentWindow\(\)\.toggleMaximize\(\)/);
  assert.match(windowMock, /toggleMaximize/);
  assert.doesNotMatch(onboarding, /onb-win-maximize/);
});

test('la UI compartida usa recetas Tailwind v4 y no reintroduce componentes CSS legacy', async () => {
  const [css, recipes] = await Promise.all([
    readFile(new URL('src/styles.css', root), 'utf8'),
    readFile(new URL('src/uiClasses.js', root), 'utf8'),
  ]);
  assert.match(css, /@theme\s*\{/);
  assert.doesNotMatch(css, /^\.btn(?:-|\s|\{|\:)/m);
  assert.doesNotMatch(css, /^\.glass-(?:card|pane|input)\b/m);
  assert.doesNotMatch(css, /^\.form-(?:grid|group)\b/m);
  assert.doesNotMatch(css, /^\.(?:nav-item|nav-badge|courses-table|status-pill|syllabus-layout|tpl-layout|lp-|latex-)/m);
  assert.match(css, /prefers-reduced-transparency/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(recipes, /export const ui/);
  assert.match(recipes, /backdrop-blur-2xl/);
  assert.match(recipes, /backdrop-saturate-150/);
  assert.match(recipes, /surface:\s*\{/);
});

test('Liquid Glass aparece solo en controles y el contenido principal permanece opaco', async () => {
  const files = ['main.js', 'pages/about.js', 'pages/courses.js', 'pages/settings.js', 'pages/syllabus.js', 'pages/templates.js', 'pages/docs.js', 'pages/institution.js', 'templatePreview.js'];
  const pageSources = (await Promise.all(files.map(file => readFile(new URL(`src/${file}`, root), 'utf8')))).join('\n');
  assert.doesNotMatch(pageSources, /(?:card|table)[^"`]*backdrop-blur/i);
  assert.doesNotMatch(pageSources, /panel[^"`]*backdrop-blur/i);
  assert.doesNotMatch(pageSources, /glass-(?:card|pane|input)/);
  assert.match(pageSources, /bg-white/);
});

test('Liquid Glass tiene fallbacks completos de accesibilidad', async () => {
  const css = await readFile(new URL('src/styles.css', root), 'utf8');
  assert.match(css, /prefers-reduced-transparency/);
  assert.match(css, /backdrop-filter:\s*none/);
  assert.match(css, /\.liquid-control::before,[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /prefers-reduced-motion/);
  const onboarding = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(onboarding, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
});

test('router y topbar usan atributos e IDs estables, no clases legacy', async () => {
  const [router, main] = await Promise.all([
    readFile(new URL('src/router.js', root), 'utf8'),
    readFile(new URL('src/main.js', root), 'utf8'),
  ]);
  assert.doesNotMatch(router, /querySelectorAll\(["']\.nav-item/);
  assert.match(router, /data-nav-item/);
  assert.match(main, /id="topbar-title"/);
  assert.match(main, /id="topbar-sub"/);
  assert.match(router, /getElementById\("topbar-title"\)/);
});

test('Acerca de Jintia está conectado al pie, Ayuda y metadatos de ejecución', async () => {
  const [main, router, docs, about, api, appMeta] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/router.js', root), 'utf8'),
    readFile(new URL('src/pages/docs.js', root), 'utf8'),
    readFile(new URL('src/pages/about.js', root), 'utf8'),
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src/appMeta.js', root), 'utf8'),
  ]);
  assert.match(router, /about:\s*\{\s*title:\s*"Acerca de Jintia"/);
  assert.match(main, /data-sidebar-page data-page="about"/);
  assert.doesNotMatch(main, /v10\.4 · jintia-skill/);
  assert.match(docs, /data-doc-nav="about"/);
  assert.match(about, /Creado y mantenido por/);
  assert.match(about, /Tauri[\s\S]*Rust[\s\S]*React[\s\S]*ElegantBook/);
  assert.match(api, /Promise\.all\(\[[\s\S]*getName\(\)[\s\S]*getVersion\(\)/);
  assert.match(appMeta, /creator:\s*"Charlie Cárdenas Toledo"/);
});

test('los enlaces externos de Acerca de usan opener con una lista cerrada', async () => {
  const [api, capabilityText] = await Promise.all([
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src-tauri/capabilities/default.json', root), 'utf8'),
  ]);
  const capability = JSON.parse(capabilityText);
  assert.match(api, /ALLOWED_EXTERNAL_URLS\.includes\(url\)/);
  assert.match(api, /openUrl\(url\)/);
  const opener = capability.permissions.find(permission => permission?.identifier === 'opener:allow-open-url');
  assert.ok(opener);
  assert.ok(opener.allow.every(entry => entry.url.startsWith('https://github.com/CharlieCardenasToledo')));
});

test('el crédito opcional de Jintia no sustituye la autoría académica', async () => {
  const [settings, onboarding, lib, course] = await Promise.all([
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
  ]);
  assert.match(settings, /id="cfg-include-jintia-credit"/);
  assert.match(settings, /Nunca sustituye ni modifica la autoría académica/);
  assert.match(onboarding, /includeJintiaCredit:\s*state\.config\?\.includeJintiaCredit !== false/);
  assert.match(lib, /include_jintia_credit:\s*Option<bool>/);
  assert.match(course, /if include_jintia_credit/);
  assert.match(course, /Producido con Jintia/);
  assert.match(course, /Autor académico no configurado/);
  assert.doesNotMatch(course, /author = if institution\.author\.is_empty\(\) \{ "Jintia Desktop"/);
});
