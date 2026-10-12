use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use roxmltree::Document;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const MAX_EPUB_BYTES: usize = 100 * 1024 * 1024;
const LIBRARY_SUBDIR: &str = "library";
const COVERS_SUBDIR: &str = "covers";
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
    pub cover_filename: Option<String>,
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
    let mut cursor = Cursor::new(bytes);
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

fn find_cover_entry<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    opf_path_str: &str,
    opf_xml: &str,
) -> Result<Option<(String, String, String)>, String> {
    let opf = Document::parse(opf_xml).map_err(|e| format!("Cannot parse OPF: {e}"))?;

    let mut items: HashMap<String, (String, String)> = HashMap::new();
    for node in opf.descendants() {
        if node.tag_name().name().eq_ignore_ascii_case("item") {
            if let (Some(id), Some(href), Some(mt)) = (
                node.attribute("id"),
                node.attribute("href"),
                node.attribute("media-type"),
            ) {
                items.insert(
                    id.to_string(),
                    (href.to_string(), mt.to_string()),
                );
            }
        }
    }

    let meta_cover_id = opf
        .descendants()
        .find(|n| {
            n.tag_name().name().eq_ignore_ascii_case("meta")
                && n.attribute("name").is_some_and(|v| v.eq_ignore_ascii_case("cover"))
        })
        .and_then(|n| n.attribute("content").map(|s| s.to_string()));

    let cover_id = meta_cover_id.or_else(|| {
        let mut best: Option<(String, bool)> = None;
        for (id, (_, mt)) in &items {
            if mt.starts_with("image/") {
                let lower = id.to_lowercase();
                let is_cover = lower.contains("cover") || lower.contains("title");
                let should_take = match &best {
                    None => true,
                    Some((_, false)) => is_cover,
                    Some((_, true)) => false,
                };
                if should_take {
                    best = Some((id.clone(), is_cover));
                }
            }
        }
        best.map(|(id, _)| id)
    });

    let Some(cover_id) = cover_id else {
        return Ok(None);
    };
    let (href, media_type) = match items.get(&cover_id) {
        Some(v) => v.clone(),
        None => return Ok(None),
    };
    if !media_type.starts_with("image/") {
        return Ok(None);
    }

    let opf_dir = Path::new(opf_path_str)
        .parent()
        .and_then(|p| p.to_str())
        .filter(|s| !s.is_empty())
        .map(|s| format!("{s}/"))
        .unwrap_or_default();

    let candidates = [format!("{opf_dir}{href}"), href.to_string()];

    let all_names: Vec<String> = (0..archive.len())
        .map(|i| {
            archive
                .by_index(i)
                .map(|f| f.name().to_string())
                .unwrap_or_default()
        })
        .collect();

    let mut found: Option<String> = None;
    for candidate in &candidates {
        if all_names.iter().any(|n| n == candidate) {
            found = Some(candidate.clone());
            break;
        }
    }

    if found.is_none() {
        let target = Path::new(href.as_str())
            .file_name()
            .and_then(|s| s.to_str());
        if let Some(target_name) = target {
            for name in &all_names {
                if Path::new(name).file_name().and_then(|s| s.to_str()) == Some(target_name) {
                    found = Some(name.clone());
                    break;
                }
            }
        }
    }

    Ok(found.map(|n| (n, href, media_type)))
}

fn read_cover_bytes<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry_name: &str,
) -> Result<Vec<u8>, String> {
    let mut entry = archive
        .by_name(entry_name)
        .map_err(|e| format!("entry {entry_name} not found: {e}"))?;
    let mut bytes = Vec::new();
    entry
        .read_to_end(&mut bytes)
        .map_err(|e| format!("cannot read {entry_name}: {e}"))?;
    Ok(bytes)
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/svg+xml" => "svg",
        "image/avif" => "avif",
        _ => "img",
    }
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

