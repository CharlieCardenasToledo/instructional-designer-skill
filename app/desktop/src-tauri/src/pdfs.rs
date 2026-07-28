use crate::models::{GeneratedPdf, PdfProjectRoot};
use crate::paths::path_text;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const MAX_SCAN_DEPTH: usize = 12;
const MAX_SCANNED_ENTRIES: usize = 10_000;

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

fn canonical_project_roots(projects: &[PdfProjectRoot]) -> Vec<PathBuf> {
    projects
        .iter()
        .filter_map(|project| {
            let path = PathBuf::from(project.project_path.trim());
            path.canonicalize().ok().filter(|path| path.is_dir())
        })
        .collect()
}

pub fn validated_pdf_path(raw_path: &str, projects: &[PdfProjectRoot]) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(raw_path.trim())
        .canonicalize()
        .map_err(|error| format!("No se pudo acceder al PDF: {error}"))?;
    if !candidate.is_file() || !is_pdf(&candidate) {
        return Err("El archivo seleccionado no es un PDF válido.".to_string());
    }
    if !canonical_project_roots(projects)
        .iter()
        .any(|root| candidate.starts_with(root))
    {
        return Err("El PDF no pertenece a un proyecto registrado en Jintia.".to_string());
    }
    Ok(candidate)
}

pub fn list_generated_pdfs(projects: Vec<PdfProjectRoot>) -> Vec<GeneratedPdf> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    let mut scanned_entries = 0usize;

    for project in projects {
        let root = match PathBuf::from(project.project_path.trim()).canonicalize() {
            Ok(path) if path.is_dir() => path,
            _ => continue,
        };
        let mut pending = vec![(root.clone(), 0usize)];

        while let Some((directory, depth)) = pending.pop() {
            if depth > MAX_SCAN_DEPTH || scanned_entries >= MAX_SCANNED_ENTRIES {
                continue;
            }
            let entries = match std::fs::read_dir(&directory) {
                Ok(entries) => entries,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                scanned_entries += 1;
                if scanned_entries > MAX_SCANNED_ENTRIES {
                    break;
                }
                let path = entry.path();
                let metadata = match std::fs::symlink_metadata(&path) {
                    Ok(metadata) if !metadata.file_type().is_symlink() => metadata,
                    _ => continue,
                };
                if metadata.is_dir() {
                    pending.push((path, depth + 1));
                    continue;
                }
                if !metadata.is_file() || !is_pdf(&path) {
                    continue;
                }

                let canonical = match path.canonicalize() {
                    Ok(path) if path.starts_with(&root) => path,
                    _ => continue,
                };
                let canonical_text = path_text(&canonical);
                if !seen.insert(canonical_text.clone()) {
                    continue;
                }
                let relative_path = canonical
                    .strip_prefix(&root)
                    .ok()
                    .map(path_text)
                    .unwrap_or_else(|| canonical_text.clone());
                let modified_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as u64)
                    .unwrap_or_default();
                results.push(GeneratedPdf {
                    course_code: project.course_code.clone(),
                    course_name: project.course_name.clone(),
                    name: canonical
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("documento.pdf")
                        .to_string(),
                    path: canonical_text,
                    relative_path,
                    size_bytes: metadata.len(),
                    modified_ms,
                });
            }
        }
    }

    results.sort_by(|left, right| {
        right
            .modified_ms
            .cmp(&left.modified_ms)
            .then_with(|| left.name.cmp(&right.name))
    });
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pdf_extension_is_case_insensitive() {
        assert!(is_pdf(Path::new("guia.pdf")));
        assert!(is_pdf(Path::new("GUIA.PDF")));
        assert!(!is_pdf(Path::new("main.tex")));
        assert!(!is_pdf(Path::new("pdf.txt")));
    }
}
