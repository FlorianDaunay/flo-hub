import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Project } from "@/lib/classify";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR, formatSize } from "@/lib/meta";
import { ArrowIcon, DownloadIcon, GithubIcon, PLATFORM_ICON } from "./Icons";

const rgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Pointer-driven tilt and spotlight through CSS variables (no React re-render). */
function tilt(e: PointerEvent<HTMLElement>, strength: number) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--mx", `${x * 100}%`);
  el.style.setProperty("--my", `${y * 100}%`);
  el.style.setProperty("--rx", `${(0.5 - y) * strength}deg`);
  el.style.setProperty("--ry", `${(x - 0.5) * strength}deg`);
}
function untilt(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

/** Screenshot in a minimal browser frame, or a generated cover for apps without one. */
export function Preview({ project, tall }: { project: Project; tall?: boolean }) {
  const [ok, setOk] = useState(!!project.screenshot);
  const color = CATEGORY_COLOR[project.category];
  const Icon = PLATFORM_ICON[project.platforms.find((p) => p !== "web") ?? project.platforms[0]];
  return (
    <div className="frame">
      <div className="frame-bar">
        <i />
        <i />
        <i />
        <span className="ml-2 truncate font-mono text-[10px] text-text-muted">{project.homepage ? host(project.homepage) : project.name}</span>
      </div>
      <div className={`relative overflow-hidden ${tall ? "aspect-[16/10]" : "aspect-[16/9]"}`}>
        {ok && project.screenshot ? (
          <img src={`${import.meta.env.BASE_URL}${project.screenshot}`} alt="" loading="lazy" onError={() => setOk(false)} className="shot h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center" style={{ background: `radial-gradient(90% 120% at 80% 0%, ${color}50, transparent 60%), radial-gradient(80% 90% at 0% 100%, ${color}26, transparent 60%)` }}>
            <div className="flex flex-col items-center gap-3 text-text-primary/80">
              <Icon width={40} height={40} strokeWidth={1.3} />
              <span className="font-display text-3xl italic">{project.title}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Downloads({ project, compact }: { project: Project; compact?: boolean }) {
  const { t, platform } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const list = project.downloads;
  if (!list.length) return null;
  if (list.length === 1)
    return (
      <a className="btn" href={list[0].url} title={`${list[0].name} · ${formatSize(list[0].size)}`}>
        <DownloadIcon /> {compact ? platform(list[0].platform) : `${t("download")} · ${platform(list[0].platform)}`}
      </a>
    );
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <DownloadIcon /> {t("download")}
      </button>
      {open && (
        <div className="surface absolute bottom-full left-0 z-20 mb-2 min-w-56 rounded-tile p-1 shadow-overlay">
          {list.map((d) => {
            const I = PLATFORM_ICON[d.platform];
            return (
              <a key={d.url} href={d.url} className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm hover:bg-surface-hover">
                <I className="text-text-secondary" />
                <span className="font-medium">{platform(d.platform)}</span>
                <span className="ml-auto pl-4 font-mono text-xs text-text-muted">
                  .{d.name.split(".").pop()} · {formatSize(d.size)}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Meta({ project }: { project: Project }) {
  const { category, platform } = useT();
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 font-medium" style={{ background: `${CATEGORY_COLOR[project.category]}1f`, color: "rgb(var(--color-text-secondary))" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[project.category] }} />
        {category(project.category)}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {project.platforms.map((p) => {
          const I = PLATFORM_ICON[p];
          return <I key={p} width={14} height={14} aria-label={platform(p)} />;
        })}
      </span>
    </div>
  );
}

/** Large showcase card: preview on one side, text and actions on the other. */
export function FeatureCard({ project, index }: { project: Project; index: number }) {
  const { t } = useT();
  return (
    <article
      className="tile card rise grid gap-6 p-4 sm:p-5 md:grid-cols-[1.35fr_1fr] md:items-center"
      style={{ "--c": rgb(CATEGORY_COLOR[project.category]), animationDelay: `${index * 90}ms` } as React.CSSProperties}
      onPointerMove={(e) => tilt(e, 3)}
      onPointerLeave={untilt}
    >
      <a href={project.homepage ?? project.repoUrl} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden className={index % 2 ? "md:order-2" : ""}>
        <Preview project={project} tall />
      </a>
      <div className="flex flex-col gap-4 px-1 pb-1">
        <Meta project={project} />
        <h3 className="font-display text-4xl leading-none tracking-tight sm:text-5xl">{project.title}</h3>
        {project.description && <p className="text-text-secondary">{project.description}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {project.homepage && (
            <a className="btn btn-primary" href={project.homepage} target="_blank" rel="noreferrer">
              {t("open")} <ArrowIcon width={14} height={14} />
            </a>
          )}
          <Downloads project={project} />
          <a className="icon-btn" href={project.repoUrl} target="_blank" rel="noreferrer" title={t("source")} aria-label={t("source")}>
            <GithubIcon />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { t } = useT();
  return (
    <article
      className="tile card rise group flex flex-col gap-4 p-3"
      style={{ "--c": rgb(CATEGORY_COLOR[project.category]), animationDelay: `${Math.min(index, 12) * 40}ms` } as React.CSSProperties}
      onPointerMove={(e) => tilt(e, 5)}
      onPointerLeave={untilt}
    >
      <a href={project.homepage ?? project.repoUrl} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <Preview project={project} />
      </a>
      <div className="flex flex-1 flex-col gap-2.5 px-2">
        <Meta project={project} />
        <h3 className="text-lg font-semibold tracking-tight">{project.title}</h3>
        {project.description && <p className="-mt-1 line-clamp-2 text-sm text-text-secondary">{project.description}</p>}
        <div className="mt-auto flex items-center gap-2 pb-2 pt-1">
          {project.homepage && (
            <a className="btn btn-primary" href={project.homepage} target="_blank" rel="noreferrer">
              {t("open")} <ArrowIcon width={14} height={14} />
            </a>
          )}
          <Downloads project={project} compact />
          <a className="icon-btn ml-auto" href={project.repoUrl} target="_blank" rel="noreferrer" title={t("source")} aria-label={t("source")}>
            <GithubIcon />
          </a>
        </div>
      </div>
    </article>
  );
}
