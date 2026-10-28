// Procedural canvas textures: no image downloads besides project screenshots.
import * as THREE from "three";

let windowsTex: THREE.CanvasTexture | null = null;

/** Tileable facade: mostly dark, sparse amber windows, a few neon-tinted ones. Used as emissive map. */
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
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = 8;
  const rows = 32;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.74) continue;
      const k = rnd();
      const a = 0.25 + rnd() * 0.75;
      g.fillStyle = k < 0.68 ? `rgba(255,170,90,${a})` : k < 0.84 ? `rgba(120,210,255,${a})` : k < 0.93 ? `rgba(255,90,200,${a})` : `rgba(255,236,210,${a})`;
      g.fillRect(x * (w / cols) + 3, y * (h / rows) + 2, w / cols - 6, h / rows - 4);
    }
  windowsTex = new THREE.CanvasTexture(c);
  windowsTex.wrapS = windowsTex.wrapT = THREE.RepeatWrapping;
  windowsTex.colorSpace = THREE.SRGBColorSpace;
  windowsTex.anisotropy = 4;
  return windowsTex;
}

/** Soft radial glow, for light pools and haze sprites. */
let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** Long soft streak (bright core fading along its length): neon reflection on wet asphalt. */
let streakTex: THREE.CanvasTexture | null = null;
export function streakTexture() {
  if (streakTex) return streakTex;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 128;
  const g = c.getContext("2d")!;
  const img = g.createImageData(32, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x - 15.5) / 16;
      const fy = y / 127;
      // Strong near the facade (y=0 → texture v=1 after flip), dissolving toward the viewer.
      const a = Math.max(0, 1 - dx * dx * 1.6) ** 2 * (1 - fy) ** 1.6 * (0.75 + 0.25 * Math.sin(y * 0.9 + x * 0.3));
      const i = (y * 32 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  streakTex = new THREE.CanvasTexture(c);
  return streakTex;
}
