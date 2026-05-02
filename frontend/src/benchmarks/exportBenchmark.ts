import type { NeuroScoringResult } from "../scoring/types";
import { applyBenchmark, benchmarkCorrelation, exportBenchmarkPayload } from "./localBenchmarkStore";
import type { BenchmarkStore } from "./types";

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

function buildPdf(lines: string[]) {
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
        const size = index === 0 && pageIndex === 0 ? 14 : line === line.toUpperCase() && line.length < 38 ? 12 : 10;
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

export function exportBenchmarkJson(store: BenchmarkStore, benchmarkId: string, result?: NeuroScoringResult) {
  const payload = exportBenchmarkPayload(store, benchmarkId, result);
  download("benchmark-calibration.json", "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
}

export function exportBenchmarkCsv(store: BenchmarkStore, benchmarkId: string) {
  const rows = [
    ["asset", "nri", "visual", "narrative", "action", "vtr"],
    ...store.items.filter((item) => item.benchmarkId === benchmarkId).map((item) => {
      const kpi = store.kpis.find((entry) => entry.benchmarkItemId === item.id && entry.kpiType === "vtr");
      return [item.assetName, item.scores.nri, item.scores.visual_salience, item.scores.narrative_clarity, item.scores.action_readiness, kpi?.value ?? ""];
    }),
  ];
  download("benchmark-calibration.csv", "text/csv;charset=utf-8", rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n"));
}

export function exportBenchmarkPdf(store: BenchmarkStore, benchmarkId: string, result?: NeuroScoringResult) {
  const benchmark = store.benchmarks.find((item) => item.id === benchmarkId);
  const metrics = result ? applyBenchmark(result, benchmarkId, store) : [];
  const corr = benchmarkCorrelation(store, benchmarkId, "vtr");
  const lines = [
    "PRAEVIA - NEUROIMPACT ANALYZER",
    "Benchmark privado y calibracion",
    "",
    `Benchmark: ${benchmark?.name ?? "Sin benchmark"}`,
    `Categoria: ${benchmark?.sector ?? "-"} / ${benchmark?.channel ?? "-"} / ${benchmark?.durationLabel ?? "-"}`,
    `Muestra: ${store.items.filter((item) => item.benchmarkId === benchmarkId).length} piezas | KPIs: ${store.kpis.filter((item) => item.benchmarkId === benchmarkId).length}`,
    "",
    "PIEZA NUEVA VS BENCHMARK",
    ...(result ? metrics.flatMap((metric) => wrap(`${metric.metricLabel}: score ${metric.score} | percentil ${metric.percentile} | media ${metric.mean} | delta ${metric.delta} | n=${metric.sampleSize}`)) : ["Sin pieza aplicada"]),
    "",
    "CALIBRACION SCORE VS KPI",
    `KPI: ${corr.label} | puntos ${corr.points.length} | r=${corr.r ?? "pendiente"}`,
    ...corr.points.slice(0, 12).flatMap((point) => wrap(`${point.assetName}: NRI ${point.score} | ${corr.label} ${point.kpi}%`)),
    "",
    "LECTURA",
    "Los percentiles son internos del cliente/categoria. Sirven para comparar piezas similares y calibrar contra resultados reales posteriores. No son garantia causal de rendimiento.",
  ];
  download("benchmark-calibration.pdf", "application/pdf", buildPdf(lines));
}
