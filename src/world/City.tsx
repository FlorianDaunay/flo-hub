import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CATEGORY_COLOR } from "@/lib/meta";
import { quadGeometry, signMaterial, uTime, type Quad } from "./batch";
import { LOT_OFFSET, LOT_SIZE, MARKET_ANGLE, MARKET_LENGTH, PLAZA_RADIUS, STREET_HALF_WIDTH, hash01, streetPoint, type CityLayout } from "./layout";
import { barsMesh, buildingMesh, detailMesh, glowMesh, type Bar, type Glow, type Part } from "./materials";
import { STREET_COLOR } from "./Signs";
import { flash } from "./Atmosphere";
import { glowTexture } from "./textures";
import type { useScreenAtlas } from "./Towers";

export const CITY_RADIUS = 230;
const box = new THREE.BoxGeometry(1, 1, 1);

/** Gradient sky with drifting, city-lit clouds and lightning. Drawn behind everything, no fog. */
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTime, uFlash: flash },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vDir; uniform float uTime; uniform float uFlash;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
          void main(){
            float y = clamp(vDir.y, -0.2, 1.0);
            vec3 horizon = vec3(0.30, 0.12, 0.17);
            vec3 mid = vec3(0.07, 0.05, 0.10);
            vec3 top = vec3(0.012, 0.014, 0.03);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, y));
            col = mix(col, top, smoothstep(0.18, 0.7, y));
            vec2 uv = vDir.xz / max(0.12, vDir.y + 0.15) * 1.2 + vec2(uTime * 0.012, uTime * 0.004);
            float c = fbm(uv);
            float under = smoothstep(0.35, 0.85, c) * (1.0 - smoothstep(0.05, 0.6, y));
            col += vec3(0.32, 0.12, 0.16) * under * 0.6 + vec3(0.08, 0.1, 0.16) * smoothstep(0.5, 0.9, c) * 0.4;
            col += vec3(0.55, 0.6, 0.85) * uFlash * smoothstep(0.4, 0.9, c);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    []
  );
  const ref = useRef<THREE.Mesh>(null);
  // Follows the camera so it never gets clipped by the far plane.
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

