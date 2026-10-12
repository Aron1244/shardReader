import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Book } from "@/features/library/types";

export function ReaderPage() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(!!bookId);

  useEffect(() => {
    let active = true;
    if (!bookId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    void (async () => {
      const all = await invoke<Book[]>("list_books");
      if (active) {
        setBook(all.find((b) => b.id === bookId) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Construction className="h-12 w-12 text-muted-foreground/40" />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {loading
            ? t("common.loading")
            : book
              ? book.title
              : t("reader.openBook")}
        </h1>
        {book?.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
      </div>

      <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          El lector EPUB (foliate-js + controles de tipografía, tema claro/oscuro/sepia,
          progreso) viene en <strong className="text-foreground">Fase 2</strong>.
        </p>
        <p className="text-[10px]">
          Spec: <code>Fase 2: experiencia de lectura</code> — render EPUB, navegar por capítulos
          y páginas, tabla de contenidos, cambiar tipografía, tamaño, interlineado, márgenes, temas.
        </p>
      </div>

      {bookId && (
        <Button asChild variant="outline">
          <Link to="/">
            <BookOpen className="h-4 w-4" />
            {t("nav.library")}
          </Link>
        </Button>
      )}
    </div>
  );
}
