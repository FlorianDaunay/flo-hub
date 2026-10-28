import { create } from "zustand";
import type { Lot } from "./layout";

export type Quality = "high" | "low";

interface WorldState {
  /** Lot the player is looking at / standing in front of. */
  focused: Lot | null;
  /** Requested teleport: position + heading. Consumed by the player. */
  teleport: { x: number; z: number; heading: number } | null;
  locked: boolean;
  quality: Quality;
  setFocused: (lot: Lot | null) => void;
  goTo: (x: number, z: number, heading: number) => void;
  setLocked: (v: boolean) => void;
  setQuality: (q: Quality) => void;
}

const initialQuality = (): Quality => {
  try {
    const saved = localStorage.getItem("flohub-quality");
    if (saved === "high" || saved === "low") return saved;
  } catch {
    /* ignore */
  }
  return matchMedia("(pointer: coarse)").matches ? "low" : "high";
};

export const useWorld = create<WorldState>((set) => ({
  focused: null,
  teleport: null,
  locked: false,
  quality: initialQuality(),
  setFocused: (focused) => set((s) => (s.focused === focused ? s : { focused })),
  goTo: (x, z, heading) => set({ teleport: { x, z, heading } }),
  setLocked: (locked) => set({ locked }),
  setQuality: (quality) => {
    try {
      localStorage.setItem("flohub-quality", quality);
    } catch {
      /* ignore */
    }
    set({ quality });
  },
}));

/** Mobile joystick + look deltas, written by the HUD, read every frame by the player. */
export const touchInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };

if (import.meta.env.DEV) (window as unknown as { __world: typeof useWorld }).__world = useWorld;
