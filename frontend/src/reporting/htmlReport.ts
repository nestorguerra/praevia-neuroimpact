import { getReportRecommendations, getReportTopScores } from "./generateReport";
import type { ReportRecord } from "./types";

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.round(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function timelineBars(report: ReportRecord) {
  return report.scoringSnapshot.timecoursePoints.map((point) => {
    const tone = point.eventLabel === "peak" ? "#B4DC54" : point.eventLabel === "valley" ? "#FF6B5A" : "#22C7D8";
    const height = Math.max(10, point.normalizedResponse);
    return `<div class="bar"><i style="height:${height}px;background:${tone};"></i><span>${formatTime(point.stimulusTimeSeconds)}</span></div>`;
  }).join("");
}

export function buildReportHtml(report: ReportRecord) {
  const { top, weak, peak, valley } = getReportTopScores(report);
  const recommendations = getReportRecommendations(report);
  const scores = report.scoringSnapshot.editorialScores;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(report.title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #2A2D32; color: #17202A; }
  body { font-family: Georgia, "Times New Roman", serif; }
  .page { width: 210mm; min-height: 297mm; margin: 12mm auto; padding: 22mm 20mm; background: #F4F1EA; page-break-after: always; box-shadow: 0 12px 36px rgba(0,0,0,.28); display: flex; flex-direction: column; }
  .page:last-child { page-break-after: auto; }
  @media print { html, body { background: #F4F1EA; } .page { margin: 0; box-shadow: none; } }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; }
  .header, .footer { display: flex; justify-content: space-between; gap: 16px; color: #69717C; font-size: 9px; border-bottom: 1px solid #D8D1C3; padding-bottom: 10px; }
  .footer { margin-top: auto; border-bottom: 0; border-top: 1px solid #D8D1C3; padding: 12px 0 0; }
  .brand { color: #17202A; font-size: 22px; letter-spacing: -.02em; }
  .brand em { color: #B7792F; }
  .kicker { color: #B7792F; font-size: 10px; margin-bottom: 16px; }
  h1 { max-width: 13ch; margin: 52mm 0 0; font-size: 62px; line-height: .96; font-weight: 400; letter-spacing: -.035em; }
  h1 em, h2 em { color: #B7792F; font-style: italic; }
  h2 { margin: 0 0 10px; font-size: 32px; line-height: 1.05; font-weight: 500; letter-spacing: -.02em; }
  h3 { margin: 0 0 8px; font-size: 19px; line-height: 1.2; }
  p { margin: 0; color: #58616D; line-height: 1.5; font-size: 14px; }
  .lede { max-width: 62ch; margin-top: 20px; font-size: 18px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 34mm; border-top: 1px solid #D8D1C3; padding-top: 18px; }
  .meta div, .tile, .decision, .score, .rec, .method, .timeline { border: 1px solid #D8D1C3; background: #ECE7DC; border-radius: 4px; }
  .meta div { padding: 12px; }
  .meta span, .tile span, .score span { display: block; color: #69717C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 7px; }
  .meta strong, .tile strong { display: block; color: #17202A; font-size: 15px; }
  .decision { padding: 22px; margin: 16px 0 22px; border-color: rgba(183,121,47,.42); }
  .decision strong { display: block; color: #B7792F; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 10px; }
  .decision p { color: #17202A; font-size: 19px; line-height: 1.38; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
  .score { padding: 14px; }
  .score b { display: block; color: #B7792F; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 28px; margin-top: 6px; }
  .score p { font-size: 11px; margin-top: 8px; }
  .timeline { padding: 16px; margin: 18px 0; }
  .bars { height: 126px; display: grid; grid-template-columns: repeat(${report.scoringSnapshot.timecoursePoints.length}, 1fr); gap: 5px; align-items: end; padding: 12px; background: #17202A; border-radius: 3px; }
  .bar { display: grid; gap: 5px; align-items: end; color: #87909C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 7px; text-align: center; }
  .bar i { display: block; border-radius: 999px 999px 2px 2px; }
  .recs { display: grid; gap: 8px; margin-top: 18px; }
  .rec { display: grid; grid-template-columns: 58px 84px 1fr 72px; gap: 12px; padding: 12px; align-items: baseline; }
  .rec .tc { color: #B7792F; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .rec .layer { color: #58616D; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
  .rec p { color: #17202A; font-size: 12px; }
  .rec .conf { text-align: right; color: #58616D; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }
  .method { padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 18px; }
  .method p { font-size: 12px; }
  .lang { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  .tile { padding: 14px; }
  .tile p { padding: 7px 0; border-bottom: 1px dashed #D8D1C3; font-size: 12px; color: #17202A; }
  .tile p:last-child { border-bottom: 0; }
</style>
</head>
<body>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>CONFIDENCIAL · ${escapeHtml(report.id)}</div></div>
  <div>
    <div class="kicker mono">Informe ${escapeHtml(report.reportType)} · NeuroImpact Analyzer</div>
    <h1>Qué cambiar.<br/>Y <em>por qué.</em></h1>
    <p class="lede">${escapeHtml(report.tldr)}</p>
  </div>
  <div class="meta">
    <div><span>Asset</span><strong>${escapeHtml(report.assetName)}</strong></div>
    <div><span>NRI</span><strong>${escapeHtml(report.scoringSnapshot.summary.nri)}</strong></div>
    <div><span>Confianza</span><strong>${escapeHtml(report.scoringSnapshot.confidenceLabel)}</strong></div>
    <div><span>Fecha</span><strong>${formatDate(report.createdAt)}</strong></div>
  </div>
  <div class="decision"><strong>Decision recomendada</strong><p>${escapeHtml(report.decision)}</p></div>
  <div class="footer mono"><span>PraevIA · NeuroImpact Analyzer</span><span>01 / 05 · portada</span></div>
</section>

<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · resumen</div></div>
  <div class="kicker mono">01 · Resumen ejecutivo</div>
  <h2>Tres lecturas. Una decision <em>accionable</em>.</h2>
  <div class="decision"><strong>TL;DR</strong><p>${escapeHtml(report.tldr)}</p></div>
  <div class="grid">
    ${scores.map((score) => `<article class="score"><span>${escapeHtml(score.metricLabel)}</span><b>${score.score}</b><p>${escapeHtml(score.action)}</p></article>`).join("")}
  </div>
  <div class="footer mono"><span>${escapeHtml(report.usage.finalModel)} · ${escapeHtml(report.usage.promptVersion)}</span><span>02 / 05 · resumen</span></div>
</section>

<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · timeline</div></div>
  <div class="kicker mono">02 · Timeline accionable</div>
  <h2>Del BOLD al timecode de montaje.</h2>
  <p>La correccion usada en este informe desplaza ${escapeHtml(report.scoringSnapshot.boldDelaySeconds)}s hacia tiempo de estimulo para que las recomendaciones sean editables.</p>
  <div class="timeline"><div class="bars">${timelineBars(report)}</div></div>
  <div class="grid">
    <article class="score"><span>Peak</span><b>${formatTime(peak.startSeconds)}</b><p>${escapeHtml(peak.action)}</p></article>
    <article class="score"><span>Valley</span><b>${formatTime(valley.startSeconds)}</b><p>${escapeHtml(valley.action)}</p></article>
    <article class="score"><span>Debil</span><b>${escapeHtml(weak.metricLabel)}</b><p>${escapeHtml(weak.action)}</p></article>
  </div>
  <div class="footer mono"><span>Benchmark · ${escapeHtml(report.scoringSnapshot.benchmarkLabel)}</span><span>03 / 05 · timeline</span></div>
</section>

<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · recomendaciones</div></div>
  <div class="kicker mono">03 · Recomendaciones priorizadas</div>
  <h2>Maximo cinco acciones.</h2>
  <div class="recs">
    ${recommendations.map((row) => `<article class="rec"><div class="tc">${escapeHtml(row.timecode)}</div><div class="layer">${escapeHtml(row.layer)}</div><p>${escapeHtml(row.action)}</p><div class="conf">CONF ${escapeHtml(row.confidence)}</div></article>`).join("")}
  </div>
  <div class="footer mono"><span>Acciones por timecode</span><span>04 / 05 · decision</span></div>
</section>

<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>${escapeHtml(report.id)} · metodologia</div></div>
  <div class="kicker mono">04 · Metodo y limites</div>
  <h2>Instrumento. <em>No oraculo.</em></h2>
  <div class="method">
    <div>
      <h3>Modelo y router</h3>
      <p>Router LLM: borrador ${escapeHtml(report.usage.draftModel)}, final ${escapeHtml(report.usage.finalModel)}, reviewer ${escapeHtml(report.usage.reviewerModel ?? "no aplicado")}.</p>
      <h3>Trazabilidad</h3>
      <p>Scoring ${escapeHtml(report.scoringSnapshot.scoringVersion)} · modelo ${escapeHtml(report.scoringSnapshot.modelId)} · report ${escapeHtml(report.id)}.</p>
    </div>
    <div>
      <h3>Guardrails</h3>
      <p>Estado: ${escapeHtml(report.guardrailStatus)}. Findings: ${escapeHtml(report.guardrailFindings.length)}. El lenguaje evita promesas absolutas y lectura de emociones reales.</p>
      <h3>Coste</h3>
      <p>Tokens estimados: ${escapeHtml(report.usage.inputTokens)} in / ${escapeHtml(Math.round(report.usage.outputTokens))} out. Coste local: ${escapeHtml(report.usage.estimatedCostEur)} EUR.</p>
    </div>
  </div>
  <div class="lang">
    <div class="tile"><span>Usamos</span><p>Respuesta cerebral predicha</p><p>Indicadores comparativos</p><p>Hipotesis editorial por timecode</p></div>
    <div class="tile"><span>Nunca decimos</span><p>Medicion emocional individual</p><p>Lectura mental</p><p>Promesas de negocio garantizadas</p></div>
  </div>
  <div class="footer mono"><span>PraevIA · NeuroImpact Analyzer</span><span>05 / 05 · metodologia</span></div>
</section>
</body>
</html>`;
}

export function downloadReportHtml(report: ReportRecord) {
  const blob = new Blob([buildReportHtml(report)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.assetName}-report.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
