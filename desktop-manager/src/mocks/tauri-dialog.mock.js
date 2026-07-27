/** Mock de "@tauri-apps/plugin-dialog" — solo para el modo "mock" de Vite (ver vite.config.js). */
export async function open(options = {}) {
  const label = options.title || (options.directory ? "una carpeta" : "un archivo");
  return window.prompt(`[mock] Selecciona ${label} (escribe una ruta de ejemplo):`, "/mock/ruta/elegida");
}

export async function confirm(message) {
  return window.confirm(message);
}
