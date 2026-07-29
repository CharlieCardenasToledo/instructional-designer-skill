import { ic } from "../icons.js";

const STATUS = { pending: ["Pendiente", "pending"], active: ["En proceso", "active"], complete: ["Correcto", "complete"], warning: ["Advertencia", "warning"], error: ["Error", "error"] };
export function StatusNode({ status = "pending", label = "" } = {}) {
  const [fallback, klass] = STATUS[status] || STATUS.pending;
  const styles = { pending: "border-2 border-slate-300 bg-white", active: "border-2 border-brand-600 bg-brand-600 shadow-[0_0_0_4px_rgba(15,163,163,.14)]", complete: "border-2 border-path-500 bg-path-500 text-white", warning: "border-2 border-amber-600 bg-amber-50", error: "border-2 border-red-600 bg-red-50" };
  return `<span class="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ${styles[klass] || styles.pending}" role="img" aria-label="${label || fallback}">${status === "complete" ? ic("check", 12) : ""}</span>`;
}
