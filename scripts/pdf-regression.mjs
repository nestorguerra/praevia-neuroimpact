#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";
const outputHtml = join(outDir, "sprint12-pdf-regression.html");
const outputPdf = join(outDir, "sprint12-pdf-regression.pdf");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
    });
  });
}

async function main() {
  await run("node", [
    "reporting/render-report.mjs",
    "--input",
    "reporting/sample-report.json",
    "--output-html",
    outputHtml,
    "--output-pdf",
    outputPdf,
  ]);
  const pdf = await readFile(outputPdf);
  const html = await readFile(outputHtml, "utf8");
  const pdfInfo = await stat(outputPdf);
  const ok = pdf.subarray(0, 8).toString("utf8") === "%PDF-1.4"
    && pdfInfo.size > 3000
    && html.includes("Instrumento. <em>No oraculo.</em>")
    && (html.match(/class=\"page\"/g) ?? []).length >= 4;
  const result = {
    ok,
    outputHtml,
    outputPdf,
    pdfHead: pdf.subarray(0, 8).toString("utf8"),
    pdfBytes: pdfInfo.size,
    pages: (html.match(/class=\"page\"/g) ?? []).length,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
