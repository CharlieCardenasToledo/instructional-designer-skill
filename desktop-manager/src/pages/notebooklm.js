import {
  checkNotebookLMAuth,
  runNotebookLMAuth,
  saveNotebooksConfig,
} from "../api.js";
import { escapeHtml, safeIndex } from "../dom.js";
import { getNotebooks, saveNotebooks } from "../state.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";
import { confirm } from "@tauri-apps/plugin-dialog";

export async function renderNotebookLM() {
  renderNotebookList();
  await updateAuthStatus();
}

async function updateAuthStatus() {
  const dot = document.getElementById("auth-dot");
  const text = document.getElementById("auth-text");
  if (!dot || !text) return;

  dot.className = "dot dot-loading";
  text.textContent = "Verificando sesión…";
  let auth = { authenticated: false, message: "No se pudo verificar" };
  try {
    auth = await checkNotebookLMAuth();
  } catch (error) {
    auth.message = String(error);
  }
  dot.className = `dot ${auth.authenticated ? "dot-ok" : "dot-err"}`;
  text.textContent = auth.message;
  const warning = document.getElementById("auth-warning");
  if (warning) warning.style.display = auth.authenticated ? "none" : "flex";
}

function normalizeNotebook(notebook) {
  if (notebook.course_code) return notebook;
  const [code = "", ...name] = String(notebook.course || "").split(/\s+[—-]\s+/);
  return {
    course_code: code.trim(),
    course_name: name.join(" — ").trim() || code.trim(),
    root_path: code.trim(),
    notebook_id: notebook.id || "",
    notebook_url: notebook.url || "",
  };
}

function notebooks() {
  return getNotebooks().map(normalizeNotebook);
}

function renderNotebookList() {
  const list = document.getElementById("notebook-list");
  if (!list) return;
  const entries = notebooks();

  list.innerHTML = entries.length
    ? entries.map((entry, index) => `
        <div class="list-item">
          <div class="list-item-left">
            <div class="dot dot-ok"></div>
            <div>
              <div class="list-item-label">${escapeHtml(entry.course_code)} — ${escapeHtml(entry.course_name)}</div>
              <div class="list-item-sub mono">${escapeHtml(entry.root_path)} · ${escapeHtml(entry.notebook_id || "sin id")}${entry.notebook_url ? " · URL guardada" : ""}</div>
            </div>
          </div>
          <button class="btn btn-danger btn-xs" data-delete-notebook="${index}" title="Eliminar notebook">
            ${ic("trash-2", 12)}
          </button>
        </div>`).join("")
    : `<div class="empty-state">${ic("notebook", 18)}<br>No hay notebooks registrados aún.</div>`;

  list.querySelectorAll("[data-delete-notebook]").forEach(button => {
    button.addEventListener("click", () => {
      const index = safeIndex(button.dataset.deleteNotebook, entries.length);
      if (index >= 0) deleteNotebook(index);
    });
  });
  refreshIcons();
}

async function persist(entries = notebooks()) {
  saveNotebooks(entries);
  const result = await saveNotebooksConfig(entries);
  toast(result.message, result.success ? "success" : "error", 6000);
  return result.success;
}

window.addNotebook = async function addNotebook() {
  const entry = {
    course_code: document.getElementById("nb-code").value.trim(),
    course_name: document.getElementById("nb-course-name").value.trim(),
    root_path: document.getElementById("nb-root").value.trim(),
    notebook_id: document.getElementById("nb-id").value.trim(),
    notebook_url: document.getElementById("nb-url").value.trim(),
  };

  if (!entry.course_code || !entry.course_name || !entry.root_path) {
    toast("Código, asignatura y carpeta raíz son obligatorios", "error");
    return;
  }
  if (!entry.notebook_id && !entry.notebook_url) {
    toast("Proporciona el Notebook ID o la URL de compartir", "error");
    return;
  }
  if (entry.notebook_url && !entry.notebook_url.startsWith("https://notebooklm.google.com/notebook/")) {
    toast("La URL debe pertenecer a notebooklm.google.com/notebook/", "error");
    return;
  }

  const entries = notebooks();
  const duplicate = entries.findIndex(item => item.course_code.toLowerCase() === entry.course_code.toLowerCase());
  if (duplicate >= 0) entries[duplicate] = entry;
  else entries.push(entry);

  if (await persist(entries)) {
    ["nb-code", "nb-course-name", "nb-root", "nb-id", "nb-url"].forEach(id => {
      document.getElementById(id).value = "";
    });
    renderNotebookList();
  }
};

async function deleteNotebook(index) {
  if (!await confirm("¿Eliminar este notebook del registro?")) return;
  const entries = notebooks();
  entries.splice(index, 1);
  if (await persist(entries)) renderNotebookList();
}

window.persistNotebooks = async function persistNotebooks() {
  await persist();
};

window.verifyNotebookLMAuth = updateAuthStatus;

window.triggerNotebookLMAuth = async function triggerNotebookLMAuth() {
  toast("Abriendo Chrome para autenticación…", "loading", 90000);
  try {
    const result = await runNotebookLMAuth();
    toast(result.message, result.success ? "success" : "error", 10000);
  } catch (error) {
    toast(`No se pudo iniciar la autenticación: ${error}`, "error", 8000);
  }
};
