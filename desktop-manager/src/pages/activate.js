import {
  applyInstitutionConfig,
  checkNotebookLMAuth,
  configureMcp,
  exportSkillZip,
  getSetupStatus,
  installSkill,
  pickDirectory,
  runNotebookLMAuth,
} from "../api.js";
import { escapeHtml } from "../dom.js";
import { state, saveConfig } from "../state.js";
import { toast } from "../toast.js";
import { ic, refreshIcons } from "../icons.js";

export async function renderActivate() {
  const container = document.getElementById("activate-steps");
  if (!container) return;
  container.innerHTML = `<div class="text-muted loading-row">${ic("loader-2")} Verificando estado…</div>`;
  refreshIcons();

  let status = {
    skill_installed: false,
    mcp_desktop_configured: false,
    mcp_claude_code_configured: false,
    institution_configured: false,
    skill_path: "~/.claude/skills/instructional-designer-skill",
    mcp_config_path: "",
  };
  let auth = { authenticated: false, message: "No verificado" };
  try {
    [status, auth] = await Promise.all([getSetupStatus(), checkNotebookLMAuth()]);
  } catch (error) {
    auth.message = String(error);
  }

  const steps = buildSteps(status, auth);
  const completed = steps.filter(step => step.ok).length;
  container.innerHTML = steps.map((step, index) => `
    <div class="step-item">
      <div class="step-num ${step.ok ? "done" : ""}">
        ${step.ok ? ic("check-circle-2", 14) : index + 1}
      </div>
      <div class="step-content">
        <div class="step-label">${escapeHtml(step.label)} ${step.optional ? `<span class="badge">Opcional</span>` : ""}</div>
        <div class="step-detail">${escapeHtml(step.detail)}</div>
      </div>
      ${step.ok
        ? `<span class="badge badge-green">${ic("check-circle-2", 11)} Listo</span>`
        : `<button class="btn btn-primary btn-sm" data-run-step="${escapeHtml(step.id)}">${ic("play", 12)} ${escapeHtml(step.action)}</button>`}
    </div>`).join("");

  container.querySelectorAll("[data-run-step]").forEach(button => {
    button.addEventListener("click", () => runStep(button.dataset.runStep));
  });

  document.getElementById("activate-progress").style.width = `${Math.round((completed / steps.length) * 100)}%`;
  document.getElementById("activate-count").textContent = `${completed} de ${steps.length} pasos preparados`;

  const requiredReady = status.institution_configured
    && (status.skill_installed || Boolean(state.config.lastSkillZip))
    && auth.authenticated;
  document.getElementById("activate-status").innerHTML = requiredReady
    ? `<div class="info-box">${ic("check-circle-2", 14)} <strong>Base preparada.</strong> Reinicia el cliente donde configuraste MCP.</div>`
    : `<div class="text-muted status-note">${ic("info", 13)} Claude/Cowork usa el ZIP; Claude Code usa la instalación local. Elige solo los destinos que necesites.</div>`;
  refreshIcons();
}

function buildSteps(status, auth) {
  return [
    {
      id: "institution",
      label: "Configuración institucional estructurada",
      ok: status.institution_configured,
      detail: "Datos JSON preservados entre actualizaciones",
      action: "Guardar",
    },
    {
      id: "zip",
      label: "ZIP para Claude y Cowork",
      ok: Boolean(state.config.lastSkillZip),
      detail: state.config.lastSkillZip || "Se sube desde Customize → Skills",
      action: "Generar ZIP",
    },
    {
      id: "skill",
      label: "Instalación local para Claude Code",
      ok: status.skill_installed,
      detail: status.skill_path,
      action: "Instalar",
      optional: true,
    },
    {
      id: "mcp-desktop",
      label: "NotebookLM MCP en Claude Desktop",
      ok: status.mcp_desktop_configured,
      detail: status.mcp_config_path || "claude_desktop_config.json",
      action: "Configurar",
      optional: true,
    },
    {
      id: "mcp-code",
      label: "NotebookLM MCP en Claude Code",
      ok: status.mcp_claude_code_configured,
      detail: "~/.claude.json",
      action: "Configurar",
      optional: true,
    },
    {
      id: "auth",
      label: "Sesión de NotebookLM",
      ok: auth.authenticated,
      detail: auth.message,
      action: "Iniciar sesión",
    },
  ];
}

function institutionPayload() {
  const config = state.config;
  return {
    author: config.author || "",
    degree: config.degree || "",
    career: config.career || "",
    faculty: config.faculty || "",
    institution: config.institution || "",
    color_r: Number(config.colorR ?? 0),
    color_g: Number(config.colorG ?? 121),
    color_b: Number(config.colorB ?? 107),
    ecosystem: config.ecosystem || "",
  };
}

const ACTIONS = {
  institution: async () => {
    const payload = institutionPayload();
    if (!payload.author || !payload.institution || !payload.faculty || !payload.career) {
      toast("Completa primero Institución, Facultad, Carrera y Autor", "error");
      return null;
    }
    return applyInstitutionConfig(payload);
  },
  zip: async () => {
    const destination = await pickDirectory("Carpeta donde guardar el ZIP para Claude/Cowork");
    if (!destination) return null;
    const result = await exportSkillZip(destination);
    if (result.success && result.path) {
      state.config.lastSkillZip = result.path;
      saveConfig();
    }
    return result;
  },
  skill: installSkill,
  "mcp-desktop": () => configureMcp("desktop"),
  "mcp-code": () => configureMcp("claude-code"),
  auth: runNotebookLMAuth,
};

async function runStep(step) {
  const action = ACTIONS[step];
  if (!action) return false;
  toast("Ejecutando configuración…", "loading", 90000);
  try {
    const result = await action();
    if (result) toast(result.message, result.success ? "success" : "error", 9000);
    await renderActivate();
    return Boolean(result?.success);
  } catch (error) {
    toast(`Error: ${error}`, "error");
    await renderActivate();
    return false;
  }
}

window.runAllSteps = async function runAllSteps() {
  const payload = institutionPayload();
  if (!payload.author || !payload.institution || !payload.faculty || !payload.career) {
    toast("Completa la configuración institucional antes de continuar", "error");
    return;
  }

  const sequence = ["institution", "zip", "skill", "mcp-desktop", "mcp-code", "auth"];
  for (const step of sequence) {
    const success = await runStep(step);
    if (!success) {
      toast("La configuración se detuvo en el paso pendiente. Revisa el mensaje anterior.", "error", 8000);
      return;
    }
  }
  toast(
    "Chrome quedó abierto para iniciar sesión. Completa el acceso y pulsa Verificar; la configuración aún no está finalizada.",
    "info",
    12000,
  );
};
