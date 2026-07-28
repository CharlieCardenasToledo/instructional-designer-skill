/** Mock de "@tauri-apps/api/window" — solo para el modo "mock" de Vite (ver vite.config.js). */
export function getCurrentWindow() {
  return {
    minimize: () => console.log("[tauri-mock] minimize()"),
    toggleMaximize: () => console.log("[tauri-mock] toggleMaximize()"),
    close: () => console.log("[tauri-mock] close() — en el navegador no cierra la pestaña"),
  };
}
