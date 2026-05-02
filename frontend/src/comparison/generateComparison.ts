import type { NeuroScoringResult, TimecoursePoint } from "../scoring/types";
import type { UploadAsset, AssetSlot } from "../uploads/types";
import type { ComparabilityIssue, ComparisonMetricDelta, ComparisonReport, ComparisonTimepoint, ComparisonVersion, MixSegment } from "./types";

const slotOrder: AssetSlot[] = ["A", "B", "C"];

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

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function valueForMetric(result: NeuroScoringResult, metricKey: string) {
  return result.editorialScores.find((score) => score.metricKey === metricKey)?.score;
}

function slotForResult(result: NeuroScoringResult, assets: UploadAsset[], index: number): AssetSlot {
  return assets.find((asset) => asset.id === result.assetId)?.slot ?? slotOrder[index] ?? "A";
}

function buildVersions(results: NeuroScoringResult[], assets: UploadAsset[]): ComparisonVersion[] {
  const versions = results
    .map((result, index) => ({
      slot: slotForResult(result, assets, index),
      label: `Version ${slotForResult(result, assets, index)}`,
      result,
      nri: result.summary.nri,
      rank: 0,
      globalDelta: 0,
    }))
    .sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));
  const ranked = [...versions].sort((a, b) => b.nri - a.nri);
  const best = ranked[0]?.nri ?? 0;
  return versions.map((version) => ({
    ...version,
    rank: ranked.findIndex((item) => item.result.id === version.result.id) + 1,
    globalDelta: Number((version.nri - best).toFixed(1)),
  }));
}

function metricDeltas(versions: ComparisonVersion[]): ComparisonMetricDelta[] {
  const keys = versions[0]?.result.editorialScores.map((score) => ({ key: score.metricKey, label: score.metricLabel })) ?? [];
  return keys.map(({ key, label }) => {
    const values = Object.fromEntries(versions.map((version) => [version.slot, valueForMetric(version.result, key)])) as Record<AssetSlot, number | undefined>;
    const valid = Object.entries(values).filter((entry): entry is [AssetSlot, number] => typeof entry[1] === "number");
    const winnerSlot = valid.sort((a, b) => b[1] - a[1])[0]?.[0] ?? versions[0]?.slot ?? "A";
    const winnerValue = values[winnerSlot] ?? 0;
    const deltas = Object.fromEntries(slotOrder.map((slot) => [slot, typeof values[slot] === "number" ? Number((values[slot]! - winnerValue).toFixed(1)) : undefined])) as Record<AssetSlot, number | undefined>;
    return { metricKey: key, metricLabel: label, winnerSlot, values, deltas, category: categoryForMetric(key) };
  });
}

function categoryForMetric(metricKey: string) {
  const categories: Record<string, string> = {
    nri: "global",
    visual_salience: "visual",
    narrative_clarity: "narrative",
    multimodal_coherence: "modality",
    semantic_load: "narrative",
    social_cueing: "social",
    scene_immersion: "visual",
    action_readiness: "action",
    temporal_momentum: "temporal",
  };
  return categories[metricKey] ?? "other";
}

function pointAt(points: TimecoursePoint[], index: number) {
  return points[index] ?? points[points.length - 1];
}

function timepointDeltas(versions: ComparisonVersion[]): ComparisonTimepoint[] {
  const maxPoints = Math.max(...versions.map((version) => version.result.timecoursePoints.length), 0);
  return Array.from({ length: maxPoints }, (_, pointIndex) => {
    const values = Object.fromEntries(versions.map((version) => [version.slot, pointAt(version.result.timecoursePoints, pointIndex)?.normalizedResponse])) as Record<AssetSlot, number | undefined>;
    const valid = Object.entries(values).filter((entry): entry is [AssetSlot, number] => typeof entry[1] === "number");
    const winnerSlot = valid.sort((a, b) => b[1] - a[1])[0]?.[0] ?? versions[0]?.slot ?? "A";
    const winnerValue = values[winnerSlot] ?? 0;
    const secondValue = valid.filter(([slot]) => slot !== winnerSlot).sort((a, b) => b[1] - a[1])[0]?.[1] ?? winnerValue;
    const firstPoint = pointAt(versions[0]?.result.timecoursePoints ?? [], pointIndex);
    return {
      pointIndex,
      timecode: formatTime(firstPoint?.stimulusTimeSeconds ?? pointIndex),
      winnerSlot,
      values,
      margin: Number((winnerValue - secondValue).toFixed(1)),
    };
  });
}

function averageRange(result: NeuroScoringResult, start: number, end: number) {
  const points = result.timecoursePoints.slice(start, end);
  return avg(points.map((point) => point.normalizedResponse));
}

function bestSegment(versions: ComparisonVersion[], start: number, end: number) {
  return [...versions].sort((a, b) => averageRange(b.result, start, end) - averageRange(a.result, start, end))[0];
}

