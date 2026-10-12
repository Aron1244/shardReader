import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "@/i18n";
import { useTheme } from "@/components/layout/theme-provider";

export function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const current = i18n.language;
  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.settings")}</h1>
      </header>

      <section className="flex max-w-md flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="language">
          {t("settings.language")}
        </label>
        <p className="text-muted-foreground text-xs">{t("settings.languageHint")}</p>
        <select
          id="language"
          value={SUPPORTED_LANGUAGES.find((l) => current.startsWith(l)) ?? "en"}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
          className="bg-background h-9 rounded-md border px-2 text-sm"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>
      </section>

      <section className="flex max-w-md flex-col gap-2">
        <span className="text-sm font-medium">{t("settings.theme")}</span>
        <p className="text-muted-foreground text-xs">{t("settings.themeHint")}</p>
        <div className="bg-background inline-flex w-fit rounded-md border p-0.5">
          {(["light", "dark", "system"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={
                "inline-flex h-7 items-center rounded-sm px-2 text-xs transition-colors " +
                (theme === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {value}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
