import { useTranslation } from "react-i18next";

export function LibraryPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.library")}</h1>
        <p className="text-muted-foreground text-sm">{t("library.empty")}</p>
      </header>
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground text-sm">shim — pendiente de implementar (Fase 1)</p>
      </div>
    </div>
  );
}
