import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";

const options = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="bg-background inline-flex rounded-md border p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={active}
            aria-label={opt.label}
            className={
              "inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors " +
              (active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
