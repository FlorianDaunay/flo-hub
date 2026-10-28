import { describe, expect, it } from "vitest";
import { assetPlatform, categorize, humanize, mergeLive, toProject, type GhRepo } from "./classify";

const repo = (over: Partial<GhRepo> = {}): GhRepo => ({
  name: "demo",
  description: null,
  html_url: "https://github.com/x/demo",
  homepage: null,
  has_pages: false,
  fork: false,
  archived: false,
  topics: [],
  language: "TypeScript",
  stargazers_count: 0,
  pushed_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("assetPlatform", () => {
  it.each([
    ["app-release.apk", "android"],
    ["Setup 1.0.exe", "windows"],
    ["app.msi", "windows"],
    ["app-1.0.AppImage", "linux"],
    ["app_1.0_amd64.deb", "linux"],
    ["app-1.0-arm64.dmg", "macos"],
    ["app-mac.zip", "macos"],
    ["latest.yml", null],
    ["app.exe.blockmap", null],
    ["source.zip", null],
  ])("%s → %s", (name, expected) => expect(assetPlatform(name)).toBe(expected));
});

describe("categorize", () => {
  it("prefers explicit flohub topic", () => expect(categorize(repo({ topics: ["game", "flohub-finance"] }))).toBe("finance"));
  it("uses topics", () => expect(categorize(repo({ topics: ["puzzle"] }))).toBe("games"));
  it("falls back to name and description", () => {
    expect(categorize(repo({ name: "chess-analyzer" }))).toBe("games");
    expect(categorize(repo({ name: "x", description: "open source gui docker manager" }))).toBe("devtools");
  });
  it("defaults to other", () => expect(categorize(repo({ name: "zzz" }))).toBe("other"));
});

describe("humanize", () => {
  it.each([
    ["visualScience", "Visual Science"],
    ["chess-analyzer", "Chess Analyzer"],
    ["SPFinder", "SPFinder"],
    ["Donut-Disaster", "Donut Disaster"],
  ])("%s", (a, b) => expect(humanize(a)).toBe(b));
});

describe("toProject", () => {
  it("skips repos without deliverable, forks and the hub", () => {
    expect(toProject(repo())).toBeNull();
    expect(toProject(repo({ fork: true, has_pages: true }))).toBeNull();
    expect(toProject(repo({ name: "flo-hub", has_pages: true }))).toBeNull();
  });
  it("derives the Pages url", () => {
    expect(toProject(repo({ has_pages: true }), [], "Me")?.homepage).toBe("https://me.github.io/demo/");
  });
  it("collects downloads from the latest release with assets", () => {
    const p = toProject(repo(), [
      { tag_name: "v2", draft: true, assets: [{ name: "a.exe", browser_download_url: "u0", size: 1 }] },
      { tag_name: "v1.1", draft: false, assets: [] },
      { tag_name: "v1", draft: false, assets: [{ name: "a.apk", browser_download_url: "u1", size: 1 }, { name: "a.dmg", browser_download_url: "u2", size: 1 }] },
    ]);
    expect(p?.platforms).toEqual(["android", "macos"]);
    expect(p?.version).toBe("v1");
  });
});

describe("mergeLive", () => {
  it("keeps downloads, refreshes metadata, adds new web repos, drops deleted", () => {
    const base = [
      toProject(repo({ name: "app" }), [{ tag_name: "v1", draft: false, assets: [{ name: "a.apk", browser_download_url: "u", size: 1 }] }])!,
      toProject(repo({ name: "gone", has_pages: true }))!,
    ];
    const out = mergeLive(base, [repo({ name: "app", description: "new", stargazers_count: 3 }), repo({ name: "fresh", has_pages: true })]);
    expect(out.map((p) => p.name).sort()).toEqual(["app", "fresh"]);
    const app = out.find((p) => p.name === "app")!;
    expect(app.description).toBe("new");
    expect(app.platforms).toEqual(["android"]);
  });
});
