import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category, Platform } from "./classify";

export type Lang = "fr" | "en";

const dict = {
  fr: {
    tagline: "Projets web, mobile et desktop.",
    lead: "Je fabrique des",
    tail: "pour le web, Android et desktop.",
    selected: "Sélection",
    allProjects: "Tous les projets",
    browse: "Voir les projets",
    walkPitch: "Ou promène-toi dans la ville néon",
    projects: "projets",
    all: "Tout",
    open: "Ouvrir",
    download: "Télécharger",
    source: "Code",
    explore: "Balade 3D",
    clean: "Vue liste",
    empty: "Aucun projet pour ce filtre.",
    updated: "Mis à jour",
    theme: "Thème",
    system: "Suivre le système",
    loading: "Chargement de la ville…",
    hint: "ZQSD pour marcher · Maj pour courir · E pour ouvrir · M pour la carte",
    map: "Carte",
    sound: "Son",
    hintTouch: "Joystick pour marcher · glisser pour regarder · carte en haut à droite",
    enter: "Entrer",
    back: "Retour",
  },
  en: {
    tagline: "Web, mobile and desktop projects.",
    lead: "I build",
    tail: "for the web, Android and desktop.",
    selected: "Selected",
    allProjects: "All projects",
    browse: "Browse projects",
    walkPitch: "Or take a walk through the neon city",
    projects: "projects",
    all: "All",
    open: "Open",
    download: "Download",
    source: "Code",
    explore: "3D walk",
    clean: "List view",
    empty: "No project for this filter.",
    updated: "Updated",
    theme: "Theme",
    system: "Follow system",
    loading: "Loading the city…",
    hint: "WASD to walk · Shift to run · E to open · M for the map",
    map: "Map",
    sound: "Sound",
    hintTouch: "Joystick to walk · drag to look · map top right",
    enter: "Enter",
    back: "Back",
  },
} as const;

export type Key = keyof (typeof dict)["fr"];

/** Rotating word of the hero. */
export const HERO_WORDS: Record<Lang, string[]> = {
  fr: ["jeux", "outils", "visualisations", "applis"],
  en: ["games", "tools", "visualisations", "apps"],
};

const categoryNames: Record<Lang, Record<Category, string>> = {
  fr: { games: "Jeux", finance: "Finance", devtools: "Outils dev", knowledge: "Savoir", media: "Médias", ai: "IA", other: "Divers" },
  en: { games: "Games", finance: "Finance", devtools: "Dev tools", knowledge: "Knowledge", media: "Media", ai: "AI", other: "Misc" },
};

const platformNames: Record<Platform, string> = { web: "Web", android: "Android", windows: "Windows", linux: "Linux", macos: "macOS" };

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en",
      setLang: (lang) => {
        document.documentElement.lang = lang;
        set({ lang });
      },
    }),
    { name: "flohub-lang" }
  )
);

export function useT() {
  const lang = useLang((s) => s.lang);
  return {
    lang,
    t: (k: Key) => dict[lang][k],
    category: (c: Category) => categoryNames[lang][c],
    platform: (p: Platform) => platformNames[p],
  };
}
