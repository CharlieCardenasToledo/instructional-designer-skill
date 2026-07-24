export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeIndex(value, length) {
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) && index >= 0 && index < length ? index : -1;
}

export function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (label) button.querySelector("span")?.replaceChildren(label);
}
