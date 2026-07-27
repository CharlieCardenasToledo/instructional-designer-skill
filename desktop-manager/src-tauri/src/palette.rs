use crate::models::{PaletteColor, SitePalette};
use regex::Regex;
use reqwest::{redirect::Policy, Client, Response};
use scraper::{Html, Selector};
use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::Duration;
use url::Url;

const MAX_DOCUMENT_BYTES: usize = 5 * 1024 * 1024;
const MAX_STYLESHEETS: usize = 32;
const MAX_PALETTE_COLORS: usize = 20;

fn color_patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        [
            r"(?i)#[0-9a-f]{3,8}\b",
            r"(?i)rgba?\(\s*[^)]+\)",
            r"(?i)hsla?\(\s*[^)]+\)",
        ]
        .into_iter()
        .map(|pattern| Regex::new(pattern).expect("invalid color regex"))
        .collect()
    })
}

fn normalize_hex(value: &str) -> Option<String> {
    let hex = value.strip_prefix('#')?;
    match hex.len() {
        3 | 4 => {
            let mut result = String::from("#");
            for character in hex.chars().take(3) {
                result.push(character);
                result.push(character);
            }
            Some(result.to_ascii_lowercase())
        }
        6 | 8 => Some(format!("#{}", &hex[..6]).to_ascii_lowercase()),
        _ => None,
    }
}

fn normalize_color(value: &str) -> String {
    normalize_hex(value).unwrap_or_else(|| {
        value
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_ascii_lowercase()
    })
}

fn extract_colors(content: &str, colors: &mut HashMap<String, usize>) {
    for regex in color_patterns() {
        for matched in regex.find_iter(content) {
            let color = normalize_color(matched.as_str());
            *colors.entry(color).or_insert(0) += 1;
        }
    }
}

fn clean_site_name(value: &str) -> Option<String> {
    let cleaned = value.split_whitespace().collect::<Vec<_>>().join(" ");
    (!cleaned.is_empty() && cleaned.len() <= 180).then_some(cleaned)
}

fn organization_name(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Array(items) => items.iter().find_map(organization_name),
        serde_json::Value::Object(map) => {
            let organization_type = map
                .get("@type")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|kind| {
                    kind.eq_ignore_ascii_case("Organization")
                        || kind.eq_ignore_ascii_case("EducationalOrganization")
                        || kind.eq_ignore_ascii_case("CollegeOrUniversity")
                });
            if organization_type {
                if let Some(name) = map
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .and_then(clean_site_name)
                {
                    return Some(name);
                }
            }
            map.get("@graph")
                .and_then(organization_name)
                .or_else(|| map.values().find_map(organization_name))
        }
        _ => None,
    }
}

fn extract_site_name(document: &Html) -> Option<String> {
    if let Ok(selector) = Selector::parse(r#"script[type="application/ld+json"]"#) {
        for script in document.select(&selector) {
            let json = script.text().collect::<String>();
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
                if let Some(name) = organization_name(&value) {
                    return Some(name);
                }
            }
        }
    }

    for selector_text in [
        r#"meta[name="application-name"]"#,
        r#"meta[property="og:site_name"]"#,
        r#"meta[property="og:title"]"#,
    ] {
        if let Ok(selector) = Selector::parse(selector_text) {
            if let Some(name) = document
                .select(&selector)
                .find_map(|element| element.value().attr("content"))
                .and_then(clean_site_name)
            {
                return Some(name);
            }
        }
    }

    let selector = Selector::parse("title").ok()?;
    let title = document.select(&selector).next()?.text().collect::<String>();
    let title = title
        .split(['|', '–', '—'])
        .map(str::trim)
        .max_by_key(|part| part.len())
        .unwrap_or(title.trim());
    clean_site_name(title)
}

fn validate_remote_url(url: &Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("La URL debe usar HTTP o HTTPS.".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "La URL no contiene un dominio válido.".to_string())?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return Err("No se permiten direcciones locales.".to_string());
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        let private = match ip {
            IpAddr::V4(ip) => {
                ip.is_private()
                    || ip.is_loopback()
                    || ip.is_link_local()
                    || ip.is_broadcast()
                    || ip.is_unspecified()
            }
            IpAddr::V6(ip) => {
                ip.is_loopback() || ip.is_unspecified() || ip.is_unique_local()
            }
        };
        if private {
            return Err("No se permiten direcciones de red privadas.".to_string());
        }
    }
    Ok(())
}

