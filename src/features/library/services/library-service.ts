import { invoke } from "@tauri-apps/api/core";
import { type Book } from "../types";

type RustImportedBook = {
  id: string;
  title: string;
  author: string | null;
  language: string | null;
  identifier: string | null;
  size_bytes: number;
  file_path: string;
  cover_filename: string | null;
  imported_at: string;
  is_unavailable: boolean;
};

function rustBookToBook(r: RustImportedBook): Book {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    language: r.language,
    filePath: r.file_path,
    format: "epub",
    sizeBytes: r.size_bytes,
    coverFilename: r.cover_filename,
    importedAt: r.imported_at,
    lastOpenedAt: null,
    isUnavailable: r.is_unavailable,
  };
}

export async function importBookFile(file: File): Promise<Book> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await invoke<RustImportedBook>("import_epub_from_bytes", {
    filename: file.name,
    bytes: Array.from(bytes),
  });
  return rustBookToBook(result);
}

export async function listBooks(): Promise<Book[]> {
  const rows = await invoke<RustImportedBook[]>("list_books");
  return rows.map(rustBookToBook);
}

export async function removeBook(id: string): Promise<void> {
  await invoke("remove_book", { id });
}

const coverCache = new Map<string, string>();

export async function getBookCoverDataUrl(id: string): Promise<string | null> {
  const cached = coverCache.get(id);
  if (cached !== undefined) return cached || null;

  const result = await invoke<[number[], string] | null>("get_book_cover", { id });
  if (!result) {
    coverCache.set(id, "");
    return null;
  }
  const [bytes, mime] = result;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const dataUrl = `data:${mime};base64,${btoa(bin)}`;
  coverCache.set(id, dataUrl);
  return dataUrl;
}

export function clearCoverCache(id?: string) {
  if (id) coverCache.delete(id);
  else coverCache.clear();
}

export async function importBooksFromFiles(files: File[]): Promise<{
  imported: Book[];
  errors: { filename: string; message: string }[];
}> {
  const imported: Book[] = [];
  const errors: { filename: string; message: string }[] = [];
  for (const file of files) {
    try {
      const book = await importBookFile(file);
      imported.push(book);
    } catch (err) {
      errors.push({
        filename: file.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { imported, errors };
}
