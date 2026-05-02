import type { EditorialMetricKey, NeuroScoringResult } from "../scoring/types";
import type {
  AppliedBenchmarkMetric,
  BenchmarkCorrelation,
  BenchmarkItem,
  BenchmarkRecord,
  BenchmarkStore,
  ExternalKpi,
  KpiType,
} from "./types";

const storageKey = (organizationId: string) => `praevia:benchmarks:${organizationId}:v1`;

const metricLabels: Record<EditorialMetricKey, string> = {
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

export const kpiLabels: Record<KpiType, string> = {
  vtr: "VTR",
  ctr: "CTR",
  retention: "Retencion",
  brand_lift: "Brand lift",
  survey: "Encuesta",
  event_feedback: "Feedback evento",
};

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function now() {
  return new Date().toISOString();
}

function scoreMap(values: Partial<Record<EditorialMetricKey, number>>) {
  return values;
}

function seedStore(organizationId: string): BenchmarkStore {
  const benchmarkId = createId("bench");
  const createdAt = now();
  const benchmark: BenchmarkRecord = {
    id: benchmarkId,
    organizationId,
    name: "Banca / CTV / 30s",
    category: "Spot CTV 30s",
    sector: "Banca",
    channel: "CTV",
    durationLabel: "30s",
    language: "es",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };
  const items: BenchmarkItem[] = [
    ["Hipotecas Q1 · Master", 72, 78, 70, 74, 61],
    ["Hipotecas Q1 · Cierre humano", 76, 74, 79, 77, 69],
    ["App ahorro · Producto", 63, 68, 62, 64, 58],
    ["Seguro hogar · Manifesto", 69, 73, 67, 70, 65],
    ["Credito verde · Social", 81, 82, 78, 80, 73],
    ["Banca privada · Evento", 58, 61, 65, 59, 54],
    ["Prestamo coche · Retail media", 66, 69, 64, 68, 62],
    ["Cuenta joven · Influencer", 74, 76, 72, 71, 78],
  ].map(([assetName, nri, visual, narrative, action, social]) => ({
    id: createId("bench_item"),
    organizationId,
    benchmarkId,
    assetName: String(assetName),
    sourceLabel: "demo",
    scores: scoreMap({
      nri: Number(nri),
      visual_salience: Number(visual),
      narrative_clarity: Number(narrative),
      action_readiness: Number(action),
      social_cueing: Number(social),
    }),
    createdAt,
  }));
  const kpiValues = [68, 73, 55, 64, 79, 51, 59, 70];
  const kpis: ExternalKpi[] = items.map((item, index) => ({
    id: createId("kpi"),
    organizationId,
    benchmarkId,
    benchmarkItemId: item.id,
    kpiType: "vtr",
    value: kpiValues[index] ?? 60,
    unit: "%",
    source: "demo post-campaign",
    period: "Q1",
    notes: "Seed demo para calibracion inicial.",
    createdAt,
  }));
  return { benchmarks: [benchmark], items, kpis };
}

export function loadBenchmarkStore(organizationId: string): BenchmarkStore {
  const raw = localStorage.getItem(storageKey(organizationId));
  if (!raw) {
    const seeded = seedStore(organizationId);
    saveBenchmarkStore(organizationId, seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as BenchmarkStore;
    if (!Array.isArray(parsed.benchmarks) || !Array.isArray(parsed.items) || !Array.isArray(parsed.kpis)) throw new Error("Invalid store");
    return parsed;
  } catch {
    const seeded = seedStore(organizationId);
    saveBenchmarkStore(organizationId, seeded);
    return seeded;
  }
}

export function saveBenchmarkStore(organizationId: string, store: BenchmarkStore) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(store));
}

export function createDemoBenchmark(organizationId: string) {
  const current = loadBenchmarkStore(organizationId);
  if (current.benchmarks.some((benchmark) => benchmark.name === "Banca / CTV / 30s")) return current;
  const seeded = seedStore(organizationId);
  const next = {
    benchmarks: [...seeded.benchmarks, ...current.benchmarks],
    items: [...seeded.items, ...current.items],
    kpis: [...seeded.kpis, ...current.kpis],
  };
  saveBenchmarkStore(organizationId, next);
  return next;
}

