// Build-time screenshots of every web project → public/shots/<name>.jpg, recorded in projects.json.
// Locally on Windows: PW_CHANNEL=msedge npm run shots
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import type { Project } from "../src/lib/classify";

const file = "public/projects.json";
const data = JSON.parse(await readFile(file, "utf8")) as { projects: Project[] };
await mkdir("public/shots", { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });

const queue = data.projects.filter((p) => p.homepage);
async function worker() {
  for (let p = queue.shift(); p; p = queue.shift()) {
    const page = await context.newPage();
    try {
      const res = await page.goto(p.homepage!, { waitUntil: "networkidle", timeout: 25000 }).catch(() => null);
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "timeout"}`);
      await page.waitForTimeout(1500);
      const path = `shots/${p.name}.jpg`;
      await page.screenshot({ path: `public/${path}`, type: "jpeg", quality: 70 });
      p.screenshot = path;
      console.log("ok  ", p.name);
    } catch (e) {
      delete p.screenshot;
      console.log("skip", p.name, (e as Error).message.split("\n")[0]);
    } finally {
      await page.close();
    }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
await writeFile(file, JSON.stringify(data, null, 2) + "\n");
