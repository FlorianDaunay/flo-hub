import { create } from "zustand";
import type { Lot } from "./layout";

export type Quality = "high" | "low";

interface WorldState {
  /** Lot the player is looking at / standing in front of. */
  focused: Lot | null;
  /** Requested teleport: position + heading. Consumed by the player. */
  teleport: { x: number; z: number; heading: number; pitch?: number } | null;
  locked: boolean;
  quality: Quality;
  sound: boolean;
  mapOpen: boolean;
  setFocused: (lot: Lot | null) => void;
  goTo: (x: number, z: number, heading: number, pitch?: number) => void;
  setLocked: (v: boolean) => void;
  setQuality: (q: Quality) => void;
  setSound: (on: boolean) => void;
  setMapOpen: (open: boolean) => void;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const initialQuality = (): Quality => {
  const saved = read("flohub-quality");
  if (saved === "high" || saved === "low") return saved;
  return matchMedia("(pointer: coarse)").matches ? "low" : "high";
};

export const useWorld = create<WorldState>((set) => ({
  focused: null,
  teleport: null,
  locked: false,
  quality: initialQuality(),
  sound: read("flohub-sound") !== "off",
  mapOpen: false,
  setFocused: (focused) => set((s) => (s.focused === focused ? s : { focused })),
  goTo: (x, z, heading, pitch) => set({ teleport: { x, z, heading, pitch } }),
  setLocked: (locked) => set({ locked }),
  setQuality: (quality) => {
    write("flohub-quality", quality);
    set({ quality });
  },
  setSound: (sound) => {
    write("flohub-sound", sound ? "on" : "off");
    set({ sound });
  },
  setMapOpen: (mapOpen) => set({ mapOpen }),
}));

/** Mobile joystick + look deltas, written by the HUD, read every frame by the player. */
export const touchInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };

/** Live player pose, written every frame by the player, read by the map without re-rendering. */
export const playerState = { x: 0, z: 0, yaw: 0 };

if (import.meta.env.DEV) (window as unknown as { __world: typeof useWorld }).__world = useWorld;
