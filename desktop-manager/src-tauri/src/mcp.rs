use crate::models::{ActionResult, NotebookLmAuthStatus};
use crate::paths::{atomic_write, backup_file, claude_code_config_path, claude_desktop_config_path, path_text};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

pub const NOTEBOOKLM_MCP_PACKAGE: &str = "notebooklm-mcp@2.0.0";
const AUTH_STATE_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);
const GOOGLE_API_AUTH_COOKIE: &[u8] = b"SAPISID";
const GOOGLE_SECURE_AUTH_COOKIES: [&[u8]; 2] = [b"__Secure-1PSID", b"__Secure-3PSID"];

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
        "args": [NOTEBOOKLM_MCP_PACKAGE]
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

// notebooklm-mcp v2.0 mantiene su navegador y perfil de Chrome persistentes
// en un `SharedContextManager` que vive en memoria mientras el proceso del
// servidor está vivo. Antes lanzábamos (y matábamos) un proceso nuevo por
// cada llamada — get_health y setup_auth terminaban en procesos distintos
// que no compartían ese estado en memoria, así que setup_auth nunca llegaba
// a completar su detección de login antes de que lo cerráramos. Ahora se
// mantiene UN solo proceso vivo, reutilizado por todas las llamadas.
struct McpConnection {
    child: Child,
    stdin: Option<ChildStdin>,
    receiver: mpsc::Receiver<String>,
    next_id: i64,
}

impl McpConnection {
    fn spawn() -> Result<Self, String> {
        let mut child = Command::new(npx_command())
            .arg(NOTEBOOKLM_MCP_PACKAGE)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| format!("No se pudo iniciar notebooklm-mcp. Verifica Node.js y npx: {error}"))?;

        let stdout = child.stdout.take().ok_or_else(|| "No se pudo leer la salida del MCP.".to_string())?;
        let stdin = child.stdin.take().ok_or_else(|| "No se pudo escribir al MCP.".to_string())?;
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout).lines();
            loop {
                match reader.next() {
                    Some(Ok(line)) => {
                        eprintln!("[notebooklm-mcp] {line}");
                        if sender.send(line).is_err() {
                            break;
                        }
                    }
                    Some(Err(error)) => {
                        eprintln!("[notebooklm-mcp] error leyendo stdout: {error}");
                        break;
                    }
                    None => break,
                }
            }
        });

        let mut connection = McpConnection { child, stdin: Some(stdin), receiver, next_id: 1 };
        connection.initialize()?;
        Ok(connection)
    }

    fn send(&mut self, value: Value) -> Result<(), String> {
        let stdin = self.stdin.as_mut().ok_or_else(|| {
            "La entrada estándar de NotebookLM MCP ya está cerrada.".to_string()
        })?;
        writeln!(stdin, "{value}")
            .map_err(|error| format!("No se pudo escribir al MCP: {error}"))?;
        stdin.flush().map_err(|error| error.to_string())
    }

    fn initialize(&mut self) -> Result<(), String> {
        let id = self.next_id;
        self.next_id += 1;
        self.send(json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": { "name": "instructional-designer-manager", "version": "1.0.0" }
                }
            }))
            .map_err(|error| format!("No se pudo inicializar el MCP: {error}"))?;
        let response = receive_json(&self.receiver, id, Duration::from_secs(30))?;
        if let Some(error) = response.get("error") {
            return Err(format!("NotebookLM MCP rechazó la inicialización: {error}"));
        }
        self.send(json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }))
    }

    fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }
}

impl Drop for McpConnection {
    fn drop(&mut self) {
        // Cerrar stdin primero permite que el servidor procese EOF y ejecute su
        // limpieza de sesiones/contextos. Solo se fuerza la terminación si no
        // sale por sí mismo en un margen breve.
        self.stdin.take();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            match self.child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => thread::sleep(Duration::from_millis(50)),
                Err(_) => break,
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

static CONNECTION: Mutex<Option<McpConnection>> = Mutex::new(None);

fn call_tool(tool: &'static str, arguments: Value, timeout: Duration) -> Result<Value, String> {
    let mut guard = CONNECTION
        .lock()
        .map_err(|_| "Estado interno de NotebookLM MCP corrupto.".to_string())?;

    if let Some(connection) = guard.as_mut() {
        if !connection.is_alive() {
            *guard = None;
        }
    }
    if guard.is_none() {
        *guard = Some(McpConnection::spawn()?);
    }
    let connection = guard.as_mut().expect("la conexión se acaba de crear");

    let id = connection.next_id;
    connection.next_id += 1;
    let result = connection
        .send(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/call",
            "params": { "name": tool, "arguments": arguments }
        }))
        .map_err(|error| format!("No se pudo llamar {tool}: {error}"))
        .and_then(|_| receive_json(&connection.receiver, id, timeout));

    if result.is_err() {
        // La conexión pudo haber quedado en un estado inconsistente (p. ej.
        // el usuario abandonó el login y se agotó el tiempo): se descarta
        // para que la próxima llamada arranque un proceso limpio.
        *guard = None;
    }
    result
}

fn find_bool_field(value: &Value, field: &str) -> Option<bool> {
    match value {
        Value::Object(map) => {
            if let Some(value) = map.get(field).and_then(Value::as_bool) {
                return Some(value);
            }
            map.values().find_map(|value| find_bool_field(value, field))
        }
        Value::Array(items) => items.iter().find_map(|value| find_bool_field(value, field)),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .as_ref()
            .and_then(|value| find_bool_field(value, field)),
        _ => None,
    }
}

