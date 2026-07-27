# Instructional Designer Manager

La aplicación de escritorio es el instalador y centro de configuración del
`instructional-designer-skill`. Su propósito es que un docente pueda pasar de
un equipo sin configurar a un entorno listo para crear cursos, sílabos y guías
instruccionales sin editar manualmente archivos de configuración.

El flujo completo es: instalar → completar onboarding → configurar institución
y NotebookLM → crear el curso → usar la skill desde Claude Code para producir
el material pedagógico.

App de escritorio (Tauri) para configurar e instalar el Instructional Designer Skill sin necesidad de conocimientos técnicos.

## Qué hace

- **Verifica dependencias** y ofrece instalación confirmada vía `winget`: Node.js, Python y el compilador LaTeX (MiKTeX en Windows) son las herramientas necesarias; Git es opcional
- **Onboarding secuencial bloqueado**: institución, plantilla, autenticación NotebookLM y destino deben estar completos antes del panel
- **Configura datos institucionales** (nombre, color RGB, facultad) y genera la configuración LaTeX lista para copiar
- **Gestiona cursos**: crea la estructura de carpetas correcta con un clic
- **Genera sílabos** en formato `README.md` compatibles con el skill, con formulario visual por semana
- **Configura NotebookLM MCP 2.0** con el comando oficial `npx gemini-notebook-mcp@latest`, preservando configuraciones MCP existentes

## Stack

| Capa | Tecnología |
|---|---|
| Shell de la app | **Tauri 2** (Rust) |
| Frontend | HTML + CSS + JS vanilla (sin framework) |
| Empaquetado | `tauri build` → `.exe` y `.msi` para Windows |
| Instalación de deps | `winget` (Windows Package Manager, incluido en Win 10/11) |

## Instalador generado

```
dist/
├── instructional-designer-manager_0.1.0_x64-setup.exe   ← instalador NSIS
└── instructional-designer-manager_0.1.0_x64_en-US.msi   ← instalador MSI
```

Tamaño estimado del instalador: **~8 MB** (usa WebView2 del sistema, no incluye Chromium).

## Desarrollo local

### Requisitos previos

- [Rust](https://rustup.rs/) (stable)
- Node.js ≥ 18
- WebView2 Runtime (ya incluido en Windows 10/11 actualizado)

```bash
# Instalar Tauri CLI
npm install

# Modo desarrollo (recarga en caliente)
npm run tauri:dev

# Build para producción (genera .exe y .msi)
npm run tauri:build
```

## Estructura

```text
app/desktop/
├── index.html              ← Punto de entrada HTML
├── vite.config.js          ← Configuración de Vite
├── package.json
├── src/
│   ├── main.js             ← Toda la lógica del frontend (SPA vanilla)
│   └── styles.css          ← Estilos (dark theme)
└── src-tauri/
    ├── Cargo.toml          ← Dependencias Rust
    ├── tauri.conf.json     ← Configuración de la ventana y bundle
    └── src/
        ├── main.rs         ← Entry point Rust
        └── lib.rs          ← Comandos Tauri (check_deps, install_dep, etc.)
```

## Comandos Tauri expuestos al frontend

| Comando | Descripción |
|---|---|
| `check_dependencies()` | Devuelve estado de Node.js, Git, Python y el compilador LaTeX |
| `install_dependency(name)` | Instala una dependencia via winget |
| `get_skill_path()` | Devuelve ruta de instalación del skill |
| `create_course_structure(...)` | Crea carpetas del curso en la ruta elegida |
| `generate_syllabus(...)` | Genera README.md del curso a partir de los datos del formulario |
