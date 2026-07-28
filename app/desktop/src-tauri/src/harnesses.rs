use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy)]
struct Provider {
    id: &'static str,
    name: &'static str,
    project_dir: &'static str,
    global_dir: &'static str,
    supports_hooks: bool,
}

const PROVIDERS: &[Provider] = &[
    Provider { id: "claude", name: "Claude Code", project_dir: ".claude", global_dir: ".claude", supports_hooks: true },
    Provider { id: "codex", name: "Codex CLI", project_dir: ".agents", global_dir: ".codex", supports_hooks: true },
    Provider { id: "cursor", name: "Cursor", project_dir: ".cursor", global_dir: ".cursor", supports_hooks: true },
    Provider { id: "gemini", name: "Gemini CLI", project_dir: ".gemini", global_dir: ".gemini", supports_hooks: false },
    Provider { id: "copilot", name: "GitHub Copilot", project_dir: ".github", global_dir: ".github", supports_hooks: true },
    Provider { id: "grok", name: "Grok Build", project_dir: ".grok", global_dir: ".grok", supports_hooks: false },
    Provider { id: "kiro", name: "Kiro", project_dir: ".kiro", global_dir: ".kiro", supports_hooks: false },
    Provider { id: "opencode", name: "OpenCode", project_dir: ".opencode", global_dir: ".opencode", supports_hooks: false },
    Provider { id: "pi", name: "Project Indigo", project_dir: ".pi", global_dir: ".pi/agent", supports_hooks: false },
    Provider { id: "qoder", name: "Qoder", project_dir: ".qoder", global_dir: ".qoder", supports_hooks: false },
    Provider { id: "trae", name: "Trae", project_dir: ".trae", global_dir: ".trae", supports_hooks: false },
    Provider { id: "rovodev", name: "Rovo Dev", project_dir: ".rovodev", global_dir: ".rovodev", supports_hooks: false },
    Provider { id: "vibe", name: "Mistral Vibe", project_dir: ".vibe", global_dir: ".vibe", supports_hooks: false },
];

fn normalize(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "claude-code" => "claude".to_string(),
        "agents" => "codex".to_string(),
        "github" => "copilot".to_string(),
        "xai" | "grok-build" => "grok".to_string(),
        "rovo" => "rovodev".to_string(),
        "project-indigo" => "pi".to_string(),
        value => value.to_string(),
    }
}

fn find_provider(value: &str) -> Option<Provider> {
    let id = normalize(value);
    PROVIDERS.iter().copied().find(|provider| provider.id == id)
}

fn skill_status(skills: &Path) -> (bool, bool, Option<String>) {
    if !skills.is_dir() { return (false, false, None); }
    let has_skills = fs::read_dir(skills).map(|entries| entries.flatten().any(|entry| entry.path().join("SKILL.md").is_file())).unwrap_or(false);
    let skill = skills.join("jintia-skill");
    let installed = skill.join("SKILL.md").is_file();
    let version = fs::read_to_string(skill.join("VERSION")).ok().map(|value| value.trim().to_string());
    (installed, has_skills, version)
}

fn detection(provider: Provider, scope: &str, found: Option<PathBuf>, root: PathBuf) -> Value {
    let skills = root.join("skills");
    let (installed, has_skills, version) = skill_status(&skills);
    let found_path = found.as_ref().map(|path| path.to_string_lossy().to_string());
    let status = if installed { "installed" } else if found.is_some() { "detected" } else { "not-detected" };
    json!({
        "id": provider.id,
        "name": provider.name,
        "scope": scope,
        "foundPath": found_path,
        "installPath": skills.to_string_lossy(),
        "installed": installed,
        "hasSkills": has_skills,
        "version": version,
        "status": status,
        "supportsHooks": provider.supports_hooks,
    })
}

pub fn detect(project_path: String, explicit: Option<Vec<String>>) -> Value {
    let project = PathBuf::from(project_path.trim());
    let home = crate::paths::home_dir().unwrap_or_else(|_| PathBuf::new());
    let selected: Vec<Provider> = explicit.unwrap_or_default().iter().filter_map(|value| find_provider(value)).collect();
    let explicit_mode = !selected.is_empty();
    let providers = if explicit_mode { selected.clone() } else { PROVIDERS.to_vec() };
    let mut detections = Vec::new();
    for provider in providers {
        let project_dir = project.join(provider.project_dir);
        if explicit_mode || project_dir.is_dir() {
            detections.push(detection(provider, "project", project_dir.is_dir().then_some(project_dir.clone()), project_dir));
        }
        if !explicit_mode {
            let global_dir = home.join(provider.global_dir);
            if global_dir.is_dir() { detections.push(detection(provider, "global", Some(global_dir.clone()), global_dir)); }
        }
    }
    if detections.is_empty() {
        for id in ["claude", "codex"] {
            let provider = find_provider(id).unwrap();
            detections.push(detection(provider, "project", None, project.join(provider.project_dir).join("skills")));
        }
    }
    json!({ "schemaVersion": "1.0.0", "projectRoot": project.to_string_lossy(), "providers": detections })
}
