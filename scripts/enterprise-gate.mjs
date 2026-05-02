#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_ENTERPRISE_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app");

  await page.goto(`${baseUrl}/app/enterprise`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Listo para operar 3-5 pilotos sin pasarela de pago." }).waitFor();
  await page.getByRole("button", { name: "Generar export mensual" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  const download = await downloadPromise;
  const pdfPath = join(outDir, "sprint16-enterprise-pack.pdf");
  await download.saveAs(pdfPath);

  await page.getByRole("button", { name: "Crear API key" }).click();
  await page.getByRole("button", { name: "Rotar" }).first().click();
  await page.getByRole("button", { name: "Revocar" }).first().click();
  await page.getByText("SSO").first().waitFor();
  await page.getByText("DPA basico").first().waitFor();
  await page.getByText("manual beta").first().waitFor();

  const snapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("praevia:enterprise:"));
    return key ? JSON.parse(localStorage.getItem(key) ?? "{}") : null;
  });
  const apiKeys = snapshot?.apiKeys?.length ?? 0;
  const exportsCount = snapshot?.exports?.length ?? 0;
  const revokedKeys = snapshot?.apiKeys?.filter((key) => key.status === "revoked").length ?? 0;
  if (apiKeys < 2 || exportsCount < 1 || revokedKeys < 1) {
    throw new Error(`Expected enterprise store with exports and rotated/revoked API key. apiKeys=${apiKeys}, exports=${exportsCount}, revoked=${revokedKeys}`);
  }

  const screenshot = join(outDir, "sprint16-enterprise.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();

  const manifest = { ok: true, baseUrl, apiKeys, exports: exportsCount, revokedKeys, pdfPath, screenshot };
  const manifestPath = join(outDir, "sprint16-enterprise-gate.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
