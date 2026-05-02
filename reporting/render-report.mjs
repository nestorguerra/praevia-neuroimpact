#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function scoreCards(report) {
  const scores = report.scoringSnapshot?.editorialScores ?? [];
  return scores.map((score) => `
    <article class="score-card">
      <span>${escapeHtml(score.metricLabel)}</span>
      <strong>${escapeHtml(score.score)}</strong>
      <p>${escapeHtml(score.action)}</p>
      <small>CONF ${escapeHtml(score.confidence)} · BENCH ${escapeHtml(score.benchmarkDelta)}</small>
    </article>
  `).join("");
}

function recommendationRows(report) {
  const recSection = report.sections?.find((section) => section.sectionKey === "recommendations");
  const rows = recSection?.payload?.recommendations ?? [];
  return rows.map((row, index) => `
    <div class="rec-row">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <b>${escapeHtml(row.timecode)} · ${escapeHtml(row.layer)}</b>
      <p>${escapeHtml(row.action)}</p>
      <em>CONF ${escapeHtml(row.confidence)} · impacto ${escapeHtml(row.impact)}</em>
    </div>
  `).join("");
}

function timelineBars(report) {
  return (report.scoringSnapshot?.timecoursePoints ?? []).map((point) => {
    const color = point.eventLabel === "peak" ? "#B4DC54" : point.eventLabel === "valley" ? "#FF6B5A" : "#22C7D8";
    return `<i style="height:${Math.max(10, point.normalizedResponse)}px;background:${color};"></i>`;
  }).join("");
}

