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
  assert.match(payload, /SKILL_VERSION/);
  assert.match(payload, /jintia-skill-\{SKILL_VERSION\}\.zip/);
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
  assert.match(source, /Preparando la prueba/);
  assert.match(source, /Preparar[\s\S]*Comprobar[\s\S]*Crear[\s\S]*Compilar[\s\S]*Validar/);
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

test('los destinos distinguen Claude del plugin universal de ChatGPT y Codex', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('function connectStep');
  const end = source.indexOf('function finalStep', start);
  const connect = source.slice(start, end);
  assert.match(connect, /id: "claude-code",\s*title: "Usar con Claude"/);
  assert.match(connect, /id: "openai",\s*title: "Usar con ChatGPT y Codex"/);
  assert.match(connect, /id: "claude-cowork",\s*title: "Usar solo en la app de Claude"/);
  assert.match(connect, /id: "both",\s*title: "Usar en todos"/);
});

test('Entorno detecta motores visuales opcionales sin instalarlos silenciosamente', async () => {
  const [course, models, setup, settings] = await Promise.all([
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/models.rs', root), 'utf8'),
    readFile(new URL('src/pages/setup.js', root), 'utf8'),
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
  ]);
  for (const tool of ['Graphviz', 'Mermaid CLI', 'PlantUML', 'D2', 'Vega-Lite CLI', 'WaveDrom', 'Inkscape', 'Google Chrome']) {
    assert.match(course, new RegExp(`"${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
  assert.match(models, /pub installable: bool/);
  assert.match(course, /installable: false/);
  assert.match(setup, /dep\.installable !== false/);
  assert.match(settings, /dep\.installable !== false/);
  assert.doesNotMatch(course, /"Graphviz"\s*=>|"Mermaid CLI"\s*=>|"PlantUML"\s*=>/);
});

test('Entorno ofrece perfiles visuales versionados sin instalación automática', async () => {
  const [api, settings, lib, profilesText] = await Promise.all([
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src/pages/settings.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
    readFile(new URL('../../skill/config/visual-install-profiles.json', root), 'utf8'),
  ]);
  const profiles = JSON.parse(profilesText);
  assert.deepEqual(profiles.profiles.map(profile => profile.id), ['minimum', 'core', 'full']);
  assert.ok(profiles.profiles.every(profile => profile.tools.every(tool => tool.version)));
  assert.match(api, /getVisualInstallProfiles/);
  assert.match(lib, /get_visual_install_profiles/);
  assert.match(settings, /jintia\.visualProfile/);
  assert.match(settings, /Capacidades deshabilitadas/);
});

test('cambiar el destino mantiene sincronizada la selección visible del onboarding', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const start = source.indexOf('input[name=onboarding-target]');
  const end = source.indexOf('root.querySelectorAll("[data-onboarding-action]"', start);
  const handler = source.slice(start, end);
  assert.match(handler, /const selectedTarget = event\.currentTarget\.value/);
  assert.match(handler, /runtime\.status = \{[\s\S]*selectedTarget/);
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
  assert.match(about, /about-origin/);
  assert.match(about, /Aarma jintia/);
  assert.match(about, /originDisclaimer/);
  assert.match(about, /Tauri[\s\S]*Rust[\s\S]*React[\s\S]*ElegantBook/);
  assert.match(api, /Promise\.all\(\[[\s\S]*getName\(\)[\s\S]*getVersion\(\)/);
  assert.match(appMeta, /creator:\s*"Charlie Cárdenas Toledo"/);
  assert.match(appMeta, /originName: brand\.linguisticForm/);
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
  assert.ok(opener.allow.every(entry =>
    entry.url.startsWith('https://github.com/CharlieCardenasToledo') ||
    entry.url === 'claude://*' ||
    entry.url === 'codex://*' ||
    entry.url === 'https://notebook.google.com/'
  ));
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

test('Configuración muestra una sola sección y conserva navegación accesible', async () => {
  const settings = await readFile(new URL('src/pages/settings.js', root), 'utf8');
  assert.match(settings, /let _settingsSection = "inst-profile"/);
  assert.match(settings, /data-settings-panel/);
  assert.match(settings, /sectionHidden\("inst-profile"\)/);
  assert.match(settings, /panel\.classList\.toggle\("hidden"/);
  assert.match(settings, /aria-current/);
});

test('Configuración muestra Notebooks como panel de solo lectura derivado de Cursos', async () => {
  const settings = await readFile(new URL('src/pages/settings.js', root), 'utf8');
  const courses = await readFile(new URL('src/pages/courses.js', root), 'utf8');
  assert.match(settings, /function renderNotebookList/);
  assert.match(settings, /state\.courses/);
  assert.match(settings, /btn-go-to-courses/);
  assert.doesNotMatch(settings, /nb-code|nb-course-name|nb-root|btn-add-notebook|async function addNotebook|async function syncNotebooks/);
  assert.doesNotMatch(settings, /getNotebooks|saveNotebooks\(/);
  assert.match(courses, /function syncNotebooksFromCourses/);
  assert.match(courses, /await saveNotebooksConfig\(entries\)/);
  assert.match(courses, /listNotebooksMcp/);
});

test('Configuración protege operaciones asíncronas y el reinicio no promete borrar datos', async () => {
  const settings = await readFile(new URL('src/pages/settings.js', root), 'utf8');
  assert.match(settings, /async function runSettingsOperation/);
  assert.match(settings, /aria-busy/);
  assert.match(settings, /No se eliminarán tu perfil, asignaturas, notebooks ni archivos/);
  assert.match(settings, /const r = await resetOnboarding\(\)/);
  assert.match(settings, /if \(!r\.success\)/);
  assert.match(settings, /window\.location\.reload\(\)/);
});

test('Configuración ejecuta el diagnóstico de la toolchain mediante un comando Tauri seguro', async () => {
  const settings = await readFile(new URL('src/pages/settings.js', root), 'utf8');
  const api = await readFile(new URL('src/api.js', root), 'utf8');
  const rust = await readFile(new URL('src-tauri/src/lib.rs', root), 'utf8');
  const toolchain = await readFile(new URL('src-tauri/src/toolchain.rs', root), 'utf8');
  assert.match(settings, /btn-run-toolchain-doctor/);
  assert.match(settings, /runSkillTool\("doctor"\)/);
  assert.match(settings, /btn-run-toolchain-operation/);
  assert.match(settings, /runSkillTool\(operation, target, strict\)/);
  assert.match(api, /invoke\("run_skill_tool"/);
  assert.match(rust, /run_skill_tool/);
  assert.match(toolchain, /\["doctor", "audit", "validate", "compile"\]/);
});

test('Plantillas separa selección, vista previa y activación confirmada', async () => {
  const templates = await readFile(new URL('src/pages/templates.js', root), 'utf8');
  assert.match(templates, /compileSyllabusPdf/);
  assert.match(templates, /previewTemplateId:\s*templateId/);
  assert.match(templates, /convertFileSrc/);
  assert.match(templates, /<iframe/);
  assert.match(templates, /data-select-template/);
  assert.match(templates, /Usar esta plantilla/);
  assert.match(templates, /Plantilla activa/);
  assert.match(templates, /aria-pressed/);
  assert.match(templates, /aria-busy/);
  assert.doesNotMatch(templates, /Activa \/ Editar/);
  assert.doesNotMatch(templates, /renderTemplatePreview/);
});

test('el backend compila la vista previa sin cambiar la plantilla activa', async () => {
  const [lib, course, config] = await Promise.all([
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/config.rs', root), 'utf8'),
  ]);
  assert.match(lib, /preview_template_id:\s*Option<String>/);
  assert.match(course, /preview_template_id[\s\S]*unwrap_or_else\(crate::config::get_active_template\)/);
  assert.match(course, /copy_template_assets\(&active_template/);
  assert.match(course, /template_assets_fingerprint\(&active_template\)/);
  assert.match(config, /pub fn copy_template_assets/);
  assert.match(config, /pub fn template_assets_fingerprint/);
});

test('la salida de pdflatex tolera la codificación local de Windows', async () => {
  const course = await readFile(new URL('src-tauri/src/course.rs', root), 'utf8');
  assert.match(course, /read_until\(b'\\n'/);
  assert.match(course, /String::from_utf8_lossy\(&line_bytes\)/);
  assert.match(course, /String::from_utf8_lossy\(&stderr_bytes\)/);
  assert.doesNotMatch(course, /BufReader::new\(stdout\)\.lines\(\)/);
});

test('Plantillas muestra el catálogo completo sin cortar resultados', async () => {
  const templates = await readFile(new URL('src/pages/templates.js', root), 'utf8');
  assert.match(templates, /templates\.map\(templateCard\)/);
  assert.doesNotMatch(templates, /gridItems|templates\.filter\([^;]+slice\(0/);
  assert.match(templates, /btn-retry-templates/);
  assert.match(templates, /No hay plantillas en esta categoría/);
});

test('onboarding y Plantillas comparten una guía semanal de demostración realista', async () => {
  const onboarding = await readFile(new URL('src/onboarding.js', root), 'utf8');
  const templates = await readFile(new URL('src/pages/templates.js', root), 'utf8');
  const sample = await readFile(new URL('src/sampleGuide.js', root), 'utf8');
  const course = await readFile(new URL('src-tauri/src/course.rs', root), 'utf8');

  assert.match(onboarding, /buildSampleGuideData\(state\.config/);
  assert.match(templates, /buildSampleGuideData\(state\.config/);
  assert.match(sample, /Pensamiento crítico y decisiones profesionales/);
  assert.match(sample, /Facione, P\. A\./);
  assert.doesNotMatch(sample, /Apellido, [A-Z]\./);
  assert.match(course, /append_demo_week/);
  assert.match(course, /\\title\{\{Guía Didáctica Semanal\}\}/);
  assert.match(course, /\\chapter\{Toma de Decisiones Basada en Evidencia\}/);
  assert.match(course, /active_template == "kaohandt-marginal"[\s\S]*\\guidesection\{Toma de Decisiones Basada en Evidencia\}/);
  assert.match(course, /\\guidesection\{Semana 1: De la Intuición a una Decisión Justificable\}/);
  assert.match(course, /Transferencia a cualquier profesión/);
  assert.match(course, /\\begin\{guidefigure\}/);
  assert.match(course, /\\begin\{tikzpicture\}/);
  assert.match(course, /\\guidefigurecaption\{Ruta de una decisión profesional justificable\.\}\{fig:ruta-decision\}/);
  assert.match(course, /\\begin\{guidetable\}/);
  assert.match(course, /\\begin\{tabularx\}/);
  assert.match(course, /\\begin\{equation\}/);
  assert.match(course, /\\marginconcept\{Criterio\}/);
  assert.match(course, /Autoevaluación/);
  assert.match(await readFile(new URL('../../skill/templates/kaohandt-marginal/preamble.tex', root), 'utf8'), /\\usepackage\{tikz\}/);
});

test('las notas marginales de Kaohandt no insertan párrafos dentro de marginnote', async () => {
  const preamble = await readFile(new URL('../../skill/templates/kaohandt-marginal/preamble.tex', root), 'utf8');
  assert.match(preamble, /\\newcommand\{\\marginconcept\}\[2\]\{\\marginnote\{[^\n]+\}\}/);
  assert.doesNotMatch(preamble, /\\marginnote\{[^\n]*\\par/);
  assert.doesNotMatch(preamble, /\\marginnote\{[^\n]*\\\\/);
  assert.match(preamble, /\\newenvironment\{guidetable\}/);
  assert.match(preamble, /\\newenvironment\{guidefigure\}/);
  assert.doesNotMatch(preamble, /\\newenvironment\{guidetable\}[^\n]*\\begin\{table\}/);
});

test('la skill exige wrappers portables para figuras y tablas en ambas plantillas', async () => {
  const [skill, figures, latexReference, elegantMeta, kaoMeta, linter] = await Promise.all([
    readFile(new URL("skill/SKILL.md", repositoryRoot), "utf8"),
    readFile(new URL("skill/references/figuras-tikz.md", repositoryRoot), "utf8"),
    readFile(new URL("skill/references/plantilla-latex.md", repositoryRoot), "utf8"),
    readFile(new URL("skill/templates/elegantbook-clasico/meta.json", repositoryRoot), "utf8"),
    readFile(new URL("skill/templates/kaohandt-marginal/meta.json", repositoryRoot), "utf8"),
    readFile(new URL("skill/scripts/latex-linter.js", repositoryRoot), "utf8"),
  ]);
  assert.match(skill, /guidefigurecaption/);
  assert.match(skill, /guidetablecaption/);
  assert.match(figures, /\\begin\{guidefigure\}/);
  assert.doesNotMatch(figures, /\\begin\{figure\}/);
  assert.match(latexReference, /\\begin\{guidetable\}/);
  assert.equal(JSON.parse(elegantMeta).validation.portableFloatContract, true);
  assert.equal(JSON.parse(kaoMeta).validation.portableFloatContract, true);
  assert.match(linter, /validatePortableFloatContract/);
});

test('el validador comparte MiKTeX nativo con Jintia antes de recurrir a WSL', async () => {
  const validator = await readFile(new URL("skill/scripts/latex-validator.js", repositoryRoot), "utf8");
  const nativeBranch = validator.indexOf("commandExists('pdflatex') && commandExists('biber')");
  const wslBranch = validator.indexOf("run('wsl.exe'");
  assert.ok(nativeBranch >= 0);
  assert.ok(wslBranch > nativeBranch);
});

test('Configuración distingue una skill instalada de una skill actualizada', async () => {
  const [payload, models, onboarding, settings] = await Promise.all([
    readFile(new URL("src-tauri/src/payload.rs", root), "utf8"),
    readFile(new URL("src-tauri/src/models.rs", root), "utf8"),
    readFile(new URL("src/onboarding.js", root), "utf8"),
    readFile(new URL("src/pages/settings.js", root), "utf8"),
  ]);
  assert.match(payload, /pub const SKILL_VERSION/);
  assert.match(payload, /pub fn skill_is_current/);
  assert.match(models, /skill_current/);
  assert.match(onboarding, /Paquete listo para importar en Claude/);
  assert.match(settings, /Skill desactualizada/);
});

test('Jintia se empaqueta como plugin universal para ChatGPT y Codex', async () => {
  const [manifestText, mcpText, payload, paths, onboarding, api] = await Promise.all([
    readFile(new URL("openai-plugin/.codex-plugin/plugin.json", repositoryRoot), "utf8"),
    readFile(new URL("openai-plugin/.mcp.json", repositoryRoot), "utf8"),
    readFile(new URL("src-tauri/src/payload.rs", root), "utf8"),
    readFile(new URL("src-tauri/src/paths.rs", root), "utf8"),
    readFile(new URL("src/onboarding.js", root), "utf8"),
    readFile(new URL("src/api.js", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const mcp = JSON.parse(mcpText);
  assert.equal(manifest.name, "jintia");
  assert.equal(manifest.version, "10.8.0");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.equal(mcp.notebooklm.command, "npx");
  assert.match(payload, /materialize_openai_plugin/);
  assert.match(payload, /register_openai_marketplace/);
  assert.match(paths, /\.codex.*plugins.*jintia/s);
  assert.match(onboarding, /id: "openai"/);
  assert.match(api, /installOpenAIPlugin/);
});

test('el paquete OpenAI incluye los contratos agents de la skill', async () => {
  const payload = await readFile(new URL("src-tauri/src/payload.rs", root), "utf8");
  assert.match(payload, /static AGENTS/);
  assert.match(payload, /target\.join\("agents"\)/);
});

test('Ayuda cubre el flujo real del producto y ofrece FAQ local buscable', async () => {
  const docs = await readFile(new URL('src/pages/docs.js', root), 'utf8');
  assert.match(docs, /const FAQS = \[/);
  assert.match(docs, /help-search/);
  assert.match(docs, /filterHelp/);
  assert.match(docs, /Jintia Desktop y jintia-skill/);
  assert.match(docs, /NotebookLM/);
  assert.match(docs, /¿Necesito WSL para compilar\?/);
  assert.match(docs, /no tiene telemetría ni un backend propio/i);
  assert.match(docs, /No se eliminan el perfil, las asignaturas, los notebooks ni los archivos generados/);
});

test('Ayuda navega a la sección visible de Configuración, no a un panel oculto', async () => {
  const docs = await readFile(new URL('src/pages/docs.js', root), 'utf8');
  assert.match(docs, /data-settings-nav/);
  assert.match(docs, /nav\.click\(\)/);
  assert.match(docs, /section:\s*"environment"/);
  assert.match(docs, /"notebooks-section"/);
});

test('la prueba final transmite progreso y permite copiar un diagnóstico', async () => {
  const [onboarding, course, lib] = await Promise.all([
    readFile(new URL('src/onboarding.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);
  assert.match(onboarding, /listen\("jintia:\/\/compile-progress"/);
  assert.match(onboarding, /id="compile-live-log"/);
  assert.match(onboarding, /Copiar diagnóstico/);
  assert.match(onboarding, /Reportar problema/);
  assert.match(course, /emit_compile_progress/);
  assert.match(course, /"package-install"/);
  assert.match(course, /fixtounicode/);
  assert.match(course, /active_template == "kaohandt-marginal"/);
  assert.match(course, /\\documentclass\[10pt,oneside\]\{\{kaohandt\}\}/);
  assert.match(lib, /app:\s*tauri::AppHandle/);
});

test('el editor de silabo protege borradores y usa estados editoriales explicitos', async () => {
  const syllabus = await readFile(new URL('src/pages/syllabus.js', root), 'utf8');
  assert.match(syllabus, /const AUTOSAVE_DELAY = 700/);
  assert.match(syllabus, /persistCurrentWeek\("draft", \{ silent: true \}\)/);
  assert.match(syllabus, /collectWeekFormData\(_activeWeek, "complete"\)/);
  assert.match(syllabus, /week\.status === "complete"/);
  assert.match(syllabus, /_activeWeek = clampWeek\(_activeWeek, count\)/);
  assert.doesNotMatch(syllabus, /course\.weeks = Math\.max/);
});

test('el formulario del silabo exige bibliografia y actividad con validacion accesible', async () => {
  const syllabus = await readFile(new URL('src/pages/syllabus.js', root), 'utf8');
  assert.match(syllabus, /\["bibliography", "Bibliografía \/ Recursos"\]/);
  assert.match(syllabus, /\["graded_activity", "Actividad calificada"\]/);
  assert.match(syllabus, /<label for="\$\{id\}"/);
  assert.match(syllabus, /<fieldset[\s\S]*<legend/);
  assert.match(syllabus, /aria-invalid/);
  assert.match(syllabus, /id="syl-error-summary"/);
  assert.match(syllabus, /min-h-11/);
});

test('Courses muestra progreso real y protege sus operaciones', async () => {
  const [courses, api, main] = await Promise.all([
    readFile(new URL('src/pages/courses.js', root), 'utf8'),
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src/main.js', root), 'utf8'),
  ]);
  assert.match(courses, /week\?\.status === "complete"/);
  assert.match(courses, /role="dialog" aria-modal="true"/);
  assert.match(courses, /event\.key === "Escape"/);
  assert.match(courses, /step="1"/);
  assert.match(courses, /Number\.isInteger\(weeks\)/);
  assert.match(courses, /_folderBusy\.has\(index\)/);
  assert.match(courses, /persistCourseList/);
  assert.match(courses, /ui\.surface\.cardGlass,\s*'relative hidden min-h-0 overflow-visible lg:block'/);
  assert.match(courses, /top-12 z-50 min-w-\[205px\]/);
  assert.match(api, /initializeReadme = true/);
  assert.match(main, /data-create-course/);
  assert.match(main, /jintia:new-course/);
});

test('Courses incorpora el estado persistente de semanas sin reemplazar el progreso local', async () => {
  const courses = await readFile(new URL('src/pages/courses.js', root), 'utf8');
  const api = await readFile(new URL('src/api.js', root), 'utf8');
  const rust = await readFile(new URL('src-tauri/src/course_state.rs', root), 'utf8');
  assert.match(courses, /getCourseState/);
  assert.match(courses, /Desactualizado/);
  assert.match(courses, /_courseStates/);
  assert.match(api, /get_course_state/);
  assert.match(rust, /state\.json/);
});

test('Courses valida skill, conexión y dependencias antes de abrir una IA', async () => {
  const [courses, api] = await Promise.all([
    readFile(new URL('src/pages/courses.js', root), 'utf8'),
    readFile(new URL('src/api.js', root), 'utf8'),
  ]);
  assert.match(courses, /getSetupStatus/);
  assert.match(courses, /checkDependencies/);
  assert.match(courses, /validateAiReadiness/);
  assert.match(courses, /skill_current/);
  assert.match(courses, /mcp_claude_code_configured/);
  assert.match(courses, /openai_plugin_current/);
  assert.match(courses, /codex:\/\/threads\/new/);
  assert.equal(courses.includes("https://chatgpt.com/"), false);
  assert.match(courses, /navigate\("settings"\)/);
  assert.match(api, /export async function getSetupStatus/);
});

test('Desktop comparte la detección de harnesses con la CLI', async () => {
  const api = await readFile(new URL('src/api.js', root), 'utf8');
  const lib = await readFile(new URL('src-tauri/src/lib.rs', root), 'utf8');
  const backend = await readFile(new URL('src-tauri/src/harnesses.rs', root), 'utf8');
  const mock = await readFile(new URL('src/mocks/tauri-core.mock.js', root), 'utf8');
  const settings = await readFile(new URL('src/pages/settings.js', root), 'utf8');
  assert.match(api, /detect_harnesses/);
  assert.match(api, /manage_harnesses/);
  assert.match(lib, /detect_harnesses/);
  assert.match(lib, /manage_harnesses/);
  assert.match(backend, /supports_hooks/);
  assert.match(mock, /detect_harnesses/);
  assert.match(mock, /manage_harnesses/);
  assert.match(settings, /btn-detect-harnesses/);
  assert.match(settings, /detectAgentHarnesses/);
  assert.match(settings, /data-harness-operation/);
});

test('la skill expone contratos de delegación especializados sin duplicar el router', async () => {
  const skill = await readFile(new URL('../../skill/SKILL.md', root), 'utf8');
  const agents = await Promise.all([
    readFile(new URL('../../skill/agents/jintia-researcher.md', root), 'utf8'),
    readFile(new URL('../../skill/agents/jintia-instructional-reviewer.md', root), 'utf8'),
    readFile(new URL('../../skill/agents/jintia-visual-producer.md', root), 'utf8'),
    readFile(new URL('../../skill/agents/jintia-finish-reviewer.md', root), 'utf8'),
  ]);
  assert.match(skill, /Delegación opcional/);
  assert.match(skill, /agents\/jintia-researcher\.md/);
  for (const agent of agents) {
    assert.match(agent, /## Misión/);
    assert.match(agent, /## Entrada/);
    assert.match(agent, /## Salida/);
    assert.match(agent, /## Límites/);
  }
});

test('las asignaturas usan Documentos por defecto y permiten cambiar la ubicación', async () => {
  const [courses, api, lib] = await Promise.all([
    readFile(new URL('src/pages/courses.js', root), 'utf8'),
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);
  assert.match(lib, /app\.path\(\)\.document_dir\(\)/);
  assert.match(lib, /path\.join\("Jintia"\)/);
  assert.match(api, /invoke\("get_default_course_root"\)/);
  assert.match(api, /dialogOpen\(\{ directory: true, title, defaultPath \}\)/);
  assert.match(courses, /id="m-change-root"/);
  assert.match(courses, /project_root: rootPath/);
  assert.match(courses, /Documentos\/Jintia\/codigo_nombre/);
  assert.match(courses, /El proyecto se preparará automáticamente/);
  assert.match(courses, /project_status: "preparing"/);
  assert.doesNotMatch(courses, /m-prepare-now|prepareNow|Registrar asignatura/);
  assert.match(await readFile(new URL('src-tauri/src/course.rs', root), 'utf8'), /course_folder_name/);
});

test('el sílabo reutiliza la ruta preparada antes de pedir otra carpeta', async () => {
  const syllabus = await readFile(new URL('src/pages/syllabus.js', root), 'utf8');
  assert.match(syllabus, /course\.project_root \|\| parentDirectory\(course\.project_path\)/);
  assert.match(syllabus, /if \(!coursePath\) \{[\s\S]*pickDirectory/);
  assert.match(syllabus, /course\.project_root = coursePath/);
});

test('la estructura del curso puede crear un README inicial sin sobrescribirlo', async () => {
  const [course, lib] = await Promise.all([
    readFile(new URL('src-tauri/src/course.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);
  assert.match(lib, /initialize_readme:\s*Option<bool>/);
  assert.match(course, /initialize_readme:\s*bool/);
  assert.match(course, /if initialize_readme/);
  assert.match(course, /if !readme\.exists\(\)/);
  assert.match(course, /Proyecto académico preparado con Jintia/);
});

test('la biblioteca muestra solo PDFs pertenecientes a proyectos registrados', async () => {
  const [page, api, main, router, backend, lib] = await Promise.all([
    readFile(new URL('src/pages/pdfs.js', root), 'utf8'),
    readFile(new URL('src/api.js', root), 'utf8'),
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/router.js', root), 'utf8'),
    readFile(new URL('src-tauri/src/pdfs.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);
  assert.match(main, /registerPage\("pdfs",\s+renderPdfs\)/);
  assert.match(main, /data-page="pdfs"/);
  assert.match(main, /id="p-pdfs"/);
  assert.match(router, /pdfs:\s*\{\s*title:\s*"PDFs generados"/);
  assert.match(api, /invoke\("list_generated_pdfs"/);
  assert.match(api, /invoke\("open_generated_pdf"/);
  assert.match(api, /invoke\("reveal_generated_pdf"/);
  assert.match(page, /Biblioteca de PDFs/);
  assert.match(page, /data-pdf-action="open"/);
  assert.match(page, /data-pdf-action="reveal"/);
  assert.match(backend, /eq_ignore_ascii_case\("pdf"\)/);
  assert.match(backend, /file_type\(\)\.is_symlink\(\)/);
  assert.match(backend, /candidate\.starts_with\(root\)/);
  assert.match(lib, /validated_pdf_path/);
});

test('cada proyecto conserva una identidad visual accesible dentro de Jintia', async () => {
  const courses = await readFile(new URL('src/pages/courses.js', root), 'utf8');
  const uiClasses = await readFile(new URL('src/uiClasses.js', root), 'utf8');
  assert.match(courses, /const PROJECT_COLORS = Object\.values\(projectColorMap\)/);
  assert.match(uiClasses, /export const projectColorMap = \{/);
  assert.match(courses, /const PROJECT_ICONS = \[/);
  assert.match(courses, /data-project-color/);
  assert.match(courses, /data-project-icon/);
  assert.match(courses, /aria-pressed/);
  assert.match(courses, /Personalizar en Jintia/);
  assert.match(courses, /No modifica el icono de la carpeta de Windows/);
  assert.match(courses, /project_color: _modalData\.projectColor/);
  assert.match(courses, /project_icon: _modalData\.projectIcon/);
});

test('eliminar una asignatura usa un modal propio de Jintia, no un diálogo nativo del SO', async () => {
  const courses = await readFile(new URL('src/pages/courses.js', root), 'utf8');
  assert.match(courses, /function openDeleteModal/);
  assert.match(courses, /id="course-delete-modal"/);
  assert.match(courses, /role="dialog" aria-modal="true" aria-labelledby="course-delete-title"/);
  assert.match(courses, /function handleDeleteKeydown/);
  assert.match(courses, /function confirmDelete/);
  assert.doesNotMatch(courses, /await confirm\(`¿Eliminar/);
});
