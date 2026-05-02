import { getReportRecommendations, getReportTopScores } from "./generateReport";
import type { ReportRecord } from "./types";

function ascii(value: string | number | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrap(text: string, width = 92) {
  const words = ascii(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function reportLines(report: ReportRecord) {
  const { top, weak, peak, valley } = getReportTopScores(report);
  const recommendations = getReportRecommendations(report);
  const lines: string[] = [
    "PRAEVIA - NEUROIMPACT ANALYZER",
    report.title,
    "",
    `Decision recomendada: ${report.decision}`,
    "",
    `TLDR: ${report.tldr}`,
    "",
    `NRI: ${report.scoringSnapshot.summary.nri} | Confianza: ${report.scoringSnapshot.confidenceLabel} | Benchmark: ${report.scoringSnapshot.benchmarkLabel}`,
    `Fortaleza: ${top.metricLabel} ${top.score} | Punto a corregir: ${weak.metricLabel} ${weak.score}`,
    `Peak: ${peak.startSeconds}s-${peak.endSeconds}s | Valley: ${valley.startSeconds}s-${valley.endSeconds}s`,
    "",
    "RECOMENDACIONES",
    ...recommendations.flatMap((row, index) => wrap(`${index + 1}. ${row.timecode} | ${row.layer} | CONF ${row.confidence} | ${row.action}`, 96)),
    "",
    "SCORES EDITORIALES",
    ...report.scoringSnapshot.editorialScores.flatMap((score) => wrap(`${score.metricLabel}: ${score.score} | CONF ${score.confidence.toFixed(2)} | ${score.action}`, 96)),
    "",
    "METODOLOGIA Y LIMITES",
    "Este informe usa respuesta cerebral predicha, indicadores comparativos y evidencia por timecode. No sustituye test con audiencia real, brand lift ni metricas reales de campana.",
    "",
    `Router LLM: draft=${report.usage.draftModel} final=${report.usage.finalModel} reviewer=${report.usage.reviewerModel ?? "no aplicado"} prompt=${report.usage.promptVersion}`,
    `Guardrails: ${report.guardrailStatus} | findings=${report.guardrailFindings.length}`,
    `Report ID: ${report.id}`,
  ];
  return lines.flatMap((line) => line ? wrap(line, 98) : [""]);
}

function buildPdfBytes(report: ReportRecord) {
  const allLines = reportLines(report);
  const linesPerPage = 42;
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += linesPerPage) {
    pages.push(allLines.slice(index, index + linesPerPage));
  }
  const objectBodies: string[] = [];
  objectBodies[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objectBodies[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const pageIds: number[] = [];
  let nextId = 4;
  pages.forEach((pageLines, pageIndex) => {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const content = [
      "BT",
      "/F1 11 Tf",
      "50 790 Td",
      ...pageLines.flatMap((line, lineIndex) => {
        const size = lineIndex === 0 && pageIndex === 0 ? 14 : line === line.toUpperCase() && line.length < 30 ? 12 : 10;
        return [`/F1 ${size} Tf`, `(${pdfEscape(line)}) Tj`, "0 -17 Td"];
      }),
      "ET",
    ].join("\n");
    objectBodies[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objectBodies[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  objectBodies[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objectBodies.length; id += 1) {
    const body = objectBodies[id];
    if (!body) continue;
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objectBodies.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectBodies.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectBodies.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadReportPdf(report: ReportRecord) {
  const bytes = buildPdfBytes(report);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.assetName}-report.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
