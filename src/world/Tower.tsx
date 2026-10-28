import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CATEGORY_COLOR } from "@/lib/meta";
import { LOT_SIZE, type Lot } from "./layout";
import { buildingMaterial, neonMaterial } from "./materials";
import { useWorld } from "./store";
import { labelTexture } from "./textures";

const S = LOT_SIZE;
const PODIUM = 7;
const box = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);
const loader = new THREE.TextureLoader();

function useScreen(lot: Lot) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const p = lot.project;
    if (!p.screenshot) return;
    let alive = true;
    loader.load(`${import.meta.env.BASE_URL}${p.screenshot}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [lot.project]);
  return tex;
}

export default function Tower({ lot }: { lot: Lot }) {
  const { project, height } = lot;
  const color = CATEGORY_COLOR[project.category];
  const neon = neonMaterial(color, 3);
  const screen = useScreen(lot);
  const focused = useWorld((s) => s.focused === lot);
  const setFocused = useWorld((s) => s.setFocused);

  const title = useMemo(() => labelTexture(project.title.toUpperCase(), { size: 80, sub: project.platforms.join(" · ") }), [project]);
  const fallback = useMemo(() => (project.screenshot ? null : labelTexture(project.title.split(" ").map((w) => w[0]).join(""), { size: 160 })), [project]);
  useEffect(() => () => title.tex.dispose(), [title]);

  const titleW = Math.min(S - 1, 2.2 * title.aspect);
  const towerW = S - 2;
  const edge = 0.12;

  return (
    <group position={[lot.x, 0, lot.z]} rotation={[0, lot.rotY, 0]}>
      {/* Podium (ground floor) and tower body, both share the world-space window material. */}
      <mesh geometry={box} material={buildingMaterial()} position={[0, PODIUM / 2, 0]} scale={[S, PODIUM, S]} />
      <mesh geometry={box} material={buildingMaterial()} position={[0, PODIUM + (height - PODIUM) / 2, -0.5]} scale={[towerW, height - PODIUM, towerW]} />

      {/* Vertical neon edges + roof ring. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={box} material={neon} position={[(sx * towerW) / 2, PODIUM + (height - PODIUM) / 2, -0.5 + (sz * towerW) / 2]} scale={[edge, height - PODIUM, edge]} />
        ))
      )}
      {[-1, 1].map((s) => (
        <mesh key={`r${s}`} geometry={box} material={neon} position={[0, height, -0.5 + (s * towerW) / 2]} scale={[towerW, edge, edge]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`q${s}`} geometry={box} material={neon} position={[(s * towerW) / 2, height, -0.5]} scale={[edge, edge, towerW]} />
      ))}
      {/* Podium cornice. */}
      <mesh geometry={box} material={neon} position={[0, PODIUM, S / 2 + 0.05]} scale={[S, edge * 1.5, edge]} />

      {/* Facade screen with the project's screenshot. Clicking it focuses the project. */}
      <group position={[0, 3.6, S / 2 + 0.06]}>
        <mesh geometry={plane} scale={[8.5, 5.5, 1]} material={neonMaterial(color, 1.8)} position={[0, 0, -0.02]} />
        <mesh geometry={plane} scale={[8.2, 5.2, 1]} position={[0, 0, -0.01]}>
          <meshBasicMaterial color="#020308" />
        </mesh>
        <mesh
          geometry={plane}
          scale={[8, 5, 1]}
          onClick={(e) => {
            e.stopPropagation();
            setFocused(lot);
          }}
        >
          {screen ? (
            <meshBasicMaterial key="shot" map={screen} toneMapped={false} color={focused ? "#ffffff" : "#9a9a9a"} />
          ) : (
            <meshBasicMaterial key="fallback" map={fallback?.tex} color={color} toneMapped={false} transparent />
          )}
        </mesh>
      </group>

      {/* Neon title above the screen. */}
      <mesh geometry={plane} position={[0, 7.9, S / 2 + 0.3]} scale={[titleW, titleW / title.aspect, 1]}>
        <meshBasicMaterial map={title.tex} transparent color={new THREE.Color(color).multiplyScalar(focused ? 4 : 2.2)} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* Rooftop beacon. */}
      <mesh geometry={box} material={neon} position={[0, height + 3, -0.5]} scale={[0.15, 6, 0.15]} />
    </group>
  );
}
