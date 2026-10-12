use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use roxmltree::Document;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const MAX_EPUB_BYTES: usize = 100 * 1024 * 1024;
const LIBRARY_SUBDIR: &str = "library";
const INDEX_FILE: &str = "index.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BookMetadata {
    pub title: String,
    pub author: Option<String>,
    pub language: String,
    pub identifier: Option<String>,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ImportedBook {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub language: Option<String>,
    pub identifier: Option<String>,
    pub size_bytes: u64,
    pub file_path: String,
    pub imported_at: String,
    pub is_unavailable: bool,
}

fn collect_text(node: roxmltree::Node) -> String {
    node.descendants()
        .filter(|n| n.is_text())
        .filter_map(|n| n.text())
        .collect::<Vec<_>>()
        .join("")
        .trim()
        .to_string()
}

fn first_element_text(doc: &Document, local_names: &[&str]) -> Option<String> {
    for name in local_names {
        for node in doc.descendants() {
            if node.tag_name().name().eq_ignore_ascii_case(name) {
                let text = collect_text(node);
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}

fn read_zip_string<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
) -> Result<String, String> {
    let mut entry = archive
        .by_name(name)
        .map_err(|e| format!("entry {name} not found: {e}"))?;
    let mut s = String::new();
    entry
        .read_to_string(&mut s)
        .map_err(|e| format!("cannot read {name}: {e}"))?;
    Ok(s)
}

fn read_metadata_from_bytes(bytes: &[u8]) -> Result<BookMetadata, String> {
    let metadata_len = bytes.len() as u64;
    let mut cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(&mut cursor)
        .map_err(|e| format!("Not a valid ZIP/EPUB: {e}"))?;

    let container_xml = read_zip_string(&mut archive, "META-INF/container.xml")?;
    let container = Document::parse(&container_xml)
        .map_err(|e| format!("Cannot parse container.xml: {e}"))?;

    let opf_path = container
        .descendants()
        .find(|n| n.has_tag_name("rootfile"))
        .and_then(|n| n.attribute("full-path"))
        .ok_or_else(|| "No OPF rootfile found in container.xml".to_string())?
        .to_string();

    let opf_xml = read_zip_string(&mut archive, &opf_path)?;
    let opf = Document::parse(&opf_xml).map_err(|e| format!("Cannot parse OPF: {e}"))?;

    let title = first_element_text(&opf, &["title"]).unwrap_or_else(|| "Untitled".to_string());

    Ok(BookMetadata {
        title,
        author: first_element_text(&opf, &["creator", "author"]),
        language: first_element_text(&opf, &["language"]).unwrap_or_default(),
        identifier: first_element_text(&opf, &["identifier"]),
        size_bytes: metadata_len,
    })
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;
    let dir = app_data.join(LIBRARY_SUBDIR);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create library dir: {e}"))?;
    Ok(dir)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_dir(app)?.join(INDEX_FILE))
}

fn read_index(app: &AppHandle) -> Result<Vec<ImportedBook>, String> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read index: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    let books: Vec<ImportedBook> =
        serde_json::from_str(&raw).map_err(|e| format!("Cannot parse index: {e}"))?;
    Ok(books)
}

fn write_index(app: &AppHandle, books: &[ImportedBook]) -> Result<(), String> {
    let path = index_path(app)?;
    let raw = serde_json::to_string_pretty(books)
        .map_err(|e| format!("Cannot serialize index: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("Cannot write index: {e}"))?;
    Ok(())
}

#[tauri::command]
fn import_epub_from_bytes(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<ImportedBook, String> {
    eprintln!(
        "[rust] import_epub_from_bytes: filename={filename:?} bytes={}",
        bytes.len()
    );

    if bytes.is_empty() {
        return Err("Empty file".into());
    }
    if bytes.len() > MAX_EPUB_BYTES {
        return Err(format!(
            "File too large ({} bytes, limit is {} MB)",
            bytes.len(),
            MAX_EPUB_BYTES / 1024 / 1024
        ));
    }

    let metadata = read_metadata_from_bytes(&bytes)?;

    let dir = library_dir(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let safe_name = sanitize_filename(&filename);
    let target = dir.join(format!("{id}-{safe_name}"));

    {
        let mut file = std::fs::File::create(&target)
            .map_err(|e| format!("Cannot create target file: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("Cannot write target file: {e}"))?;
        file.flush().ok();
    }

    let book = ImportedBook {
        id,
        title: metadata.title,
        author: metadata.author,
        language: if metadata.language.is_empty() {
            None
        } else {
            Some(metadata.language)
        },
        identifier: metadata.identifier,
        size_bytes: metadata.size_bytes,
        file_path: target.to_string_lossy().to_string(),
        imported_at: now_iso(),
        is_unavailable: false,
    };

    let mut books = read_index(&app)?;
    books.insert(0, book.clone());
    write_index(&app, &books)?;

    eprintln!("[rust] import_epub_from_bytes: SUCCESS, id={}, title={:?}", book.id, book.title);
    Ok(book)
}

#[tauri::command]
fn read_epub_metadata(path: String) -> Result<BookMetadata, String> {
    let p = Path::new(&path);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if ext != "epub" {
        return Err(format!("Unsupported file extension: .{ext}"));
    }
    let bytes = std::fs::read(p).map_err(|e| format!("Cannot read file: {e}"))?;
    read_metadata_from_bytes(&bytes)
}

#[tauri::command]
fn check_file_exists(path: String) -> Result<bool, String> {
    Path::new(&path)
        .try_exists()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_books(app: AppHandle) -> Result<Vec<ImportedBook>, String> {
    let mut books = read_index(&app)?;
    books.sort_by(|a, b| b.imported_at.cmp(&a.imported_at));
    for book in books.iter_mut() {
        book.is_unavailable = !Path::new(&book.file_path).exists();
    }
    Ok(books)
}

#[tauri::command]
fn remove_book(app: AppHandle, id: String) -> Result<(), String> {
    let mut books = read_index(&app)?;
    let mut removed_file: Option<String> = None;
    if let Some(pos) = books.iter().position(|b| b.id == id) {
        let removed = books.remove(pos);
        removed_file = Some(removed.file_path);
    }
    write_index(&app, &books)?;
    if let Some(p) = removed_file {
        let _ = std::fs::remove_file(&p);
    }
    Ok(())
}

#[tauri::command]
fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        eprintln!("\n=========== RUST PANIC ===========");
        if let Some(loc) = info.location() {
            eprintln!("  at {}:{}:{}", loc.file(), loc.line(), loc.column());
        }
        if let Some(s) = info.payload().downcast_ref::<&str>() {
            eprintln!("  message: {s}");
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            eprintln!("  message: {s}");
        }
        eprintln!("==================================\n");
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            read_epub_metadata,
            import_epub_from_bytes,
            check_file_exists,
            list_books,
            remove_book
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
