import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookOpen, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Book } from "../types";
import { getBookCoverDataUrl } from "../services/library-service";

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

type Props = {
  book: Book;
  onRemove: (book: Book) => Promise<void> | void;
};

export function BookCard({ book, onRemove }: Props) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    if (book.coverFilename) {
      void getBookCoverDataUrl(book.id).then((url) => {
        if (active) setCoverUrl(url);
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setCoverUrl(null);
    return () => {
      active = false;
    };
  }, [book.id, book.coverFilename]);

  const open = () => {
    if (book.isUnavailable) return;
    navigate(`/reader/${book.id}`);
  };

  return (
    <>
      <Card
        className={cn(
          "flex flex-col gap-3 overflow-hidden p-0 transition-colors",
          book.isUnavailable && "border-dashed opacity-70",
        )}
      >
        <div
          className={cn(
            "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-secondary to-muted",
          )}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={book.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground/30" />
          )}
          {book.isUnavailable && (
            <div className="absolute inset-0 flex items-end gap-1.5 bg-background/80 p-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">
                {t("library.unavailable")} {book.filePath}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 px-4 pb-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
            {book.title}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {book.author ?? t("library.unknownAuthor")}
          </p>
          {(book.sizeBytes || book.importedAt) && (
            <p className="line-clamp-1 text-[10px] text-muted-foreground/70">
              {[formatSize(book.sizeBytes), formatDate(book.importedAt)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={open}
              disabled={book.isUnavailable}
            >
              <BookOpen className="h-4 w-4" />
              {t("library.openReader")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("library.remove")}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("library.remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("library.removeConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {t("library.removeCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmOpen(false);
                await onRemove(book);
              }}
            >
              {t("library.removeConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
