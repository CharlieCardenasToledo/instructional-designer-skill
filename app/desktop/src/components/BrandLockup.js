import { BrandMark } from "./BrandMark.js";

// Sobre el sidebar (bg-brand-950) usamos la variante on-dark: la marca a
// color por defecto tiene el cuerpo de la J en el mismo navy del fondo y
// se vuelve casi invisible salvo por el punto teal y la flecha verde.
export function BrandLockup({ className = "" } = {}) {
  return `<div class="${className} flex items-center gap-2.5 border-b border-white/10 px-4 py-4">${BrandMark({ onDark: true, className: "h-9 w-9 shrink-0", size: 36 })}<div class="min-w-0"><strong class="block truncate text-[15px] font-bold tracking-tight text-white">Jintia</strong><span class="block max-w-[145px] text-[9px] leading-tight text-slate-300">Diseña el camino del aprendizaje</span></div></div>`;
}
