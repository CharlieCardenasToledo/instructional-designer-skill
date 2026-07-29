import { StatusNode } from "./StatusNode.js";

export function ProgressPath({ items = [], completed = 0, active = -1 } = {}) {
  return `<div class="flex w-full items-start" role="list" aria-label="Progreso">${items.map((item, index) => `<div class="relative flex flex-1 flex-col items-center gap-1.5 text-center text-[11px] text-slate-500">${StatusNode({ status: index < completed ? "complete" : index === active ? "active" : "pending", label: item })}<span>${item}</span>${index < items.length - 1 ? `<span class="absolute left-1/2 top-[7px] -z-0 h-0.5 w-full ${index < completed ? "bg-path-500" : "bg-slate-200"}"></span>` : ""}</div>`).join("")}</div>`;
}
