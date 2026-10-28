import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { uTime } from "./batch";
import { hash01, type CityLayout } from "./layout";

const box = new THREE.BoxGeometry(1, 1, 1);

/**
 * Flying traffic. High lanes: light dots circling the skyline. Low "spinners": dark bodies
 * cruising above the avenues, head/tail lights and a sweeping searchlight cone.
 * Five instanced draw calls whatever the count.
 */
export default function Traffic({ layout }: { layout: CityLayout }) {
  const lanes = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        r: 45 + hash01(`r${i}`) * 175,
        h: 30 + Math.floor(hash01(`h${i}`) * 4) * 12,
        speed: (0.03 + hash01(`s${i}`) * 0.05) * (i % 2 ? 1 : -1),
        phase: hash01(`p${i}`) * Math.PI * 2,
        red: i % 3 === 0,
      })),
    []
  );

  const spinners = useMemo(() => {
    const streets = layout.streets.filter((s) => s.length > 40);
    return Array.from({ length: 7 }, (_, i) => {
      const st = streets[i % streets.length];
      return { angle: st.angle, length: st.length, h: 14 + hash01(`sh${i}`) * 12, speed: 7 + hash01(`sv${i}`) * 6, phase: hash01(`sp${i}`), side: (hash01(`ss${i}`) - 0.5) * 8 };
    });
  }, [layout]);

  const meshes = useMemo(() => {
    const lights = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ toneMapped: false }), lanes.length);
    const c = new THREE.Color();
    lanes.forEach((l, i) => lights.setColorAt(i, l.red ? c.set("#ff3040").multiplyScalar(4) : c.set("#ffe2b8").multiplyScalar(3.5)));
    const bodies = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: "#20232c", metalness: 0.9, roughness: 0.3 }), spinners.length);
    const heads = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color("#dff1ff").multiplyScalar(5), toneMapped: false }), spinners.length);
    const tails = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2238").multiplyScalar(5), toneMapped: false }), spinners.length);
    const coneGeo = new THREE.ConeGeometry(4, 16, 24, 1, true).translate(0, -8, 0);
    const beam = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime },
      vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
        void main(){ vH = -position.y / 16.0; vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `varying float vH; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(vN, vV)), 1.5); float a = (1.0 - vH) * 0.16 * edge;
          gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a, 1.0); }`,
    });
    const cones = new THREE.InstancedMesh(coneGeo, beam, spinners.length);
    for (const m of [lights, bodies, heads, tails, cones]) m.frustumCulled = false;
    return { lights, bodies, heads, tails, cones };
  }, [lanes, spinners]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler() }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { m, q, p, s, up, e } = tmp;
    lanes.forEach((l, i) => {
      const a = l.phase + t * l.speed;
      p.set(Math.cos(a) * l.r, l.h, Math.sin(a) * l.r);
      q.setFromAxisAngle(up, -a + (l.speed > 0 ? 0 : Math.PI));
      meshes.lights.setMatrixAt(i, m.compose(p, q, s.set(0.35, 0.2, 1.4)));
    });
    meshes.lights.instanceMatrix.needsUpdate = true;

    spinners.forEach((sp, i) => {
      // Ping-pong along the avenue, beyond its end and over the plaza.
      const span = sp.length + 20;
      const u = (t * sp.speed + sp.phase * span * 2) % (span * 2);
      const along = (u < span ? u : span * 2 - u) - 10;
      const dirSign = u < span ? 1 : -1;
      const dx = Math.sin(sp.angle);
      const dz = -Math.cos(sp.angle);
      p.set(dx * along - dz * sp.side, sp.h + Math.sin(t * 0.7 + i) * 0.5, dz * along + dx * sp.side);
      const yaw = Math.atan2(-dx * dirSign, -dz * dirSign);
      q.setFromAxisAngle(up, yaw);
      meshes.bodies.setMatrixAt(i, m.compose(p, q, s.set(2.2, 0.8, 4.4)));
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      meshes.heads.setMatrixAt(i, m.compose(p.clone().add(new THREE.Vector3(fx * 2.25, 0, fz * 2.25)), q, s.set(1.6, 0.18, 0.08)));
      meshes.tails.setMatrixAt(i, m.compose(p.clone().add(new THREE.Vector3(-fx * 2.25, 0.1, -fz * 2.25)), q, s.set(1.8, 0.12, 0.08)));
      // Searchlight pointing down and forward, slowly sweeping.
      e.set(0.45 + Math.sin(t * 0.8 + i) * 0.2, yaw, Math.sin(t * 0.5 + i * 2) * 0.35, "YXZ");
      tmp.q2.setFromEuler(e);
      meshes.cones.setMatrixAt(i, m.compose(p, tmp.q2, s.set(1, 1, 1)));
    });
    for (const k of ["bodies", "heads", "tails", "cones"] as const) meshes[k].instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {Object.values(meshes).map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </>
  );
}
