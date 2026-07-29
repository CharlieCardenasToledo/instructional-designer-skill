import { StatusNode } from "./StatusNode.js";

export function PathStepper(steps = [], active = 0) {
  return `<ol class="flex list-none p-0" aria-label="Progreso">${steps.map((step, index) => `<li class="flex flex-1 items-center gap-2 text-xs ${index < active ? "text-path-600" : "text-slate-500"}">${StatusNode({ status: index < active ? "complete" : index === active ? "active" : "pending", label: step })}<span class="max-[760px]:hidden">${step}</span>${index < steps.length - 1 ? `<span class="mx-1 h-0.5 flex-1 ${index < active ? "bg-path-500" : "bg-slate-200"}"></span>` : ""}</li>`).join("")}</ol>`;
}
