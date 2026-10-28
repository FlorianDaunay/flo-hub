// Build-time fetch: writes public/projects.json from the GitHub REST API.
// Works without a token (60 req/h); in CI the automatic GITHUB_TOKEN raises the limit.
import { writeFile, mkdir } from "node:fs/promises";
import { GITHUB_USER, byRecent, toProject, type GhRelease, type GhRepo, type Project } from "../src/lib/classify";

const user = process.env.FLOHUB_USER ?? GITHUB_USER;
const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "flo-hub" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

const repos: GhRepo[] = [];
for (let page = 1; ; page++) {
  const batch = await gh<GhRepo[]>(`/users/${user}/repos?per_page=100&type=owner&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const projects: Project[] = [];
for (const repo of repos.filter((r) => !r.fork)) {
  const releases = await gh<GhRelease[]>(`/repos/${user}/${repo.name}/releases?per_page=5`).catch(() => []);
  const project = toProject(repo, releases, user);
  if (project) projects.push(project);
}
projects.sort(byRecent);

await mkdir("public", { recursive: true });
await writeFile("public/projects.json", JSON.stringify({ user, generatedAt: new Date().toISOString(), projects }, null, 2) + "\n");
console.log(`${projects.length} projects / ${repos.length} repos`);
for (const p of projects) console.log(`  ${p.category.padEnd(9)} ${p.platforms.join(",").padEnd(14)} ${p.name}`);
