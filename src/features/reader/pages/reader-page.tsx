import { useTranslation } from "react-i18next";

export function ReaderPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">{t("reader.openBook")}</p>
    </div>
  );
}
