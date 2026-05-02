#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_COMMERCIAL_URL ?? "http://localhost:5173";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: rootDir, env: process.env, stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

async function assertHttp(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.status;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await run("node", ["scripts/export-pilot-kit.mjs"]);

  const staticChecks = [
    "/pilot-kit/deck-cliente.html",
    "/pilot-kit/deck-interno.html",
    "/pilot-kit/motion-teaser.html",
    "/pilot-kit/one-pager.html",
    "/pilot-kit/security-sheet.html",
    "/pilot-kit/pilot-contract-template.html",
    "/pilot-kit/legal-procurement-pack.html",
    "/pilot-kit/demo-data/spot_c_claim_directo.srt",
  ];
  const statusCodes = [];
  for (const path of staticChecks) {
    statusCodes.push({ path, status: await assertHttp(path) });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("praevia.demo_requests.v1"));
  await page.getByLabel("Nombre").fill("Nestor Guerra");
  await page.getByLabel("Email corporativo").fill("nestor@empresa.es");
  await page.getByLabel("Empresa").fill("Banco Atlas");
  await page.getByLabel("Rol").fill("CMO");
  await page.getByLabel("Caso de uso").fill("Spot A/B/C para lanzamiento Q2");
  await page.getByLabel("Numero de piezas").fill("10 assets");
  await page.getByLabel("Oferta de interes").fill("Sprint 10");
  await page.getByLabel("Autorizo el contacto para preparar una demo confidencial del piloto.").check();
  await page.getByRole("button", { name: /Solicitar demo confidencial|Registrando solicitud/ }).click();
  await page.getByText(/Demo registrada|Demo guardada localmente/).waitFor({ timeout: 5000 });
  const storedLeadCount = await page.evaluate(() => {
    const raw = localStorage.getItem("praevia.demo_requests.v1");
    return raw ? JSON.parse(raw).length : 0;
  });
  if (storedLeadCount < 1) throw new Error("Demo request was not persisted locally.");
  const landingScreenshot = join(outDir, "sprint13-landing-form-confirmation.png");
  await page.screenshot({ path: landingScreenshot, fullPage: true });

  await page.goto(`${baseUrl}/pilot-kit`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Una reunion. Una demo. Una propuesta cerrada." }).waitFor();
  const assetLinkCount = await page.locator(".asset-card").count();
  const demoCardCount = await page.locator(".demo-card").count();
  if (assetLinkCount < 7 || demoCardCount < 3) {
    throw new Error(`Pilot kit is incomplete: ${assetLinkCount} assets, ${demoCardCount} demos.`);
  }
  const kitScreenshot = join(outDir, "sprint13-pilot-kit.png");
  await page.screenshot({ path: kitScreenshot, fullPage: true });
  await browser.close();

  const manifest = {
    ok: true,
    baseUrl,
    staticChecks: statusCodes,
    storedLeadCount,
    screenshots: [landingScreenshot, kitScreenshot],
  };
  const manifestPath = join(outDir, "sprint13-commercial-gate.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
});