fn now_unix() -> String {
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
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create library dir: {e}"))?;
    std::fs::create_dir_all(dir.join(COVERS_SUBDIR))
        .map_err(|e| format!("Cannot create covers dir: {e}"))?;
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

    let id = uuid::Uuid::new_v4().to_string();
    let dir = library_dir(&app)?;
    let safe_name = sanitize_filename(&filename);
    let target = dir.join(format!("{id}-{safe_name}"));

    // Open archive once and extract both metadata and cover.
    let mut cursor = Cursor::new(bytes.as_slice());
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
    let opf_doc = Document::parse(&opf_xml).map_err(|e| format!("Cannot parse OPF: {e}"))?;

    // Metadata from OPF.
    let title = first_element_text(&opf_doc, &["title"]).unwrap_or_else(|| "Untitled".to_string());
    let author = first_element_text(&opf_doc, &["creator", "author"]);
    let language = first_element_text(&opf_doc, &["language"]).unwrap_or_default();
    let identifier = first_element_text(&opf_doc, &["identifier"]);

    // Cover detection (still using same archive).
    let cover_info = find_cover_entry(&mut archive, &opf_path, &opf_xml).unwrap_or(None);
    let cover_filename = if let Some((entry_name, _href, media_type)) = cover_info {
        let ext = ext_for_mime(&media_type);
        let cover_name = format!("{id}.{ext}");
        let cover_path = dir.join(COVERS_SUBDIR).join(&cover_name);
        match read_cover_bytes(&mut archive, &entry_name) {
            Ok(cover_bytes) => {
                if let Err(e) = std::fs::write(&cover_path, &cover_bytes) {
                    eprintln!("[rust] cover write failed: {e}");
                    None
                } else {
                    Some(cover_name)
                }
            }
            Err(e) => {
                eprintln!("[rust] cover read failed: {e}");
                None
            }
        }
    } else {
        None
    };

    // Write the EPUB file.
    {
        let mut file = std::fs::File::create(&target)
            .map_err(|e| format!("Cannot create target file: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("Cannot write target file: {e}"))?;
        file.flush().ok();
    }

    let book = ImportedBook {
        id,
        title,
        author,
        language: if language.is_empty() {
            None
        } else {
            Some(language)
        },
        identifier,
        size_bytes: bytes.len() as u64,
        file_path: target.to_string_lossy().to_string(),
        cover_filename,
        imported_at: now_unix(),
        is_unavailable: false,
    };

    let mut books = read_index(&app)?;
    books.insert(0, book.clone());
    write_index(&app, &books)?;

    eprintln!(
        "[rust] import_epub_from_bytes: SUCCESS id={} cover={:?}",
        book.id, book.cover_filename
    );
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
    let removed = books.iter().find(|b| b.id == id).cloned();
    books.retain(|b| b.id != id);
    write_index(&app, &books)?;
    if let Some(b) = removed {
        let _ = std::fs::remove_file(&b.file_path);
        if let Some(c) = b.cover_filename {
            let _ = std::fs::remove_file(library_dir(&app)?.join(COVERS_SUBDIR).join(c));
        }
    }
    Ok(())
}

#[tauri::command]
fn get_book_cover(
    app: AppHandle,
    id: String,
) -> Result<Option<(Vec<u8>, String)>, String> {
    let books = read_index(&app)?;
    let Some(book) = books.iter().find(|b| b.id == id) else {
        return Ok(None);
    };
    let Some(cover_name) = &book.cover_filename else {
        return Ok(None);
    };
    let path = library_dir(&app)?.join(COVERS_SUBDIR).join(cover_name);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("read cover: {e}"))?;
    let mime = match path.extension().and_then(|s| s.to_str()).unwrap_or("img") {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    };
    Ok(Some((bytes, mime.to_string())))
}

#[tauri::command]
fn read_book_bytes(app: AppHandle, id: String) -> Result<Vec<u8>, String> {
    let books = read_index(&app)?;
    let book = books
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| "Book not found".to_string())?;
    std::fs::read(&book.file_path).map_err(|e| format!("Cannot read book file: {e}"))
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
            remove_book,
            get_book_cover,
            read_book_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// (no additional helpers needed)
