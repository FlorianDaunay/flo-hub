import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useData } from "@/lib/data";
import { FOG_COLOR, Lights, NeonEnvironment, Rain, Steam, onLightning } from "./Atmosphere";
import { muteAudio, startAudio, stopAudio, thunder } from "./audio";
import City from "./City";
import Hud from "./Hud";
import { layoutCity } from "./layout";
import Player from "./Player";
import Signs from "./Signs";
import { useWorld } from "./store";
import Towers, { useScreenAtlas } from "./Towers";
import Traffic from "./Traffic";

/** Dev only: exposes renderer stats to the console as window.__gl. */
function DevStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => void ((window as unknown as { __gl: THREE.WebGLRenderer }).__gl = gl), [gl]);
  return null;
}

const coarse = matchMedia("(pointer: coarse)").matches;
const CA_OFFSET = new THREE.Vector2(0.0007, 0.0005);

/** Starts the soundtrack on the first gesture (browsers block autoplay) and follows the toggle. */
function useSoundtrack() {
  const sound = useWorld((s) => s.sound);
  const [gesture, setGesture] = useState(false);
  useEffect(() => {
    if (gesture) return;
    const go = () => setGesture(true);
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, [gesture]);
  useEffect(() => {
    if (!gesture) return;
    if (sound) startAudio(0.55);
    else muteAudio();
  }, [gesture, sound]);
  useEffect(() => {
    onLightning.add(thunder);
    return () => {
      onLightning.delete(thunder);
      stopAudio();
    };
  }, []);
}

export default function World({ onExit }: { onExit: () => void }) {
  const projects = useData((s) => s.projects);
  const layout = useMemo(() => layoutCity(projects), [projects]);
  const atlas = useScreenAtlas(projects);
  const quality = useWorld((s) => s.quality);
  const setQuality = useWorld((s) => s.setQuality);
  const [dpr, setDpr] = useState(quality === "high" ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 1));
  useSoundtrack();

  return (
    <div className="fixed inset-0 select-none bg-[#07050a]">
      <Canvas
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 72, near: 0.1, far: 420 }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0115);
        }}
        onPointerDown={(e) => {
          if (coarse || e.button !== 0 || useWorld.getState().mapOpen) return;
          const canvas = (e.currentTarget as HTMLElement).querySelector("canvas");
          if (canvas && document.pointerLockElement !== canvas) canvas.requestPointerLock();
        }}
      >
        {import.meta.env.DEV && <DevStats />}
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setQuality("low");
          }}
        />
        <NeonEnvironment />
        <Lights />
        <Suspense fallback={null}>
          <City layout={layout} atlas={atlas} />
          <Towers lots={layout.lots} atlas={atlas} />
          <Signs layout={layout} />
        </Suspense>
        <Traffic layout={layout} />
        <Rain />
        <Steam layout={layout} />
        <Player layout={layout} />
        {quality === "high" ? (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={1.25} luminanceThreshold={0.85} luminanceSmoothing={0.25} radius={0.75} />
            <ChromaticAberration offset={CA_OFFSET} radialModulation={false} modulationOffset={0} />
            <Noise opacity={0.07} blendFunction={BlendFunction.OVERLAY} />
            <Vignette offset={0.25} darkness={0.75} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={1} luminanceThreshold={0.9} radius={0.6} levels={4} />
            <Vignette offset={0.25} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
      <Hud layout={layout} onExit={onExit} touch={coarse} />
    </div>
  );
}
