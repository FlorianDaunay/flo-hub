import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useData } from "@/lib/data";
import City from "./City";
import Hud from "./Hud";
import { layoutCity } from "./layout";
import Player from "./Player";
import { useWorld } from "./store";
import Tower from "./Tower";

const coarse = matchMedia("(pointer: coarse)").matches;

export default function World({ onExit }: { onExit: () => void }) {
  const projects = useData((s) => s.projects);
  const layout = useMemo(() => layoutCity(projects), [projects]);
  const quality = useWorld((s) => s.quality);
  const setQuality = useWorld((s) => s.setQuality);
  const [dpr, setDpr] = useState(quality === "high" ? Math.min(devicePixelRatio, 1.75) : 1);

  return (
    <div className="fixed inset-0 select-none bg-[#05060c]">
      <Canvas
        dpr={dpr}
        gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
        camera={{ fov: 70, near: 0.1, far: 420 }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          scene.background = new THREE.Color("#070912");
          scene.fog = new THREE.FogExp2("#0b0f1f", 0.0085);
        }}
        onPointerDown={(e) => {
          if (!coarse && e.button === 0 && document.pointerLockElement !== e.currentTarget) (e.currentTarget as HTMLElement).querySelector("canvas")?.requestPointerLock();
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setQuality("low");
          }}
        />
        <hemisphereLight args={["#5d6fb8", "#07070c", 0.55]} />
        <directionalLight position={[-60, 120, -40]} intensity={0.35} color="#9fb4ff" />
        <Stars radius={300} depth={40} count={1500} factor={6} saturation={0} fade speed={0.3} />
        <Suspense fallback={null}>
          <City layout={layout} />
          {layout.lots.map((lot) => (
            <Tower key={lot.project.name} lot={lot} />
          ))}
        </Suspense>
        <Player layout={layout} />
        {quality === "high" && (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.7} />
            <Vignette offset={0.3} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
      <Hud layout={layout} onExit={onExit} touch={coarse} />
    </div>
  );
}
