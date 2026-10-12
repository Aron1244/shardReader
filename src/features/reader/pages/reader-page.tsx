import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Settings, TableOfContents } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import type { Book } from "@/features/library/types";
import { readBookBytes } from "@/features/library/services/library-service";
import "foliate-js/view.js";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function ReaderPage() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus({ kind: "error", message: "No book id" });
      return;
    }
    let cancelled = false;
    setStatus({ kind: "loading" });

    void (async () => {
      try {
        const all = await invoke<Book[]>("list_books");
        const found = all.find((b) => b.id === bookId) ?? null;
        if (cancelled) return;
        if (!found) {
          setStatus({ kind: "error", message: t("reader.openBook") });
          return;
        }
        setBook(found);

        const bytes = await readBookBytes(bookId);
        if (cancelled) return;

        const blob = new Blob([new Uint8Array(bytes)], {
          type: "application/epub+zip",
        });
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;

        const container = containerRef.current;
        if (!container) {
          URL.revokeObjectURL(url);
          setStatus({ kind: "error", message: "Mount point missing" });
          return;
        }

        const view = document.createElement("foliate-view");
        view.setAttribute("flow", "paginated");
        view.style.height = "100%";
        view.style.width = "100%";
        view.style.display = "block";

        container.replaceChildren(view);
        viewRef.current = view;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (view as any).open(url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (view as any).goTo(0);

        if (!cancelled) setStatus({ kind: "ready" });
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, t]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Back to library">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-sm font-semibold leading-tight">
            {book?.title ?? "..."}
          </h1>
          {book?.author && (
            <p className="truncate text-xs text-muted-foreground">{book.author}</p>
          )}
        </div>
        {status.kind === "ready" && (
          <>
            <Button variant="ghost" size="icon" title="Table of contents" disabled>
              <TableOfContents className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Reading settings" disabled>
              <Settings className="h-4 w-4" />
            </Button>
          </>
        )}
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />

        {status.kind === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        )}

        {status.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-4 text-center">
            <p className="text-sm font-medium text-destructive">{t("reader.openBook")}</p>
            <p className="max-w-md text-xs text-muted-foreground">{status.message}</p>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                {t("nav.library")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
