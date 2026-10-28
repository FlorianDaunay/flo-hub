# flo-hub

Portfolio of my public projects that ship something: web apps, Android APKs, desktop installers.
Two modes: a clean list, and a 3D walk through a neon city (one avenue per format, one tower per project).

## How it works
- `npm run fetch`: reads public repos of `FlorianDaunay` from the GitHub API (no key needed; `GITHUB_TOKEN` raises the limit) and writes `public/projects.json`.
  A repo is listed when it has a homepage / GitHub Pages, or release assets (`.apk`, `.exe`, `.msi`, `.AppImage`, `.deb`, `.dmg`…).
  Category comes from topics (`flohub-games`, `flohub-finance`…) or is guessed.
- `npm run shots`: screenshots each web project with Playwright (`PW_CHANNEL=msedge` locally on Windows).
- In the browser, one cached API call refreshes descriptions, topics and new Pages sites.
- `.github/workflows/deploy.yml` rebuilds and deploys to GitHub Pages on push and daily.

To tune how a project appears, copy `skills/flohub-project/` into the project's `.claude/skills/` and ask Claude to "update flohub metadata".

## Dev
```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```
Repo settings → Pages → Source: **GitHub Actions**.