/** Wet asphalt: metallic and smooth so it mirrors the environment, with rougher dry patches. */
function Ground() {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#0a0b10", roughness: 0.2, metalness: 0.85, envMapIntensity: 1.2 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vXZ;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvXZ = (modelMatrix * vec4(transformed,1.0)).xz;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec2 vXZ;
          float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
          float puddle = gn(vXZ * 0.18) * 0.65 + gn(vXZ * 0.7) * 0.35;
          roughnessFactor = mix(0.1, 0.55, smoothstep(0.35, 0.7, puddle));`
        );
    };
    return m;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[CITY_RADIUS * 2.6, CITY_RADIUS * 2.6]} />
    </mesh>
  );
}

function Streets({ layout }: { layout: CityLayout }) {
  const { slabs, neon, pools } = useMemo(() => {
    const slabsList: { p: [number, number, number]; s: [number, number, number]; rotY: number; dark?: boolean }[] = [];
    const bars: Bar[] = [];
    const glows: Glow[] = [];
    for (const st of layout.streets) {
      const run = st.length - PLAZA_RADIUS + 1;
      const rot = -st.angle;
      const col = STREET_COLOR[st.district];
      for (const s of [-1, 1]) {
        const [sx, sz] = streetPoint(st.angle, PLAZA_RADIUS - 1 + run / 2, s * (STREET_HALF_WIDTH + 1.25));
        slabsList.push({ p: [sx, 0.08, sz], s: [2.5, 0.16, run], rotY: rot });
        const [cx, cz] = streetPoint(st.angle, PLAZA_RADIUS - 1 + run / 2, s * STREET_HALF_WIDTH);
        bars.push({ p: [cx, 0.17, cz], s: [0.06, 0.02, run], rotY: rot, color: col, boost: 1.4 });
      }
      for (let a = PLAZA_RADIUS + 2; a < st.length - 2; a += 6) {
        const [dx, dz] = streetPoint(st.angle, a, 0);
        bars.push({ p: [dx, 0.012, dz], s: [0.16, 0.01, 2.2], rotY: rot, color: "#ffffff", boost: 0.25 });
      }
      // District gate.
      const span = STREET_HALF_WIDTH * 2 + 4;
      for (const s of [-1, 1]) {
        const [gx, gz] = streetPoint(st.angle, PLAZA_RADIUS + 4, (s * span) / 2);
        slabsList.push({ p: [gx, 5.5, gz], s: [1.2, 11, 1.2], rotY: rot });
        bars.push({ p: [gx, 5.5, gz], s: [1.26, 0.08, 1.26], rotY: rot, color: col, boost: 3 });
      }
      const [gx, gz] = streetPoint(st.angle, PLAZA_RADIUS + 4, 0);
      slabsList.push({ p: [gx, 10.9, gz], s: [span + 1.2, 1.4, 1.2], rotY: rot });
      bars.push({ p: [gx, 10.15, gz], s: [span + 1.2, 0.1, 1.3], rotY: rot, color: col, boost: 3 });
      glows.push({ x: gx, z: gz, w: span, l: 6, rotY: rot, color: col, strength: 0.16 });

      // Sodium street lamps (head bar + pool on the ground).
      for (let a = PLAZA_RADIUS + 10; a < st.length - 4; a += 15)
        for (const s of [-1, 1]) {
          const [lx, lz] = streetPoint(st.angle, a, s * (STREET_HALF_WIDTH + 0.6));
          slabsList.push({ p: [lx, 3.2, lz], s: [0.14, 6.4, 0.14], rotY: rot, dark: true });
          const [hx, hz] = streetPoint(st.angle, a, s * (STREET_HALF_WIDTH - 0.4));
          bars.push({ p: [hx, 6.3, hz], s: [1.8, 0.1, 0.45], rotY: rot, color: "#ffb062", boost: 4 });
          glows.push({ x: hx, z: hz, w: 10, l: 10, rotY: 0, color: "#ff9a4a", strength: 0.2 });
        }
    }
    // Plaza lamps.
    for (let i = 0; i < 10; i++) {
      const r = (i / 10) * Math.PI * 2 + Math.PI / 10;
      const x = Math.sin(r) * (PLAZA_RADIUS - 1.5);
      const z = Math.cos(r) * (PLAZA_RADIUS - 1.5);
      slabsList.push({ p: [x, 2.5, z], s: [0.14, 5, 0.14], rotY: 0, dark: true });
      bars.push({ p: [x, 5.05, z], s: [0.5, 0.12, 0.5], color: "#ffb062", boost: 4 });
      glows.push({ x, z, w: 8, l: 8, rotY: 0, color: "#ff9a4a", strength: 0.24 });
    }

    const slabs = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: "#1b1d26", roughness: 0.55, metalness: 0.6 }), slabsList.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    slabsList.forEach((b, i) => slabs.setMatrixAt(i, m.compose(new THREE.Vector3(...b.p), q.setFromAxisAngle(up, b.rotY), new THREE.Vector3(...b.s))));
    slabs.instanceMatrix.needsUpdate = true;
    slabs.computeBoundingSphere();
    return { slabs, neon: barsMesh(bars), pools: glowMesh(glows, glowTexture(), 0.06) };
  }, [layout]);

  return (
    <>
      <primitive object={slabs} />
      <primitive object={neon} />
      <primitive object={pools} />
    </>
  );
}

/** Central plaza: pedestal and a holographic core. */
function Plaza() {
  const core = useRef<THREE.Group>(null);
  const holo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime, uColor: { value: new THREE.Color("#46d6ff").multiplyScalar(1.6) } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
          void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vY = wp.y; vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vY;
          void main(){ float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);
            float scan = 0.55 + 0.45 * sin(vY * 30.0 - uTime * 4.0);
            float glitch = step(0.97, fract(sin(floor(uTime * 8.0)) * 4375.85)) * 0.6;
            gl_FragColor = vec4(uColor * (0.15 + fres * 1.6) * scan * (1.0 - glitch), 1.0); }`,
      }),
    []
  );
  useFrame((_, dt) => {
    if (core.current) core.current.rotation.y += dt * 0.3;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[PLAZA_RADIUS, 64]} />
        <meshStandardMaterial color="#0c0e15" roughness={0.12} metalness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[PLAZA_RADIUS - 0.12, PLAZA_RADIUS, 96]} />
        <meshBasicMaterial color={new THREE.Color("#ff2bd6").multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[2.6, 3, 1, 48]} />
        <meshStandardMaterial color="#141826" roughness={0.3} metalness={0.85} />
      </mesh>
      <group ref={core} position={[0, 6, 0]}>
        <mesh material={holo}>
          <icosahedronGeometry args={[2.4, 2]} />
        </mesh>
        <mesh material={holo} rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[3.8, 0.05, 8, 96]} />
        </mesh>
        <mesh material={holo} rotation={[Math.PI / 1.7, 0.6, 0]}>
          <torusGeometry args={[4.3, 0.03, 8, 96]} />
        </mesh>
      </group>
    </group>
  );
}

