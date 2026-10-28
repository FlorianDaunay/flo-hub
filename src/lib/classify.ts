// Pure classification of GitHub repos into projects. Shared by the build script and the browser.

export const GITHUB_USER = "FlorianDaunay";

export const PLATFORMS = ["web", "android", "windows", "linux", "macos"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CATEGORIES = ["games", "finance", "devtools", "knowledge", "media", "ai"] as const;
export type Category = (typeof CATEGORIES)[number] | "other";

export interface Download {
  platform: Platform;
  name: string;
  url: string;
  size: number;
}

export interface Project {
  name: string;
  title: string;
  description: string;
  repoUrl: string;
  homepage: string | null;
  category: Category;
  platforms: Platform[];
  downloads: Download[];
  topics: string[];
  language: string | null;
  stars: number;
  pushedAt: string;
  version: string | null;
  /** Path (relative to the site root) of a build-time screenshot, if any. */
  screenshot?: string;
}

/** Subset of the GitHub REST repo object we rely on. */
export interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  has_pages: boolean;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
}

export interface GhRelease {
  tag_name: string;
  draft: boolean;
  assets: { name: string; browser_download_url: string; size: number }[];
}

const ASSET_RULES: [RegExp, Platform][] = [
  [/\.(apk|aab)$/i, "android"],
  [/\.(exe|msi|msix|appx)$/i, "windows"],
  [/(\.appimage|\.deb|\.rpm|\.flatpak|\.snap|linux[^/]*\.(tar\.gz|tgz|zip))$/i, "linux"],
  [/(\.dmg|\.pkg|(mac|darwin|osx)[^/]*\.(zip|tar\.gz))$/i, "macos"],
];

export function assetPlatform(fileName: string): Platform | null {
  if (/\.(blockmap|sha\d+|sig|asc|yml|yaml|json)$/i.test(fileName)) return null;
  for (const [re, platform] of ASSET_RULES) if (re.test(fileName)) return platform;
  return null;
}

/** Keywords per category, matched against topics first, then name + description. */
const CATEGORY_KEYWORDS: Record<(typeof CATEGORIES)[number], string[]> = {
  games: ["game", "games", "puzzle", "chess", "pokemon", "rpg", "fighter", "platformer", "card", "battle", "sandbox", "multiplayer", "video-game", "swarm", "queens"],
  finance: ["finance", "quant", "option", "options", "pricing", "greeks", "payoff", "trading", "backtest", "excel", "portfolio", "blackscholes"],
  devtools: ["tool", "dev", "docker", "snippet", "snippets", "code", "blueprint", "manager", "cli", "plugin", "parser", "eclipse"],
  knowledge: ["science", "law", "laws", "education", "periodic", "chemistry", "physics", "math", "wiki", "visualization", "learning"],
  media: ["music", "audio", "lofi", "image", "photo", "video", "shazam", "studio", "filter", "filters"],
  ai: ["ai", "ml", "machine-learning", "deep-learning", "neural", "llm", "model"],
};

const ORDER = CATEGORIES;

function tokens(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .flatMap((t) => [t, ...t.split("-")])
    .filter(Boolean);
}

export function categorize(repo: Pick<GhRepo, "name" | "description" | "topics">): Category {
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  // Explicit "flohub-<category>" topic wins.
  for (const t of topics) {
    const c = t.replace(/^flohub-/, "");
    if (t.startsWith("flohub-") && (ORDER as readonly string[]).includes(c)) return c as Category;
  }
  const score = (words: string[]) => {
    let best: Category = "other";
    let bestScore = 0;
    for (const c of ORDER) {
      const s = words.filter((w) => CATEGORY_KEYWORDS[c].includes(w)).length;
      if (s > bestScore) [best, bestScore] = [c, s];
    }
    return best;
  };
  const fromTopics = score(topics.flatMap((t) => [t, ...t.split("-")]));
  if (fromTopics !== "other") return fromTopics;
  return score(tokens(`${repo.name} ${repo.description ?? ""}`));
}

/** "visualScience" → "Visual Science", "chess-analyzer" → "Chess Analyzer", "SPFinder" stays. */
export function humanize(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function pagesUrl(user: string, repo: string): string {
  return `https://${user.toLowerCase()}.github.io/${repo}/`;
}

export function toProject(repo: GhRepo, releases: GhRelease[] = [], user = GITHUB_USER): Project | null {
  if (repo.fork || repo.name.toLowerCase() === "flo-hub" || repo.name.toLowerCase() === user.toLowerCase()) return null;
  const homepage = repo.homepage?.trim() || (repo.has_pages ? pagesUrl(user, repo.name) : null);

  // Latest non-draft release that carries at least one installable asset.
  const downloads: Download[] = [];
  let version: string | null = null;
  for (const rel of releases) {
    if (rel.draft) continue;
    const found = rel.assets.flatMap((a) => {
      const platform = assetPlatform(a.name);
      return platform ? [{ platform, name: a.name, url: a.browser_download_url, size: a.size }] : [];
    });
    if (found.length) {
      downloads.push(...found);
      version = rel.tag_name;
      break;
    }
  }

  const platforms = PLATFORMS.filter((p) => (p === "web" ? !!homepage : downloads.some((d) => d.platform === p)));
  if (!platforms.length) return null;

  return {
    name: repo.name,
    title: humanize(repo.name),
    description: repo.description ?? "",
    repoUrl: repo.html_url,
    homepage,
    category: categorize(repo),
    platforms,
    downloads,
    topics: repo.topics ?? [],
    language: repo.language,
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
    version,
  };
}

/**
 * Applies a live repo list on top of build-time projects: refreshes repo metadata, keeps
 * build-time downloads (releases are not fetched live) and adds repos that became web projects.
 */
export function mergeLive(base: Project[], live: GhRepo[], user = GITHUB_USER): Project[] {
  const byName = new Map(base.map((p) => [p.name, p]));
  const out: Project[] = [];
  for (const repo of live) {
    const prev = byName.get(repo.name);
    const fresh = toProject(repo, [], user);
    if (prev) {
      byName.delete(repo.name);
      const homepage = fresh?.homepage ?? prev.homepage;
      out.push({
        ...prev,
        description: repo.description ?? prev.description,
        homepage,
        topics: repo.topics ?? prev.topics,
        category: categorize(repo),
        language: repo.language,
        stars: repo.stargazers_count,
        pushedAt: repo.pushed_at,
        platforms: PLATFORMS.filter((p) => (p === "web" ? !!homepage : prev.downloads.some((d) => d.platform === p))),
      });
    } else if (fresh) out.push(fresh);
  }
  // Repos missing from the live list were deleted or made private: they are dropped.
  return out.sort(byRecent);
}

export const byRecent = (a: Project, b: Project) => b.pushedAt.localeCompare(a.pushedAt);
