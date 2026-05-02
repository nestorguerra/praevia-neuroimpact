#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_E2E_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

async function ensureInputs() {
  await mkdir(outDir, { recursive: true });
  const files = [
    ["sprint12_A.txt", "Sprint 12 Version A: apertura clara, beneficio directo, cierre sobrio."],
    ["sprint12_B.txt", "Sprint 12 Version B: ritmo mas fuerte, prueba social y CTA marcado."],
    ["sprint12_C.txt", "Sprint 12 Version C: humano, breve, packshot final y claim limpio."],
  ];
  await Promise.all(files.map(([name, body]) => writeFile(join(outDir, name), body, "utf8")));
  return files.map(([name]) => join(outDir, name));
}

async function main() {
  const files = await ensureInputs();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Nombre").fill("Nestor Guerra");
  await page.getByLabel("Email corporativo").fill("nestor+sprint12@praevia.ai");
  await page.getByLabel("Organizacion").fill("PraevIA Sprint 12");
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app");

  await page.goto(`${baseUrl}/app/upload`, { waitUntil: "networkidle" });
  await page.locator("input[type='file']").setInputFiles(files);
  await page.waitForFunction(() => document.body.innerText.includes("3/3 SLOTS"));
  await page.getByRole("button", { name: "Preparar inputs TRIBE" }).first().click();
  await page.waitForFunction(() => document.querySelectorAll(".preprocessing-job").length >= 3);
  await page.getByRole("button", { name: "Lanzar TRIBE" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".analysis-run-card").length >= 3);
  await page.getByRole("button", { name: "Calcular scoring" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".scoring-result-card").length >= 3);

  await page.goto(`${baseUrl}/app/results`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Informe" }).click();
  await page.getByRole("button", { name: "Generar informe" }).click();
  await page.waitForSelector(".report-generated-card");
  const reportDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF" }).click(),
  ]).then(([download]) => download);
  const reportPath = join(outDir, "sprint12-e2e-report.pdf");
  await reportDownload.saveAs(reportPath);

  await page.goto(`${baseUrl}/app/compare`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Regenerar mix|Generar comparativa/ }).click();
  await page.waitForSelector(".comparison-version-card");

  await page.goto(`${baseUrl}/app/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-stat-card");
  const beforeAssets = await page.locator(".admin-delete-panel select option").count();
  const adminDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export admin JSON" }).click(),
  ]).then(([download]) => download);
  const adminPath = join(outDir, "sprint12-admin-snapshot.json");
  await adminDownload.saveAs(adminPath);
  await page.getByRole("button", { name: "Borrar asset y derivados" }).click();
  await page.waitForTimeout(350);
  const afterAssets = await page.locator(".admin-delete-panel select option").count();
  const bodyText = await page.locator("body").innerText();
  await page.screenshot({ path: join(outDir, "sprint12-e2e-admin-after-delete.png"), fullPage: true });

  await browser.close();

  const reportHead = (await readFile(reportPath)).subarray(0, 8).toString("utf8");
  const adminSnapshot = JSON.parse(await readFile(adminPath, "utf8"));
  const result = {
    ok: true,
    baseUrl,
    reportHead,
    beforeAssets,
    afterAssets,
    deleted: afterAssets === beforeAssets - 1,
    usageEvents: adminSnapshot.usageEvents?.length ?? 0,
    auditText: bodyText.includes("secure_delete.completed"),
    artifacts: { reportPath, adminPath },
  };
  if (reportHead !== "%PDF-1.4" || !result.deleted || !result.auditText) {
    console.error(JSON.stringify({ ...result, ok: false }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