fn find_string_field(value: &Value, field: &str) -> Option<String> {
    match value {
        Value::Object(map) => map
            .get(field)
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| map.values().find_map(|value| find_string_field(value, field))),
        Value::Array(items) => items.iter().find_map(|value| find_string_field(value, field)),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .as_ref()
            .and_then(|value| find_string_field(value, field)),
        _ => None,
    }
}

fn is_tool_error(value: &Value) -> bool {
    value.get("error").is_some()
        || value.pointer("/result/isError").and_then(Value::as_bool).unwrap_or(false)
        || find_bool_field(value, "success") == Some(false)
}

fn tool_error_message(value: &Value) -> String {
    find_string_field(value, "error")
        .or_else(|| find_string_field(value, "message"))
        .unwrap_or_else(|| value.to_string())
}

fn notebooklm_data_dir() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .map(|path| path.join("notebooklm-mcp").join("Data"))
    } else if cfg!(target_os = "macos") {
        env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join("Library").join("Application Support").join("notebooklm-mcp"))
    } else {
        env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".local").join("share")))
            .map(|path| path.join("notebooklm-mcp"))
    }
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|window| window == needle)
}

/// Workaround para notebooklm-mcp 2.0.0: `get_health` solo comprueba
/// browser_state/state.json, aunque el perfil persistente de Chrome ya tenga
/// una sesión válida. Si el detector perdió la pestaña durante el redirect,
/// Chrome igualmente guarda sus cookies al cerrar el contexto.
fn persistent_profile_has_recent_google_auth() -> bool {
    let Some(data_dir) = notebooklm_data_dir() else {
        return false;
    };
    let cookie_files = [
        data_dir.join("chrome_profile").join("Default").join("Network").join("Cookies"),
        data_dir.join("chrome_profile").join("Default").join("Network").join("Cookies-wal"),
    ];

    cookie_files.iter().any(|path| {
        let recent = fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.elapsed().ok())
            .is_some_and(|age| age <= AUTH_STATE_MAX_AGE);
        if !recent {
            return false;
        }
        fs::read(path).ok().is_some_and(|bytes| {
            contains_bytes(&bytes, GOOGLE_API_AUTH_COOKIE)
                && GOOGLE_SECURE_AUTH_COOKIES
                    .iter()
                    .any(|name| contains_bytes(&bytes, name))
        })
    })
}

fn discard_connection() {
    if let Ok(mut guard) = CONNECTION.lock() {
        *guard = None;
    }
}

pub fn check_auth() -> NotebookLmAuthStatus {
    match call_tool("get_health", json!({}), Duration::from_secs(60)) {
        Ok(value) if !is_tool_error(&value) => match find_bool_field(&value, "authenticated") {
            Some(true) => NotebookLmAuthStatus {
                authenticated: true,
                message: "Sesión activa. NotebookLM puede consultar tus notebooks.".to_string(),
            },
            Some(false) if persistent_profile_has_recent_google_auth() => NotebookLmAuthStatus {
                authenticated: true,
                message: "Sesión activa detectada en el perfil persistente de NotebookLM.".to_string(),
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
            message: format!("NotebookLM MCP devolvió un error: {}", tool_error_message(&value)),
        },
        Err(error) => NotebookLmAuthStatus { authenticated: false, message: error },
    }
}

pub fn start_auth() -> ActionResult {
    // setup_auth es síncrono en notebooklm-mcp: bloquea sondeando la URL de la
    // ventana hasta ver notebooklm.google.com (hasta 10 min) y solo entonces
    // guarda las cookies, cierra el navegador y responde. Un timeout más corto
    // aquí (antes, 90 s) provocaba que matáramos el proceso a medio login,
    // dejando el navegador abierto y la sesión sin guardar.
    let response = call_tool(
        "setup_auth",
        json!({ "show_browser": true }),
        Duration::from_secs(630),
    );
    match response {
        Ok(value)
            if !is_tool_error(&value)
                && find_bool_field(&value, "authenticated") == Some(true) =>
        {
            ActionResult::ok("Sesión iniciada y verificada con NotebookLM.")
        }
        Ok(_value) if persistent_profile_has_recent_google_auth() => {
            // El MCP 2.0.0 puede perder la referencia de la pestaña durante el
            // redirect. Cerramos cualquier contexto residual y usamos el
            // perfil que Chrome ya persistió como fuente de verificación.
            discard_connection();
            ActionResult::ok(
                "Sesión iniciada. Se verificó mediante el perfil persistente de NotebookLM.",
            )
        }
        Ok(value) => {
            discard_connection();
            ActionResult::error(format!(
                "NotebookLM MCP no pudo iniciar la autenticación: {}",
                tool_error_message(&value)
            ))
        }
        Err(error) => ActionResult::error(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_health_payload_from_mcp_text_content() {
        let value = json!({
            "result": {
                "content": [{
                    "type": "text",
                    "text": "{\"success\":true,\"data\":{\"authenticated\":true}}"
                }]
            }
        });
        assert_eq!(find_bool_field(&value, "authenticated"), Some(true));
        assert!(!is_tool_error(&value));
    }

    #[test]
    fn recognizes_nested_tool_failure_and_extracts_message() {
        let value = json!({
            "result": {
                "content": [{
                    "type": "text",
                    "text": "{\"success\":false,\"error\":\"Authentication failed or was cancelled\"}"
                }]
            }
        });
        assert!(is_tool_error(&value));
        assert_eq!(
            tool_error_message(&value),
            "Authentication failed or was cancelled"
        );
    }

    #[test]
    fn byte_search_finds_cookie_names_without_decoding_sqlite() {
        let data = b"sqlite-prefix-SAPISID-value-__Secure-1PSID-suffix";
        assert!(contains_bytes(data, b"SAPISID"));
        assert!(!contains_bytes(data, b"APISID3"));
    }
}
