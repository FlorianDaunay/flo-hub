// Pure city layout: districts (one per format) are streets radiating from a central plaza;
// projects line both sides, grouped by category. Units are metres.
import { CATEGORIES, type Category, type Platform, type Project } from "@/lib/classify";

export type District = "web" | "android" | "desktop";

export const PLAZA_RADIUS = 16;
export const STREET_HALF_WIDTH = 7;
export const LOT_SPACING = 15;
export const LOT_SIZE = 10;
/** Distance from the street axis to a tower's centre. */
export const LOT_OFFSET = STREET_HALF_WIDTH + 2.5 + LOT_SIZE / 2;

/** Heading of each street (radians, 0 = −Z / north, clockwise). */
export const DISTRICT_ANGLE: Record<District, number> = { web: 0, android: Math.PI / 2, desktop: -Math.PI / 2 };

/** A project lives in its most "specific" format: desktop builds over android over web. */
export function districtOf(platforms: Platform[]): District {
  if (platforms.some((p) => p === "windows" || p === "linux" || p === "macos")) return "desktop";
  if (platforms.includes("android")) return "android";
  return "web";
}

export interface Lot {
  project: Project;
  district: District;
  /** Tower centre. */
  x: number;
  z: number;
  /** Rotation (Y) so the facade faces the street. */
  rotY: number;
  height: number;
}

export interface CategorySign {
  district: District;
  category: Category;
  x: number;
  z: number;
  rotY: number;
}

export interface StreetInfo {
  district: District;
  angle: number;
  length: number;
}

export interface CityLayout {
  lots: Lot[];
  signs: CategorySign[];
  streets: StreetInfo[];
}

const CATEGORY_ORDER: Category[] = [...CATEGORIES, "other"];

/** Deterministic 0..1 hash so the city is the same on every visit. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Point at distance `along` on a street, shifted `side` metres to its right. */
export function streetPoint(angle: number, along: number, side: number): [number, number] {
  const dx = Math.sin(angle);
  const dz = -Math.cos(angle);
  // Right-hand normal of (dx, dz).
  return [dx * along - dz * side, dz * along + dx * side];
}

export function layoutCity(projects: Project[]): CityLayout {
  const lots: Lot[] = [];
  const signs: CategorySign[] = [];
  const streets: StreetInfo[] = [];

  for (const district of Object.keys(DISTRICT_ANGLE) as District[]) {
    const angle = DISTRICT_ANGLE[district];
    const members = projects
      .filter((p) => districtOf(p.platforms) === district)
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.title.localeCompare(b.title));
    if (!members.length) continue;

    let slot = 0;
    let prevCategory: Category | null = null;
    for (const project of members) {
      if (project.category !== prevCategory) {
        // A category starts on a fresh pair of lots so both sides share it, with a sign on the pavement.
        if (slot % 2) slot++;
        const along = PLAZA_RADIUS + 8 + (slot / 2) * LOT_SPACING - 3;
        const [x, z] = streetPoint(angle, along, 0);
        signs.push({ district, category: project.category, x, z, rotY: -angle });
        prevCategory = project.category;
      }
      const side = slot % 2 ? 1 : -1;
      const along = PLAZA_RADIUS + 8 + Math.floor(slot / 2) * LOT_SPACING + LOT_SPACING / 2;
      const [x, z] = streetPoint(angle, along, side * LOT_OFFSET);
      // Facade (local +Z) turned toward the street axis.
      const rotY = -angle + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const height = 22 + Math.round(hash01(project.name) * 38) + Math.min(project.stars, 20);
      lots.push({ project, district, x, z, rotY, height });
      slot++;
    }
    streets.push({ district, angle, length: PLAZA_RADIUS + 8 + Math.ceil(slot / 2) * LOT_SPACING + 12 });
  }
  return { lots, signs, streets };
}
