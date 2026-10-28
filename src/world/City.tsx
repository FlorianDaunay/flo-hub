import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR } from "@/lib/meta";
import { PLAZA_RADIUS, STREET_HALF_WIDTH, LOT_OFFSET, LOT_SIZE, hash01, streetPoint, type CityLayout, type District } from "./layout";
import { buildingMaterial, neonMaterial } from "./materials";
import { useWorld } from "./store";
import { glowTexture, labelTexture } from "./textures";

const box = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);
const DISTRICT_COLOR: Record<District, string> = { web: "#3DA9FF", android: "#2EF2A0", desktop: "#FF3DCB" };
const DISTRICT_LABEL: Record<District, string> = { web: "WEB", android: "ANDROID", desktop: "DESKTOP" };
const CITY_RADIUS = 240;

function Ground() {
  const quality = useWorld((s) => s.quality);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[CITY_RADIUS * 2.6, CITY_RADIUS * 2.6]} />
      {quality === "high" ? (
        <MeshReflectorMaterial
          resolution={512}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={14}
          mirror={0.6}
          roughness={0.9}
          depthScale={0.4}
          minDepthThreshold={0.6}
          maxDepthThreshold={1.2}
          color="#07080d"
          metalness={0.6}
        />
      ) : (
        <meshStandardMaterial color="#0a0b11" roughness={0.55} metalness={0.4} />
      )}
    </mesh>
  );
}

function Label({ text, sub, color, width, position, rotY = 0, boost = 2.5 }: { text: string; sub?: string; color: string; width: number; position: [number, number, number]; rotY?: number; boost?: number }) {
  const label = useMemo(() => labelTexture(text, { size: 96, sub }), [text, sub]);
  return (
    <mesh geometry={plane} position={position} rotation={[0, rotY, 0]} scale={[width, width / label.aspect, 1]}>
      <meshBasicMaterial map={label.tex} transparent color={new THREE.Color(color).multiplyScalar(boost)} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Streets({ layout }: { layout: CityLayout }) {
  const { t } = useT();
  const counts = useMemo(() => {
    const c: Partial<Record<District, number>> = {};
    for (const l of layout.lots) c[l.district] = (c[l.district] ?? 0) + 1;
    return c;
  }, [layout]);

  return (
    <>
      {layout.streets.map(({ district, angle, length }) => {
        const color = DISTRICT_COLOR[district];
        const run = length - PLAZA_RADIUS + 1;
        const mid = streetPoint(angle, PLAZA_RADIUS - 1 + run / 2, 0);
        const gate = streetPoint(angle, PLAZA_RADIUS + 4, 0);
        const span = STREET_HALF_WIDTH * 2 + 4;
        return (
          <group key={district}>
            {/* Asphalt band + sidewalks + lane dashes. */}
            <group position={[mid[0], 0, mid[1]]} rotation={[0, -angle, 0]}>
              <mesh geometry={box} position={[0, 0.01, 0]} scale={[STREET_HALF_WIDTH * 2, 0.02, run]}>
                <meshStandardMaterial color="#0e1018" roughness={0.6} metalness={0.3} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={box} position={[s * (STREET_HALF_WIDTH + 1.25), 0.08, 0]} scale={[2.5, 0.16, run]}>
                  <meshStandardMaterial color="#1a1d27" roughness={0.8} />
                </mesh>
              ))}
              {[-1, 1].map((s) => (
                <mesh key={`c${s}`} geometry={box} material={neonMaterial(color, 1.6)} position={[s * STREET_HALF_WIDTH, 0.17, 0]} scale={[0.08, 0.02, run]} />
              ))}
              {Array.from({ length: Math.floor(run / 6) }, (_, i) => (
                <mesh key={i} geometry={box} material={neonMaterial("#ffffff", 0.35)} position={[0, 0.025, -run / 2 + 3 + i * 6]} scale={[0.18, 0.01, 2.2]} />
              ))}
            </group>

            {/* District gate. */}
            <group position={[gate[0], 0, gate[1]]} rotation={[0, -angle, 0]}>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={box} material={buildingMaterial()} position={[(s * span) / 2, 5, 0]} scale={[1.2, 10, 1.2]} />
              ))}
              <mesh geometry={box} material={buildingMaterial()} position={[0, 10.4, 0]} scale={[span + 1.2, 1.6, 1.4]} />
              <mesh geometry={box} material={neonMaterial(color, 3)} position={[0, 9.5, 0.75]} scale={[span + 1.2, 0.1, 0.05]} />
              <mesh geometry={box} material={neonMaterial(color, 3)} position={[0, 9.5, -0.75]} scale={[span + 1.2, 0.1, 0.05]} />
              <Label text={DISTRICT_LABEL[district]} sub={`${counts[district] ?? 0} ${t("projects")}`} color={color} width={6.5} position={[0, 12.6, 0]} boost={3} />
            </group>
          </group>
        );
      })}

      {/* Category posts on the street axis, at the start of each category block. */}
      {layout.signs.map((s) => (
        <CategoryPost key={`${s.district}-${s.category}`} {...s} />
      ))}
    </>
  );
}

