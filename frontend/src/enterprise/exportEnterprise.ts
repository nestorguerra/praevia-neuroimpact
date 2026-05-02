import type { AdminSnapshot } from "../admin/types";
import type { EnterpriseStore, MonthlyUsageExport } from "./types";

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
        const size = index === 0 && pageIndex === 0 ? 14 : line === line.toUpperCase() && line.length < 42 ? 12 : 10;
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

export function exportMonthlyUsageJson(store: EnterpriseStore, snapshot: AdminSnapshot, monthlyExport: MonthlyUsageExport) {
  download(
    `praevia-usage-${monthlyExport.month}.json`,
    "application/json;charset=utf-8",
    JSON.stringify({ organization: store.organizationName, export: monthlyExport, usageEvents: snapshot.usageEvents }, null, 2),
  );
}

export function exportMonthlyUsageCsv(snapshot: AdminSnapshot, monthlyExport: MonthlyUsageExport) {
  const rows = [
    ["month", "event_type", "label", "credits", "cost_eur", "gpu_seconds", "input_tokens", "output_tokens", "storage_bytes", "created_at"],
    ...snapshot.usageEvents.map((event) => [
      monthlyExport.month,
      event.eventType,
      event.label,
      event.creditsDelta,
      event.estimatedCostEur,
      event.gpuSeconds,
      event.inputTokens,
      event.outputTokens,
      event.storageBytesDelta,
      event.createdAt,
    ]),
  ];
  download(
    `praevia-usage-${monthlyExport.month}.csv`,
    "text/csv;charset=utf-8",
    rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n"),
  );
}

export function exportEnterprisePackPdf(store: EnterpriseStore, monthlyExport: MonthlyUsageExport) {
  const lines = [
    "PRAEVIA - NEUROIMPACT ANALYZER",
    "Pack mensual SaaS v1.5 beta",
    "",
    `Organizacion: ${store.organizationName}`,
    `Periodo: ${monthlyExport.month}`,
    "Modo de facturacion: manual beta, sin pasarela de pago",
    "",
    "USO MENSUAL",
    `Creditos usados: ${monthlyExport.creditsUsed}`,
    `Coste estimado: ${monthlyExport.estimatedCostEur} EUR`,
    `GPU seconds: ${monthlyExport.gpuSeconds}`,
    `Tokens entrada/salida: ${monthlyExport.inputTokens} / ${monthlyExport.outputTokens}`,
    `Runs: ${monthlyExport.runs} | Informes: ${monthlyExport.reports} | Comparativas: ${monthlyExport.comparisons}`,
    "",
    "PLANES ACTIVOS",
    ...store.plans.map((plan) => `${plan.name}: ${plan.priceLabel} | ${plan.monthlyAssets} | ${plan.users}`),
    "",
    "SEGURIDAD Y OPERACION",
    `Retencion assets: ${store.retentionPolicy.assetRetentionDays} dias`,
    `Retencion informes: ${store.retentionPolicy.reportRetentionDays} dias`,
    `Region: ${store.retentionPolicy.region}`,
    `SLA incidente: ${store.retentionPolicy.incidentResponseHours}h`,
    `SSO: ${store.ssoRoadmap.status} | ${store.ssoRoadmap.protocol}`,
    "",
    "CHECKLIST PROCUREMENT",
    ...store.procurementChecklist.map((item) => `${item.status.toUpperCase()} - ${item.label}: ${item.evidence}`),
    "",
    "LECTURA",
    "Este pack sirve para piloto beta, renovacion manual y revision de procurement. La pasarela de pago queda fuera del alcance actual.",
  ];
  download(`praevia-enterprise-pack-${monthlyExport.month}.pdf`, "application/pdf", buildPdf(lines));
}
