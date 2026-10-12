import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  TableOfContents,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import type { Book } from "@/features/library/types";
import { readBookBytes } from "@/features/library/services/library-service";
import "foliate-js/view.js";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type Location = {
  index: number;
  fraction: number;
  cfi: string | null;
  tocItem: { label: string } | null;
  pageItem?: { label?: string } | null;
  page: number | null;
  pages: number | null;
};

export function ReaderPage() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [location, setLocation] = useState<Location | null>(null);
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = view as any;

        container.replaceChildren(view);
        viewRef.current = view;

        await v.open(url);

        // The foliate-js demo (reader.js) uses `pageItem.label` from the
        // relocate event detail to display the current page. `pageItem`
        // comes from the EPUB's own page list (the `<nav epub:type="page-list">`
        // landmark in the OPF), so the label is the actual book page number.
        // For EPUBs that don't include a page list, we fall back to foliate's
        // location units (`location.current` / `location.total`) which are
        // a consistent book-wide byte/1500 metric that never resets per
        // section. Both numbers are in the same units and monotonically grow.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const book = v.book as
          | { pageList?: unknown[]; sections?: unknown[] }
          | undefined;
        const totalPages = book?.pageList?.length
          ? book.pageList.length
          : null;

        v.addEventListener("relocate", (e: { detail: Location & { cfi: string } }) => {
          const detail = e.detail as Location & {
            cfi: string;
            location?: { current?: number; total?: number };
            pageItem?: { label?: string } | null;
          };
          const pageItemLabel = detail.pageItem?.label ?? null;
          let currentPageNum: number | null = null;
          if (pageItemLabel) {
            const parsed = Number.parseInt(String(pageItemLabel), 10);
            if (!Number.isNaN(parsed)) currentPageNum = parsed;
          }
          if (currentPageNum == null) {
            currentPageNum = detail.location?.current ?? null;
          }

          setLocation({
            index: detail.index,
            fraction: detail.fraction ?? 0,
            cfi: detail.cfi ?? null,
            tocItem: detail.tocItem ?? null,
            page: currentPageNum,
            pages: totalPages ?? detail.location?.total ?? null,
          });
        });

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

  useEffect(() => {
    if (status.kind !== "ready") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignore when the user is typing in an input/textarea/contenteditable,
      // so future settings panel inputs don't get hijacked.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = viewRef.current as any;
      if (!v) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          v.prev();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          v.next();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status.kind]);

  const goPrev = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewRef.current as any)?.prev();
  };
  const goNext = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewRef.current as any)?.next();
  };

  const percent = Math.round((location?.fraction ?? 0) * 100);
  const showToolbar = status.kind === "ready";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Back to library">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-sm font-semibold leading-tight">
            {book?.title ?? "..."}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {location?.tocItem?.label ??
              book?.author ??
              (bookId ? "" : "")}
          </p>
        </div>
        {showToolbar && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground">
                {location?.page != null && location?.pages != null
                  ? `p. ${location.page} / ${location.pages}`
                  : "—"}
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="tabular-nums w-8 text-right">{percent}%</span>
            </div>
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
