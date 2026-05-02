#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function main() {
  const inputHtml = resolve(argValue("--input-html", ""));
  const outputPdf = resolve(argValue("--output-pdf", "/tmp/praevia-server-report.pdf"));
  const html = await readFile(inputHtml, "utf8");
  await mkdir(dirname(outputPdf), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => Array.from(document.querySelectorAll(".page")).map((page, index) => ({
    index,
    scrollHeight: page.scrollHeight,
    clientHeight: page.clientHeight,
    overflow: page.scrollHeight > page.clientHeight + 2,
  })));
  const overflowing = overflow.filter((item) => item.overflow);
  if (overflowing.length) {
    throw new Error(`PDF page overflow: ${JSON.stringify(overflowing)}`);
  }
  await page.pdf({
    path: outputPdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log(JSON.stringify({ ok: true, inputHtml, outputPdf }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