async fn response_text(mut response: Response) -> Result<String, String> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_DOCUMENT_BYTES as u64)
    {
        return Err("El recurso remoto supera el límite de 5 MB.".to_string());
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("No se pudo leer la respuesta: {error}"))?
    {
        if bytes.len() + chunk.len() > MAX_DOCUMENT_BYTES {
            return Err("El recurso remoto supera el límite de 5 MB.".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

async fn fetch_text(client: &Client, url: Url) -> Result<String, String> {
    validate_remote_url(&url)?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("No se pudo descargar el recurso: {error}"))?
        .error_for_status()
        .map_err(|error| format!("El sitio respondió con un error: {error}"))?;
    validate_remote_url(response.url())?;
    response_text(response).await
}

pub async fn extract_site_palette(raw_url: String) -> Result<SitePalette, String> {
    let base_url = Url::parse(raw_url.trim())
        .map_err(|error| format!("La URL no es válida: {error}"))?;
    validate_remote_url(&base_url)?;

    let client = Client::builder()
        .user_agent("AcademiaOS Palette Extractor/1.0")
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(25))
        .redirect(Policy::limited(5))
        .build()
        .map_err(|error| format!("No se pudo preparar el cliente HTTP: {error}"))?;

    let html = fetch_text(&client, base_url.clone()).await?;
    let mut colors = HashMap::<String, usize>::new();
    extract_colors(&html, &mut colors);

    let (site_name, stylesheet_urls) = {
        let document = Html::parse_document(&html);
        let site_name = extract_site_name(&document);
        let selector = Selector::parse("link[href]")
            .map_err(|error| format!("No se pudo analizar el HTML: {error:?}"))?;
        let mut seen = HashSet::new();
        let urls = document
            .select(&selector)
            .filter(|element| {
                element
                    .value()
                    .attr("rel")
                    .is_some_and(|rel| rel.split_ascii_whitespace().any(|item| item.eq_ignore_ascii_case("stylesheet")))
            })
            .filter_map(|element| element.value().attr("href"))
            .filter_map(|href| base_url.join(href).ok())
            .filter(|url| validate_remote_url(url).is_ok())
            .filter(|url| seen.insert(url.as_str().to_string()))
            .take(MAX_STYLESHEETS)
            .collect::<Vec<_>>();
        (site_name, urls)
    };

    for stylesheet_url in stylesheet_urls {
        if let Ok(css) = fetch_text(&client, stylesheet_url).await {
            extract_colors(&css, &mut colors);
        }
    }

    let mut palette = colors
        .into_iter()
        .map(|(color, occurrences)| PaletteColor { color, occurrences })
        .collect::<Vec<_>>();
    palette.sort_by(|left, right| {
        right
            .occurrences
            .cmp(&left.occurrences)
            .then_with(|| left.color.cmp(&right.color))
    });
    palette.truncate(MAX_PALETTE_COLORS);

    if palette.is_empty() {
        return Err("No se encontraron colores en el HTML ni en sus hojas de estilo.".to_string());
    }
    Ok(SitePalette {
        site_name,
        colors: palette,
    })
}

#[cfg(test)]
mod tests {
    use super::{extract_colors, extract_site_name, normalize_hex, validate_remote_url};
    use scraper::Html;
    use std::collections::HashMap;
    use url::Url;

    #[test]
    fn normalizes_short_and_alpha_hex_colors() {
        assert_eq!(normalize_hex("#AbC"), Some("#aabbcc".to_string()));
        assert_eq!(normalize_hex("#123456cc"), Some("#123456".to_string()));
    }

    #[test]
    fn extracts_and_counts_supported_css_colors() {
        let mut colors = HashMap::new();
        extract_colors(
            "color:#fff; border:#FFFFFF; background:rgb(0, 121, 107); outline:hsl(10 20% 30%);",
            &mut colors,
        );
        assert_eq!(colors.get("#ffffff"), Some(&2));
        assert_eq!(colors.get("rgb(0, 121, 107)"), Some(&1));
        assert_eq!(colors.get("hsl(10 20% 30%)"), Some(&1));
    }

    #[test]
    fn rejects_local_and_private_targets() {
        assert!(validate_remote_url(&Url::parse("http://localhost:3000").unwrap()).is_err());
        assert!(validate_remote_url(&Url::parse("http://127.0.0.1").unwrap()).is_err());
        assert!(validate_remote_url(&Url::parse("https://uide.edu.ec").unwrap()).is_ok());
    }

    #[test]
    fn prefers_structured_organization_name() {
        let document = Html::parse_document(
            r#"<html><head>
            <title>Inicio | UIDE</title>
            <script type="application/ld+json">
              {"@type":"CollegeOrUniversity","name":"Universidad Internacional del Ecuador"}
            </script></head></html>"#,
        );
        assert_eq!(
            extract_site_name(&document),
            Some("Universidad Internacional del Ecuador".to_string())
        );
    }
}
