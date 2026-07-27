# Instructional Designer Manager

Aplicación Tauri que instala, configura y exporta
`instructional-designer-skill`. La descripción del producto y las descargas
están en el [README principal](../../README.md).

## Responsabilidades

- ejecutar el onboarding y comprobar requisitos;
- guardar la identidad institucional;
- configurar NotebookLM MCP sin reemplazar otros servidores;
- instalar la skill para Claude Code;
- exportar un ZIP compatible con Claude Skills;
- registrar cursos y crear su estructura de carpetas;
- estructurar el sílabo canónico;
- generar una previsualización rápida en PDF;
- activar la plantilla LaTeX embebida.

La app no redacta por sí sola las guías semanales completas. Ese trabajo lo
realiza la skill desde Claude.

## Arquitectura

```text
src/                         Interfaz Vite y Tailwind CSS 4
├── api.js                   Único adaptador de comandos Tauri
├── onboarding.js            Flujo inicial
├── pages/                   Pantallas del panel
├── mocks/                   Backend web para desarrollo visual
└── state.js                 Estado de interfaz y cursos en localStorage

src-tauri/src/               Backend Rust
├── config.rs                Institución, plantillas y configuración MCP
├── course.rs                Requisitos, cursos, sílabo y PDF
├── mcp.rs                   Proceso y autenticación de NotebookLM
├── onboarding.rs            Estado persistente del onboarding
├── palette.rs               Extracción de color desde sitios web
├── paths.rs                 Rutas y escritura atómica
└── payload.rs               Instalación y exportación de la skill
```

La interfaz usa JavaScript modular. React está disponible para componentes
puntuales, pero las páginas actuales no dependen de un router React.

## Requisitos de desarrollo

- Node.js `^20.19.0` o `>=22.12.0`;
- Rust estable;
- requisitos de sistema de Tauri 2;
- Python y LaTeX para probar el flujo completo.

## Comandos

```bash
npm ci
npm run dev          # frontend conectado a Tauri
npm run dev:web      # frontend con backend mock
npm test             # contratos estáticos
npm run build        # bundle web
npm run tauri:dev    # aplicación de escritorio
npm run tauri:build  # instaladores de la plataforma actual
```

Los bundles se escriben en:

```text
src-tauri/target/release/bundle/
```

- Windows: NSIS `.exe` y MSI.
- macOS: `.dmg`.

## Superficie de comandos

`src/api.js` es la única capa del frontend autorizada para invocar Tauri.

| Área | Comandos |
|---|---|
| Requisitos | `check_dependencies`, `install_dependency` |
| Onboarding | `get_onboarding_status`, `advance_onboarding`, `go_to_onboarding_step`, `complete_onboarding`, `reset_onboarding` |
| Skill | `get_skill_path`, `install_skill`, `export_skill_zip` |
| Configuración | `configure_mcp`, `get_setup_status`, `apply_institution_config`, `extract_site_palette` |
| NotebookLM | `check_notebooklm_auth`, `run_notebooklm_auth`, `save_notebooks_config` |
| Cursos | `create_course_structure`, `generate_syllabus`, `compile_syllabus_pdf` |
| Plantillas | `list_templates`, `get_active_template`, `set_active_template` |

## Persistencia y datos

- Los cursos visibles en el panel se guardan en `localStorage`.
- La configuración de onboarding, institución, notebooks y exportaciones se
  guarda en el directorio de configuración de la app.
- La instalación local conserva configuraciones reales al actualizar la skill.
- La exportación ZIP puede incluir `institution.json` y `notebooks.json`.

No uses datos reales en tests, mocks ni fixtures versionados.

## Dependencias del usuario

Node.js, Python y un compilador LaTeX son obligatorios para el flujo completo;
Git es opcional.

- Windows: la app puede solicitar una instalación con `winget`.
- macOS: muestra comandos de Homebrew para completar la instalación.
- Linux: muestra comandos orientativos para el gestor de paquetes.

El validador completo de la skill usa WSL en Windows. La previsualización
rápida de la app usa el compilador LaTeX nativo detectado.

## Plantillas

La versión actual embebe únicamente `elegantbook-clasico`. Para agregar otra:

1. crear `skill/templates/<id>/`;
2. incluir `meta.json`, `template.md`, `preamble.tex` y `skeleton.tex`;
3. agregar el id a `EMBEDDED_TEMPLATE_IDS`;
4. actualizar el enum de `activeTemplate` en el esquema;
5. añadir pruebas del contrato.

## Modo mock y revisión visual

```bash
npm run dev:web
```

Este modo reemplaza Tauri por los módulos de `src/mocks/`. Sirve para revisar
la interfaz y producir capturas sin modificar la configuración real. No valida
comandos Rust, acceso al sistema de archivos ni instaladores.

## Releases

Los workflows se encuentran en `.github/workflows/`:

- `release-windows.yml`;
- `release-macos.yml`.

Ambos ejecutan `npm ci`, tests y `tauri:build`. Los tags `v*` publican assets
en GitHub Releases; `workflow_dispatch` conserva solamente artifacts de la
ejecución. El workflow Windows contiene una integración condicional con
SignPath. Permanece desactivada hasta que la fundación apruebe el proyecto y
se configuren las variables y el secreto correspondientes.

Consulta [docs/releasing.md](../../docs/releasing.md) antes de publicar.

## Seguridad

La aplicación no incorpora telemetría. NotebookLM, la extracción de paleta
desde una URL y la instalación de dependencias utilizan red. La política de
reporte está en [SECURITY.md](../../SECURITY.md).
