import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Project } from "@/lib/classify";
import { CATEGORY_COLOR } from "@/lib/meta";
import { packAtlas, quadGeometry, signMaterial, type AtlasRect, type Quad } from "./batch";
import { LOT_SIZE, hash01, type Lot } from "./layout";
import { barsMesh, buildingMaterial, glowMesh, type Bar, type Glow } from "./materials";
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

export default function Towers({ lots, atlas }: { lots: Lot[]; atlas: ReturnType<typeof useScreenAtlas> }) {
  const setFocused = useWorld((s) => s.setFocused);

  const { bodies, neon, streaks } = useMemo(() => {
    const boxes: { p: [number, number, number]; s: [number, number, number]; rotY: number }[] = [];
    const bars: Bar[] = [];
    const glows: Glow[] = [];
    for (const lot of lots) {
      const col = CATEGORY_COLOR[lot.project.category];
      const h = lot.height;
      const r = hash01(lot.project.name + "style");
      const w = S - 2;
      const add = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) => boxes.push({ p: toWorld(lot, lx, ly, lz), s: [sx, sy, sz], rotY: lot.rotY });
      const bar = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, color = col, boost = 3) =>
        bars.push({ p: toWorld(lot, lx, ly, lz), s: [sx, sy, sz], rotY: lot.rotY, color, boost });

      // Massing: podium, shaft, setback crown, rooftop clutter.
      add(0, PODIUM / 2, 0, S, PODIUM, S);
      add(0, PODIUM + (h - PODIUM) / 2, -0.5, w, h - PODIUM, w);
      const crownH = 4 + r * 8;
      add(0, h + crownH / 2, -1.2, w * 0.62, crownH, w * 0.62);
      add(-w * 0.3, h + 0.8, w * 0.25, 1.6, 1.6, 1.2);
      add(w * 0.28, h + 0.6, -w * 0.3, 2.2, 1.2, 1.6);
      // Dark bezel behind the screen.
      add(0, SCREEN_Y, S / 2 + 0.1, SCREEN_W + 0.6, SCREEN_H + 0.6, 0.25);

      // Neon: corner edges or horizontal bands, roof ring, cornice, screen frame, antenna.
      const e = 0.12;
      if (r < 0.5) {
        for (const sx of [-1, 1]) bar((sx * w) / 2, PODIUM + (h - PODIUM) / 2, -0.5 + w / 2, e, h - PODIUM, e);
      } else {
        const step = 5 + Math.round(r * 4);
        for (let y = PODIUM + step; y < h - 2; y += step) bar(0, y, -0.5 + w / 2 + 0.02, w, 0.08, 0.06, col, 1.6);
      }
      for (const s of [-1, 1]) {
        bar(0, h, -0.5 + (s * w) / 2, w, e, e);
        bar((s * w) / 2, h, -0.5, e, e, w);
      }
      bar(0, PODIUM, S / 2 + 0.05, S, 0.16, 0.12);
      const fz = S / 2 + 0.26;
      bar(0, SCREEN_Y + SCREEN_H / 2 + 0.3, fz, SCREEN_W + 0.6, 0.08, 0.06, col, 2.2);
      bar(0, SCREEN_Y - SCREEN_H / 2 - 0.3, fz, SCREEN_W + 0.6, 0.08, 0.06, col, 2.2);
      for (const s of [-1, 1]) bar((s * (SCREEN_W + 0.6)) / 2, SCREEN_Y, fz, 0.08, SCREEN_H + 0.68, 0.06, col, 2.2);
      bar(w * 0.2, h + crownH + 3, -1.2, 0.12, 6, 0.12, "#3a3f55", 1);
      bar(w * 0.2, h + crownH + 6.1, -1.2, 0.35, 0.35, 0.35, "#ff2a3a", 5);

      // Wet street reflections of the screen and of the cornice.
      const [sx, , sz] = toWorld(lot, 0, 0, S / 2 + 1 + 4.5);
      glows.push({ x: sx, z: sz, w: SCREEN_W * 0.9, l: 9, rotY: lot.rotY, color: col, strength: 0.32 });
      const [cx, , cz] = toWorld(lot, 0, 0, S / 2 + 1 + 3);
      glows.push({ x: cx, z: cz, w: S * 0.9, l: 6, rotY: lot.rotY, color: "#ffffff", strength: 0.06 });
    }

    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), buildingMaterial(), boxes.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    boxes.forEach((b, i) => bodies.setMatrixAt(i, m.compose(new THREE.Vector3(...b.p), q.setFromAxisAngle(up, b.rotY), new THREE.Vector3(...b.s))));
    bodies.instanceMatrix.needsUpdate = true;
    bodies.computeBoundingSphere();
    return { bodies, neon: barsMesh(bars), streaks: glowMesh(glows, streakTexture()) };
  }, [lots]);

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
      for (const o of [bodies, neon, streaks]) {
        o.geometry.dispose();
        o.dispose();
      }
    },
    [bodies, neon, streaks]
  );

  return (
    <>
      <primitive object={bodies} />
      <primitive object={neon} />
      <primitive object={streaks} />
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