function reportHtml(report) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(report.title)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #2A2D32; color: #17202A; font-family: Georgia, "Times New Roman", serif; }
.page { width: 210mm; min-height: 297mm; margin: 12mm auto; padding: 22mm 20mm; background: #F4F1EA; page-break-after: always; display: flex; flex-direction: column; box-shadow: 0 12px 34px rgba(0,0,0,.24); }
.page:last-child { page-break-after: auto; }
@media print { html, body { background: #F4F1EA; } .page { margin: 0; box-shadow: none; } }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: .14em; }
.header, .footer { display: flex; justify-content: space-between; gap: 18px; color: #69717C; font-size: 9px; border-bottom: 1px solid #D8D1C3; padding-bottom: 10px; }
.footer { margin-top: auto; border-bottom: 0; border-top: 1px solid #D8D1C3; padding: 12px 0 0; }
.brand { color: #17202A; font-size: 22px; letter-spacing: -.02em; }
.brand em, h1 em, h2 em { color: #B7792F; }
.kicker { color: #B7792F; font-size: 10px; margin-bottom: 16px; }
h1 { max-width: 13ch; margin: 54mm 0 0; font-size: 62px; line-height: .96; font-weight: 400; letter-spacing: -.035em; }
h2 { margin: 0 0 12px; font-size: 32px; line-height: 1.05; font-weight: 500; letter-spacing: -.02em; }
p { margin: 0; color: #58616D; line-height: 1.5; font-size: 14px; }
.lede { max-width: 62ch; margin-top: 22px; font-size: 18px; }
.decision, .score-card, .timeline, .rec-row, .method { border: 1px solid #D8D1C3; background: #ECE7DC; border-radius: 4px; }
.decision { margin: 18px 0 24px; padding: 22px; border-color: rgba(183,121,47,.42); }
.decision strong { display: block; color: #B7792F; font-size: 10px; margin-bottom: 10px; }
.decision p { color: #17202A; font-size: 19px; }
.meta, .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
.score-card { padding: 14px; min-height: 118px; }
.score-card span { display: block; color: #69717C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; letter-spacing: .14em; text-transform: uppercase; }
.score-card strong { display: block; margin: 8px 0; color: #B7792F; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 30px; }
.score-card p { font-size: 11px; }
.score-card small { display: block; margin-top: 8px; color: #69717C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; }
.timeline { padding: 16px; margin: 20px 0; }
.bars { display: grid; grid-template-columns: repeat(${report.scoringSnapshot?.timecoursePoints?.length ?? 12}, 1fr); gap: 5px; align-items: end; height: 128px; padding: 12px; background: #17202A; border-radius: 3px; }
.bars i { display: block; border-radius: 999px 999px 2px 2px; }
.recs { display: grid; gap: 8px; margin-top: 18px; }
.rec-row { display: grid; grid-template-columns: 42px 140px 1fr 110px; gap: 10px; padding: 12px; align-items: baseline; }
.rec-row span, .rec-row b, .rec-row em { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; font-style: normal; }
.rec-row span { color: #B7792F; }
.rec-row p { color: #17202A; font-size: 12px; }
.method { padding: 18px; margin-top: 18px; }
</style>
</head>
<body>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>CONFIDENCIAL · ${escapeHtml(report.id)}</div></div>
  <div class="kicker mono">Informe ${escapeHtml(report.reportType)} · NeuroImpact Analyzer</div>
  <h1>Qué cambiar.<br/>Y <em>por qué.</em></h1>
  <p class="lede">${escapeHtml(report.tldr)}</p>
  <div class="decision"><strong class="mono">Decision recomendada</strong><p>${escapeHtml(report.decision)}</p></div>
  <div class="meta">
    <article class="score-card"><span>Asset</span><strong style="font-size:18px;">${escapeHtml(report.assetName)}</strong></article>
    <article class="score-card"><span>NRI</span><strong>${escapeHtml(report.scoringSnapshot?.summary?.nri)}</strong></article>
    <article class="score-card"><span>Confianza</span><strong style="font-size:18px;">${escapeHtml(report.scoringSnapshot?.confidenceLabel)}</strong></article>
  </div>
  <div class="footer mono"><span>PraevIA · NeuroImpact Analyzer</span><span>01 / 04</span></div>
</section>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · resumen</div></div>
  <div class="kicker mono">01 · Scores editoriales</div>
  <h2>Indicadores convertidos en <em>decision</em>.</h2>
  <div class="scores">${scoreCards(report)}</div>
  <div class="footer mono"><span>${escapeHtml(report.usage?.finalModel)} · ${escapeHtml(report.usage?.promptVersion)}</span><span>02 / 04</span></div>
</section>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · timeline</div></div>
  <div class="kicker mono">02 · Timeline accionable</div>
  <h2>Del BOLD al timecode.</h2>
  <div class="timeline"><div class="bars">${timelineBars(report)}</div></div>
  <div class="recs">${recommendationRows(report)}</div>
  <div class="footer mono"><span>Recomendaciones por timecode</span><span>03 / 04</span></div>
</section>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · metodo</div></div>
  <div class="kicker mono">03 · Metodo y limites</div>
  <h2>Instrumento. <em>No oraculo.</em></h2>
  <div class="method">
    <p>Este informe usa respuesta cerebral predicha, indicadores comparativos y evidencia por timecode. No sustituye test con audiencia real, brand lift ni metricas de campana.</p>
    <p style="margin-top:12px;">Guardrails: ${escapeHtml(report.guardrailStatus)} · findings ${escapeHtml(report.guardrailFindings?.length ?? 0)} · draft ${escapeHtml(report.usage?.draftModel)} · final ${escapeHtml(report.usage?.finalModel)} · reviewer ${escapeHtml(report.usage?.reviewerModel ?? "no aplicado")}.</p>
  </div>
  <div class="footer mono"><span>PraevIA · NeuroImpact Analyzer</span><span>04 / 04</span></div>
</section>
</body>
</html>`;
}

async function main() {
  const inputPath = resolve(argValue("--input", "reporting/sample-report.json"));
  const outputPdf = resolve(argValue("--output-pdf", "/tmp/praevia-report.pdf"));
  const outputHtml = argValue("--output-html", "");
  const report = JSON.parse(await readFile(inputPath, "utf8"));
  const html = reportHtml(report);
  if (outputHtml) {
    const htmlPath = resolve(outputHtml);
    await mkdir(dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html, "utf8");
  }
  await mkdir(dirname(outputPdf), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log(JSON.stringify({ ok: true, outputPdf, outputHtml: outputHtml || null }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
