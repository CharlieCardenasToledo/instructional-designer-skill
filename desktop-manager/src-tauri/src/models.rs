use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActionResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
}

impl ActionResult {
    pub fn ok(message: impl Into<String>) -> Self {
        Self { success: true, message: message.into(), path: None, backup_path: None }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self { success: false, message: message.into(), path: None, backup_path: None }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn with_backup(mut self, path: impl Into<String>) -> Self {
        self.backup_path = Some(path.into());
        self
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DependencyStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub required: bool,
    pub note: String,
    pub command: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstitutionConfig {
    pub author: String,
    pub degree: String,
    pub career: String,
    pub faculty: String,
    pub institution: String,
    #[serde(default)]
    pub website: String,
    pub color_r: u8,
    pub color_g: u8,
    pub color_b: u8,
    pub ecosystem: String,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct PaletteColor {
    pub color: String,
    pub occurrences: usize,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct SitePalette {
    pub site_name: Option<String>,
    pub colors: Vec<PaletteColor>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WeekData {
    pub number: u32,
    #[serde(default)]
    pub title: String,
    pub unit: String,
    pub topics: String,
    pub outcomes: String,
    pub bibliography: String,
    pub graded_activity: Option<String>,
    #[serde(default)]
    pub autonomous_hours: u32,
    #[serde(default)]
    pub teaching_hours: u32,
    #[serde(default)]
    pub practice_hours: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotebookEntry {
    pub course_code: String,
    pub course_name: String,
    pub root_path: String,
    pub notebook_id: String,
    pub notebook_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TemplateMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    #[serde(rename = "previewType")]
    pub preview_type: String,
    pub featured: bool,
    #[serde(rename = "documentClass")]
    pub document_class: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotebookLmAuthStatus {
    pub authenticated: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SetupStatus {
    pub skill_installed: bool,
    pub mcp_configured: bool,
    pub mcp_desktop_configured: bool,
    pub mcp_claude_code_configured: bool,
    pub institution_configured: bool,
    pub skill_path: String,
    pub mcp_config_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStatus {
    pub version: u32,
    pub completed: bool,
    pub current_step: u8,
    pub max_completed_step: u8,
    pub selected_target: String,
    pub last_updated: u64,
    /// Explica por qué el sistema devolvió al usuario a un paso anterior
    /// (p. ej. una dependencia que antes estaba lista dejó de estarlo).
    /// Solo se llena en el momento en que se detecta la regresión.
    #[serde(default)]
    pub regression_reason: Option<String>,
}

impl Default for OnboardingStatus {
    fn default() -> Self {
        Self {
            version: 1,
            completed: false,
            current_step: 1,
            max_completed_step: 0,
            selected_target: String::new(),
            last_updated: 0,
            regression_reason: None,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct OnboardingResult {
    pub success: bool,
    pub message: String,
    pub status: OnboardingStatus,
}