/** Background skyline in one instanced draw call, kept clear of the plaza and streets. */
function Skyline({ layout, atlas, lotsAtlasKeys }: { layout: CityLayout; atlas: ReturnType<typeof useScreenAtlas>; lotsAtlasKeys: { name: string; category: keyof typeof CATEGORY_COLOR }[] }) {
  const items = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number }[] = [];
    const clear = (x: number, z: number, r: number) => {
      if (Math.hypot(x, z) < PLAZA_RADIUS + r + 14) return false;
      for (const s of layout.streets) {
        const dx = Math.sin(s.angle);
        const dz = -Math.cos(s.angle);
        const along = x * dx + z * dz;
        const side = Math.abs(-x * dz + z * dx);
        if (along > -r && along < s.length + r + 4 && side < LOT_OFFSET + LOT_SIZE / 2 + r + 3) return false;
      }
      return true;
    };
    const cell = 16;
    for (let gx = -CITY_RADIUS; gx <= CITY_RADIUS; gx += cell)
      for (let gz = -CITY_RADIUS; gz <= CITY_RADIUS; gz += cell) {
        const k = `${gx},${gz}`;
        const x = gx + (hash01(k + "x") - 0.5) * 4;
        const z = gz + (hash01(k + "z") - 0.5) * 4;
        const dist = Math.hypot(x, z);
        if (dist > CITY_RADIUS || hash01(k) < 0.08) continue;
        const w = 8 + hash01(k + "w") * 6;
        const d = 8 + hash01(k + "d") * 6;
        if (!clear(x, z, Math.max(w, d) / 2)) continue;
        const h = 16 + hash01(k + "h") ** 2 * 120 * (0.5 + 0.5 * Math.exp(-(((dist - 85) / 75) ** 2)));
        out.push({ x, z, w, d, h });
      }
    return out;
  }, [layout]);

  const meshes = useMemo(() => {
    const boxes: Part[] = [];
    const cyls: Part[] = [];
    const dBox: Part[] = [];
    const dCyl: Part[] = [];
    const bars: Bar[] = [];
    const tint = ["#ff2bd6", "#36c8ff", "#ff8a3d", "#7c5cff"];
    items.forEach((b) => {
      const k = hash01(`${b.x}${b.z}`);
      const seed = k * 100;
      const round = k > 0.86 && b.h > 40;
      if (round) cyls.push({ p: [b.x, b.h / 2, b.z], s: [Math.min(b.w, b.d), b.h, Math.min(b.w, b.d)], seed });
      else boxes.push({ p: [b.x, b.h / 2, b.z], s: [b.w, b.h, b.d], seed });
      // Tiers on the tall ones, a cornice on each.
      if (b.h > 45 && !round) {
        boxes.push({ p: [b.x, b.h + 6, b.z], s: [b.w * 0.7, 12, b.d * 0.7], seed });
        dBox.push({ p: [b.x, b.h + 0.2, b.z], s: [b.w + 0.5, 0.4, b.d + 0.5], color: "#23262e" });
        if (b.h > 80) boxes.push({ p: [b.x, b.h + 16, b.z], s: [b.w * 0.42, 8, b.d * 0.42], seed });
      } else if (!round) dBox.push({ p: [b.x, b.h + 0.2, b.z], s: [b.w + 0.4, 0.4, b.d + 0.4], color: "#23262e" });
      const roofY = b.h > 80 && !round ? b.h + 20 : b.h > 45 && !round ? b.h + 12 : b.h;
      // Rooftop: water tank or AC block, masts with warning lights.
      if (k < 0.45) dCyl.push({ p: [b.x + b.w * 0.15, roofY + 1.6, b.z - b.d * 0.15], s: [2.4, 3.2, 2.4], color: "#3d3833" });
      else dBox.push({ p: [b.x - b.w * 0.1, roofY + 0.8, b.z + b.d * 0.1], s: [b.w * 0.35, 1.6, b.d * 0.3], color: "#41454e" });
      if (b.h > 70) {
        dBox.push({ p: [b.x, roofY + 6, b.z], s: [0.25, 12, 0.25], color: "#3b3f4a" });
        bars.push({ p: [b.x, roofY + 12.2, b.z], s: [0.6, 0.6, 0.6], color: "#ff2a3a", boost: 5 });
      }
      if (k < 0.3 && !round) {
        const c = tint[Math.floor(k * 13) % tint.length];
        for (const sd of [-1, 1]) {
          bars.push({ p: [b.x, b.h + 0.45, b.z + (sd * (b.d + 0.5)) / 2], s: [b.w + 0.5, 0.15, 0.15], color: c, boost: 2.4 });
          bars.push({ p: [b.x + (sd * (b.w + 0.5)) / 2, b.h + 0.45, b.z], s: [0.15, 0.15, b.d + 0.5], color: c, boost: 2.4 });
        }
      }
    });
    return [buildingMesh(boxes), buildingMesh(cyls, new THREE.CylinderGeometry(0.5, 0.5, 1, 32)), detailMesh(dBox), detailMesh(dCyl, new THREE.CylinderGeometry(0.5, 0.5, 1, 12)), barsMesh(bars)];
  }, [items]);

  // Giant holographic billboards: project screenshots on tall blocks, facing the centre.
  const ads = useMemo(() => {
    if (!atlas || !lotsAtlasKeys.length) return null;
    const quads: Quad[] = [];
    const tall = items.filter((b) => b.h > 45 && Math.hypot(b.x, b.z) < 160);
    tall
      .filter((_, i) => i % 3 === 0)
      .slice(0, 14)
      .forEach((b, i) => {
        const p = lotsAtlasKeys[i % lotsAtlasKeys.length];
        const rect = atlas.rects.get(p.name);
        if (!rect) return;
        const a = Math.atan2(-b.x, -b.z);
        const off = Math.max(b.w, b.d) / 2 + 0.6;
        const dir = new THREE.Vector2(-b.x, -b.z).normalize();
        quads.push({ rect, height: 9, width: 14.4, position: [b.x + dir.x * off, b.h * 0.62, b.z + dir.y * off], rotY: a, color: CATEGORY_COLOR[p.category], intensity: 1.15 });
      });
    return new THREE.Mesh(quadGeometry(quads), signMaterial(atlas.tex, { holo: true, additive: true }));
  }, [atlas, items, lotsAtlasKeys]);

  useEffect(() => () => void ads?.geometry.dispose(), [ads]);

  return (
    <>
      {meshes.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
      {ads && <primitive object={ads} />}
    </>
  );
}

