import type { AnalysisRun } from "../inference/types";
import type { EditorialMetricKey, NeuroScoringResult, NetworkScore, PeakMoment, RegionScore, TimecoursePoint } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

const labels: Record<EditorialMetricKey, string> = {
  nri: "Neural Response Index",
  visual_salience: "Visual Salience",
  narrative_clarity: "Narrative Clarity",
  multimodal_coherence: "Multimodal Coherence",
  semantic_load: "Semantic Load",
  social_cueing: "Social Cueing",
  scene_immersion: "Scene Immersion",
  action_readiness: "Action Readiness",
  temporal_momentum: "Temporal Momentum",
};

function clip(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function confidenceFor(run: AnalysisRun) {
  if ((run.nTimesteps ?? 0) >= 24 && run.nVertices === 20484) return { label: "alta" as const, value: 0.86 };
  if ((run.nTimesteps ?? 0) >= 10 && run.nVertices === 20484) return { label: "media" as const, value: 0.72 };
  return { label: "baja" as const, value: 0.55 };
}

function formatMetricAction(metricKey: EditorialMetricKey, score: number) {
  if (metricKey === "visual_salience" && score < 60) return "Refuerza el primer plano visual o elimina frames de baja saliencia.";
  if (metricKey === "semantic_load" && score > 70) return "Reduce carga verbal o separa conceptos por tramo.";
  if (metricKey === "multimodal_coherence" && score < 65) return "Alinea locucion, cambio visual y claim en el mismo tramo.";
  if (metricKey === "action_readiness" && score < 60) return "Acerca el CTA al pico temporal o refuerza gesto/packshot.";
  return "Comparar contra benchmark interno antes de convertirlo en decision creativa.";
}

export function buildScoringResult(run: AnalysisRun): NeuroScoringResult {
  const confidence = confidenceFor(run);
  const seed = run.assetName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 13;
  const base = 61 + seed;
  const networkScores: NetworkScore[] = [
    { networkKey: "visual", networkLabel: "Visual salience network", score: clip(base + 9), confidence: confidence.value, evidence: "Respuesta visual proxy desde vertices fsaverage5." },
    { networkKey: "auditory", networkLabel: "Auditory processing network", score: clip(base - 3), confidence: confidence.value, evidence: "Audio extraido en Sprint 5; pendiente validacion ffprobe real." },
    { networkKey: "language", networkLabel: "Language and semantic network", score: clip(base + 1), confidence: confidence.value - 0.04, evidence: "Transcript disponible como derivado; Whisper local en worker CPU." },
    { networkKey: "social", networkLabel: "Social cognition network", score: clip(base - 8), confidence: confidence.value - 0.08, evidence: "Senales sociales aproximadas; sin detector visual dedicado aun." },
    { networkKey: "control", networkLabel: "Executive control network", score: clip(base + 3), confidence: confidence.value - 0.02, evidence: "Patron temporal estable en control narrativo." },
    { networkKey: "motor", networkLabel: "Action readiness network", score: clip(base - 2), confidence: confidence.value - 0.02, evidence: "Proxy de disposicion a accion y cierre." },
  ];
  const byNetwork = Object.fromEntries(networkScores.map((item) => [item.networkKey, item.score]));
  const metricValues: Record<EditorialMetricKey, number> = {
    nri: clip(networkScores.reduce((sum, item) => sum + item.score, 0) / networkScores.length),
    visual_salience: byNetwork.visual,
    narrative_clarity: clip((byNetwork.language + byNetwork.control) / 2),
    multimodal_coherence: clip((byNetwork.visual + byNetwork.auditory + byNetwork.language) / 3),
    semantic_load: clip(100 - byNetwork.language * 0.42),
    social_cueing: byNetwork.social,
    scene_immersion: clip(byNetwork.visual * 0.72 + byNetwork.control * 0.28),
    action_readiness: byNetwork.motor,
    temporal_momentum: clip(Math.max(...networkScores.map((item) => item.score)) - Math.min(...networkScores.map((item) => item.score)) + 48),
  };
  const editorialScores = Object.entries(metricValues).map(([metricKey, score]) => ({
    metricKey: metricKey as EditorialMetricKey,
    metricLabel: labels[metricKey as EditorialMetricKey],
    score,
    confidence: confidence.value,
    benchmarkDelta: clip(score - 60),
    evidence: `${labels[metricKey as EditorialMetricKey]} derivado de redes y timecourse v0.1.`,
    action: formatMetricAction(metricKey as EditorialMetricKey, score),
  }));
  const regionScores: RegionScore[] = [
    { regionKey: "v1_v2", regionLabel: "Visual occipital", networkKey: "visual", score: clip(byNetwork.visual + 4), meanResponse: 0.061, peakResponse: 0.142, evidence: "ROI proxy sobre bloque visual." },
    { regionKey: "ppa_scene", regionLabel: "Scene / parahippocampal", networkKey: "visual", score: clip(byNetwork.visual - 2), meanResponse: 0.052, peakResponse: 0.125, evidence: "Proxy de contexto/escena." },
    { regionKey: "stg", regionLabel: "Superior temporal", networkKey: "auditory", score: byNetwork.auditory, meanResponse: 0.047, peakResponse: 0.108, evidence: "Audio normalizado disponible." },
    { regionKey: "ifg", regionLabel: "Inferior frontal language", networkKey: "language", score: byNetwork.language, meanResponse: 0.051, peakResponse: 0.117, evidence: "Transcript alineable." },
    { regionKey: "sts_tpj", regionLabel: "STS / TPJ social", networkKey: "social", score: byNetwork.social, meanResponse: 0.038, peakResponse: 0.092, evidence: "Social cognition proxy." },
    { regionKey: "dlpfc", regionLabel: "Prefrontal control", networkKey: "control", score: byNetwork.control, meanResponse: 0.044, peakResponse: 0.102, evidence: "Control narrativo proxy." },
  ];
  const values = [34, 47, 63, 78, 71, 59, 45, 52, 68, 84, 62, 43].slice(0, run.nTimesteps ?? 12);
  const timecoursePoints: TimecoursePoint[] = values.map((value, index) => {
    const boldTime = Number((index * 1.49).toFixed(2));
    const stimulusTime = Number(Math.max(0, boldTime - 4.5).toFixed(2));
    return {
      pointIndex: index,
      boldTimeSeconds: boldTime,
      stimulusTimeSeconds: stimulusTime,
      globalResponse: Number((value / 100).toFixed(3)),
      normalizedResponse: value,
      eventLabel: value >= 82 ? "peak" : value <= 36 ? "valley" : undefined,
    };
  });
  const peakMoments: PeakMoment[] = [
    { momentType: "peak", startSeconds: 8.91, endSeconds: 10.4, score: 84, evidence: "Pico global tras correccion BOLD aproximada.", action: "Usar este tramo como referencia de cierre o refuerzo." },
    { momentType: "valley", startSeconds: 0, endSeconds: 1.49, score: 34, evidence: "Arranque con respuesta baja.", action: "Refuerza el primer plano, claim o entrada sonora en los 2 primeros segundos." },
    { momentType: "flat", startSeconds: 5.93, endSeconds: 7.42, score: 52, evidence: "Tramo medio con diferencial limitado.", action: "Introducir contraste visual o simplificar carga verbal." },
  ];
  return {
    id: createId("scoring"),
    organizationId: run.organizationId,
    experimentId: run.experimentId,
    assetId: run.assetId,
    analysisRunId: run.id,
    assetName: run.assetName,
    modelId: run.modelId,
    scoringVersion: "scoring-v0.1",
    confidenceLabel: confidence.label,
    benchmarkLabel: "Demo baseline · sin benchmark cliente",
    boldDelaySeconds: 4.5,
    summary: {
      nri: metricValues.nri,
      confidence: confidence.label,
      benchmark: "Demo baseline",
      decision: "Resultado interno generado. No usar como decision comercial hasta tener TRIBE real + benchmark.",
    },
    editorialScores,
    regionScores,
    networkScores,
    timecoursePoints,
    peakMoments,
    createdAt: new Date().toISOString(),
  };
}
