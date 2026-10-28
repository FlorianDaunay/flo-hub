import { useEffect, useMemo, useState } from "react";
import { PLATFORMS, CATEGORIES, type Category, type Platform, type Project } from "@/lib/classify";
import { useData } from "@/lib/data";
import { HERO_WORDS, useLang, useT } from "@/lib/i18n";
import { CATEGORY_COLOR, FEATURED } from "@/lib/meta";
import { CubeIcon, GithubIcon, PLATFORM_ICON } from "./Icons";
import ProjectCard, { FeatureCard } from "./ProjectCard";
import ThemePicker from "./ThemePicker";

const ALL_CATEGORIES: Category[] = [...CATEGORIES, "other"];

function RotatingWord() {
  const { lang } = useT();
  const words = HERO_WORDS[lang];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <span className="word-swap font-display font-normal italic">
      {words.map((w, k) => (
        <span key={w} data-on={k === i} className="bg-gradient-to-r from-[#ff3dcb] via-[#a66bff] to-[#3da9ff] bg-clip-text pr-2 text-transparent">
          {w}
        </span>
      ))}
    </span>
  );
}

/** Three screenshots fanned out like prints on a desk. */
function Fan({ projects }: { projects: Project[] }) {
  const shots = projects.filter((p) => p.screenshot).slice(0, 3);
  const pose = ["-rotate-6 -translate-x-10 translate-y-6", "rotate-3 translate-x-8 -translate-y-2", "-rotate-1 translate-y-10"];
  return (
    <div className="relative hidden h-[22rem] lg:block" aria-hidden>
      {shots.map((p, i) => (
        // Outer element holds the pose; the inner one animates (both use transform).
        <div key={p.name} className={`absolute left-1/2 top-1/2 -ml-[13rem] -mt-[8rem] w-[26rem] transition duration-500 hover:!z-10 hover:rotate-0 hover:scale-105 ${pose[i]}`} style={{ zIndex: i }}>
          <div className="rise overflow-hidden rounded-card border border-border bg-surface shadow-overlay" style={{ animationDelay: `${200 + i * 140}ms` }}>
            <div className="frame-bar">
              <i />
              <i />
              <i />
            </div>
            <img src={`${import.meta.env.BASE_URL}${p.screenshot}`} alt="" className="aspect-[16/10] w-full object-cover object-top" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CleanView({ onWalk }: { onWalk: () => void }) {
  const { t, category, platform } = useT();
  const { lang, setLang } = useLang();
  const { projects, user, ready, generatedAt } = useData();
  const [plat, setPlat] = useState<Platform | null>(null);
  const [cat, setCat] = useState<Category | null>(null);

  const featured = useMemo(() => {
    const picked = FEATURED.map((n) => projects.find((p) => p.name === n)).filter((p): p is Project => !!p?.screenshot);
    return picked.length >= 3 ? picked.slice(0, 3) : projects.filter((p) => p.screenshot).slice(0, 3);
  }, [projects]);
  const byPlatform = useMemo(() => (plat ? projects.filter((p) => p.platforms.includes(plat)) : projects), [projects, plat]);
  const shown = useMemo(() => (cat ? byPlatform.filter((p) => p.category === cat) : byPlatform), [byPlatform, cat]);
  const platCount = (p: Platform) => projects.filter((x) => x.platforms.includes(p)).length;
  const catCount = (c: Category) => byPlatform.filter((x) => x.category === c).length;

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="grain" aria-hidden />

      <header className="sticky top-3 z-30 mx-auto mt-3 flex max-w-6xl items-center gap-1 px-3 sm:px-6">
        <div className="surface flex w-full items-center gap-1 rounded-pill py-1.5 pl-2 pr-1.5 shadow-card backdrop-blur-xl">
          <a href="#" className="flex items-center gap-2.5 pl-1 pr-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-text-primary font-mono text-[11px] text-canvas">FD</span>
            <span className="hidden text-sm sm:inline">Florian Daunay</span>
          </a>
          <div className="ml-auto flex items-center gap-0.5">
            <button className="icon-btn w-auto rounded-pill px-2.5 font-mono text-xs font-medium uppercase" onClick={() => setLang(lang === "fr" ? "en" : "fr")} aria-label="Language">
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <ThemePicker />
            {user && (
              <a className="icon-btn rounded-pill" href={`https://github.com/${user}`} target="_blank" rel="noreferrer" aria-label="GitHub">
                <GithubIcon />
              </a>
            )}
            <button className="btn btn-primary ml-1 rounded-pill" onClick={onWalk}>
              <CubeIcon /> <span className="hidden sm:inline">{t("explore")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-10 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="rise">
            <h1 className="text-5xl font-bold leading-[0.95] tracking-tighter sm:text-7xl">Florian Daunay</h1>
            <p className="mt-6 max-w-xl text-2xl leading-snug text-text-secondary sm:text-3xl">
              {t("lead")} <RotatingWord /> <br className="hidden sm:block" />
              {t("tail")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#projects" className="btn btn-primary rounded-pill px-5 py-2.5">
                {t("browse")} ↓
              </a>
              <button onClick={onWalk} className="btn rounded-pill px-5 py-2.5">
                <CubeIcon /> {t("explore")}
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 font-mono text-xs text-text-muted">
              <span className="surface rounded-pill px-3 py-1">
                <b className="font-medium text-text-primary">{projects.length}</b> {t("projects")}
              </span>
              {PLATFORMS.filter((p) => platCount(p) > 0).map((p) => {
                const I = PLATFORM_ICON[p];
                return (
                  <span key={p} className="surface inline-flex items-center gap-1.5 rounded-pill px-3 py-1" title={platform(p)}>
                    <I width={12} height={12} /> {platCount(p)}
                  </span>
                );
              })}
            </div>
          </div>
          <Fan projects={featured.length ? featured : projects} />
        </section>

        {featured.length > 0 && (
          <section className="pb-20">
            <h2 className="mb-6 flex items-baseline gap-3 text-sm font-medium uppercase tracking-[0.2em] text-text-muted">
              <span className="font-display text-3xl normal-case italic tracking-normal text-text-primary">{t("selected")}</span>
            </h2>
            <div className="grid gap-6">
              {featured.map((p, i) => (
                <FeatureCard key={p.name} project={p} index={i} />
              ))}
            </div>
          </section>
        )}

        <section id="projects" className="scroll-mt-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl italic">{t("allProjects")}</h2>
            <div className="surface flex rounded-pill p-1">
              <button className="chip" aria-pressed={plat === null} onClick={() => setPlat(null)}>
                {t("all")}
              </button>
              {PLATFORMS.filter((p) => platCount(p) > 0).map((p) => {
                const I = PLATFORM_ICON[p];
                return (
                  <button key={p} className="chip px-2.5" aria-pressed={plat === p} onClick={() => setPlat(plat === p ? null : p)} title={platform(p)} aria-label={platform(p)}>
                    <I width={15} height={15} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sticky top-[4.5rem] z-20 -mx-4 mb-8 flex gap-1.5 overflow-x-auto px-4 py-2 sm:-mx-6 sm:px-6">
            {ALL_CATEGORIES.filter((c) => catCount(c) > 0).map((c) => (
              <button
                key={c}
                className="chip surface shadow-card backdrop-blur-xl"
                aria-pressed={cat === c}
                onClick={() => setCat(cat === c ? null : c)}
                style={cat === c ? { background: CATEGORY_COLOR[c], color: "#0b0b10", borderColor: "transparent" } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: cat === c ? "#0b0b10" : CATEGORY_COLOR[c] }} />
                {category(c)}
                <span className="font-mono text-xs opacity-60">{catCount(c)}</span>
              </button>
            ))}
          </div>

          {ready && shown.length === 0 && <p className="py-20 text-center text-text-muted">{t("empty")}</p>}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" key={`${plat}-${cat}`}>
            {shown.map((p, i) => (
              <ProjectCard key={p.name} project={p} index={i} />
            ))}
          </div>
        </section>

        <footer className="mt-24 flex flex-col items-center gap-4 text-center">
          <button onClick={onWalk} className="group relative overflow-hidden rounded-card border border-border bg-[#07050a] px-8 py-6 text-left text-white shadow-overlay">
            <span className="absolute inset-0 opacity-70 transition group-hover:opacity-100" style={{ background: "radial-gradient(60% 120% at 20% 100%, #ff2bd655, transparent 60%), radial-gradient(60% 120% at 90% 0%, #36c8ff55, transparent 60%)" }} />
            <span className="relative flex items-center gap-4">
              <CubeIcon width={28} height={28} />
              <span>
                <span className="block font-display text-2xl italic">{t("explore")}</span>
                <span className="block text-sm text-white/60">{t("walkPitch")}</span>
              </span>
            </span>
          </button>
          {generatedAt && (
            <p className="font-mono text-[11px] text-text-muted">
              {t("updated")} {new Date(generatedAt).toLocaleDateString(lang)}
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
