import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const mockPath = (name) => fileURLToPath(new URL(`./src/mocks/${name}`, import.meta.url));

// Modo "mock" (`vite --mode mock`, ver package.json → "dev:web"): reemplaza
// los módulos de Tauri por implementaciones en memoria (src/mocks/) para
// poder correr y probar la interfaz en un navegador normal, sin backend
// Rust. Solo aplica a este modo — `vite`/`vite build`/`tauri dev`/`tauri
// build` no lo activan y siguen usando Tauri real tal cual.
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss()],
  clearScreen: false,
  resolve: mode === "mock" ? {
    alias: {
      "@tauri-apps/api/core": mockPath("tauri-core.mock.js"),
      "@tauri-apps/api/window": mockPath("tauri-window.mock.js"),
      "@tauri-apps/api/path": mockPath("tauri-path.mock.js"),
      "@tauri-apps/plugin-dialog": mockPath("tauri-dialog.mock.js"),
    },
  } : undefined,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
