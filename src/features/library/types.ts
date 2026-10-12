export type BookFormat = "epub" | "fb2" | "mobi" | "azw3" | "unknown";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  language: string | null;
  filePath: string;
  format: BookFormat;
  sizeBytes: number | null;
  coverFilename: string | null;
  importedAt: string;
  lastOpenedAt: string | null;
  isUnavailable: boolean;
};
