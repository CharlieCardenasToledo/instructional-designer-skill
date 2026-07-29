export function SectionCard({ title = "", content = "", className = "" } = {}) {
  return `<section class="rounded-xl border border-slate-200 bg-white p-[18px] shadow-sm ${className}">${title ? `<h2 class="mb-3 text-base font-semibold text-brand-950">${title}</h2>` : ""}${content}</section>`;
}
