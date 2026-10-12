import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Library, Settings } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { to: "/", icon: Library, key: "library", end: true },
  { to: "/reader", icon: BookOpen, key: "reader", end: false },
  { to: "/settings", icon: Settings, key: "settings", end: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="bg-background text-foreground flex h-screen w-screen overflow-hidden">
      <aside className="flex h-full w-56 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center px-4 text-sm font-semibold tracking-wide">
          {t("app.name")}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="flex h-14 items-center justify-between border-t px-3">
          <span className="text-muted-foreground text-xs">v0.1.0</span>
          <ModeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
