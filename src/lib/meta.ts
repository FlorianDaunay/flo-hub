// Fixed illustration colours per category (cards covers, 3D neon). Theme-independent on purpose.
import type { Category } from "./classify";

export const CATEGORY_COLOR: Record<Category, string> = {
  games: "#FF3DCB",
  finance: "#2EF2A0",
  devtools: "#3DA9FF",
  knowledge: "#FFC23D",
  media: "#A66BFF",
  ai: "#3DF2F2",
  other: "#C9D1E3",
};

export function formatSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