function CategoryPost({ category, x, z, rotY }: { category: keyof typeof CATEGORY_COLOR; x: number; z: number; rotY: number }) {
  const { category: name } = useT();
  const color = CATEGORY_COLOR[category];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh geometry={box} position={[0, 0.15, 0]} scale={[1.6, 0.3, 1.6]}>
        <meshStandardMaterial color="#151823" roughness={0.6} />
      </mesh>
      <mesh geometry={box} material={neonMaterial(color, 2.5)} position={[0, 2.2, 0]} scale={[0.1, 4, 0.1]} />
      <Label text={name(category)} color={color} width={3.2} position={[0, 4.6, 0]} boost={2.6} />
    </group>
  );
}

function Plaza() {
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (core.current) core.current.rotation.y += dt * 0.25;
    if (ring.current) ring.current.rotation.z += dt * 0.1;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[PLAZA_RADIUS, 64]} />
        <meshStandardMaterial color="#10131c" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} material={neonMaterial("#8b7bff", 2)}>
        <ringGeometry args={[PLAZA_RADIUS - 0.15, PLAZA_RADIUS, 96]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} material={neonMaterial("#8b7bff", 1.4)}>
        <ringGeometry args={[4.8, 5, 64]} />
      </mesh>
      {/* Hologram: pedestal, spinning wire core, floating name. */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[2.6, 3, 1, 48]} />
        <meshStandardMaterial color="#141826" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh ref={core} position={[0, 5.2, 0]}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshBasicMaterial color={new THREE.Color("#8b7bff").multiplyScalar(1.4)} wireframe toneMapped={false} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring} position={[0, 5.2, 0]} rotation={[Math.PI / 2.4, 0, 0]} material={neonMaterial("#3DF2F2", 2.5)}>
        <torusGeometry args={[3.6, 0.04, 8, 96]} />
      </mesh>
      <Billboard position={[0, 9.6, 0]}>
        <Label text="FLORIAN DAUNAY" color="#ffffff" width={7} position={[0, 0, 0]} boost={1.6} />
      </Billboard>
    </group>
  );
}

