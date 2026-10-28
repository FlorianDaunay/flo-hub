import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { uTime } from "./batch";
import { MARKET_ANGLE, PLAZA_RADIUS, STREET_HALF_WIDTH, streetPoint, type CityLayout } from "./layout";
import { useWorld } from "./store";

/** Lightning intensity 0..1, read by the sky shader and the lights. */
export const flash = { value: 0 };
/** Listeners called when lightning strikes (thunder sound). */
export const onLightning = new Set<() => void>();

export const FOG_COLOR = "#1d1018";

/** Neon-tinted reflections for every metallic surface, baked once into a small cube map. */
export function NeonEnvironment() {
  return (
    <Environment frames={1} resolution={128} background={false}>
      <color attach="background" args={["#0a0710"]} />
      <Lightformer form="rect" intensity={2.2} color="#ff2bd6" position={[-20, 4, -10]} scale={[12, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.4} color="#2bd0ff" position={[20, 6, 8]} scale={[14, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.7} color="#ff8a3d" position={[0, 8, 30]} scale={[30, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={0.8} color="#7c5cff" position={[0, 30, 0]} scale={20} target={[0, 0, 0]} />
    </Environment>
  );
}

/** Lights + lightning: a dim moody fill, flashing white-blue now and then. */
export function Lights() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const next = useRef(12);
  const strike = useRef(-1);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uTime.value = t;
    if (t > next.current) {
      strike.current = t;
      next.current = t + 18 + Math.random() * 30;
      onLightning.forEach((f) => f());
    }
    const s = t - strike.current;
    // Two quick pulses then fade.
    flash.value = strike.current < 0 || s > 1.2 ? 0 : Math.max(0, Math.exp(-s * 9) + (s > 0.18 ? 0.7 * Math.exp(-(s - 0.18) * 6) : 0));
    if (hemi.current) hemi.current.intensity = 0.45 + flash.value * 2.5;
    if (dir.current) dir.current.intensity = 0.25 + flash.value * 3;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#6a5a9a", "#0a0608", 0.45]} />
      <directionalLight ref={dir} position={[-60, 120, -40]} intensity={0.25} color="#a9b8ff" />
    </>
  );
}

/** Fine rain: line streaks that wrap around the camera, animated on the GPU. One draw call. */
export function Rain() {
  const quality = useWorld((s) => s.quality);
  const count = quality === "high" ? 9000 : 3500;
  const R = 26;
  const H = 22;
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 2 * 3);
    const tip = new Float32Array(count * 2);
    const seed = new Float32Array(count * 2 * 2);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * R;
      const z = (Math.random() * 2 - 1) * R;
      const y = Math.random() * H;
      const sp = 0.8 + Math.random() * 0.4;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        tip[i * 2 + k] = k;
        seed.set([sp, Math.random()], (i * 2 + k) * 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("tip", new THREE.BufferAttribute(tip, 1));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 2));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime, uCam: { value: new THREE.Vector3() }, uFlash: flash },
      vertexShader: `
        attribute float tip; attribute vec2 seed; uniform float uTime; uniform vec3 uCam; varying float vA;
        void main(){
          vec3 p = position;
          float fall = 24.0 * seed.x;
          p.y = mod(p.y - uTime * fall, ${H.toFixed(1)});
          p.x = mod(p.x - uCam.x + ${R.toFixed(1)}, ${(2 * R).toFixed(1)}) - ${R.toFixed(1)} + uCam.x;
          p.z = mod(p.z - uCam.z + ${R.toFixed(1)}, ${(2 * R).toFixed(1)}) - ${R.toFixed(1)} + uCam.z;
          p.y += uCam.y - 6.0;
          // Streak length matches motion blur, slanted by the wind.
          p += tip * vec3(0.18, 0.75, 0.06) * seed.x;
          vA = mix(0.0, 1.0, tip) * (0.5 + 0.5 * seed.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uFlash; varying float vA;
        void main(){ gl_FragColor = vec4(vec3(0.55, 0.6, 0.75) * (0.28 + uFlash * 1.5) * vA, 1.0); }`,
    });
    return { geo, mat };
  }, [count]);
  useFrame(({ camera }) => mat.uniforms.uCam.value.copy(camera.position));
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}

/** Steam rising from street vents and food stalls: GPU points, one draw call. */
export function Steam({ layout }: { layout: CityLayout }) {
  const { geo, mat } = useMemo(() => {
    const vents: [number, number][] = [];
    for (const st of layout.streets)
      for (let a = PLAZA_RADIUS + 18; a < st.length - 6; a += 23) vents.push(streetPoint(st.angle, a, (a % 2 ? 1 : -1) * (STREET_HALF_WIDTH - 2.5)));
    for (let a = PLAZA_RADIUS + 12; a < 70; a += 13) for (const s of [-1, 1]) vents.push(streetPoint(MARKET_ANGLE, a, s * (STREET_HALF_WIDTH + 1.3)));
    const PER = 14;
    const pos = new Float32Array(vents.length * PER * 3);
    const seed = new Float32Array(vents.length * PER);
    vents.forEach(([x, z], v) => {
      for (let i = 0; i < PER; i++) {
        pos.set([x, 0, z], (v * PER + i) * 3);
        seed[v * PER + i] = Math.random();
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime, uScale: { value: 300 } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
        void main(){
          float life = fract(uTime * 0.12 + seed);
          vec3 p = position + vec3(sin(seed * 40.0 + uTime * 0.6) * life * 1.4, life * 7.0, cos(seed * 23.0) * life * 1.2);
          vA = sin(life * 3.14159) * 0.075;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.8 + life * 2.6) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(0.75, 0.66, 0.74), vA * smoothstep(0.5, 0.0, d)); }`,
    });
    return { geo, mat };
  }, [layout]);
  useFrame(({ size }) => (mat.uniforms.uScale.value = size.height * 0.6));
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

