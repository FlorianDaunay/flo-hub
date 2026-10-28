import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { CATEGORY_COLOR, formatSize } from "@/lib/meta";
import { ArrowIcon, DownloadIcon, GithubIcon, GridIcon, MapIcon, MuteIcon, PLATFORM_ICON, SoundIcon } from "@/components/Icons";
import type { CityLayout } from "./layout";
import { FullMap, Minimap } from "./CityMap";
import { touchInput, useWorld } from "./store";

const glass = "rounded-xl border border-white/10 bg-[#0b0e1a]/65 text-white backdrop-blur-md";

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) [x, y] = [x / l, y / l];
    touchInput.moveX = x;
    touchInput.moveY = y;
    setKnob({ x, y });
  };
  const end = () => {
    id.current = null;
    touchInput.moveX = touchInput.moveY = 0;
    setKnob({ x: 0, y: 0 });
  };
  return (
    <div
      ref={base}
      className="pointer-events-auto absolute bottom-8 left-8 h-32 w-32 touch-none rounded-full border border-white/15 bg-white/5 backdrop-blur-sm"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/30" style={{ transform: `translate(calc(-50% + ${knob.x * 40}px), calc(-50% + ${knob.y * 40}px))` }} />
    </div>
  );
}

/** Drag anywhere (outside the joystick) to look around on touch screens. */
function TouchLook() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="pointer-events-auto absolute inset-0 touch-none"
      onPointerDown={(e) => (last.current = { id: e.pointerId, x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        touchInput.lookX += e.clientX - l.x;
        touchInput.lookY += e.clientY - l.y;
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

function FocusPanel({ touch }: { touch: boolean }) {
  const lot = useWorld((s) => s.focused);
  const locked = useWorld((s) => s.locked);
  const { t, category, platform } = useT();
  if (!lot) return null;
  const p = lot.project;
  return (
    <div className={`absolute inset-x-0 flex justify-center px-3 ${touch ? "bottom-44" : "bottom-8"}`}>
    <div key={p.name} className={`${glass} rise pointer-events-auto w-full max-w-[30rem] p-4`}>
      <div className="flex items-center gap-2 text-xs text-white/60">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[p.category] }} />
        {category(p.category)}
        <span className="ml-auto flex gap-1.5">
          {p.platforms.map((pl) => {
            const Icon = PLATFORM_ICON[pl];
            return <Icon key={pl} width={14} height={14} aria-label={platform(pl)} />;
          })}
        </span>
      </div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{p.title}</h2>
      {p.description && <p className="mt-1 line-clamp-2 text-sm text-white/70">{p.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.homepage && (
          <a href={p.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-white/90">
            {t("open")} <ArrowIcon width={14} height={14} />
            {!touch && <kbd className="ml-1 rounded border border-black/20 px-1 font-mono text-[10px]">E</kbd>}
          </a>
        )}
        {p.downloads.map((d) => (
          <a key={d.url} href={d.url} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10" title={`${d.name} · ${formatSize(d.size)}`}>
            <DownloadIcon width={14} height={14} /> {platform(d.platform)}
          </a>
        ))}
        <a href={p.repoUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10" aria-label={t("source")}>
          <GithubIcon />
        </a>
      </div>
      {locked && <p className="mt-2 text-[11px] text-white/40">Esc → {t("back").toLowerCase()} · clic</p>}
    </div>
    </div>
  );
}

export default function Hud({ layout, onExit, touch }: { layout: CityLayout; onExit: () => void; touch: boolean }) {
  const { t } = useT();
  const { lang, setLang } = useLang();
  const locked = useWorld((s) => s.locked);
  const quality = useWorld((s) => s.quality);
  const setQuality = useWorld((s) => s.setQuality);
  const sound = useWorld((s) => s.sound);
  const setSound = useWorld((s) => s.setSound);
  const mapOpen = useWorld((s) => s.mapOpen);
  const setMapOpen = useWorld((s) => s.setMapOpen);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 10000);
    return () => clearTimeout(id);
  }, []);

  const btn = "grid h-9 w-9 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white";

  return (
    <div className="pointer-events-none absolute inset-0 font-sans">
      {touch && !mapOpen && <TouchLook />}

      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3 sm:p-4">
        <button onClick={onExit} className={`${glass} pointer-events-auto inline-flex h-11 items-center gap-2 px-3 text-sm hover:bg-white/10`}>
          <GridIcon /> <span className="hidden sm:inline">{t("clean")}</span>
        </button>
        <div className={`${glass} pointer-events-auto ml-auto flex items-center p-1`}>
          <button
            className={btn}
            onClick={() => {
              document.exitPointerLock?.();
              setMapOpen(true);
            }}
            aria-label={t("map")}
            title={`${t("map")} (M)`}
          >
            <MapIcon />
          </button>
          <button className={btn} onClick={() => setSound(!sound)} aria-label={t("sound")} title={t("sound")}>
            {sound ? <SoundIcon /> : <MuteIcon />}
          </button>
          <button className={`${btn} font-mono text-xs uppercase`} onClick={() => setLang(lang === "fr" ? "en" : "fr")}>
            {lang === "fr" ? "en" : "fr"}
          </button>
          <button className={`${btn} font-mono text-[11px]`} onClick={() => setQuality(quality === "high" ? "low" : "high")} title="Quality">
            {quality === "high" ? "HQ" : "LQ"}
          </button>
        </div>
      </div>

      <div className={`absolute right-3 sm:right-4 ${touch ? "top-[4.25rem]" : "bottom-4"}`}>
        <Minimap layout={layout} />
      </div>

      {!touch && locked && <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />}

      {!touch && !locked && !mapOpen && (
        <div className="absolute inset-x-0 top-[40%] flex justify-center">
          <p className={`${glass} rounded-full px-5 py-2 text-sm tracking-wide`}>{t("enter")} · clic</p>
        </div>
      )}

      {hint && !mapOpen && <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/45">{touch ? t("hintTouch") : t("hint")}</p>}

      {!mapOpen && <FocusPanel touch={touch} />}
      {touch && !mapOpen && <Joystick />}
      <FullMap layout={layout} />
    </div>
  );
}
