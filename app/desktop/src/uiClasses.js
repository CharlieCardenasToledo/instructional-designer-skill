/** Shared Tailwind v4 class recipes for the application UI. */
export const ui = {
  layout: {
    appMain: "flex min-w-0 flex-1 flex-col overflow-hidden",
    page: "min-h-0 flex-1 overflow-y-auto p-5",
    stack: "flex h-full flex-col gap-4",
    twoCol: "grid h-full grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_300px]",
  },
  surface: {
    page: "min-h-0 flex-1 overflow-y-auto bg-app-bg p-5",
    card: "rounded-xl border border-slate-200 bg-white shadow-sm",
    panel: "rounded-xl border border-slate-200 bg-white",
    tableWrap: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
    mutedPanel: "rounded-xl border border-slate-200 bg-slate-50",
    pane: "rounded-xl border border-slate-200 bg-white",
    input: "rounded-md border border-slate-300 bg-white text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15",
  },
  liquid: {
    control: "liquid-control relative isolate overflow-hidden rounded-full border border-white/45 bg-white/55 text-slate-900 shadow-control backdrop-blur-2xl backdrop-saturate-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    controlDark: "liquid-control liquid-control-dark relative isolate overflow-hidden rounded-full border border-white/25 bg-slate-950/35 text-white shadow-control-dark backdrop-blur-2xl backdrop-saturate-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2",
    group: "liquid-control relative isolate overflow-hidden rounded-full border border-white/45 bg-white/50 p-1 shadow-control backdrop-blur-2xl backdrop-saturate-150",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  },
  button: {
    base: "relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    primary: "liquid-control border-brand/45 bg-brand/80 text-white shadow-control backdrop-blur-2xl backdrop-saturate-150 hover:bg-brand-hover/85",
    secondary: "liquid-control border-white/45 bg-white/55 text-slate-800 shadow-control backdrop-blur-2xl backdrop-saturate-150 hover:bg-white/75",
    ghost: "liquid-control border-white/35 bg-white/30 text-slate-700 shadow-control backdrop-blur-2xl backdrop-saturate-150 hover:bg-white/65 hover:text-slate-950",
    danger: "liquid-control border-red-200/70 bg-red-50/75 text-red-600 shadow-control backdrop-blur-2xl backdrop-saturate-150 hover:bg-red-100/90",
    sm: "px-2.5 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  },
  nav: {
    item: "liquid-control relative isolate flex w-full items-center gap-2.5 overflow-hidden rounded-full border border-white/35 bg-white/35 px-3 py-2 text-left text-[13px] font-medium text-slate-600 shadow-control backdrop-blur-2xl backdrop-saturate-150 transition hover:bg-white/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    active: "border-brand/35 bg-brand/15 text-teal-800",
  },
  settingsNav: {
    item: "w-auto shrink-0 rounded-full px-3 py-2 text-xs text-slate-600 transition hover:bg-white/65 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:w-full",
    active: "bg-white/80 font-bold text-teal-700 shadow-sm",
  },
  windowControl: {
    base: "liquid-control relative isolate inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-white/35 text-slate-600 shadow-control backdrop-blur-2xl backdrop-saturate-150 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    close: "hover:border-red-400/50 hover:bg-red-600/80 hover:text-white",
  },
  table: {
    base: "min-w-[760px] w-full border-collapse text-[13px]",
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
    overlay: "fixed inset-0 z-[5000] hidden items-center justify-center bg-slate-900/45 p-6",
    panel: "max-h-[calc(100vh-48px)] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl",
  },
};

export const cx = (...classes) => classes.filter(Boolean).join(" ");

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
