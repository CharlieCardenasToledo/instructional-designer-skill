/** Shared Tailwind v4 class recipes for the application UI. */
export const ui = {
  button: {
    base: "liquid-control relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    primary: "border-brand bg-brand text-white hover:bg-brand-hover",
    secondary: "border-white/45 bg-white/55 text-slate-700 hover:bg-white/75",
    ghost: "border-white/35 bg-white/30 text-slate-600 hover:bg-white/65 hover:text-slate-900",
    danger: "border-red-200/70 bg-red-50/70 text-red-600 hover:bg-red-100/90",
    sm: "px-2.5 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  },
  surface: {
    card: "rounded-app-lg border border-slate-200 bg-surface-raised shadow-sm",
    pane: "rounded-app border border-slate-200 bg-surface-raised",
    input: "rounded-md border border-slate-300 bg-white text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15",
  },
  liquid: {
    control: "liquid-control relative isolate overflow-hidden rounded-full border border-white/45 bg-white/55 text-slate-900 shadow-control backdrop-blur-2xl backdrop-saturate-150",
    controlDark: "liquid-control liquid-control-dark relative isolate overflow-hidden rounded-full border border-white/25 bg-slate-950/35 text-white shadow-control-dark backdrop-blur-2xl backdrop-saturate-150",
    group: "liquid-control relative isolate overflow-hidden rounded-full border border-white/45 bg-white/50 p-1 shadow-control backdrop-blur-2xl backdrop-saturate-150",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white",
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
