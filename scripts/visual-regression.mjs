#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_VISUAL_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

async function screenshot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/${name.path}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const file = join(outDir, `sprint12-visual-${name.label}-${viewport.width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return { label: name.label, path: name.path, viewport, file, overflow, ok: overflow.scrollWidth <= overflow.clientWidth };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app");

  const pages = [
    { label: "landing", path: "" },
    { label: "pilot-kit", path: "pilot-kit" },
    { label: "workspace", path: "app" },
    { label: "upload", path: "app/upload" },
    { label: "compare", path: "app/compare" },
    { label: "benchmarks", path: "app/benchmarks" },
    { label: "enterprise", path: "app/enterprise" },
    { label: "workflow", path: "app/workflow" },
    { label: "admin", path: "app/admin" },
  ];
  const viewports = [
    { width: 1440, height: 980 },
    { width: 390, height: 844 },
  ];
  const results = [];
  for (const viewport of viewports) {
    for (const item of pages) {
      results.push(await screenshot(page, item, viewport));
    }
  }
  await browser.close();
  const manifestPath = join(outDir, "sprint12-visual-manifest.json");
  await writeFile(manifestPath, JSON.stringify({ ok: results.every((item) => item.ok), results }, null, 2), "utf8");
  const ok = results.every((item) => item.ok);
  console.log(JSON.stringify({ ok, manifestPath, count: results.length }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
