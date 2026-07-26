/** Shared Tailwind v4 class recipes for the application UI. */
export const ui = {
  button: {
    base: "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
    primary: "border-brand bg-brand text-white hover:bg-brand-hover",
    secondary: "border-slate-200 bg-white/70 text-slate-700 hover:bg-white",
    ghost: "border-transparent bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800",
    danger: "border-red-200 bg-red-50 text-red-500 hover:bg-red-100",
    sm: "px-2.5 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  },
  glass: {
    card: "rounded-app-lg border border-slate-900/10 bg-white/65 shadow-glass backdrop-blur-xl",
    pane: "rounded-app border border-slate-900/10 bg-white/55 backdrop-blur-xl",
    input: "rounded-md border border-slate-300/70 bg-white/60 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15",
  },
  form: {
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2",
    group: "flex flex-col gap-1.5",
  },
};

export const cx = (...classes) => classes.filter(Boolean).join(" ");
