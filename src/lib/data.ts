import { create } from "zustand";
import { mergeLive, type GhRepo, type Project } from "./classify";

interface ProjectsFile {
  user: string;
  generatedAt: string;
  projects: Project[];
}

interface DataState {
  user: string;
  projects: Project[];
  ready: boolean;
  generatedAt: string | null;
}

export const useData = create<DataState>(() => ({ user: "", projects: [], ready: false, generatedAt: null }));

const LIVE_KEY = "flohub-live";
const LIVE_TTL = 30 * 60 * 1000;

/** Live repo list, cached so a visitor spends at most one API call per half hour. */
async function liveRepos(user: string): Promise<GhRepo[] | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as { at: number; user: string; repos: GhRepo[] } | null;
    if (cached && cached.user === user && Date.now() - cached.at < LIVE_TTL) return cached.repos;
  } catch {
    /* storage unavailable */
  }
  try {
    const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=pushed`);
    if (!res.ok) return null;
    const repos = (await res.json()) as GhRepo[];
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify({ at: Date.now(), user, repos }));
    } catch {
      /* quota */
    }
    return repos;
  } catch {
    return null;
  }
}

export async function loadProjects() {
  const file = (await fetch(`${import.meta.env.BASE_URL}projects.json`).then((r) => r.json())) as ProjectsFile;
  useData.setState({ user: file.user, projects: file.projects, ready: true, generatedAt: file.generatedAt });
  const live = await liveRepos(file.user);
  // A full page of 100 means there may be more: merging would drop the rest, so keep build data.
  if (live && live.length < 100) useData.setState({ projects: mergeLive(file.projects, live, file.user) });
}
