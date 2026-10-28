import { useMemo, useState } from "react";
import { PLATFORMS, CATEGORIES, type Category, type Platform } from "@/lib/classify";
import { useData } from "@/lib/data";
import { useLang, useT } from "@/lib/i18n";
import { CATEGORY_COLOR } from "@/lib/meta";
import { CubeIcon, GithubIcon, PLATFORM_ICON } from "./Icons";
import ProjectCard from "./ProjectCard";
import ThemePicker from "./ThemePicker";

const ALL_CATEGORIES: Category[] = [...CATEGORIES, "other"];

export default function CleanView({ onWalk }: { onWalk: () => void }) {
  const { t, category, platform } = useT();
  const { lang, setLang } = useLang();
  const { projects, user, ready } = useData();
  const [plat, setPlat] = useState<Platform | null>(null);
  const [cat, setCat] = useState<Category | null>(null);

  const byPlatform = useMemo(() => (plat ? projects.filter((p) => p.platforms.includes(plat)) : projects), [projects, plat]);
  const shown = useMemo(() => (cat ? byPlatform.filter((p) => p.category === cat) : byPlatform), [byPlatform, cat]);
  const platCount = (p: Platform) => projects.filter((x) => x.platforms.includes(p)).length;
  const catCount = (c: Category) => byPlatform.filter((x) => x.category === c).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-tile bg-text-primary font-mono text-xs text-canvas">FD</span>
            <span className="hidden sm:inline">Florian Daunay</span>
          </a>
          <div className="ml-auto flex items-center gap-1">
            <button className="icon-btn w-auto px-2.5 font-mono text-xs font-medium uppercase" onClick={() => setLang(lang === "fr" ? "en" : "fr")} aria-label="Language">
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <ThemePicker />
            {user && (
              <a className="icon-btn" href={`https://github.com/${user}`} target="_blank" rel="noreferrer" aria-label="GitHub">
                <GithubIcon />
              </a>
            )}
            <button className="btn btn-primary ml-2" onClick={onWalk}>
              <CubeIcon /> {t("explore")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="pb-10 pt-16 sm:pt-24">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Florian Daunay<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 text-lg text-text-secondary sm:text-xl">{t("tagline")}</p>
          <div className="mt-6 flex gap-6 font-mono text-sm text-text-muted">
            <span>
              <b className="font-medium text-text-primary">{projects.length}</b> {t("projects")}
            </span>
            {PLATFORMS.filter((p) => platCount(p) > 0).map((p) => {
              const Icon = PLATFORM_ICON[p];
              return (
                <span key={p} className="hidden items-center gap-1.5 sm:flex" title={platform(p)}>
                  <Icon width={14} height={14} /> {platCount(p)}
                </span>
              );
            })}
          </div>
        </section>

        <nav className="sticky top-14 z-10 -mx-4 mb-8 space-y-2 bg-canvas/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            <button className="chip" aria-pressed={plat === null} onClick={() => setPlat(null)}>
              {t("all")}
            </button>
            {PLATFORMS.filter((p) => platCount(p) > 0).map((p) => {
              const Icon = PLATFORM_ICON[p];
              return (
                <button key={p} className="chip" aria-pressed={plat === p} onClick={() => setPlat(plat === p ? null : p)}>
                  <Icon width={14} height={14} /> {platform(p)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {ALL_CATEGORIES.filter((c) => catCount(c) > 0).map((c) => (
              <button key={c} className="chip text-xs" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />
                {category(c)}
                <span className="font-mono opacity-60">{catCount(c)}</span>
              </button>
            ))}
          </div>
        </nav>

        {ready && shown.length === 0 && <p className="py-20 text-center text-text-muted">{t("empty")}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" key={`${plat}-${cat}`}>
          {shown.map((p, i) => (
            <ProjectCard key={p.name} project={p} index={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
