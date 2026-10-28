import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { LOT_SIZE, PLAZA_RADIUS, STREET_HALF_WIDTH, type CityLayout, type Lot } from "./layout";
import { playerState, touchInput, useWorld } from "./store";

const EYE = 1.7;
const WALK = 6;
const RUN = 13;
/** Walkable half-width of a street: road + sidewalk. */
const STREET_WALK = STREET_HALF_WIDTH + 2.2;
const FOCUS_RANGE = 16;

function walkable(layout: CityLayout, x: number, z: number) {
  if (Math.hypot(x, z) < PLAZA_RADIUS - 0.8) return true;
  return layout.streets.some((s) => {
    const dx = Math.sin(s.angle);
    const dz = -Math.cos(s.angle);
    const along = x * dx + z * dz;
    const side = -x * dz + z * dx;
    return along > 0 && along < s.length && Math.abs(side) < (s.district === "market" ? STREET_HALF_WIDTH - 0.2 : STREET_WALK);
  });
}

/** First-person walker: pointer-lock mouse look + WASD/ZQSD/arrows, or touch joystick. */
export default function Player({ layout }: { layout: CityLayout }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0.12 });
  const pos = useRef({ x: 0, z: PLAZA_RADIUS - 4 });
  const frame = useRef(0);
  const bob = useRef(0);

  useEffect(() => {
    camera.rotation.order = "YXZ";
    const el = gl.domElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.type === "keydown") keys.current.add(e.code);
      else keys.current.delete(e.code);
      if (e.type === "keydown" && e.code === "KeyM") {
        const st = useWorld.getState();
        if (!st.mapOpen) document.exitPointerLock?.();
        st.setMapOpen(!st.mapOpen);
      }
      if (e.type === "keydown" && e.code === "KeyE") {
        const lot = useWorld.getState().focused;
        const url = lot?.project.homepage ?? lot?.project.downloads[0]?.url ?? lot?.project.repoUrl;
        if (url) {
          document.exitPointerLock?.();
          window.open(url, "_blank", "noopener");
        }
      }
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.yaw -= e.movementX * 0.0022;
      look.current.pitch = Math.max(-1.2, Math.min(1.2, look.current.pitch - e.movementY * 0.0022));
    };
    const onLock = () => useWorld.getState().setLocked(document.pointerLockElement === el);
    const onBlur = () => keys.current.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("pointerlockchange", onLock);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("blur", onBlur);
    };
  }, [camera, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useWorld.getState();
    if (st.teleport) {
      pos.current = { x: st.teleport.x, z: st.teleport.z };
      look.current.yaw = st.teleport.heading;
      look.current.pitch = st.teleport.pitch ?? 0.08;
      useWorld.setState({ teleport: null });
    }

    // Touch look.
    look.current.yaw -= touchInput.lookX * 0.005;
    look.current.pitch = Math.max(-1.2, Math.min(1.2, look.current.pitch - touchInput.lookY * 0.005));
    touchInput.lookX = touchInput.lookY = 0;

    const k = st.mapOpen ? new Set<string>() : keys.current;
    // Physical key codes: ZQSD on AZERTY and WASD on QWERTY are the same codes.
    let f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    let r = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    f += -touchInput.moveY;
    r += touchInput.moveX;
    const len = Math.hypot(f, r);
    const running = k.has("ShiftLeft") || k.has("ShiftRight") || Math.hypot(touchInput.moveX, touchInput.moveY) > 0.9;
    if (len > 0.01) {
      const speed = (running ? RUN : WALK) * Math.min(1, len);
      f /= Math.max(1, len);
      r /= Math.max(1, len);
      const { yaw } = look.current;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const dx = (fx * f - fz * r) * speed * dt;
      const dz = (fz * f + fx * r) * speed * dt;
      const p = pos.current;
      // Slide along the walkable area's borders.
      if (walkable(layout, p.x + dx, p.z + dz)) {
        p.x += dx;
        p.z += dz;
      } else if (walkable(layout, p.x + dx, p.z)) p.x += dx;
      else if (walkable(layout, p.x, p.z + dz)) p.z += dz;
      bob.current += dt * speed * 1.6;
    }

    playerState.x = pos.current.x;
    playerState.z = pos.current.z;
    playerState.yaw = look.current.yaw;
    camera.position.set(pos.current.x, EYE + Math.sin(bob.current) * 0.04, pos.current.z);
    camera.rotation.set(look.current.pitch, look.current.yaw, 0);

    // Focus: the closest facade in front of the player, a few times per second.
    if (++frame.current % 6 === 0) {
      const fx = -Math.sin(look.current.yaw);
      const fz = -Math.cos(look.current.yaw);
      let best: Lot | null = null;
      let bestScore = Infinity;
      for (const lot of layout.lots) {
        // Facade centre: tower centre pushed half a lot toward the street.
        const sx = lot.x + Math.sin(lot.rotY) * (LOT_SIZE / 2);
        const sz = lot.z + Math.cos(lot.rotY) * (LOT_SIZE / 2);
        const vx = sx - pos.current.x;
        const vz = sz - pos.current.z;
        const d = Math.hypot(vx, vz);
        if (d > FOCUS_RANGE) continue;
        const facing = (vx * fx + vz * fz) / d;
        if (facing < 0.55) continue;
        const score = d * (2 - facing);
        if (score < bestScore) [best, bestScore] = [lot, score];
      }
      st.setFocused(best);
    }
  });

  return null;
}
