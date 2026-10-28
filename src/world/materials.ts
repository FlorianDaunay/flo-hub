// Shared materials. Every building surface uses ONE procedural facade material (no textures):
// window grid, frames, spandrels, seams, grime, and "interior mapping" so each window shows a
// lit or dark room with real parallax. Detail parts (ledges, balconies, pipes...) share another.
import * as THREE from "three";
import { uTime } from "./batch";

/** 1 = full facade (interior rooms), 0 = cheap lit windows. Set from the quality toggle. */
export const uDetail = { value: 1 };

let buildingMat: THREE.MeshStandardMaterial | null = null;

const FACADE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uDetail;
varying vec3 vWPos;
varying vec3 vWNrm;
varying float vSeed;
varying vec2 vCenter;
float fh1(float n){ return fract(sin(n) * 43758.5453123); }
float fh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float fnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(fh2(i), fh2(i+vec2(1,0)), f.x), mix(fh2(i+vec2(0,1)), fh2(i+vec2(1,1)), f.x), f.y); }

vec3 fAlbedo; float fRough; float fMetal; vec3 fEmis;

vec3 roomLight(float r){
  // Warm tungsten most of the time, some cold office light, some neon-lit rooms.
  if (r < 0.55) return vec3(1.0, 0.62, 0.32);
  if (r < 0.78) return vec3(0.62, 0.8, 1.0);
  if (r < 0.9) return vec3(1.0, 0.28, 0.75);
  return vec3(0.35, 0.95, 0.9);
}

