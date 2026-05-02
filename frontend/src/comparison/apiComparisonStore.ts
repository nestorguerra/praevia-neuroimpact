import { apiFetch } from "../api/client";
import type { NeuroScoringResult } from "../scoring/types";
import type { AssetSlot, UploadAsset } from "../uploads/types";
import type { ComparisonMetricDelta, ComparisonReport, ComparisonTimepoint, ComparisonVersion, MixSegment } from "./types";

type ApiComparison = {
  id: string;
  organization_id: string;
  experiment_id: string;
  status: ComparisonReport["status"] | "failed";
  title: string;
  decision: string;
  master_slot: AssetSlot;
  items: Array<{
    scoring_result_id: string;
    asset_id: string;
    asset_name: string;
    slot: AssetSlot;
    rank: number;
    nri: number;
    global_delta: number;
    pipeline_mode?: string | null;
    run_status?: string | null;
    asset_kind?: string | null;
    duration_seconds?: number | null;
    n_timesteps?: number | null;
    n_vertices?: number | null;
  }>;
  metric_deltas: Array<{
    metric_key: string;
    metric_label: string;
    winner_slot: AssetSlot;
    values: Partial<Record<AssetSlot, number>>;
    deltas: Partial<Record<AssetSlot, number>>;
    category?: string;
  }>;
  timepoints: Array<{
    point_index: number;
    timecode: string;
    winner_slot: AssetSlot;
    values: Partial<Record<AssetSlot, number>>;
    margin?: number;
  }>;
  mix: Array<{
    segment_key: string;
    label: string;
    timecode: string;
    source_slot: AssetSlot;
    reason: string;
    action: string;
    order_index: number;
    impact?: string;
    confidence?: string;
  }>;
  comparability: ComparisonReport["comparability"];
  winner_by_modality?: Partial<Record<string, AssetSlot>>;
  report_payload?: Record<string, unknown>;
  created_at: string;
};

const fallbackSlots: AssetSlot[] = ["A", "B", "C"];

function versionFromApi(item: ApiComparison["items"][number], results: NeuroScoringResult[]): ComparisonVersion | null {
  const result = results.find((entry) => entry.id === item.scoring_result_id);
  if (!result) return null;
  return {
    slot: item.slot,
    label: `Version ${item.slot}`,
    result,
    nri: Number(item.nri),
    rank: item.rank,
    globalDelta: Number(item.global_delta),
    pipelineMode: item.pipeline_mode ?? undefined,
    runStatus: item.run_status ?? undefined,
    assetKind: item.asset_kind ?? undefined,
    durationSeconds: typeof item.duration_seconds === "number" ? item.duration_seconds : undefined,
    nTimesteps: typeof item.n_timesteps === "number" ? item.n_timesteps : undefined,
    nVertices: typeof item.n_vertices === "number" ? item.n_vertices : undefined,
  };
}

function normalizeSlotRecord(values: Partial<Record<AssetSlot, number>>): Record<AssetSlot, number | undefined> {
  return {
    A: typeof values.A === "number" ? values.A : undefined,
    B: typeof values.B === "number" ? values.B : undefined,
    C: typeof values.C === "number" ? values.C : undefined,
  };
}

function comparisonFromApi(row: ApiComparison, results: NeuroScoringResult[]): ComparisonReport | null {
  const versions = row.items
    .map((item) => versionFromApi(item, results))
    .filter((item): item is ComparisonVersion => Boolean(item));
  if (versions.length < 2) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    title: row.title,
    status: row.status === "failed" ? "needs_review" : row.status,
    decision: row.decision,
    masterSlot: row.master_slot,
    versions,
    metricDeltas: row.metric_deltas.map((item): ComparisonMetricDelta => ({
      metricKey: item.metric_key,
      metricLabel: item.metric_label,
      winnerSlot: item.winner_slot,
      values: normalizeSlotRecord(item.values),
      deltas: normalizeSlotRecord(item.deltas),
      category: item.category,
    })),
    timepoints: row.timepoints.map((item): ComparisonTimepoint => ({
      pointIndex: item.point_index,
      timecode: item.timecode,
      winnerSlot: item.winner_slot,
      values: normalizeSlotRecord(item.values),
      margin: item.margin,
    })),
    mix: row.mix.map((item): MixSegment => ({
      id: item.segment_key,
      label: item.label,
      timecode: item.timecode,
      sourceSlot: item.source_slot,
      reason: item.reason,
      action: item.action,
      impact: item.impact,
      confidence: item.confidence,
    })),
    comparability: row.comparability,
    winnerByModality: row.winner_by_modality ?? {},
    reportPayload: row.report_payload ?? {},
    createdAt: row.created_at,
  };
}

export async function loadComparisonsFromApi(
  experimentId: string,
  accessToken: string,
  results: NeuroScoringResult[],
): Promise<ComparisonReport[]> {
  const rows = await apiFetch<ApiComparison[]>(`/v1/experiments/${experimentId}/comparisons`, accessToken);
  return rows
    .map((row) => comparisonFromApi(row, results))
    .filter((item): item is ComparisonReport => Boolean(item));
}

export async function createComparisonInApi(
  organizationId: string,
  experimentId: string,
  results: NeuroScoringResult[],
  assets: UploadAsset[],
  accessToken: string,
): Promise<ComparisonReport | null> {
  const scoringResults = results.slice(0, 3);
  const slots = Object.fromEntries(scoringResults.map((result, index) => [
    result.id,
    assets.find((asset) => asset.id === result.assetId)?.slot ?? fallbackSlots[index] ?? "A",
  ]));
  const row = await apiFetch<ApiComparison>("/v1/comparisons", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      experiment_id: experimentId,
      scoring_result_ids: scoringResults.map((result) => result.id),
      slots,
    }),
  });
  return comparisonFromApi(row, scoringResults);
}
