import { useEffect, useRef, useState } from "react";
import { themeToStyle, themes, useActiveTheme, useThemeStore } from "@/themes";
import { useT } from "@/lib/i18n";
import { PaletteIcon } from "./Icons";

export default function ThemePicker() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = useActiveTheme();
  const { selectTheme, followSystem, setFollowSystem } = useThemeStore();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={t("theme")} title={t("theme")} aria-expanded={open}>
        <PaletteIcon />
      </button>
      {open && (
        <div className="surface absolute right-0 top-full z-30 mt-2 w-72 rounded-card p-2 shadow-overlay">
          <label className="flex cursor-pointer items-center justify-between rounded-control px-2.5 py-2 text-sm hover:bg-surface-hover">
            {t("system")}
            <input type="checkbox" checked={followSystem} onChange={(e) => setFollowSystem(e.target.checked)} className="accent-[rgb(var(--color-accent))]" />
          </label>
          <div className="my-1 h-px bg-border" />
          <ul className="max-h-80 overflow-y-auto">
            {themes.map((th) => (
              <li key={th.id}>
                <button
                  onClick={() => selectTheme(th.id)}
                  className={`flex w-full items-center gap-3 rounded-control px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover ${th.id === active.id ? "font-semibold" : ""}`}
                >
                  <span style={themeToStyle(th)} className="flex h-5 w-8 shrink-0 overflow-hidden rounded-[4px] border border-border">
                    <span className="flex-1 bg-canvas" />
                    <span className="flex-1 bg-surface" />
                    <span className="flex-1 bg-accent" />
                  </span>
                  {th.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
