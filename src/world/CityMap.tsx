import { useEffect, useMemo, useRef } from "react";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR } from "@/lib/meta";
import { PLATFORM_ICON } from "@/components/Icons";
import { PLAZA_RADIUS, STREET_HALF_WIDTH, LOT_OFFSET, streetPoint, viewpoint, type CityLayout, type Lot, type StreetKind } from "./layout";
import { STREET_COLOR } from "./Signs";
import { playerState, useWorld } from "./store";

const STREET_NAME: Record<StreetKind, string> = { web: "Web", android: "Android", desktop: "Desktop", market: "Market" };

/** Tight bounding box of the streets and lots, with a margin. */
function bounds(layout: CityLayout) {
  let [x0, z0, x1, z1] = [-PLAZA_RADIUS, -PLAZA_RADIUS, PLAZA_RADIUS, PLAZA_RADIUS];
  for (const s of layout.streets)
    for (const side of [-1, 1]) {
      const [x, z] = streetPoint(s.angle, s.length, side * (LOT_OFFSET + 6));
      [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)];
    }
  const m = 14;
  return { x: x0 - m, y: z0 - m, w: x1 - x0 + m * 2, h: z1 - z0 + m * 2 };
}

/** Minimap window: 140 m around the player. */
const LOCAL = 70;

