---
name: flohub-project
description: Make the current repository show up correctly on flo-hub (FlorianDaunay's project portfolio). Sets the GitHub description, topics (incl. the flohub category), homepage, and checks release asset names. Use when the user says "flohub", "add to portfolio", "update portfolio metadata", or after shipping a release.
---

# flo-hub project metadata

flo-hub lists public repos of `FlorianDaunay` that ship something, with **no special file in the repo**.
Everything is read from GitHub metadata, so this skill only edits repo settings and release names.

## What flo-hub reads
| Shown as | Read from |
| --- | --- |
| Title | repo name (`chess-analyzer` → "Chess Analyzer", camelCase split) |
| One-line text | repo **description** (keep it ≤ 90 chars, English, no trailing period) |
| Category (colour, 3D street block) | topic `flohub-<category>`, else guessed from topics/name/description |
| Web (Open button) | repo **homepage**, else GitHub Pages if enabled |
| Android / Windows / Linux / macOS | assets of the latest non-draft release that has installable files |

Categories: `games`, `finance`, `devtools`, `knowledge`, `media`, `ai` (anything else → "Misc").

Release asset names → platform: `.apk`/`.aab` android · `.exe`/`.msi`/`.msix` windows ·
`.AppImage`/`.deb`/`.rpm`/`.flatpak`/`.snap` or `*linux*.tar.gz|zip` linux · `.dmg`/`.pkg` or `*mac*|*darwin*.zip|tar.gz` macos.
`.yml`, `.blockmap`, checksums and source archives are ignored.

## Steps
1. Read the README / package.json / app manifest to understand what the project is.
2. Propose to the user, in one short block, and wait for OK:
   - description (≤ 90 chars, says what it does, not the stack),
   - `flohub-<category>` + 3–6 plain topics (lowercase, hyphenated),
   - homepage URL if deployed (GitHub Pages: `https://floriandaunay.github.io/<repo>/`).
3. Apply. With `gh`:
   ```sh
   gh repo edit --description "<text>" --homepage "<url>" --add-topic flohub-<category> --add-topic <t1> --add-topic <t2>
   ```
   Without `gh`: give the user the values to paste in GitHub → repo → ⚙ (About), or use the REST API
   (`PATCH /repos/{owner}/{repo}` for description/homepage, `PUT /repos/{owner}/{repo}/topics` with `{"names": [...]}`) with their token.
4. If the project builds installers, check the latest release (`gh release view --json assets`) and that the
   asset names match the table above. Suggest renames (e.g. `app-release.apk` → `<repo>-<version>.apk`) if a file would be missed.
   A release must not be a draft. Pre-releases are fine.
5. Tell the user flo-hub updates within a day (daily rebuild), or immediately via
   flo-hub → Actions → Deploy → Run workflow. Descriptions/topics/homepage also refresh live in visitors' browsers.

## Rules
- Never change visibility, never create or delete releases without asking.
- The repo must be public and not a fork to be listed.