export function addRunToBenchmark(organizationId: string, benchmarkId: string, result: NeuroScoringResult) {
  const current = loadBenchmarkStore(organizationId);
  if (current.items.some((item) => item.scoringResultId === result.id && item.benchmarkId === benchmarkId)) return current;
  const item: BenchmarkItem = {
    id: createId("bench_item"),
    organizationId,
    benchmarkId,
    assetName: result.assetName,
    scoringResultId: result.id,
    sourceLabel: "run",
    scores: Object.fromEntries(result.editorialScores.map((score) => [score.metricKey, score.score])) as Partial<Record<EditorialMetricKey, number>>,
    createdAt: now(),
  };
  const next = { ...current, items: [item, ...current.items] };
  saveBenchmarkStore(organizationId, next);
  return next;
}

export function addManualBenchmarkItem(organizationId: string, benchmarkId: string, assetName: string, scores: BenchmarkItem["scores"]) {
  const current = loadBenchmarkStore(organizationId);
  if (current.items.some((item) => item.assetName === assetName && item.benchmarkId === benchmarkId)) return current;
  const item: BenchmarkItem = {
    id: createId("bench_item"),
    organizationId,
    benchmarkId,
    assetName,
    sourceLabel: "manual",
    scores,
    createdAt: now(),
  };
  const next = { ...current, items: [item, ...current.items] };
  saveBenchmarkStore(organizationId, next);
  return next;
}

export function addExternalKpi(organizationId: string, input: Omit<ExternalKpi, "id" | "organizationId" | "createdAt">) {
  const current = loadBenchmarkStore(organizationId);
  const kpi: ExternalKpi = {
    id: createId("kpi"),
    organizationId,
    createdAt: now(),
    ...input,
  };
  const next = { ...current, kpis: [kpi, ...current.kpis] };
  saveBenchmarkStore(organizationId, next);
  return next;
}

export function percentile(value: number, values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const belowOrEqual = sorted.filter((item) => item <= value).length;
  return Math.round((belowOrEqual / sorted.length) * 100);
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function applyBenchmark(result: NeuroScoringResult, benchmarkId: string, store: BenchmarkStore): AppliedBenchmarkMetric[] {
  const benchmarkItems = store.items.filter((item) => item.benchmarkId === benchmarkId && item.scoringResultId !== result.id);
  return result.editorialScores.map((score) => {
    const values = benchmarkItems
      .map((item) => item.scores[score.metricKey])
      .filter((value): value is number => typeof value === "number");
    const avg = mean(values);
    return {
      metricKey: score.metricKey,
      metricLabel: metricLabels[score.metricKey],
      score: score.score,
      mean: avg,
      percentile: percentile(score.score, values),
      delta: Math.round((score.score - avg) * 10) / 10,
      sampleSize: values.length,
    };
  });
}

function pearson(xs: number[], ys: number[]) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, value, index) => sum + (value - xMean) * (ys[index] - yMean), 0);
  const xDen = Math.sqrt(xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0));
  const yDen = Math.sqrt(ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0));
  if (!xDen || !yDen) return null;
  return Math.round((numerator / (xDen * yDen)) * 100) / 100;
}

export function benchmarkCorrelation(store: BenchmarkStore, benchmarkId: string, kpiType: KpiType): BenchmarkCorrelation {
  const items = store.items.filter((item) => item.benchmarkId === benchmarkId);
  const points = items.flatMap((item) => {
    const kpi = store.kpis.find((entry) => entry.benchmarkItemId === item.id && entry.kpiType === kpiType);
    const score = item.scores.nri;
    if (!kpi || typeof score !== "number") return [];
    return [{ itemId: item.id, assetName: item.assetName, score, kpi: kpi.value }];
  });
  return {
    kpiType,
    label: kpiLabels[kpiType],
    points,
    r: pearson(points.map((point) => point.score), points.map((point) => point.kpi)),
  };
}

export function exportBenchmarkPayload(store: BenchmarkStore, benchmarkId: string, result?: NeuroScoringResult) {
  const benchmark = store.benchmarks.find((item) => item.id === benchmarkId);
  const metrics = result ? applyBenchmark(result, benchmarkId, store) : [];
  return {
    benchmark,
    items: store.items.filter((item) => item.benchmarkId === benchmarkId),
    kpis: store.kpis.filter((item) => item.benchmarkId === benchmarkId),
    appliedResult: result ? { id: result.id, assetName: result.assetName, metrics } : null,
    correlation: benchmarkCorrelation(store, benchmarkId, "vtr"),
  };
}
