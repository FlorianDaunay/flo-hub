// Procedural canvas textures: no image downloads besides project screenshots.
import * as THREE from "three";

let windowsTex: THREE.CanvasTexture | null = null;

/** Tileable facade: dark glass with random warm/cool lit windows. Used as emissive map. */
export function windowsTexture(): THREE.CanvasTexture {
  if (windowsTex) return windowsTex;
  const w = 128;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = 8;
  const rows = 32;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.62) continue;
      const warm = rnd() < 0.55;
      const a = 0.35 + rnd() * 0.65;
      g.fillStyle = warm ? `rgba(255,196,128,${a})` : `rgba(150,200,255,${a})`;
      g.fillRect(x * (w / cols) + 3, y * (h / rows) + 2, w / cols - 6, h / rows - 4);
    }
  windowsTex = new THREE.CanvasTexture(c);
  windowsTex.wrapS = windowsTex.wrapT = THREE.RepeatWrapping;
  windowsTex.colorSpace = THREE.SRGBColorSpace;
  windowsTex.anisotropy = 4;
  return windowsTex;
}

/** Neon text sign (white glyphs, transparent background); tint it with the material colour. */
export function labelTexture(text: string, opts: { font?: string; size?: number; pad?: number; sub?: string } = {}) {
  const size = opts.size ?? 96;
  const pad = opts.pad ?? 24;
  const font = `600 ${size}px ${opts.font ?? "Inter, system-ui, sans-serif"}`;
  const subFont = `500 ${Math.round(size * 0.38)}px "JetBrains Mono", monospace`;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = font;
  const tw = g.measureText(text).width;
  g.font = subFont;
  const sw = opts.sub ? g.measureText(opts.sub).width : 0;
  c.width = Math.ceil(Math.max(tw, sw) + pad * 2);
  c.height = Math.ceil(size * (opts.sub ? 1.75 : 1.25) + pad * 2);
  g.textBaseline = "top";
  g.fillStyle = "#fff";
  g.font = font;
  g.fillText(text, (c.width - tw) / 2, pad);
  if (opts.sub) {
    g.font = subFont;
    g.globalAlpha = 0.75;
    g.fillText(opts.sub, (c.width - sw) / 2, pad + size * 1.2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}

/** Soft radial glow sprite for lamp halos. */
let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
