import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR } from "@/lib/meta";
import { quadGeometry, signMaterial, textAtlas, type AtlasItem, type Quad } from "./batch";
import { LOT_SIZE, MARKET_ANGLE, MARKET_LENGTH, PLAZA_RADIUS, STREET_HALF_WIDTH, hash01, streetPoint, type CityLayout, type StreetKind } from "./layout";
import { SCREEN_H, SCREEN_Y, toWorld } from "./Towers";

export const STREET_COLOR: Record<StreetKind, string> = { web: "#36c8ff", android: "#2ef2a0", desktop: "#ff3dcb", market: "#ff8a3d" };
const STREET_LABEL: Record<StreetKind, string> = { web: "WEB", android: "ANDROID", desktop: "DESKTOP", market: "夜市 NIGHT MARKET" };

/** Ambient signage: short Japanese words and city clichés, no meaning needed. */
const KANJI = ["電脳", "ネオン", "未来", "酒場", "ホテル", "東京", "電気", "夜", "雨", "零", "迷宮", "回路", "記憶", "夢", "光", "街"];
const SHOP = ["RAMEN", "OPEN 24H", "BAR", "NOODLES", "ARCADE", "HOTEL", "SUSHI", "CYBER", "PACHINKO", "KARAOKE"];
const SIGN_COLORS = ["#ff2bd6", "#36c8ff", "#ff8a3d", "#ffe14d", "#7c5cff", "#ff3355", "#2ef2a0"];

/** Every text in the city, in one atlas and one draw call. */
export default function Signs({ layout }: { layout: CityLayout }) {
  const { t, category } = useT();

  const mesh = useMemo(() => {
    const items: AtlasItem[] = [];
    const quads: Omit<Quad, "rect">[] = [];
    const add = (item: AtlasItem, q: Omit<Quad, "rect">) => {
      items.push(item);
      quads.push(q);
    };
    /** Readable from both sides: the same text twice, back to back. */
    const both = (item: AtlasItem, q: Omit<Quad, "rect">) => {
      const nx = Math.sin(q.rotY) * 0.03;
      const nz = Math.cos(q.rotY) * 0.03;
      add(item, { ...q, position: [q.position[0] + nx, q.position[1], q.position[2] + nz] });
      add(item, { ...q, rotY: q.rotY + Math.PI, position: [q.position[0] - nx, q.position[1], q.position[2] - nz] });
    };

    for (const lot of layout.lots) {
      const p = lot.project;
      const col = CATEGORY_COLOR[p.category];
      add({ text: p.title.toUpperCase(), sub: p.platforms.join(" · "), size: 72 }, { height: 1.7, position: toWorld(lot, 0, SCREEN_Y + SCREEN_H / 2 + 1.6, LOT_SIZE / 2 + 0.35), rotY: lot.rotY, color: col, intensity: 2.4 });
      // A vertical kanji blade hanging off the front corner, sticking out over the pavement.
      const k = hash01(p.name + "k");
      const word = KANJI[Math.floor(k * KANJI.length)];
      const side = k < 0.5 ? -1 : 1;
      const hgt = word.length * 2.2;
      both(
        { text: word, vertical: true, size: 96 },
        { height: hgt, position: toWorld(lot, side * (LOT_SIZE / 2 - 0.4), PODIUM_TOP + 2 + hgt / 2 + k * 6, LOT_SIZE / 2 + 0.9), rotY: lot.rotY + (side * Math.PI) / 2, color: SIGN_COLORS[Math.floor(k * 97) % SIGN_COLORS.length], intensity: 2.6, flicker: k < 0.35 ? k * 10 : -1 }
      );
    }

    for (const s of layout.signs)
      both({ text: category(s.category), size: 72 }, { height: 1.1, position: [s.x, 4.4, s.z], rotY: s.rotY, color: CATEGORY_COLOR[s.category], intensity: 2.6 });

    const counts = new Map<StreetKind, number>();
    for (const l of layout.lots) counts.set(l.district, (counts.get(l.district) ?? 0) + 1);
    for (const st of layout.streets) {
      const [x, z] = streetPoint(st.angle, PLAZA_RADIUS + 4, 0);
      const sub = st.district === "market" ? undefined : `${counts.get(st.district) ?? 0} ${t("projects")}`;
      both({ text: STREET_LABEL[st.district], sub, size: 96 }, { height: sub ? 2.4 : 1.6, position: [x, 12.4, z], rotY: -st.angle, color: STREET_COLOR[st.district], intensity: 3 });
    }

    // Plaza: the name on the four sides of a square around the hologram.
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      add({ text: "FLORIAN DAUNAY", size: 72 }, { height: 0.9, position: [Math.sin(a) * 3.4, 1.6, Math.cos(a) * 3.4], rotY: a, color: "#e8ecff", intensity: 1.6 });
    }

    // Night market: shop signs on both sides.
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const along = PLAZA_RADIUS + 10 + Math.floor(i / 2) * 9;
      if (along > MARKET_LENGTH - 6) break;
      const [x, z] = streetPoint(MARKET_ANGLE, along, side * (STREET_HALF_WIDTH + 0.6));
      const k = hash01(`m${i}`);
      const vertical = k < 0.45;
      const color = SIGN_COLORS[i % SIGN_COLORS.length];
      if (vertical) {
        const word = KANJI[(i * 5) % KANJI.length];
        both({ text: word, vertical: true, size: 96 }, { height: word.length * 1.6, position: [x, 5 + k * 3, z], rotY: -MARKET_ANGLE, color, intensity: 2.8, flicker: i * 1.7 });
      } else {
        both({ text: SHOP[i % SHOP.length], size: 72 }, { height: 1.1, position: [x, 3.6 + k * 2, z], rotY: -MARKET_ANGLE + (side * Math.PI) / 2 + Math.PI, color, intensity: 2.6, flicker: k < 0.7 ? i : -1 });
      }
    }

    // Skyline holo-signs: giant vertical words floating over the far blocks.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = 120 + hash01(`hs${i}`) * 50;
      const word = KANJI[(i * 3 + 1) % KANJI.length];
      add({ text: word, vertical: true, size: 128 }, { height: word.length * 9, position: [Math.sin(a) * r, 55 + hash01(`hy${i}`) * 25, -Math.cos(a) * r], rotY: -a, color: SIGN_COLORS[i % SIGN_COLORS.length], intensity: 1.6, flicker: i % 3 === 0 ? i : -1 });
    }

    const { tex, rects } = textAtlas(items);
    const geo = quadGeometry(quads.map((q, i) => ({ ...q, rect: rects[i] })));
    const mat = signMaterial(tex);
    mat.side = THREE.FrontSide;
    return new THREE.Mesh(geo, mat);
  }, [layout, t, category]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh]
  );

  return <primitive object={mesh} renderOrder={2} />;
}

const PODIUM_TOP = 8;