void facade(){
  vec3 N = normalize(vWNrm);
  float seed = vSeed;
  if (abs(N.y) > 0.5) {
    // Roof: dark tar with gravel speckle.
    float g = fnoise(vWPos.xz * 3.0);
    fAlbedo = vec3(0.035, 0.036, 0.04) * (0.7 + 0.6 * g);
    fRough = 0.85; fMetal = 0.1; fEmis = vec3(0.0);
    return;
  }
  vec3 T = normalize(vec3(-N.z, 0.0, N.x));
  // Boxes are axis-aligned: plain projection. Round towers: unroll the circumference.
  vec2 rel = vWPos.xz - vCenter;
  bool round = abs(N.x) > 0.02 && abs(N.z) > 0.02;
  float u = round ? atan(rel.y, rel.x) * length(rel) : dot(vWPos, T);
  float v = vWPos.y;
  float style = floor(fh1(seed * 3.1) * 3.0);
  float bay = mix(2.1, 3.3, fh1(seed * 7.7));
  float flr = mix(3.3, 4.0, fh1(seed * 11.3));
  vec2 w0, w1;
  bool shop = v < 4.6;
  if (shop) { flr = 4.6; bay = 3.6; w0 = vec2(0.04, 0.04); w1 = vec2(0.96, 0.78); }
  else if (style < 0.5) { w0 = vec2(0.035, 0.1); w1 = vec2(0.965, 0.97); }        // curtain wall
  else if (style < 1.5) { w0 = vec2(0.24, 0.26); w1 = vec2(0.76, 0.86); }         // punched windows
  else { w0 = vec2(0.02, 0.34); w1 = vec2(0.98, 0.84); }                          // ribbon windows

  vec2 q = vec2(u / bay, v / flr);
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float inWin = step(w0.x, f.x) * step(f.x, w1.x) * step(w0.y, f.y) * step(f.y, w1.y);
  float dist = length(vWPos - cameraPosition);

  // Wall: concrete / dark metal panels, seams at bay edges, ledge at each floor, rain streaks.
  vec3 wall = style < 0.5 ? vec3(0.025, 0.03, 0.04) : mix(vec3(0.075, 0.075, 0.08), vec3(0.11, 0.095, 0.085), fh1(seed * 5.3));
  float seam = smoothstep(0.0, 0.025, min(f.x, 1.0 - f.x)) * smoothstep(0.0, 0.03, min(f.y, 1.0 - f.y));
  float ledge = smoothstep(0.08, 0.0, f.y);
  float streak = fnoise(vec2(u * 2.3, v * 0.08 + fh1(cell.x) * 7.0));
  float grime = mix(0.55, 1.0, smoothstep(0.0, 18.0, v)) * (0.75 + 0.35 * streak);
  vec3 wallCol = wall * grime * mix(0.55, 1.0, seam) + ledge * 0.05;

  if (inWin < 0.5) {
    fAlbedo = wallCol; fRough = style < 0.5 ? 0.35 : 0.8; fMetal = style < 0.5 ? 0.7 : 0.15; fEmis = vec3(0.0);
    return;
  }

  float rs = fh2(cell + seed * 91.7);
  float litChance = shop ? 0.75 : mix(0.22, 0.42, fh1(seed * 2.9));
  float lit = step(1.0 - litChance, rs);
  vec3 light = roomLight(fh2(cell * 1.7 + seed));
  // A few rooms have a flickering TV.
  float tv = step(0.93, fh2(cell + 3.3)) * (0.6 + 0.4 * sin(uTime * 7.0 + rs * 40.0) * sin(uTime * 2.3 + rs * 9.0));
  vec3 emis = vec3(0.0);
  vec2 wsz = (w1 - w0) * vec2(bay, flr);
  vec2 wl = (f - w0) / (w1 - w0);

  if (uDetail > 0.5 && dist < 170.0) {
    // Interior mapping: march the view ray into a box room behind the glass.
    vec3 V = normalize(vWPos - cameraPosition);
    vec3 rd = vec3(dot(V, T), V.y, -dot(V, N));
    rd.z = max(rd.z, 1e-3);
    float depth = mix(3.0, 6.0, fh1(rs * 13.0));
    vec3 ro = vec3(wl.x * wsz.x, wl.y * wsz.y, 0.0);
    float tx = rd.x > 0.0 ? (wsz.x - ro.x) / rd.x : -ro.x / min(rd.x, -1e-4);
    float ty = rd.y > 0.0 ? (wsz.y + 0.4 - ro.y) / rd.y : (-0.25 - ro.y) / min(rd.y, -1e-4);
    float tz = depth / rd.z;
    float t = min(min(tx, ty), tz);
    vec3 h = ro + rd * t;
    float shade;
    vec2 sp;
    if (t == tz) { shade = 1.0; sp = h.xy; }                 // back wall
    else if (t == tx) { shade = 0.7; sp = h.zy; }            // side walls
    else if (rd.y > 0.0) { shade = 0.95; sp = h.xz; }        // ceiling
    else { shade = 0.45; sp = h.xz; }                        // floor
    // Ceiling lamp: brighter near the top centre of the room.
    float lamp = 1.0 / (1.0 + 0.12 * dot(h - vec3(wsz.x * 0.5, wsz.y, depth * 0.5), h - vec3(wsz.x * 0.5, wsz.y, depth * 0.5)));
    float furn = 0.0;
    if (t == tz) {
      // Furniture silhouettes and a picture/shelf on the back wall.
      float k = fh1(rs * 31.0);
      furn = step(h.y, 0.9 + k * 0.5) * step(wsz.x * (0.15 + 0.3 * k), h.x) * step(h.x, wsz.x * (0.6 + 0.3 * k));
      float pic = step(1.4, h.y) * step(h.y, 2.1) * step(wsz.x * 0.3, h.x) * step(h.x, wsz.x * 0.55);
      shade *= 1.0 - 0.35 * pic;
    }
    float room = shade * (0.3 + 1.1 * lamp) * (1.0 - 0.8 * furn);
    emis = light * room * (0.9 * lit) + vec3(0.25, 0.45, 1.0) * tv * shade;
    // Unlit rooms: faint spill so the depth still reads.
    emis += vec3(0.015, 0.016, 0.022) * shade * (1.0 - lit);
    // Blinds on some windows, glowing when the room is lit.
    float blinds = step(0.7, fh1(rs * 5.0)) * step(0.4, fract(wl.y * wsz.y * 5.0));
    emis = mix(emis, light * 0.55 * lit, blinds * 0.85 * step(0.35, wl.y));
  } else {
    emis = light * (0.55 * lit) + vec3(0.25, 0.45, 1.0) * tv;
  }
  // Inset frame: darker near the window edge, thin mullion in the middle of wide panes.
  float edge = min(min(wl.x * wsz.x, (1.0 - wl.x) * wsz.x), min(wl.y * wsz.y, (1.0 - wl.y) * wsz.y));
  float frame = smoothstep(0.02, 0.14, edge);
  float mull = (style < 0.5 || shop) ? smoothstep(0.015, 0.04, abs(wl.x - 0.5) * wsz.x) : 1.0;
  emis *= frame * mull * (shop ? 0.85 : 1.1);
  // Far away: settle to the average so windows don't shimmer.
  emis = mix(emis, light * 0.22 * lit, smoothstep(140.0, 260.0, dist));

  fAlbedo = mix(vec3(0.01, 0.012, 0.016), wallCol * 0.6, 1.0 - frame);
  fRough = mix(0.05, 0.6, 1.0 - frame);
  fMetal = 0.9;
  fEmis = emis;
}
`;

export function buildingMaterial(): THREE.MeshStandardMaterial {
  if (buildingMat) return buildingMat;
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", envMapIntensity: 1.1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uDetail = uDetail;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying float vSeed;\nvarying vec2 vCenter;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        vec4 wc = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          wc = instanceMatrix * wc;
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        wp = modelMatrix * wp;
        vWPos = wp.xyz;
        vWNrm = normalize(mat3(modelMatrix) * wn);
        vSeed = aSeed;
        vCenter = (modelMatrix * wc).xz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FACADE_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\nfacade();\ndiffuseColor.rgb = fAlbedo;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = fRough;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = fMetal;")
      .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance = fEmis;");
  };
  buildingMat = m;
  return m;
}

export interface Part {
  p: [number, number, number];
  s: [number, number, number];
  rotY?: number;
  /** Full rotation [x, y, z] (applied Y then X then Z) when a part is not upright. */
  rot?: [number, number, number];
  /** Facade seed: parts of the same building share it so they share a style. */
  seed?: number;
  color?: THREE.ColorRepresentation;
}

function compose(m: THREE.Matrix4, part: Part) {
  const q = new THREE.Quaternion();
  if (part.rot) q.setFromEuler(new THREE.Euler(part.rot[0], part.rot[1], part.rot[2], "YXZ"));
  else q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), part.rotY ?? 0);
  return m.compose(new THREE.Vector3(...part.p), q, new THREE.Vector3(...part.s));
}

/** Instanced buildings (boxes or cylinders) with the facade material and a per-instance seed. */
export function buildingMesh(parts: Part[], geometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1)): THREE.InstancedMesh {
  const geo = geometry.clone();
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(parts.map((p) => p.seed ?? Math.random() * 100)), 1));
  const mesh = new THREE.InstancedMesh(geo, buildingMaterial(), parts.length);
  const m = new THREE.Matrix4();
  parts.forEach((part, i) => mesh.setMatrixAt(i, compose(m, part)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

let detailMat: THREE.MeshStandardMaterial | null = null;
/** Dark weathered metal for structural details; tinted per instance. */
export function detailMaterial() {
  return (detailMat ??= new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0.75, envMapIntensity: 1 }));
}

export function detailMesh(parts: Part[], geometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1)): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, detailMaterial(), parts.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  parts.forEach((part, i) => {
    mesh.setMatrixAt(i, compose(m, part));
    mesh.setColorAt(i, c.set(part.color ?? "#2a2d36"));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Instanced neon bars: one draw call for any number of glowing boxes, coloured per instance. */
export interface Bar {
  p: [number, number, number];
  s: [number, number, number];
  rotY?: number;
  color: THREE.ColorRepresentation;
  boost?: number;
}

export function barsMesh(bars: Bar[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), bars.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  bars.forEach((b, i) => {
    q.setFromAxisAngle(up, b.rotY ?? 0);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s)));
    mesh.setColorAt(i, c.set(b.color).multiplyScalar(b.boost ?? 3));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Instanced additive glow quads lying on the ground: fake wet-asphalt reflections and light pools. */
export interface Glow {
  x: number;
  z: number;
  w: number;
  l: number;
  rotY: number;
  color: THREE.ColorRepresentation;
  strength?: number;
}

export function glowMesh(glows: Glow[], texture: THREE.Texture, y = 0.05): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, glows.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  glows.forEach((g, i) => {
    q.setFromAxisAngle(up, g.rotY);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(g.x, y + i * 0.0004, g.z), q, new THREE.Vector3(g.w, 1, g.l)));
    mesh.setColorAt(i, c.set(g.color).multiplyScalar(g.strength ?? 0.5));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
