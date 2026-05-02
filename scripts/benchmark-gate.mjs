#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_BENCHMARK_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app");

  await page.goto(`${baseUrl}/app/benchmarks`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "El moat empieza cuando el cliente compara contra su propio historico." }).waitFor();
  await page.getByRole("button", { name: "Asignar pieza nueva" }).click();
  await page.getByRole("button", { name: "Importar KPI" }).click();
  await page.getByText(/Pieza nueva|Hipotecas Q2/).first().waitFor({ timeout: 5000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  const download = await downloadPromise;
  const pdfPath = join(outDir, "sprint15-benchmark-calibration.pdf");
  await download.saveAs(pdfPath);

  const snapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("praevia:benchmarks:"));
    return key ? JSON.parse(localStorage.getItem(key) ?? "{}") : null;
  });
  const items = snapshot?.items?.length ?? 0;
  const kpis = snapshot?.kpis?.length ?? 0;
  if (items < 9 || kpis < 9) throw new Error(`Expected seeded benchmark plus new KPI, got ${items} items and ${kpis} KPIs.`);
  const screenshot = join(outDir, "sprint15-benchmarks.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();

  const manifest = { ok: true, baseUrl, items, kpis, pdfPath, screenshot };
  const manifestPath = join(outDir, "sprint15-benchmark-gate.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