/** Street lamps (instanced poles + heads) with fake light pools on the ground. */
function Lamps({ layout }: { layout: CityLayout }) {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (const s of layout.streets)
      for (let a = PLAZA_RADIUS + 10; a < s.length - 4; a += 15)
        for (const side of [-1, 1]) out.push(streetPoint(s.angle, a, side * (STREET_HALF_WIDTH + 0.6)));
    for (let i = 0; i < 12; i++) {
      const r = (i / 12) * Math.PI * 2 + Math.PI / 12;
      out.push([Math.sin(r) * (PLAZA_RADIUS - 1.5), Math.cos(r) * (PLAZA_RADIUS - 1.5)]);
    }
    return out;
  }, [layout]);

  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    spots.forEach(([x, z], i) => {
      poles.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 3, z), new THREE.Quaternion(), new THREE.Vector3(0.12, 6, 0.12)));
      heads.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 6.05, z), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.12, 0.9)));
      pools.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.06, z), q, new THREE.Vector3(9, 9, 1)));
    });
    for (const r of [poles, heads, pools]) r.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <>
      <instancedMesh ref={poles} args={[box, undefined, spots.length]}>
        <meshStandardMaterial color="#20232e" roughness={0.5} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[box, neonMaterial("#cfe4ff", 4), spots.length]} />
      <instancedMesh ref={pools} args={[plane, undefined, spots.length]}>
        <meshBasicMaterial map={glowTexture()} color="#6d86c9" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Background skyline: one instanced draw call, kept clear of the plaza and streets. */
function Skyline({ layout }: { layout: CityLayout }) {
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
    const cell = 17;
    for (let gx = -CITY_RADIUS; gx <= CITY_RADIUS; gx += cell)
      for (let gz = -CITY_RADIUS; gz <= CITY_RADIUS; gz += cell) {
        const k = `${gx},${gz}`;
        const x = gx + (hash01(k + "x") - 0.5) * 4;
        const z = gz + (hash01(k + "z") - 0.5) * 4;
        const dist = Math.hypot(x, z);
        if (dist > CITY_RADIUS || hash01(k) < 0.12) continue;
        const w = 8 + hash01(k + "w") * 6;
        const d = 8 + hash01(k + "d") * 6;
        if (!clear(x, z, Math.max(w, d) / 2)) continue;
        // Taller towards a ring around the centre, like a downtown.
        const h = 14 + hash01(k + "h") ** 2 * 90 * (0.55 + 0.45 * Math.exp(-(((dist - 90) / 80) ** 2)));
        out.push({ x, z, w, d, h });
      }
    return out;
  }, [layout]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((b, i) => {
      ref.current!.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d)));
      // Red aviation lights on the tall ones, hidden (scaled to 0) on the others.
      const s = b.h > 60 ? 0.35 : 0;
      tops.current!.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.h + 0.4, b.z), q, new THREE.Vector3(s, s, s)));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    tops.current!.instanceMatrix.needsUpdate = true;
  }, [items]);

  return (
    <>
      <instancedMesh ref={ref} args={[box, buildingMaterial(), items.length]} />
      <instancedMesh ref={tops} args={[box, neonMaterial("#ff3344", 4), items.length]} />
    </>
  );
}

/** Flying cars looping around the city: a single instanced mesh updated each frame. */
function Traffic() {
  const COUNT = 60;
  const cars = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        r: 40 + hash01(`r${i}`) * 170,
        h: 22 + hash01(`h${i}`) * 45,
        speed: (0.04 + hash01(`s${i}`) * 0.06) * (i % 2 ? 1 : -1),
        phase: hash01(`p${i}`) * Math.PI * 2,
      })),
    []
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(0.5, 0.25, 2.2), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cars.forEach((c, i) => {
      const a = c.phase + t * c.speed;
      pos.set(Math.cos(a) * c.r, c.h + Math.sin(t * 0.5 + i) * 0.6, Math.sin(a) * c.r);
      q.setFromAxisAngle(up, -a + (c.speed > 0 ? 0 : Math.PI));
      ref.current!.setMatrixAt(i, m.compose(pos, q, scl));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[box, neonMaterial("#ffd9a8", 3), COUNT]} frustumCulled={false} />;
}

export default function City({ layout }: { layout: CityLayout }) {
  return (
    <>
      <Ground />
      <Plaza />
      <Streets layout={layout} />
      <Lamps layout={layout} />
      <Skyline layout={layout} />
      <Traffic />
    </>
  );
}
