#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";
const kitDir = join(rootDir, "frontend/public/pilot-kit");

const deckFiles = [
  ["deck-cliente.html", "sprint13-deck-cliente.pdf"],
  ["deck-interno.html", "sprint13-deck-interno.pdf"],
];

const paperFiles = [
  ["one-pager.html", "sprint13-one-pager.pdf"],
  ["security-sheet.html", "sprint13-security-sheet.pdf"],
  ["pilot-contract-template.html", "sprint13-pilot-contract-template.pdf"],
  ["legal-procurement-pack.html", "sprint33-legal-procurement-pack.pdf"],
];

async function gotoLocal(page, file) {
  await page.goto(pathToFileURL(join(kitDir, file)).href, { waitUntil: "networkidle" });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const artifacts = [];

  for (const [input, output] of deckFiles) {
    await gotoLocal(page, input);
    const file = join(outDir, output);
    await page.pdf({
      path: file,
      width: "1600px",
      height: "900px",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    artifacts.push(file);
  }

  for (const [input, output] of paperFiles) {
    await gotoLocal(page, input);
    const file = join(outDir, output);
    await page.pdf({
      path: file,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    artifacts.push(file);
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoLocal(page, "motion-teaser.html");
  await page.waitForTimeout(600);
  const motionPoster = join(outDir, "sprint13-motion-teaser-poster.png");
  await page.screenshot({ path: motionPoster, fullPage: true });
  artifacts.push(motionPoster);

  await browser.close();
  console.log(JSON.stringify({ ok: true, artifacts }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
