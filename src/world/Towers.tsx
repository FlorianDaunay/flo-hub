import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Project } from "@/lib/classify";
import { CATEGORY_COLOR } from "@/lib/meta";
import { packAtlas, quadGeometry, signMaterial, type AtlasRect, type Quad } from "./batch";
import { LOT_OFFSET, LOT_SIZE, hash01, streetPoint, type Lot } from "./layout";
import { barsMesh, buildingMesh, detailMesh, glowMesh, type Bar, type Glow, type Part } from "./materials";
import { useWorld } from "./store";
import { streakTexture } from "./textures";

const S = LOT_SIZE;
const PODIUM = 8;
export const SCREEN_Y = 4.4;
export const SCREEN_W = 8;
export const SCREEN_H = 5;
const SHOT_W = 512;
const SHOT_H = 320;

/** Local (tower) coordinates → world, for a tower rotated by a multiple of 90°. */
export function toWorld(lot: Lot, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(lot.rotY);
  const s = Math.sin(lot.rotY);
  return [lot.x + lx * c + lz * s, ly, lot.z - lx * s + lz * c];
}

function fallbackTile(p: Project): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SHOT_W;
  c.height = SHOT_H;
  const g = c.getContext("2d")!;
  const col = CATEGORY_COLOR[p.category];
  const grad = g.createLinearGradient(0, 0, SHOT_W, SHOT_H);
  grad.addColorStop(0, "#07080d");
  grad.addColorStop(1, col + "66");
  g.fillStyle = grad;
  g.fillRect(0, 0, SHOT_W, SHOT_H);
  g.fillStyle = "#fff";
  g.font = '600 120px "JetBrains Mono", monospace';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(
    p.title
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 3),
    SHOT_W / 2,
    SHOT_H / 2
  );
  return c;
}

/** All project screenshots in one texture (fallback tiles for the others). */
export function useScreenAtlas(projects: Project[]) {
  const [atlas, setAtlas] = useState<{ tex: THREE.Texture; rects: Map<string, AtlasRect> } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = (p: Project) =>
      new Promise<HTMLCanvasElement>((resolve) => {
        if (!p.screenshot) return resolve(fallbackTile(p));
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = SHOT_W;
          c.height = SHOT_H;
          c.getContext("2d")!.drawImage(img, 0, 0, SHOT_W, SHOT_H);
          resolve(c);
        };
        img.onerror = () => resolve(fallbackTile(p));
        img.src = `${import.meta.env.BASE_URL}${p.screenshot}`;
      });
    Promise.all(projects.map(load)).then((tiles) => {
      if (!alive) return;
      const { tex, rects } = packAtlas(tiles, 4096);
      setAtlas({ tex, rects: new Map(projects.map((p, i) => [p.name, rects[i]])) });
    });
    return () => {
      alive = false;
    };
  }, [projects]);
  useEffect(() => () => atlas?.tex.dispose(), [atlas]);
  return atlas;
}

const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1);
const CYL_LO = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1);
const FLOOR = 3.6;

/**
 * Architecture of every project tower, as a handful of instanced meshes:
 * facade boxes + round towers (procedural windows), detail boxes + cylinders (ledges, balconies,
 * AC units, fire escapes, tanks, pipes, antennas), neon, and ground reflections.
 */
