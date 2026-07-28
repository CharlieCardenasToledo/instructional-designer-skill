use crate::models::ToolchainReport;
use crate::payload;
use std::path::Path;
use std::process::Command;

fn validate_target(operation: &str, target: Option<&str>) -> Result<String, String> {
    let target = target.ok_or_else(|| format!("{operation} requiere una ruta de archivo."))?;
    let path = Path::new(target);
    if !path.is_file() { return Err(format!("No existe el archivo objetivo: {target}")); }
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
    match operation {
        "audit" if !matches!(extension.as_str(), "md" | "tex") => Err("audit solo acepta README.md o archivos .tex.".to_string()),
        "validate" | "compile" if extension != "tex" => Err(format!("{operation} requiere un archivo .tex.")),
        _ => Ok(target.to_string()),
    }
}

pub fn run(operation: String, target: Option<String>, json: Option<bool>, strict: Option<bool>) -> ToolchainReport {
    if !["doctor", "audit", "validate", "compile"].contains(&operation.as_str()) { return ToolchainReport::error(format!("Operación no permitida: {operation}")); }
    let skill_path = payload::installed_skill_path();
    let entrypoint = Path::new(&skill_path).join("bin").join("jintia.js");
    if !entrypoint.is_file() { return ToolchainReport::error(format!("La skill no está instalada en {skill_path}. Instálala antes de ejecutar la toolchain.")); }
    let mut args = vec![entrypoint.to_string_lossy().into_owned(), operation.clone()];
    if let Some(target) = target.as_deref() { match validate_target(&operation, Some(target)) { Ok(target) => args.push(target), Err(error) => return ToolchainReport::error(error) } }
    else if operation != "doctor" { return ToolchainReport::error(format!("{operation} requiere una ruta de archivo.")); }
    if json.unwrap_or(true) && matches!(operation.as_str(), "doctor" | "audit") { args.push("--json".to_string()); }
    if strict.unwrap_or(false) && operation == "audit" { args.push("--strict".to_string()); }
    match Command::new("node").args(&args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
            let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
            ToolchainReport { success: output.status.success(), message: if output.status.success() { format!("{operation} terminó correctamente.") } else { format!("{operation} terminó con errores.") }, operation, stdout: stdout.clone(), stderr, exit_code: output.status.code(), report: serde_json::from_str(&stdout).ok() }
        }
        Err(error) => ToolchainReport::error(format!("No se pudo iniciar Node.js: {error}")),
    }
}

pub fn manage_harness(operation: String, project_path: String, providers: Vec<String>, scope: String, confirm: bool) -> ToolchainReport {
    if !["status", "install", "update", "repair", "uninstall"].contains(&operation.as_str()) { return ToolchainReport::error(format!("Operación de harness no permitida: {operation}")); }
    if !["project", "global"].contains(&scope.as_str()) { return ToolchainReport::error("El alcance debe ser project o global.".to_string()); }
    let skill_path = payload::installed_skill_path();
    let entrypoint = Path::new(&skill_path).join("bin").join("jintia.js");
    if !entrypoint.is_file() { return ToolchainReport::error(format!("La skill no está instalada en {skill_path}.")); }
    let mut args = vec![entrypoint.to_string_lossy().into_owned(), "harness".to_string(), operation.clone(), format!("--project={project_path}"), format!("--scope={scope}"), "--json".to_string()];
    if !providers.is_empty() { args.push(format!("--providers={}", providers.join(","))); }
    if confirm { args.push("--yes".to_string()); }
    match Command::new("node").args(&args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
            let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
            ToolchainReport { success: output.status.success(), message: if output.status.success() { format!("harness {operation} terminó correctamente.") } else { format!("harness {operation} terminó con errores.") }, operation: format!("harness {operation}"), stdout: stdout.clone(), stderr, exit_code: output.status.code(), report: serde_json::from_str(&stdout).ok() }
        }
        Err(error) => ToolchainReport::error(format!("No se pudo iniciar Node.js: {error}")),
    }
}
