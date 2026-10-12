import { useEffect } from "react";
import { create } from "zustand";
import { type Book } from "../types";
import {
  importBooksFromFiles as importBatch,
  listBooks,
  removeBook as removeBookService,
} from "../services/library-service";

type ImportError = { filename: string; message: string };

type LibraryState = {
  books: Book[];
  loading: boolean;
  importing: number;
  lastImportErrors: ImportError[];
  load: () => Promise<void>;
  importMany: (files: File[]) => Promise<{ added: Book[]; errors: ImportError[] }>;
  remove: (id: string) => Promise<void>;
  clearImportErrors: () => void;
  pushImportError: (err: ImportError) => void;
};

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  loading: false,
  importing: 0,
  lastImportErrors: [],

  load: async () => {
    set({ loading: true });
    try {
      const books = await listBooks();
      set({ books });
    } finally {
      set({ loading: false });
    }
  },

  importMany: async (files: File[]) => {
    set((s) => ({ importing: s.importing + files.length }));
    try {
      const { imported, errors } = await importBatch(files);
      const newIds = new Set(imported.map((b) => b.id));
      set((s) => ({
        books: [...imported, ...s.books.filter((b) => !newIds.has(b.id))],
        lastImportErrors: [...s.lastImportErrors, ...errors],
      }));
      return { added: imported, errors };
    } finally {
      set((s) => ({ importing: Math.max(0, s.importing - files.length) }));
    }
  },

  remove: async (id: string) => {
    await removeBookService(id);
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
  },

  clearImportErrors: () => set({ lastImportErrors: [] }),

  pushImportError: (err) =>
    set((s) => ({ lastImportErrors: [...s.lastImportErrors, err] })),
}));

export function useLibrary() {
  const books = useLibraryStore((s) => s.books);
  const loading = useLibraryStore((s) => s.loading);
  const importing = useLibraryStore((s) => s.importing);
  const lastImportErrors = useLibraryStore((s) => s.lastImportErrors);
  const load = useLibraryStore((s) => s.load);
  const importMany = useLibraryStore((s) => s.importMany);
  const remove = useLibraryStore((s) => s.remove);
  const clearImportErrors = useLibraryStore((s) => s.clearImportErrors);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    books,
    loading,
    importing,
    lastImportErrors,
    importMany,
    remove,
    clearImportErrors,
  };
}