function buildTowers(lots: Lot[]): THREE.InstancedMesh[] {
  const bBox: Part[] = [];
  const bCyl: Part[] = [];
  const dBox: Part[] = [];
  const dCyl: Part[] = [];
  const bars: Bar[] = [];
  const glows: Glow[] = [];
  const metal = ["#2a2d36", "#33302d", "#24282f", "#3a3530"];

  for (const lot of lots) {
    const col = CATEGORY_COLOR[lot.project.category];
    const h = lot.height;
    const k = (n: string) => hash01(lot.project.name + n);
    const r = k("style");
    const seed = k("seed") * 100;
    const W = (lx: number, ly: number, lz: number) => toWorld(lot, lx, ly, lz);
    const box = (list: Part[], lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, extra: Partial<Part> = {}) =>
      list.push({ ...extra, p: W(lx, ly, lz), s: [sx, sy, sz], rotY: lot.rotY, rot: extra.rot ? [extra.rot[0], lot.rotY + extra.rot[1], extra.rot[2]] : undefined });
    const bar = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, color = col, boost = 3) => bars.push({ p: W(lx, ly, lz), s: [sx, sy, sz], rotY: lot.rotY, color, boost });
    const tint = metal[Math.floor(k("m") * metal.length)];

    // Podium: shopfront floor, cornice, entrance pillars.
    box(bBox, 0, PODIUM / 2, 0, S, PODIUM, S, { seed: seed + 50 });
    box(dBox, 0, PODIUM + 0.2, 0.2, S + 0.8, 0.4, S + 0.4, { color: "#1d2027" });
    for (const sx of [-1, 1]) box(dBox, sx * (S / 2 - 0.3), PODIUM / 2, S / 2 + 0.25, 0.5, PODIUM, 0.5, { color: "#1d2027" });
    bar(0, PODIUM + 0.42, S / 2 + 0.62, S + 0.8, 0.06, 0.06, col, 2);

    const w = S - 1;
    const d = S - 1.6;
    const zc = -0.3;
    const front = zc + d / 2;

    if (r < 0.34) {
      // Setback tower: three tiers, ledges, vertical fins, spire.
      const tiers = [
        [PODIUM, PODIUM + (h - PODIUM) * 0.55, 1],
        [PODIUM + (h - PODIUM) * 0.55, PODIUM + (h - PODIUM) * 0.82, 0.78],
        [PODIUM + (h - PODIUM) * 0.82, h, 0.56],
      ];
      for (const [y0, y1, f] of tiers) {
        box(bBox, 0, (y0 + y1) / 2, zc, w * f, y1 - y0, d * f, { seed });
        box(dBox, 0, y1 + 0.2, zc, w * f + 0.6, 0.4, d * f + 0.6, { color: tint });
        bar(0, y1 + 0.42, zc + (d * f) / 2 + 0.32, w * f + 0.6, 0.06, 0.06, col, 2.4);
      }
      const t1 = tiers[0][1] - PODIUM;
      for (const fx of [-1, 0, 1]) box(dBox, (fx * w) / 3, PODIUM + t1 / 2, front + 0.3, 0.16, t1, 0.6, { color: tint });
      box(dCyl, 0, h + 7, zc, 0.5, 14, 0.5, { color: "#3b3f4a" });
      bar(0, h + 14.2, zc, 0.3, 0.6, 0.3, "#ff2a3a", 5);
    } else if (r < 0.67) {
      // Residential block: balconies, AC units, fire escape, pipes, water tank.
      box(bBox, 0, (PODIUM + h) / 2, zc, w, h - PODIUM, d, { seed });
      for (let y = PODIUM + 3.4; y < h - 2.5; y += FLOOR)
        for (const sx of [-1, 1]) {
          if (k(`b${y}${sx}`) < 0.3) continue;
          box(dBox, sx * w * 0.25, y, front + 0.6, w * 0.42, 0.14, 1.2, { color: tint });
          box(dBox, sx * w * 0.25, y + 0.5, front + 1.18, w * 0.42, 0.9, 0.05, { color: "#454954" });
          if (k(`a${y}${sx}`) < 0.35) box(dBox, sx * w * 0.25 + 1.2, y + 0.45, front + 0.85, 0.9, 0.6, 0.55, { color: "#565a63" });
        }
      const side = k("fe") < 0.5 ? -1 : 1;
      const fx = side * (w / 2 + 0.65);
      for (let y = PODIUM + 3.4, i = 0; y < h - 3; y += FLOOR, i++) {
        box(dBox, fx, y, zc, 1.2, 0.12, 3.4, { color: "#2e3139" });
        box(dBox, fx + side * 0.58, y + 0.5, zc, 0.04, 1, 3.4, { color: "#3c404a" });
        if (y + FLOOR < h - 3) box(dBox, fx, y + FLOOR / 2, zc, 0.9, 0.08, Math.hypot(FLOOR, 2.6), { color: "#2e3139", rot: [(i % 2 ? 1 : -1) * Math.atan2(FLOOR, 2.6), 0, 0] });
      }
      for (let i = 0; i < 6; i++) box(dBox, -side * (w / 2 + 0.3), PODIUM + 2 + k(`ac${i}`) * (h - PODIUM - 4), zc + (k(`az${i}`) - 0.5) * d * 0.8, 0.6, 0.6, 0.9, { color: "#50545d" });
      box(dCyl, -side * (w / 2 + 0.25), (PODIUM + h) / 2, front - 0.6, 0.35, h - PODIUM, 0.35, { color: "#3a3d45" });
      box(dCyl, w * 0.2, h + 2.4, zc - 1, 2.6, 2.4, 2.6, { color: "#3d3833" });
      for (const lx of [-1, 1]) for (const lz of [-1, 1]) box(dBox, w * 0.2 + lx * 0.9, h + 0.6, zc - 1 + lz * 0.9, 0.15, 1.2, 0.15, { color: "#2a2d36" });
      for (const sx of [-1, 1]) bar(sx * (w / 2), (PODIUM + h) / 2, front, 0.1, h - PODIUM, 0.1, col, 2.4);
    } else {
      // Round glass tower with ring ledges and a crown.
      const R = S - 1.6;
      box(bCyl, 0, (PODIUM + h) / 2, zc, R, h - PODIUM, R, { seed });
      for (let y = PODIUM + FLOOR * 4; y < h - 2; y += FLOOR * 4) box(dCyl, 0, y, zc, R + 0.6, 0.25, R + 0.6, { color: tint });
      box(bCyl, 0, h + 2.5, zc, R * 0.6, 5, R * 0.6, { seed: seed + 7 });
      box(dCyl, 0, h + 0.15, zc, R + 0.8, 0.3, R + 0.8, { color: tint });
      bar(0, (PODIUM + h) / 2, zc + R / 2 + 0.05, 0.1, h - PODIUM, 0.1, col, 2.6);
      bar(0, h + 0.35, zc, R + 0.8, 0.08, 0.08, col, 2.4);
      bar(0, h + 0.35, zc, 0.08, 0.08, R + 0.8, col, 2.4);
    }

    // Rooftop clutter: AC boxes, an antenna with a warning light, sometimes a dish.
    for (let i = 0; i < 3; i++) box(dBox, (k(`rx${i}`) - 0.5) * w * 0.5, h + 0.5, zc + (k(`rz${i}`) - 0.5) * d * 0.4, 1.6, 1, 1.1, { color: "#4a4e57" });
    if (r >= 0.34) {
      box(dBox, -w * 0.3, h + 4, zc + 1, 0.12, 8, 0.12, { color: "#3b3f4a" });
      bar(-w * 0.3, h + 8.1, zc + 1, 0.3, 0.3, 0.3, "#ff2a3a", 5);
    }
    if (k("dish") < 0.5) box(dCyl, w * 0.3, h + 1.4, zc + 2, 1.8, 0.15, 1.8, { color: "#6a6e78", rot: [0.6, 0, 0] });

    // Screen bezel + neon frame.
    box(dBox, 0, SCREEN_Y, S / 2 + 0.1, SCREEN_W + 0.6, SCREEN_H + 0.6, 0.25, { color: "#101217" });
    const fz = S / 2 + 0.26;
    bar(0, SCREEN_Y + SCREEN_H / 2 + 0.3, fz, SCREEN_W + 0.6, 0.08, 0.06, col, 2.2);
    bar(0, SCREEN_Y - SCREEN_H / 2 - 0.3, fz, SCREEN_W + 0.6, 0.08, 0.06, col, 2.2);
    for (const s of [-1, 1]) bar((s * (SCREEN_W + 0.6)) / 2, SCREEN_Y, fz, 0.08, SCREEN_H + 0.68, 0.06, col, 2.2);

    // Wet street reflections of the screen and of the cornice light.
    const [sx, , sz] = W(0, 0, S / 2 + 1 + 4.5);
    glows.push({ x: sx, z: sz, w: SCREEN_W * 0.9, l: 9, rotY: lot.rotY, color: col, strength: 0.32 });
    const [cx, , cz] = W(0, 0, S / 2 + 1 + 3);
    glows.push({ x: cx, z: cz, w: S * 0.9, l: 6, rotY: lot.rotY, color: "#ffffff", strength: 0.06 });
  }

  // Skywalks over the avenues between facing towers.
  const byPair = new Map<string, Lot[]>();
  for (const l of lots) {
    const key = `${l.district}:${l.along}`;
    byPair.set(key, [...(byPair.get(key) ?? []), l]);
  }
  for (const [key, pair] of byPair) {
    if (pair.length !== 2 || hash01(key) > 0.55) continue;
    const y = 16 + hash01(key + "y") * 10;
    if (Math.min(pair[0].height, pair[1].height) < y + 6) continue;
    const { angle, along } = pair[0];
    const len = (LOT_OFFSET - S / 2) * 2 + 2;
    const [x, z] = streetPoint(angle, along, 0);
    bBox.push({ p: [x, y, z], s: [len, 3, 3.4], rotY: -angle, seed: hash01(key) * 100 });
    dBox.push({ p: [x, y + 1.65, z], s: [len + 0.4, 0.3, 3.8], rotY: -angle, color: "#22252d" });
    for (const s of [-1, 1]) {
      const [ex, ez] = streetPoint(angle, along + s * 1.72, 0);
      bars.push({ p: [ex, y - 1.52, ez], s: [len, 0.07, 0.07], rotY: -angle, color: "#36c8ff", boost: 2.6 });
    }
  }

  return [buildingMesh(bBox), buildingMesh(bCyl, CYL), detailMesh(dBox), detailMesh(dCyl, CYL_LO), barsMesh(bars), glowMesh(glows, streakTexture())];
}

