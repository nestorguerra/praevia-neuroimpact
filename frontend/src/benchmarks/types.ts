import type { EditorialMetricKey } from "../scoring/types";

export type KpiType = "vtr" | "ctr" | "retention" | "brand_lift" | "survey" | "event_feedback";

export type BenchmarkRecord = {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  sector: string;
  channel: string;
  durationLabel: string;
  language: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type BenchmarkItem = {
  id: string;
  organizationId: string;
  benchmarkId: string;
  assetName: string;
  scoringResultId?: string;
  sourceLabel: "demo" | "run" | "manual";
  scores: Partial<Record<EditorialMetricKey, number>>;
  createdAt: string;
};

export type ExternalKpi = {
  id: string;
  organizationId: string;
  benchmarkId: string;
  benchmarkItemId: string;
  kpiType: KpiType;
  value: number;
  unit: "%" | "score" | "index";
  source: string;
  period: string;
  notes?: string;
  createdAt: string;
};

export type BenchmarkStore = {
  benchmarks: BenchmarkRecord[];
  items: BenchmarkItem[];
  kpis: ExternalKpi[];
};

export type AppliedBenchmarkMetric = {
  metricKey: EditorialMetricKey;
  metricLabel: string;
  score: number;
  mean: number;
  percentile: number;
  delta: number;
  sampleSize: number;
};

export type BenchmarkCorrelationPoint = {
  itemId: string;
  assetName: string;
  score: number;
  kpi: number;
};

export type BenchmarkCorrelation = {
  kpiType: KpiType;
  label: string;
  points: BenchmarkCorrelationPoint[];
  r: number | null;
};
