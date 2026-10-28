// Draw-call savers: every text sign of the city lives in ONE atlas texture and ONE merged mesh,
// every screenshot in another. Flicker is computed in the vertex shader from a shared clock.
import * as THREE from "three";

/** Shared clock uniform, advanced once per frame by the world. */
export const uTime = { value: 0 };

export interface AtlasItem {
  text: string;
  sub?: string;
  vertical?: boolean;
  /** Glyph size in atlas pixels. */
  size?: number;
  font?: string;
}

export interface AtlasRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  aspect: number;
}

const SANS = "Inter, system-ui, sans-serif";
const CJK = '"Yu Gothic", "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans JP", "MS Gothic", sans-serif';

function renderItem(item: AtlasItem): HTMLCanvasElement {
  const size = item.size ?? 64;
  const pad = Math.round(size * 0.3);
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  if (item.vertical) {
    const font = `700 ${size}px ${item.font ?? CJK}`;
    const chars = [...item.text];
    c.width = size + pad * 2;
    c.height = Math.round(chars.length * size * 1.08 + pad * 2);
    g.font = font;
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "top";
    chars.forEach((ch, i) => g.fillText(ch, c.width / 2, pad + i * size * 1.08));
    return c;
  }
  const font = `600 ${size}px ${item.font ?? SANS}`;
  const subFont = `500 ${Math.round(size * 0.4)}px "JetBrains Mono", monospace`;
  g.font = font;
  const tw = g.measureText(item.text).width;
  g.font = subFont;
  const sw = item.sub ? g.measureText(item.sub).width : 0;
  c.width = Math.ceil(Math.max(tw, sw) + pad * 2);
  c.height = Math.ceil(size * (item.sub ? 1.7 : 1.2) + pad * 2);
  g.fillStyle = "#fff";
  g.textBaseline = "top";
  g.font = font;
  g.fillText(item.text, (c.width - tw) / 2, pad);
  if (item.sub) {
    g.font = subFont;
    g.globalAlpha = 0.7;
    g.fillText(item.sub, (c.width - sw) / 2, pad + size * 1.18);
  }
  return c;
}

/** Shelf-packs canvases into one texture. */
export function packAtlas(canvases: (HTMLCanvasElement | HTMLImageElement)[], width = 2048) {
  let x = 0;
  let y = 0;
  let shelf = 0;
  const pos: [number, number][] = [];
  for (const c of canvases) {
    if (x + c.width > width) {
      x = 0;
      y += shelf + 2;
      shelf = 0;
    }
    pos.push([x, y]);
    x += c.width + 2;
    shelf = Math.max(shelf, c.height);
  }
  const height = THREE.MathUtils.ceilPowerOfTwo(Math.max(1, y + shelf));
  const atlas = document.createElement("canvas");
  atlas.width = width;
  atlas.height = height;
  const g = atlas.getContext("2d")!;
  const rects: AtlasRect[] = canvases.map((c, i) => {
    const [px, py] = pos[i];
    g.drawImage(c, px, py);
    return { u0: px / width, u1: (px + c.width) / width, v0: 1 - (py + c.height) / height, v1: 1 - py / height, aspect: c.width / c.height };
  });
  const tex = new THREE.CanvasTexture(atlas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, rects };
}

export function textAtlas(items: AtlasItem[]) {
  return packAtlas(items.map(renderItem));
}

export interface Quad {
  rect: AtlasRect;
  /** Height in metres; width follows the texture aspect unless given. */
  height: number;
  width?: number;
  position: [number, number, number];
  rotY: number;
  color: THREE.ColorRepresentation;
  intensity?: number;
  /** < 0: steady. Otherwise seeds the flicker pattern. */
  flicker?: number;
}

/** Merges textured quads into one geometry (position, uv, color, flicker). */
export function quadGeometry(quads: Quad[]): THREE.BufferGeometry {
  const n = quads.length;
  const position = new Float32Array(n * 12);
  const uv = new Float32Array(n * 8);
  const color = new Float32Array(n * 12);
  const flicker = new Float32Array(n * 4);
  const index: number[] = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  quads.forEach((q, i) => {
    const h = q.height;
    const w = q.width ?? h * q.rect.aspect;
    m.makeRotationY(q.rotY).setPosition(...q.position);
    const corners: [number, number][] = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
    corners.forEach(([x, y], k) => {
      v.set(x, y, 0).applyMatrix4(m);
      position.set([v.x, v.y, v.z], i * 12 + k * 3);
    });
    const { u0, v0, u1, v1 } = q.rect;
    uv.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
    c.set(q.color).multiplyScalar(q.intensity ?? 1);
    for (let k = 0; k < 4; k++) {
      color.set([c.r, c.g, c.b], i * 12 + k * 3);
      flicker[i * 4 + k] = q.flicker ?? -1;
    }
    const b = i * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geo.setAttribute("flicker", new THREE.BufferAttribute(flicker, 1));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Unlit material for merged quads: vertex colour × texture, optional flicker and hologram
 * scanlines. Colours above 1 feed the bloom.
 */
export function signMaterial(map: THREE.Texture, opts: { holo?: boolean; additive?: boolean } = {}) {
  const m = new THREE.MeshBasicMaterial({
    map,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float flicker;\nuniform float uTime;\nvarying float vFlick;\nvarying float vY;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFlick = 1.0;
        if (flicker >= 0.0) {
          float t = uTime * 9.0 + flicker * 37.0;
          float r = fract(sin(floor(t) * 12.9898 + flicker * 78.233) * 43758.5453);
          // Mostly on, a short stutter now and then, plus a faint mains hum.
          vFlick = (r < 0.07 ? 0.15 + 0.4 * fract(t * 7.0) : 1.0) * (0.93 + 0.07 * sin(uTime * 50.0 + flicker));
        }
        vY = position.y;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nvarying float vFlick;\nvarying float vY;`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= vFlick;
        ${opts.holo ? "float scan = 0.72 + 0.28 * sin(vY * 22.0 - uTime * 3.0); diffuseColor.rgb *= scan; diffuseColor.a *= 0.85;" : ""}`
      );
  };
  return m;
}
