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
