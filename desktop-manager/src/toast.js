/**
 * toast.js — Sistema de notificaciones (Single Responsibility Principle)
 * Feedback inmediato para cada acción del usuario (Norman: Principio de Feedback).
 */
import { refreshIcons } from "./icons.js";

let timer;

const TYPE_ICON = {
  success: "check-circle-2",
  error:   "x-circle",
  info:    "info",
  loading: "loader-2",
};

export function toast(msg, type = "info", ms = 3800) {
  const el = document.getElementById("toast");
  if (!el) return;

  const iconName = TYPE_ICON[type] || "info";
  el.replaceChildren();
  const icon = document.createElement("i");
  icon.dataset.lucide = iconName;
  icon.setAttribute("width", "15");
  icon.setAttribute("height", "15");
  const text = document.createElement("span");
  text.textContent = String(msg ?? "");
  el.append(icon, text);
  el.className = `show ${type}`;

  clearTimeout(timer);
  if (type !== "loading") {
    timer = setTimeout(() => { el.className = ""; }, ms);
  }

  refreshIcons();
}
