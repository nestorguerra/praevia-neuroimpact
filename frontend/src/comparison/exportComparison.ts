import type { ComparisonReport } from "./types";

function download(filename: string, type: string, content: BlobPart) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | undefined) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

export function exportComparisonJson(comparison: ComparisonReport) {
  download(`${comparison.title.replaceAll("/", "-")}-comparison.json`, "application/json;charset=utf-8", JSON.stringify(comparison, null, 2));
}

export function exportComparisonCsv(comparison: ComparisonReport) {
  const rows = [
    ["section", "key", "label", "slot", "score", "delta", "action"],
    ...comparison.versions.map((version) => ["ranking", version.result.id, version.label, version.slot, version.nri, version.globalDelta, version.rank === 1 ? "master" : "donor"]),
    ...comparison.metricDeltas.flatMap((metric) => comparison.versions.map((version) => [
      "metric_delta",
      metric.metricKey,
      metric.metricLabel,
      version.slot,
      metric.values[version.slot],
      metric.deltas[version.slot],
      metric.winnerSlot === version.slot ? "winner" : "",
    ])),
    ...comparison.mix.map((segment) => ["mix", segment.id, segment.label, segment.sourceSlot, "", "", `${segment.timecode} · ${segment.action}`]),
  ];
  download(`${comparison.title.replaceAll("/", "-")}-comparison.csv`, "text/csv;charset=utf-8", rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

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

function wrap(text: string, width = 96) {
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

function pdfLines(comparison: ComparisonReport) {
  return [
    "PRAEVIA - NEUROIMPACT ANALYZER",
    comparison.title,
    "",
    `Decision recomendada: ${comparison.decision}`,
    "",
    "RANKING",
    ...comparison.versions.flatMap((version) => wrap(`${version.rank}. Version ${version.slot} | NRI ${version.nri} | delta ${version.globalDelta}`)),
    "",
    "GANADORES POR METRICA",
    ...comparison.metricDeltas.slice(0, 9).flatMap((metric) => wrap(`${metric.metricLabel}: Version ${metric.winnerSlot}`)),
    "",
    "MIX RECOMENDADO",
    ...comparison.mix.flatMap((segment) => wrap(`${segment.label} | ${segment.timecode} | Version ${segment.sourceSlot} | ${segment.action}`)),
    "",
    "COMPARABILIDAD",
    ...comparison.comparability.flatMap((issue) => wrap(`${issue.severity.toUpperCase()} | ${issue.label}: ${issue.detail}`)),
  ];
}

function buildPdf(comparison: ComparisonReport) {
  const lines = pdfLines(comparison);
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) chunks.push(lines.slice(index, index + 42));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let nextId = 4;
  const pageIds: number[] = [];
  chunks.forEach((pageLines, pageIndex) => {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const content = [
      "BT",
      "/F1 11 Tf",
      "50 790 Td",
      ...pageLines.flatMap((line, index) => {
        const size = index === 0 && pageIndex === 0 ? 14 : line === line.toUpperCase() && line.length < 32 ? 12 : 10;
        return [`/F1 ${size} Tf`, `(${pdfEscape(line)}) Tj`, "0 -17 Td"];
      }),
      "ET",
    ].join("\n");
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function exportComparisonPdf(comparison: ComparisonReport) {
  download(`${comparison.title.replaceAll("/", "-")}-comparison.pdf`, "application/pdf", buildPdf(comparison));
}