function mixSegments(versions: ComparisonVersion[], metricRows: ComparisonMetricDelta[], timepoints: ComparisonTimepoint[]): MixSegment[] {
  const maxPoints = Math.max(...versions.map((version) => version.result.timecoursePoints.length), 0);
  const firstEnd = Math.max(1, Math.floor(maxPoints / 3));
  const middleEnd = Math.max(firstEnd + 1, Math.floor((maxPoints / 3) * 2));
  const opening = bestSegment(versions, 0, firstEnd);
  const middle = bestSegment(versions, firstEnd, middleEnd);
  const closing = bestSegment(versions, middleEnd, maxPoints);
  const visualWinner = metricRows.find((row) => row.metricKey === "visual_salience")?.winnerSlot ?? opening.slot;
  const actionWinner = metricRows.find((row) => row.metricKey === "action_readiness")?.winnerSlot ?? closing.slot;
  const lowestPoint = [...timepoints]
    .filter((point) => typeof point.values[versions.find((version) => version.rank === 1)?.slot ?? "A"] === "number")
    .sort((a, b) => (a.values[versions.find((version) => version.rank === 1)?.slot ?? "A"] ?? 100) - (b.values[versions.find((version) => version.rank === 1)?.slot ?? "A"] ?? 100))[0];

  return [
    {
      id: "master",
      label: "Master",
      timecode: "Global",
      sourceSlot: versions.find((version) => version.rank === 1)?.slot ?? "A",
      reason: "Mejor NRI global y base mas defendible para comite.",
      action: "Usar como estructura principal del montaje.",
    },
    {
      id: "opening",
      label: "Apertura",
      timecode: `00:00-${timepoints[firstEnd]?.timecode ?? "00:05"}`,
      sourceSlot: visualWinner,
      reason: "Mejor rendimiento visual para entrada y primer anclaje.",
      action: `Importar plano/ritmo de Version ${visualWinner} si mejora el arranque.`,
    },
    {
      id: "middle",
      label: "Tramo medio",
      timecode: `${timepoints[firstEnd]?.timecode ?? "00:05"}-${timepoints[middleEnd]?.timecode ?? "00:10"}`,
      sourceSlot: middle.slot,
      reason: "Mejor promedio temporal en tramo de explicacion.",
      action: `Usar Version ${middle.slot} como donante para simplificar el cuerpo.`,
    },
    {
      id: "closing",
      label: "Cierre / CTA",
      timecode: `${timepoints[middleEnd]?.timecode ?? "00:10"}-${timepoints.at(-1)?.timecode ?? "00:15"}`,
      sourceSlot: actionWinner,
      reason: "Mejor Action Readiness para cierre y decision.",
      action: `Sustituir cierre por Version ${actionWinner} si se mantiene coherencia narrativa.`,
    },
    {
      id: "cut",
      label: "Recorte",
      timecode: lowestPoint?.timecode ?? "00:00",
      sourceSlot: versions.find((version) => version.rank === 1)?.slot ?? "A",
      reason: "Valle relativo de la version master.",
      action: "Recortar, reforzar claim o cambiar imagen en este tramo.",
    },
  ];
}

function comparability(results: NeuroScoringResult[], assets: UploadAsset[]): ComparabilityIssue[] {
  const kinds = new Set(assets.filter((asset) => results.some((result) => result.assetId === asset.id)).map((asset) => asset.health.kind));
  const timesteps = results.map((result) => result.timecoursePoints.length);
  const maxTimesteps = Math.max(...timesteps, 0);
  const minTimesteps = Math.min(...timesteps, maxTimesteps);
  const issues: ComparabilityIssue[] = [
    {
      severity: results.length >= 2 ? "ok" : "error",
      label: "Piezas",
      detail: `${results.length} versiones con scoring. Minimo 2 para A/B; ideal 3 para A/B/C.`,
    },
    {
      severity: kinds.size <= 1 ? "ok" : "warning",
      label: "Formato",
      detail: kinds.size <= 1 ? "Versiones del mismo tipo de asset." : "Hay tipos de asset mezclados; revisar comparabilidad.",
    },
    {
      severity: maxTimesteps - minTimesteps <= 3 ? "ok" : "warning",
      label: "Duracion",
      detail: `Timesteps ${minTimesteps}-${maxTimesteps}. Diferencias grandes pueden sesgar el timeline.`,
    },
    {
      severity: "ok",
      label: "Canal",
      detail: "Canal heredado del proyecto. Para produccion, validar que A/B/C comparten canal y duracion objetivo.",
    },
  ];
  return issues;
}

export function buildComparisonReport(results: NeuroScoringResult[], assets: UploadAsset[], organizationId: string, experimentId: string): ComparisonReport | null {
  if (results.length < 2) return null;
  const versions = buildVersions(results, assets);
  const deltas = metricDeltas(versions);
  const timepoints = timepointDeltas(versions);
  const mix = mixSegments(versions, deltas, timepoints);
  const masterSlot = versions.find((version) => version.rank === 1)?.slot ?? "A";
  const close = mix.find((segment) => segment.id === "closing");
  const visual = mix.find((segment) => segment.id === "opening");
  const cut = mix.find((segment) => segment.id === "cut");
  const winnerByModality = Object.fromEntries(deltas.map((metric) => [metric.category ?? "other", metric.winnerSlot]));
  return {
    id: createId("comparison"),
    organizationId,
    experimentId,
    title: results.length >= 3 ? "Comparativa A/B/C" : "Comparativa A/B",
    status: comparability(results, assets).some((issue) => issue.severity === "error") ? "needs_review" : "ready",
    decision: `Usar Version ${masterSlot} como master, cierre de Version ${close?.sourceSlot ?? masterSlot}, plano/arranque de Version ${visual?.sourceSlot ?? masterSlot} y recortar ${cut?.timecode ?? "el valle principal"}.`,
    masterSlot,
    versions,
    metricDeltas: deltas,
    timepoints,
    mix,
    comparability: comparability(results, assets),
    winnerByModality,
    reportPayload: {
      algorithm_version: "comparison-local-v0.1",
      source: "local_contract",
      winner_by_modality: winnerByModality,
      timepoints_compared: timepoints.length,
    },
    createdAt: new Date().toISOString(),
  };
}
