/** Shared Tailwind v4 class recipes for the application UI. */
export const ui = {
  layout: {
    appMain: "relative flex min-w-0 flex-1 flex-col overflow-hidden",
    page: "min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4 xl:p-5",
    stack: "flex min-h-full min-w-0 flex-col gap-4",
    twoCol: "grid min-h-full min-w-0 grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_300px]",
  },
  surface: {
    page: "min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-app-bg p-3 sm:p-4 xl:p-5",
    card: "rounded-xl border border-slate-200 bg-white shadow-sm",
    cardGlass: "relative isolate overflow-hidden rounded-xl border border-white/20 backdrop-blur-xl backdrop-saturate-125 bg-white/40 shadow-sm will-change-[backdrop-filter]",
    panel: "rounded-xl border border-slate-200 bg-white",
    tableWrap: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
    mutedPanel: "rounded-xl border border-slate-200 bg-slate-50",
    pane: "rounded-xl border border-slate-200 bg-white",
    input: "rounded-md border border-slate-300 bg-white text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15",
  },
  liquid: {
    control: "liquid-control relative isolate overflow-hidden rounded-full border text-slate-900 backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    controlDark: "liquid-control liquid-control-dark relative isolate overflow-hidden rounded-full border text-white backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2",
    group: "liquid-control relative isolate overflow-hidden rounded-full border p-1 backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter]",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  },
  button: {
    base: "relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    primary: "border-transparent bg-brand-600 text-white shadow-sm hover:bg-brand-700",
    secondary: "border-slate-300 bg-white text-brand-950 hover:bg-slate-50",
    ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 hover:text-brand-950",
    danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    sm: "px-2.5 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  },
  nav: {
    // bg-transparent es obligatorio: el proyecto desactiva Tailwind Preflight
    // a propósito, así que sin esto un <button> sin fondo explícito hereda
    // el "buttonface" gris nativo del navegador en vez de dejar ver el navy
    // del sidebar detrás (mismo bug que el botón del footer, ver commit previo).
    item: "relative flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left text-[13px] font-medium text-slate-300 transition hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
    // "!" fuerza la victoria sobre item's border-transparent: ambas son
    // utilidades border-color de igual especificidad, así que sin esto
    // gana la que Tailwind emita después en el CSS compilado (no
    // necesariamente esta), dejando el borde activo invisible en runtime.
    active: "!border-brand-600/20 bg-brand-600/10 font-semibold text-white",
  },
  settingsNav: {
    item: "relative isolate flex w-auto shrink-0 items-center gap-2.5 overflow-hidden rounded-full border border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-slate-700 no-underline transition hover:bg-slate-900/[0.045] hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 lg:w-full",
    active: "liquid-control liquid-control-brand-soft border font-bold text-teal-800 backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter]",
  },
  windowControl: {
    base: "relative isolate inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-transparent bg-white/10 text-slate-700 transition hover:border-white/55 hover:bg-white/55 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
    close: "hover:border-red-300/70 hover:bg-red-500/85 hover:text-white",
  },
  table: {
    base: "w-full table-fixed border-collapse text-[13px]",
    headRow: "border-b border-slate-300/50 bg-slate-100/70",
    th: "px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-app-muted",
    td: "border-b border-slate-200/70 px-3.5 py-3 align-middle",
    row: "group transition-colors hover:bg-brand/[0.025]",
  },
  status: {
    pill: "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
    active: "border-green-700/25 bg-green-700/[0.08] text-green-700",
    draft: "border-brand/20 bg-brand/[0.06] text-teal-700",
  },
  badge: {
    base: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
    success: "inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-600",
    error: "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500",
    muted: "inline-flex items-center gap-1 rounded-full border border-slate-300/50 bg-slate-200/20 px-2 py-0.5 text-[11px] font-bold text-app-muted",
  },
  list: {
    item: "flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2",
    left: "flex items-center gap-3",
    label: "text-[13px] font-semibold text-app-text",
    sub: "mt-px text-[11px] text-app-muted",
    right: "flex items-center gap-1.5",
  },
  form: {
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2",
    group: "flex flex-col gap-1.5",
  },
  modal: {
    overlay: "fixed inset-0 z-[5000] hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6",
    panel: "max-h-[calc(100vh-32px)] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]",
  },
};

export const cx = (...classes) => classes.filter(Boolean).join(" ");

/**
 * Project color reference mapping for maintenance and theming.
 * These colors are defined as CSS custom properties in styles.css and can be
 * updated there to change all project colors globally (supporting future dark mode or theme changes).
 * Hex values are stored in course.project_color for persistence; CSS vars are for rendering.
 *
 * Usage:
 *  - In JS: Reference the hex value directly: projectColor(course) returns course.project_color
 *  - In CSS: Use var(--project-color-jintia), var(--project-color-blue), etc. to support theming
 *  - To add dark mode: Update CSS custom properties in styles.css only
 */
export const projectColorMap = {
  "jintia":  { hex: "#0f766e", cssVar: "--project-color-jintia", label: "Verde Jintia" },
  "blue":    { hex: "#2563eb", cssVar: "--project-color-blue", label: "Azul" },
  "purple":  { hex: "#7c3aed", cssVar: "--project-color-purple", label: "Violeta" },
  "orange":  { hex: "#c2410c", cssVar: "--project-color-orange", label: "Naranja" },
  "rose":    { hex: "#be123c", cssVar: "--project-color-rose", label: "Rosa" },
  "slate":   { hex: "#475569", cssVar: "--project-color-slate", label: "Grafito" },
};

/** Selects the readable Liquid Glass tone for a control over a known color. */
export function liquidForBackground(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color || "");
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color || "");
  const channels = hex
    ? [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)].map(value => Number.parseInt(value, 16))
    : rgb?.slice(1, 4).map(Number);
  if (!channels) return ui.liquid.control;
  const [r, g, b] = channels.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.34
    ? ui.liquid.controlDark
    : ui.liquid.control;
}
