#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_WORKFLOW_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app");

  await page.goto(`${baseUrl}/app/workflow`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Del informe a la ejecucion editorial." }).waitFor();
  await page.getByRole("button", { name: "Crear 3 tareas" }).click();
  await page.getByLabel("Comentario").fill("00:18-00:22 recortar locucion y adelantar claim.");
  await page.getByRole("button", { name: "Anadir comentario" }).click();
  await page.getByRole("button", { name: "Aprobar" }).first().click();
  await page.getByRole("button", { name: "Crear share link" }).click();
  await page.getByText(/client_viewer/).waitFor({ timeout: 5000 });
  const workflowScreenshot = join(outDir, "workflow.png");
  await page.screenshot({ path: workflowScreenshot, fullPage: true });

  const shareHref = await page.getByRole("link", { name: "Abrir viewer" }).getAttribute("href");
  if (!shareHref) throw new Error("Share viewer link was not created.");
  await page.goto(`${baseUrl}${shareHref}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Revision cliente · Piloto creativo" }).waitFor();
  const taskCount = await page.locator(".share-panel .share-row").count();
  if (taskCount < 4) throw new Error(`Expected shared tasks/comments, got ${taskCount} rows.`);
  const viewerScreenshot = join(outDir, "share-viewer.png");
  await page.screenshot({ path: viewerScreenshot, fullPage: true });

  const manifest = {
    ok: true,
    baseUrl,
    shareHref,
    taskCount,
    screenshots: [workflowScreenshot, viewerScreenshot],
  };
  const manifestPath = join(outDir, "workflow-gate.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await browser.close();
  console.log(JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