/** North-up plan of the city. `onPick` makes project lots clickable. */
function Plan({ layout, labels, onPick, focusedName, follow }: { layout: CityLayout; labels?: boolean; onPick?: (lot: Lot) => void; focusedName?: string; follow?: boolean }) {
  const arrow = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const b = useMemo(() => bounds(layout), [layout]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      arrow.current?.setAttribute("transform", `translate(${playerState.x} ${playerState.z}) rotate(${(-playerState.yaw * 180) / Math.PI})`);
      if (follow) svg.current?.setAttribute("viewBox", `${playerState.x - LOCAL} ${playerState.z - LOCAL} ${LOCAL * 2} ${LOCAL * 2}`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [follow]);

  return (
    <svg ref={svg} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} className="h-full w-full">
      {layout.streets.map((s) => {
        const [x1, z1] = streetPoint(s.angle, PLAZA_RADIUS - 2, 0);
        const [x2, z2] = streetPoint(s.angle, s.length, 0);
        return (
          <g key={s.district}>
            <line x1={x1} y1={z1} x2={x2} y2={z2} stroke="rgba(255,255,255,0.08)" strokeWidth={STREET_HALF_WIDTH * 2 + 5} strokeLinecap="round" />
            <line x1={x1} y1={z1} x2={x2} y2={z2} stroke={STREET_COLOR[s.district]} strokeOpacity={0.55} strokeWidth={0.8} />
            {labels && (
              <text x={x2} y={z2} dy={s.angle === 0 ? -6 : s.angle === Math.PI ? 12 : 4} textAnchor="middle" fill={STREET_COLOR[s.district]} fontSize={7} fontWeight={600} letterSpacing={1.2}>
                {STREET_NAME[s.district].toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      <circle r={PLAZA_RADIUS} fill="rgba(255,255,255,0.06)" stroke="#ff2bd6" strokeOpacity={0.6} strokeWidth={0.6} />
      {layout.lots.map((lot) => {
        const on = lot.project.name === focusedName;
        const c = CATEGORY_COLOR[lot.project.category];
        return (
          <g key={lot.project.name} transform={`translate(${lot.x} ${lot.z})`} className={onPick ? "cursor-pointer" : undefined} onClick={onPick ? () => onPick(lot) : undefined}>
            {onPick && <circle r={9} fill="transparent" />}
            <rect x={-4.5} y={-4.5} width={9} height={9} rx={1.5} fill={c} fillOpacity={on ? 0.95 : 0.55} stroke={on ? "#fff" : "none"} strokeWidth={0.8} />
          </g>
        );
      })}
      {labels &&
        layout.lots.map((lot) => {
          // Label on the outer side of the lot, away from the street.
          const [ox, oz] = streetPoint(lot.angle, lot.along, lot.side * (LOT_OFFSET + 7));
          // North-south streets: horizontal labels beside the lot. East-west: labels run upward/downward.
          const vertical = Math.abs(Math.sin(lot.angle)) < 0.5;
          const [tx, tz] = streetPoint(lot.angle, lot.along, lot.side * (LOT_OFFSET + 6));
          const up = tz < lot.z;
          return (
            <text
              key={lot.project.name + "l"}
              x={vertical ? ox : tx}
              y={vertical ? oz + 1.5 : tz}
              transform={vertical ? undefined : `rotate(-90 ${tx} ${tz})`}
              dy={vertical ? 0 : 1.5}
              textAnchor={vertical ? (lot.side > 0 ? "start" : "end") : up ? "start" : "end"}
              fill="rgba(255,255,255,0.75)"
              fontSize={4.2}
              className="pointer-events-none"
            >
              {lot.project.title}
            </text>
          );
        })}
      <g ref={arrow}>
        <circle r={5} fill="#fff" fillOpacity={0.12} />
        <path d="M0 -4.5 L3.2 3.5 L0 2 L-3.2 3.5 Z" fill="#fff" />
      </g>
    </svg>
  );
}

const glass = "border border-white/10 bg-[#0b0e1a]/75 text-white backdrop-blur-md";

export function Minimap({ layout }: { layout: CityLayout }) {
  const setMapOpen = useWorld((s) => s.setMapOpen);
  const focused = useWorld((s) => s.focused);
  return (
    <button
      onClick={() => {
        document.exitPointerLock?.();
        setMapOpen(true);
      }}
      className={`${glass} pointer-events-auto block h-28 w-28 overflow-hidden rounded-full transition hover:border-white/30 sm:h-36 sm:w-36`}
      aria-label="Map"
    >
      <Plan layout={layout} focusedName={focused?.project.name} follow />
    </button>
  );
}

export function FullMap({ layout }: { layout: CityLayout }) {
  const { category, platform } = useT();
  const open = useWorld((s) => s.mapOpen);
  const setMapOpen = useWorld((s) => s.setMapOpen);
  const goTo = useWorld((s) => s.goTo);
  const setFocused = useWorld((s) => s.setFocused);
  const focused = useWorld((s) => s.focused);

  const groups = useMemo(() => {
    const order: StreetKind[] = ["web", "android", "desktop"];
    return order.map((d) => ({ d, lots: layout.lots.filter((l) => l.district === d) })).filter((g) => g.lots.length);
  }, [layout]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMapOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, setMapOpen]);

  if (!open) return null;
  const pick = (lot: Lot) => {
    const v = viewpoint(lot);
    goTo(v.x, v.z, v.heading);
    setFocused(lot);
    setMapOpen(false);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-8" onClick={() => setMapOpen(false)}>
      <div className={`${glass} rise flex h-full max-h-[52rem] w-full max-w-5xl flex-col overflow-hidden rounded-3xl sm:flex-row`} onClick={(e) => e.stopPropagation()}>
        <div className="relative min-h-0 flex-1 p-2 sm:p-4">
          <Plan layout={layout} labels onPick={pick} focusedName={focused?.project.name} />
          <button onClick={() => setMapOpen(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20" aria-label="Close">
            ×
          </button>
        </div>
        <div className="max-h-[42%] overflow-y-auto border-t border-white/10 p-3 sm:max-h-none sm:w-72 sm:border-l sm:border-t-0">
          {groups.map(({ d, lots }) => (
            <section key={d} className="mb-3">
              <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: STREET_COLOR[d] }}>
                {STREET_NAME[d]}
              </h3>
              {lots.map((lot) => {
                const p = lot.project;
                return (
                  <button key={p.name} onClick={() => pick(lot)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[p.category] }} title={category(p.category)} />
                    <span className="truncate">{p.title}</span>
                    <span className="ml-auto flex shrink-0 gap-1 text-white/45">
                      {p.platforms.map((pl) => {
                        const I = PLATFORM_ICON[pl];
                        return <I key={pl} width={12} height={12} aria-label={platform(pl)} />;
                      })}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
