import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { BookOpen, Loader2, Upload } from "lucide-react";
import { useLibrary } from "../hooks/use-library";
import { useLibraryStore } from "../hooks/use-library";
import { BookCard } from "../components/book-card";

export function LibraryPage() {
  const { t } = useTranslation();
  const { books, loading, importing, importMany, remove, lastImportErrors, clearImportErrors } =
    useLibrary();
  const pushImportError = useLibraryStore((s) => s.pushImportError);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = !loading && books.length === 0;

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[library] onFileChange fired");
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log("[library] no files selected");
      return;
    }
    const fileArr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".epub"));
    if (fileArr.length === 0) {
      pushImportError({ filename: "*", message: "Selected file is not .epub" });
      e.target.value = "";
      return;
    }
    console.log(`[library] importing ${fileArr.length} file(s)`);
    await importMany(fileArr);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.library")}</h1>
          <p className="text-sm text-muted-foreground">
            {books.length > 0 ? `${books.length} libro(s)` : t("library.empty")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 [&:has(input:disabled)]:pointer-events-none [&:has(input:disabled)]:opacity-50">
            {importing > 0 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("library.importing")} ({importing})
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {t("library.import")}
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,application/epub+zip"
              multiple
              onChange={onFileChange}
              className="sr-only"
              disabled={importing > 0}
            />
          </label>
        </div>
      </header>

      {lastImportErrors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-center justify-between gap-2">
            <span>
              {t("library.importErrors", { count: lastImportErrors.length })}
            </span>
            <button
              type="button"
              onClick={clearImportErrors}
              className="text-xs underline underline-offset-2"
            >
              {t("common.close")}
            </button>
          </div>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {lastImportErrors.slice(0, 5).map((e, i) => (
              <li key={i} className="truncate">
                {e.filename} — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">{t("library.empty")}</p>
          <p className="text-xs text-muted-foreground">{t("library.emptyHint")}</p>
        </div>
      )}

      {!isEmpty && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onRemove={() => remove(book.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