export default function Towers({ lots, atlas }: { lots: Lot[]; atlas: ReturnType<typeof useScreenAtlas> }) {
  const setFocused = useWorld((s) => s.setFocused);

  const meshes = useMemo(() => buildTowers(lots), [lots]);

  const screens = useMemo(() => {
    if (!atlas) return null;
    const quads: Quad[] = lots.map((lot) => ({
      rect: atlas.rects.get(lot.project.name)!,
      height: SCREEN_H,
      width: SCREEN_W,
      position: toWorld(lot, 0, SCREEN_Y, S / 2 + 0.26),
      rotY: lot.rotY,
      color: "#ffffff",
      intensity: 0.95,
    }));
    const mat = signMaterial(atlas.tex);
    mat.transparent = false;
    mat.depthWrite = true;
    mat.side = THREE.FrontSide;
    return new THREE.Mesh(quadGeometry(quads), mat);
  }, [lots, atlas]);

  useEffect(
    () => () => {
      for (const o of meshes) {
        o.geometry.dispose();
        o.dispose();
      }
    },
    [meshes]
  );

  return (
    <>
      {meshes.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
      {screens && (
        <primitive
          object={screens}
          onClick={(e: { stopPropagation: () => void; faceIndex?: number | null }) => {
            e.stopPropagation();
            if (e.faceIndex != null) setFocused(lots[Math.floor(e.faceIndex / 2)] ?? null);
          }}
        />
      )}
    </>
  );
}
