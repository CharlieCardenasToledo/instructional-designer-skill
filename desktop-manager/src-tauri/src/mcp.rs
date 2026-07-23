use crate::models::{ActionResult, NotebookLmAuthStatus};
use crate::paths::{atomic_write, backup_file, claude_code_config_path, claude_desktop_config_path, path_text};
use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub fn configure_mcp(target: String) -> ActionResult {
    let (path, label) = match target.as_str() {
        "desktop" => match claude_desktop_config_path() {
            Ok(path) => (path, "Claude Desktop"),
            Err(error) => return ActionResult::error(error),
        },
        "claude-code" => match claude_code_config_path() {
            Ok(path) => (path, "Claude Code"),
            Err(error) => return ActionResult::error(error),
        },
        _ => return ActionResult::error("Destino MCP no reconocido."),
    };

    let mut root = if path.exists() {
        let text = match fs::read_to_string(&path) {
            Ok(text) => text,
            Err(error) => return ActionResult::error(format!("No se pudo leer {}: {error}", path.display())),
        };
        match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(object)) => Value::Object(object),
            Ok(_) => return ActionResult::error(format!("{} no contiene un objeto JSON.", path.display())),
            Err(error) => {
                return ActionResult::error(format!(
                    "La configuración existente no es JSON válido y no fue modificada: {error}"
                ))
            }
        }
    } else {
        json!({})
    };

    if root.get("mcpServers").is_some_and(|value| !value.is_object()) {
        return ActionResult::error(
            "La clave mcpServers existente no es un objeto. Corrígela antes de continuar.",
        );
    }
    if root.get("mcpServers").is_none() {
        root["mcpServers"] = json!({});
    }
    root["mcpServers"]["notebooklm"] = json!({
        "command": "npx",
        "args": ["notebooklm-mcp@latest"]
    });

    let bytes = match serde_json::to_vec_pretty(&root) {
        Ok(bytes) => bytes,
        Err(error) => return ActionResult::error(format!("No se pudo serializar la configuración: {error}")),
    };
    let backup = match backup_file(&path) {
        Ok(path) => path,
        Err(error) => return ActionResult::error(error),
    };
    if let Err(error) = atomic_write(&path, &bytes) {
        return ActionResult::error(error);
    }

    let result = ActionResult::ok(format!(
        "NotebookLM MCP 2.0 configurado para {label} en:\n{}\n\nReinicia {label} para aplicar el cambio.",
        path_text(&path)
    ))
    .with_path(path_text(&path));
    if let Some(backup) = backup {
        result.with_backup(path_text(&backup))
    } else {
        result
    }
}

fn npx_command() -> &'static str {
    if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" }
}

fn receive_json(
    receiver: &mpsc::Receiver<String>,
    id: i64,
    timeout: Duration,
) -> Result<Value, String> {
    let deadline = Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(format!("NotebookLM MCP no respondió a la solicitud {id} dentro del tiempo esperado."));
        }
        let line = receiver.recv_timeout(remaining)
            .map_err(|_| format!("NotebookLM MCP cerró la conexión durante la solicitud {id}."))?;
        if let Ok(value) = serde_json::from_str::<Value>(&line) {
            if value.get("id").and_then(Value::as_i64) == Some(id) {
                return Ok(value);
            }
        }
    }
}

fn call_tool(tool: &str, timeout: Duration) -> Result<Value, String> {
    let mut child = Command::new(npx_command())
        .arg("notebooklm-mcp@latest")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("No se pudo iniciar notebooklm-mcp. Verifica Node.js y npx: {error}"))?;

    let stdout = child.stdout.take().ok_or_else(|| "No se pudo leer la salida del MCP.".to_string())?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });

    let result = (|| -> Result<Value, String> {
        let stdin = child.stdin.as_mut().ok_or_else(|| "No se pudo escribir al MCP.".to_string())?;
        writeln!(
            stdin,
            "{}",
            json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": { "name": "instructional-designer-manager", "version": "1.0.0" }
                }
            })
        )
        .map_err(|error| format!("No se pudo inicializar el MCP: {error}"))?;
        stdin.flush().map_err(|error| error.to_string())?;
        let initialize = receive_json(&receiver, 1, timeout)?;
        if let Some(error) = initialize.get("error") {
            return Err(format!("NotebookLM MCP rechazó la inicialización: {error}"));
        }

        writeln!(stdin, "{}", json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }))
            .map_err(|error| error.to_string())?;
        writeln!(
            stdin,
            "{}",
            json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": { "name": tool, "arguments": {} }
            })
        )
        .map_err(|error| format!("No se pudo llamar {tool}: {error}"))?;
        stdin.flush().map_err(|error| error.to_string())?;
        receive_json(&receiver, 2, timeout)
    })();

    let _ = child.kill();
    let _ = child.wait();
    result
}

fn find_authenticated(value: &Value) -> Option<bool> {
    match value {
        Value::Object(map) => {
            if let Some(value) = map.get("authenticated").and_then(Value::as_bool) {
                return Some(value);
            }
            map.values().find_map(find_authenticated)
        }
        Value::Array(items) => items.iter().find_map(find_authenticated),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .as_ref()
            .and_then(find_authenticated)
            .or_else(|| {
                if text.contains("\"authenticated\":true") || text.contains("\"authenticated\": true") {
                    Some(true)
                } else if text.contains("\"authenticated\":false") || text.contains("\"authenticated\": false") {
                    Some(false)
                } else {
                    None
                }
            }),
        _ => None,
    }
}

fn is_tool_error(value: &Value) -> bool {
    value.get("error").is_some()
        || value.pointer("/result/isError").and_then(Value::as_bool).unwrap_or(false)
}

pub fn check_auth() -> NotebookLmAuthStatus {
    match call_tool("get_health", Duration::from_secs(60)) {
        Ok(value) if !is_tool_error(&value) => match find_authenticated(&value) {
            Some(true) => NotebookLmAuthStatus {
                authenticated: true,
                message: "Sesión activa. NotebookLM puede consultar tus notebooks.".to_string(),
            },
            Some(false) => NotebookLmAuthStatus {
                authenticated: false,
                message: "Servidor disponible, pero falta iniciar sesión en Google.".to_string(),
            },
            None => NotebookLmAuthStatus {
                authenticated: false,
                message: "El servidor respondió, pero no devolvió un estado de autenticación reconocible.".to_string(),
            },
        },
        Ok(value) => NotebookLmAuthStatus {
            authenticated: false,
            message: format!("NotebookLM MCP devolvió un error: {value}"),
        },
        Err(error) => NotebookLmAuthStatus { authenticated: false, message: error },
    }
}

pub fn start_auth() -> ActionResult {
    match call_tool("setup_auth", Duration::from_secs(90)) {
        Ok(value) if !is_tool_error(&value) => ActionResult::ok(
            "Chrome se abrió para autenticar NotebookLM. Completa el acceso en un máximo de 10 minutos y pulsa “Verificar sesión”.",
        ),
        Ok(value) => ActionResult::error(format!("NotebookLM MCP no pudo iniciar la autenticación: {value}")),
        Err(error) => ActionResult::error(error),
    }
}
