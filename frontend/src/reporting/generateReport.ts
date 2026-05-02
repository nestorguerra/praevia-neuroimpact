import type { AnalysisRun } from "../inference/types";
import type { ProjectBundle } from "../projects/types";
import type { EditorialScore, NeuroScoringResult, PeakMoment } from "../scoring/types";
import { getRuntimeReadiness, loadRuntimeSettings } from "../settings/localRuntimeSettings";
import type { UploadAsset } from "../uploads/types";
import { reviewReportClaims } from "./guardrails";
import type { ReportRecord, ReportSection } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.round(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function topScore(result: NeuroScoringResult) {
  return [...result.editorialScores].sort((a, b) => b.score - a.score)[0];
}

function weakScore(result: NeuroScoringResult) {
  return [...result.editorialScores].sort((a, b) => a.score - b.score)[0];
}

function peakMoment(result: NeuroScoringResult) {
  return result.peakMoments.find((moment) => moment.momentType === "peak") ?? result.peakMoments[0];
}

function valleyMoment(result: NeuroScoringResult) {
  return result.peakMoments.find((moment) => moment.momentType === "valley") ?? result.peakMoments[0];
}

function decisionFor(result: NeuroScoringResult) {
  const weak = weakScore(result);
  const peak = peakMoment(result);
  if (result.summary.nri >= 72) {
    return `Avanzar con ajustes: mantener la pieza como base, proteger el tramo ${formatTime(peak.startSeconds)}-${formatTime(peak.endSeconds)} y corregir ${weak.metricLabel}.`;
  }
  if (result.summary.nri >= 55) {
    return `Revisar montaje: no descartar la pieza, pero reforzar ${weak.metricLabel} y reanalizar despues de cambios.`;
  }
  return `No usar como master: la pieza necesita una nueva iteracion antes de circular en comite.`;
}

function recommendationRows(result: NeuroScoringResult) {
  const weak = weakScore(result);
  const strong = topScore(result);
  const moments = result.peakMoments.map((moment) => ({
    timecode: `${formatTime(moment.startSeconds)}-${formatTime(moment.endSeconds)}`,
    layer: moment.momentType === "peak" ? "ritmo" : moment.momentType === "valley" ? "montaje" : "narrativa",
    action: moment.action,
    confidence: result.confidenceLabel,
    impact: moment.momentType === "peak" ? "alto" : "medio",
  }));

  return [
    ...moments,
    {
      timecode: "global",
      layer: weak.metricLabel,
      action: weak.action,
      confidence: result.confidenceLabel,
      impact: weak.score < 55 ? "alto" : "medio",
    },
    {
      timecode: "global",
      layer: strong.metricLabel,
      action: "Usar la fortaleza principal como referencia de montaje y evitar diluirla con tramos de baja saliencia.",
      confidence: result.confidenceLabel,
      impact: "medio",
    },
  ].slice(0, 5);
}

function section(id: string, sectionKey: string, title: string, body: string, payload: Record<string, unknown>, orderIndex: number): ReportSection {
  const reviewed = reviewReportClaims(body);
  return {
    id: createId("section"),
    sectionKey,
    title,
    body: reviewed.text,
    payload,
    orderIndex,
  };
}

export function generateReportFromResult({
  result,
  bundle,
  run,
  asset,
}: {
  result: NeuroScoringResult;
  bundle?: ProjectBundle | null;
  run?: AnalysisRun;
  asset?: UploadAsset;
}): ReportRecord {
  const id = createId("report");
  const top = topScore(result);
  const weak = weakScore(result);
  const peak = peakMoment(result);
  const valley = valleyMoment(result);
  const decision = decisionFor(result);
  const tldr = `NRI ${result.summary.nri} con confianza ${result.confidenceLabel}. La fortaleza principal es ${top.metricLabel} (${top.score}) y el punto a corregir es ${weak.metricLabel} (${weak.score}).`;
  const recommendations = recommendationRows(result);
  const title = `Informe creativo · ${result.assetName}`;
  const reportText = [title, decision, tldr, ...recommendations.map((item) => item.action)].join("\n");
  const guardrailReview = reviewReportClaims(reportText);
  const now = new Date().toISOString();
  const baseStorageKey = `reports/org/${result.organizationId}/experiment/${result.experimentId}/scoring/${result.id}/report/${id}`;
  const runtimeSettings = loadRuntimeSettings(result.organizationId);
  const runtimeReadiness = getRuntimeReadiness(runtimeSettings);
  const sections = [
    section(
      id,
      "executive_summary",
      "Resumen ejecutivo",
      `La pieza muestra un perfil util para decision editorial. ${tldr} La decision recomendada es: ${decision}`,
      { nri: result.summary.nri, topScore: top, weakScore: weak, project: bundle?.project },
      1,
    ),
    section(
      id,
      "timeline",
      "Timeline accionable",
      `El pico principal aparece en ${formatTime(peak.startSeconds)}-${formatTime(peak.endSeconds)}. El valle principal aparece en ${formatTime(valley.startSeconds)}-${formatTime(valley.endSeconds)}. Estos tramos concentran la decision de montaje.`,
      { peak, valley, timecourse: result.timecoursePoints },
      2,
    ),
    section(
      id,
      "recommendations",
      "Recomendaciones priorizadas",
      "Aplicar primero las acciones con timecode. Despues revisar la metrica global mas debil antes de regenerar el informe final.",
      { recommendations },
      3,
    ),
    section(
      id,
      "methodology",
      "Metodologia y limites",
      "Este informe usa respuesta cerebral predicha, indicadores comparativos y evidencia por timecode. No sustituye test con audiencia real, brand lift ni metricas reales de campana.",
      {
        modelId: result.modelId,
        scoringVersion: result.scoringVersion,
        benchmark: result.benchmarkLabel,
        promptVersion: "report-master-v0.1",
        run,
        assetKind: asset?.health.kind,
      },
      4,
    ),
    section(
      id,
      "technical_annex",
      "Anexo tecnico",
      "El anexo conserva trazabilidad de modelo, scoring, delay BOLD, tokens estimados, benchmark y hashes/keys cuando esten disponibles en storage real.",
      {
        boldDelaySeconds: result.boldDelaySeconds,
        regionScores: result.regionScores,
        networkScores: result.networkScores,
      },
      5,
    ),
  ];

  return {
    id,
    organizationId: result.organizationId,
    experimentId: result.experimentId,
    assetId: result.assetId,
    analysisRunId: result.analysisRunId,
    scoringResultId: result.id,
    assetName: result.assetName,
    reportType: "creative",
    language: "es",
    status: "ready",
    title: guardrailReview.text.split("\n")[0] || title,
    decision: reviewReportClaims(decision).text,
    tldr: reviewReportClaims(tldr).text,
    guardrailStatus: guardrailReview.status,
    guardrailFindings: guardrailReview.findings,
    usage: {
      provider: runtimeReadiness.llmReady ? "openai" : "local",
      draftModel: runtimeReadiness.llmReady ? runtimeSettings.llm.reportWriterModel : "local-draft-v0",
      finalModel: runtimeReadiness.llmReady ? runtimeSettings.llm.reportInterpreterModel : "local-final-v0",
      reviewerModel: runtimeReadiness.llmReady ? runtimeSettings.llm.reportWriterModel : undefined,
      promptVersion: runtimeSettings.llm.promptVersion,
      inputTokens: Math.max(350, Math.round(reportText.length / 4)),
      outputTokens: Math.max(700, sections.reduce((sum, item) => sum + item.body.length, 0) / 4),
      estimatedCostEur: 0,
    },
    htmlStorageKey: `${baseStorageKey}/report.html`,
    pdfStorageKey: `${baseStorageKey}/report.pdf`,
    sections,
    scoringSnapshot: result,
    createdAt: now,
    updatedAt: now,
  };
}

export type RecommendationRow = ReturnType<typeof recommendationRows>[number];

export function getReportRecommendations(report: ReportRecord) {
  return (report.sections.find((item) => item.sectionKey === "recommendations")?.payload.recommendations ?? []) as RecommendationRow[];
}

export function getReportTopScores(report: ReportRecord): { top: EditorialScore; weak: EditorialScore; peak: PeakMoment; valley: PeakMoment } {
  return {
    top: topScore(report.scoringSnapshot),
    weak: weakScore(report.scoringSnapshot),
    peak: peakMoment(report.scoringSnapshot),
    valley: valleyMoment(report.scoringSnapshot),
  };
}
