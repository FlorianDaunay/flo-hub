import { useEffect, useRef, useState } from "react";
import type { Platform, Project } from "@/lib/classify";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR, formatSize } from "@/lib/meta";
import { ArrowIcon, DownloadIcon, GithubIcon, PLATFORM_ICON } from "./Icons";

export function Cover({ project }: { project: Project }) {
  const [shotOk, setShotOk] = useState(!!project.screenshot);
  const color = CATEGORY_COLOR[project.category];
  const Icon = PLATFORM_ICON[project.platforms[0]];
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-t-card bg-surface-hover">
      {shotOk && project.screenshot ? (
        <img
          src={`${import.meta.env.BASE_URL}${project.screenshot}`}
          alt=""
          loading="lazy"
          onError={() => setShotOk(false)}
          className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 85% 0%, ${color}55, transparent 60%), radial-gradient(90% 80% at 0% 100%, ${color}22, transparent 60%)` }}>
          <div className="cover-grid absolute inset-0" />
          <span className="absolute bottom-3 left-4 font-mono text-5xl font-medium tracking-tight text-text-primary/80">
            {project.title.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </span>
          <Icon width={28} height={28} className="absolute right-4 top-4 text-text-primary/50" />
        </div>
      )}
    </div>
  );
}

function DownloadMenu({ project }: { project: Project }) {
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
  if (list.length === 1)
    return (
      <a className="btn" href={list[0].url} title={`${list[0].name} · ${formatSize(list[0].size)}`}>
        <DownloadIcon /> {platform(list[0].platform)}
      </a>
    );
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <DownloadIcon /> {t("download")}
      </button>
      {open && (
        <div className="surface absolute bottom-full right-0 z-20 mb-2 min-w-56 rounded-tile p-1 shadow-overlay">
          {list.map((d) => {
            const Icon = PLATFORM_ICON[d.platform];
            return (
              <a key={d.url} href={d.url} className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm hover:bg-surface-hover">
                <Icon className="text-text-secondary" />
                <span className="font-medium">{platform(d.platform)}</span>
                <span className="ml-auto pl-4 font-mono text-xs text-text-muted">.{d.name.split(".").pop()} · {formatSize(d.size)}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { t, category, platform } = useT();
  const color = CATEGORY_COLOR[project.category];
  return (
    <article className="card group rise flex flex-col transition duration-300 hover:-translate-y-0.5 hover:shadow-overlay" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <a href={project.homepage ?? project.repoUrl} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <Cover project={project} />
      </a>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {category(project.category)}
          <span className="ml-auto flex items-center gap-1.5">
            {project.platforms.map((p: Platform) => {
              const Icon = PLATFORM_ICON[p];
              return <Icon key={p} width={14} height={14} aria-label={platform(p)} />;
            })}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{project.title}</h3>
          {project.description && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{project.description}</p>}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          {project.homepage && (
            <a className="btn btn-primary" href={project.homepage} target="_blank" rel="noreferrer">
              {t("open")} <ArrowIcon width={14} height={14} />
            </a>
          )}
          {project.downloads.length > 0 && <DownloadMenu project={project} />}
          <a className="icon-btn ml-auto" href={project.repoUrl} target="_blank" rel="noreferrer" title={t("source")} aria-label={t("source")}>
            <GithubIcon />
          </a>
        </div>
      </div>
    </article>
  );
}
