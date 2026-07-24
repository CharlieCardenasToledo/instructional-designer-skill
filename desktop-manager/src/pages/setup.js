import { checkDependencies, installDependency } from "../api.js";
import { escapeHtml } from "../dom.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";
import { confirm } from "@tauri-apps/plugin-dialog";

const LARGE_INSTALLS = new Set(["WSL 2", "TeX Live (pdflatex)"]);

export async function renderSetup() {
  const list = document.getElementById("dep-list");
  if (!list) return;

  list.innerHTML = `<div class="text-muted loading-row">${ic("loader-2")} Verificando dependencias del sistema…</div>`;
  refreshIcons();

  try {
    state.deps = await checkDependencies();
  } catch {
    state.deps = [{
      name: "Node.js",
      installed: false,
      version: null,
      required: true,
      note: "No se pudo consultar el sistema."
    }];
  }

  const ok = state.deps.filter(dep => dep.installed).length;
  const requiredMissing = state.deps.filter(dep => dep.required && !dep.installed);
  const total = state.deps.length;
  document.getElementById("dep-ok-count").textContent = String(ok);
  document.getElementById("dep-tot-count").textContent = String(total);
  document.getElementById("dep-progress").style.width = `${total ? Math.round((ok / total) * 100) : 0}%`;

  const badge = document.getElementById("dep-missing-badge");
  if (badge) {
    badge.textContent = requiredMissing.length ? String(requiredMissing.length) : "";
    badge.style.display = requiredMissing.length ? "" : "none";
  }
  const installAll = document.getElementById("btn-install-all");
  if (installAll) installAll.disabled = requiredMissing.length === 0;

  const ordered = [
    ...state.deps.filter(dep => !dep.installed),
    ...state.deps.filter(dep => dep.installed),
  ];
  list.innerHTML = ordered.map(depItem).join("");
  list.querySelectorAll("[data-install-dependency]").forEach(button => {
    button.addEventListener("click", () => installDep(button.dataset.installDependency));
  });
  refreshIcons();
}

function depItem(dep) {
  const version = dep.version || (dep.installed ? "Instalado" : "No encontrado");
  const requirement = dep.required ? "Requerido" : "Opcional";
  return `
    <div class="list-item">
      <div class="list-item-left">
        <div class="dot ${dep.installed ? "dot-ok" : "dot-err"}"></div>
        <div>
          <div class="list-item-label">${escapeHtml(dep.name)} <span class="badge">${requirement}</span></div>
          <div class="list-item-sub">${escapeHtml(version)} · ${escapeHtml(dep.note || "")}</div>
        </div>
      </div>
      <div class="list-item-right">
        ${dep.installed
          ? `<span class="badge badge-green">${ic("check-circle-2", 11)} Listo</span>`
          : `<button class="btn btn-primary btn-sm" data-install-dependency="${escapeHtml(dep.name)}" title="Instalar ${escapeHtml(dep.name)}">${ic("download", 13)} Instalar</button>`}
      </div>
    </div>`;
}

async function installDep(name) {
  const large = LARGE_INSTALLS.has(name);
  const confirmed = !large || await confirm(
    `${name} modifica componentes del sistema y puede descargar varios gigabytes.\n\n¿Deseas continuar?`
  );
  if (!confirmed) return;

  toast(`Instalando ${name}…`, "loading", 120000);
  try {
    const result = await installDependency(name, confirmed);
    toast(result.message, result.success ? "success" : "error", 7000);
    if (result.success) await renderSetup();
  } catch (error) {
    toast(`Error al instalar ${name}: ${error}`, "error");
  }
}

window.installAll = async function installAll() {
  const missing = state.deps.filter(dep => dep.required && !dep.installed);
  if (!missing.length) {
    toast("Todas las dependencias requeridas están instaladas", "success");
    return;
  }
  for (const dependency of missing) await installDep(dependency.name);
};
