export function PageHeader({ title, description = "", action = "" } = {}) {
  return `<header class="mb-[18px] flex items-start justify-between gap-4"><div><h1 class="text-2xl font-bold leading-[30px] text-brand-950">${title}</h1>${description ? `<p class="mt-1 text-sm leading-[21px] text-slate-500">${description}</p>` : ""}</div>${action}</header>`;
}