/** Night market alley: stalls, awnings, lanterns and the buildings that frame it. */
function Market() {
  const { blocks, stallMesh, neon, pools } = useMemo(() => {
    const list: Part[] = [];
    const stalls: Part[] = [];
    const bars: Bar[] = [];
    const glows: Glow[] = [];
    const rot = -MARKET_ANGLE;
    const colors = ["#ff8a3d", "#ff2bd6", "#ffe14d", "#36c8ff"];
    for (let a = PLAZA_RADIUS + 12; a < MARKET_LENGTH; a += 13)
      for (const s of [-1, 1]) {
        const k = hash01(`mk${a}${s}`);
        const [bx, bz] = streetPoint(MARKET_ANGLE, a, s * LOT_OFFSET);
        list.push({ p: [bx, (20 + k * 25) / 2, bz], s: [LOT_SIZE, 20 + k * 25, 11], rotY: rot, seed: k * 100 });
        // Stall: counter, posts, sloped awning; an awning edge in neon.
        const [sx, sz] = streetPoint(MARKET_ANGLE, a, s * (STREET_HALF_WIDTH + 1.3));
        stalls.push({ p: [sx, 0.55, sz], s: [1.4, 1.1, 4], rotY: rot, color: "#3a2f2a" });
        stalls.push({ p: [sx, 1.15, sz], s: [1.6, 0.08, 4.2], rotY: rot, color: "#5a4a3c" });
        for (const e of [-1.9, 1.9]) {
          const [qx, qz] = streetPoint(MARKET_ANGLE, a + e, s * (STREET_HALF_WIDTH + 0.4));
          stalls.push({ p: [qx, 1.3, qz], s: [0.08, 2.6, 0.08], rotY: rot, color: "#2a2d36" });
        }
        stalls.push({ p: [sx, 2.7, sz], s: [2.6, 0.1, 4.8], rot: [0, rot, s * 0.22], color: ["#6b2230", "#22465e", "#5e4a1e"][Math.floor(k * 3)] });
        const [ex, ez] = streetPoint(MARKET_ANGLE, a, s * (STREET_HALF_WIDTH + 0.1));
        const c = colors[Math.floor(k * 4)];
        bars.push({ p: [ex, 2.55, ez], s: [0.06, 0.06, 4.6], rotY: rot, color: c, boost: 3 });
        glows.push({ x: ex, z: ez, w: 5, l: 5, rotY: 0, color: c, strength: 0.14 });
      }
    // Paper lanterns strung across the alley.
    for (let a = PLAZA_RADIUS + 9; a < MARKET_LENGTH; a += 7)
      for (let i = -2; i <= 2; i++) {
        const [lx, lz] = streetPoint(MARKET_ANGLE, a, i * 2.6);
        const sag = 7.4 - (1 - (i / 2.6) ** 2) * 1.1;
        bars.push({ p: [lx, sag, lz], s: [0.22, 0.3, 0.22], color: i % 2 ? "#ff4a2d" : "#ff9a3d", boost: 2 });
      }
    // A red torii-like gate closes the alley: something to walk toward.
    const end = MARKET_LENGTH - 3;
    for (const s of [-1, 1]) {
      const [px, pz] = streetPoint(MARKET_ANGLE, end, s * (STREET_HALF_WIDTH - 1));
      bars.push({ p: [px, 4.5, pz], s: [0.5, 9, 0.5], rotY: rot, color: "#ff2a3a", boost: 2.2 });
    }
    for (const [y, w] of [[9.2, STREET_HALF_WIDTH * 2 + 1.5], [7.6, STREET_HALF_WIDTH * 2 - 1]] as const) {
      const [gx, gz] = streetPoint(MARKET_ANGLE, end, 0);
      bars.push({ p: [gx, y, gz], s: [w, 0.45, 0.5], rotY: rot, color: "#ff2a3a", boost: 2.2 });
    }
    const [tx, tz] = streetPoint(MARKET_ANGLE, end - 4, 0);
    glows.push({ x: tx, z: tz, w: 12, l: 10, rotY: 0, color: "#ff2a3a", strength: 0.22 });
    return { blocks: buildingMesh(list), stallMesh: detailMesh(stalls), neon: barsMesh(bars), pools: glowMesh(glows, glowTexture(), 0.07) };
  }, []);
  return (
    <>
      <primitive object={blocks} />
      <primitive object={stallMesh} />
      <primitive object={neon} />
      <primitive object={pools} />
    </>
  );
}

