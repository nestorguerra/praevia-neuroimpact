import { apiFetch } from "../api/client";
import type { NeuroScoringResult } from "../scoring/types";
import type { BenchmarkItem, BenchmarkRecord, BenchmarkStore, ExternalKpi, KpiType } from "./types";

type ApiBenchmark = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  sector: string;
  channel: string;
  duration_label: string;
  language: string;
  status: BenchmarkRecord["status"];
  created_at: string;
  updated_at: string;
};

type ApiBenchmarkItem = {
  id: string;
  organization_id: string;
  benchmark_id: string;
  asset_name: string;
  scoring_result_id?: string | null;
  source_label: BenchmarkItem["sourceLabel"];
  scores: BenchmarkItem["scores"];
  created_at: string;
};

type ApiExternalKpi = {
  id: string;
  organization_id: string;
  benchmark_id: string;
  benchmark_item_id: string;
  kpi_type: KpiType;
  value: number;
  unit: ExternalKpi["unit"];
  source: string;
  period: string;
  notes?: string | null;
  created_at: string;
};

type ApiBenchmarkSnapshot = {
  organization_id: string;
  benchmarks: ApiBenchmark[];
  benchmark_items: ApiBenchmarkItem[];
  external_kpis: ApiExternalKpi[];
};

const demoItems = [
  ["Hipotecas Q1 · Master", 72, 78, 70, 74, 61],
  ["Hipotecas Q1 · Cierre humano", 76, 74, 79, 77, 69],
  ["App ahorro · Producto", 63, 68, 62, 64, 58],
  ["Seguro hogar · Manifesto", 69, 73, 67, 70, 65],
  ["Credito verde · Social", 81, 82, 78, 80, 73],
  ["Banca privada · Evento", 58, 61, 65, 59, 54],
  ["Prestamo coche · Retail media", 66, 69, 64, 68, 62],
  ["Cuenta joven · Influencer", 74, 76, 72, 71, 78],
] as const;

function benchmarkFromApi(row: ApiBenchmark): BenchmarkRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category,
    sector: row.sector,
    channel: row.channel,
    durationLabel: row.duration_label,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function itemFromApi(row: ApiBenchmarkItem): BenchmarkItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    benchmarkId: row.benchmark_id,
    assetName: row.asset_name,
    scoringResultId: row.scoring_result_id || undefined,
    sourceLabel: row.source_label,
    scores: row.scores ?? {},
    createdAt: row.created_at,
  };
}

function kpiFromApi(row: ApiExternalKpi): ExternalKpi {
  return {
    id: row.id,
    organizationId: row.organization_id,
    benchmarkId: row.benchmark_id,
    benchmarkItemId: row.benchmark_item_id,
    kpiType: row.kpi_type,
    value: Number(row.value),
    unit: row.unit,
    source: row.source,
    period: row.period,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function storeFromApi(snapshot: ApiBenchmarkSnapshot): BenchmarkStore {
  return {
    benchmarks: snapshot.benchmarks.map(benchmarkFromApi),
    items: snapshot.benchmark_items.map(itemFromApi),
    kpis: snapshot.external_kpis.map(kpiFromApi),
  };
}

export async function loadBenchmarkStoreFromApi(organizationId: string, accessToken: string): Promise<BenchmarkStore> {
  return storeFromApi(await apiFetch<ApiBenchmarkSnapshot>(`/v1/benchmarks/${organizationId}`, accessToken));
}

export async function createDemoBenchmarkInApi(organizationId: string, accessToken: string): Promise<BenchmarkStore> {
  const current = await loadBenchmarkStoreFromApi(organizationId, accessToken);
  const existing = current.benchmarks.find((benchmark) => benchmark.name === "Banca / CTV / 30s");
  if (existing) return current;

  const benchmark = await apiFetch<ApiBenchmark>("/v1/benchmarks", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      name: "Banca / CTV / 30s",
      category: "Spot CTV 30s",
      sector: "Banca",
      channel: "CTV",
      duration_label: "30s",
      language: "es",
      owner_name: "PraevIA demo",
    }),
  });

  const createdItems = await Promise.all(demoItems.map(([assetName, nri, visual, narrative, action, social]) => apiFetch<ApiBenchmarkItem>("/v1/benchmark-items", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      benchmark_id: benchmark.id,
      asset_name: assetName,
      source_label: "demo",
      scores: {
        nri,
        visual_salience: visual,
        narrative_clarity: narrative,
        action_readiness: action,
        social_cueing: social,
      },
    }),
  })));

  const kpiValues = [68, 73, 55, 64, 79, 51, 59, 70];
  await Promise.all(createdItems.map((item, index) => apiFetch<ApiExternalKpi>("/v1/external-kpis", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      benchmark_id: benchmark.id,
      benchmark_item_id: item.id,
      kpi_type: "vtr",
      value: kpiValues[index] ?? 60,
      unit: "%",
      source: "demo post-campaign",
      period: "Q1",
      notes: "Seed demo para calibracion inicial.",
    }),
  })));

  return loadBenchmarkStoreFromApi(organizationId, accessToken);
}

export async function addRunToBenchmarkInApi(
  organizationId: string,
  benchmarkId: string,
  result: NeuroScoringResult,
  accessToken: string,
): Promise<BenchmarkStore> {
  const current = await loadBenchmarkStoreFromApi(organizationId, accessToken);
  if (!current.items.some((item) => item.benchmarkId === benchmarkId && item.scoringResultId === result.id)) {
    await apiFetch<ApiBenchmarkItem>("/v1/benchmark-items", accessToken, {
      method: "POST",
      body: JSON.stringify({
        organization_id: organizationId,
        benchmark_id: benchmarkId,
        asset_name: result.assetName,
        scoring_result_id: result.id,
        source_label: "run",
        scores: Object.fromEntries(result.editorialScores.map((score) => [score.metricKey, score.score])),
      }),
    });
  }
  return loadBenchmarkStoreFromApi(organizationId, accessToken);
}

export async function addManualBenchmarkItemInApi(
  organizationId: string,
  benchmarkId: string,
  assetName: string,
  scores: BenchmarkItem["scores"],
  accessToken: string,
): Promise<BenchmarkStore> {
  await apiFetch<ApiBenchmarkItem>("/v1/benchmark-items", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      benchmark_id: benchmarkId,
      asset_name: assetName,
      source_label: "manual",
      scores,
    }),
  });
  return loadBenchmarkStoreFromApi(organizationId, accessToken);
}

export async function addExternalKpiInApi(
  organizationId: string,
  input: Omit<ExternalKpi, "id" | "organizationId" | "createdAt">,
  accessToken: string,
): Promise<BenchmarkStore> {
  await apiFetch<ApiExternalKpi>("/v1/external-kpis", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      benchmark_id: input.benchmarkId,
      benchmark_item_id: input.benchmarkItemId,
      kpi_type: input.kpiType,
      value: input.value,
      unit: input.unit,
      source: input.source,
      period: input.period,
      notes: input.notes ?? "",
    }),
  });
  return loadBenchmarkStoreFromApi(organizationId, accessToken);
}