/** Power lines sagging across every street: one LineSegments draw call. */
function Cables({ layout }: { layout: CityLayout }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (const st of layout.streets)
      for (let a = PLAZA_RADIUS + 14; a < st.length - 4; a += 11) {
        const k = hash01(`c${st.district}${a}`);
        for (let n = 0; n < 1 + Math.floor(k * 3); n++) {
          const y0 = 9 + k * 6 + n * 1.3;
          const off = (n - 1) * 1.7;
          const span = LOT_OFFSET - LOT_SIZE / 2 + 0.2;
          const SEG = 12;
          for (let i = 0; i < SEG; i++) {
            for (const j of [i, i + 1]) {
              const t = j / SEG;
              const side = -span + t * span * 2;
              const [x, z] = streetPoint(st.angle, a + off, side);
              pts.push(x, y0 - Math.sin(t * Math.PI) * (1.2 + k), z);
            }
          }
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [layout]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#05060a" transparent opacity={0.85} />
    </lineSegments>
  );
}

export default function City({ layout, atlas }: { layout: CityLayout; atlas: ReturnType<typeof useScreenAtlas> }) {
  const keys = useMemo(() => layout.lots.map((l) => ({ name: l.project.name, category: l.project.category })), [layout]);
  return (
    <>
      <Sky />
      <Ground />
      <Plaza />
      <Streets layout={layout} />
      <Market />
      <Cables layout={layout} />
      <Skyline layout={layout} atlas={atlas} lotsAtlasKeys={keys} />
    </>
  );
}
