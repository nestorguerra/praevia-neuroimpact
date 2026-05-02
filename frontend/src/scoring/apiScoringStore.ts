import type { AnalysisRun } from "../inference/types";
import type { NeuroScoringResult } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(accessToken),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

function scoringFromApi(row: any): NeuroScoringResult {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    assetId: row.asset_id,
    analysisRunId: row.analysis_run_id,
    assetName: row.asset_name,
    modelId: row.model_id,
    scoringVersion: row.scoring_version,
    confidenceLabel: row.confidence_label,
    benchmarkLabel: row.benchmark_label,
    boldDelaySeconds: row.bold_delay_seconds,
    summary: row.summary,
    editorialScores: (row.editorial_scores ?? []).map((item: any) => ({
      metricKey: item.metric_key,
      metricLabel: item.metric_label,
      score: item.score,
      confidence: item.confidence,
      benchmarkDelta: item.benchmark_delta ?? 0,
      evidence: item.evidence,
      action: item.action,
    })),
    regionScores: (row.region_scores ?? []).map((item: any) => ({
      regionKey: item.region_key,
      regionLabel: item.region_label,
      networkKey: item.network_key,
      score: item.score,
      meanResponse: item.mean_response,
      peakResponse: item.peak_response,
      evidence: item.evidence,
    })),
    networkScores: (row.network_scores ?? []).map((item: any) => ({
      networkKey: item.network_key,
      networkLabel: item.network_label,
      score: item.score,
      confidence: item.confidence,
      evidence: item.evidence,
    })),
    timecoursePoints: (row.timecourse_points ?? []).map((item: any) => ({
      pointIndex: item.point_index,
      boldTimeSeconds: item.bold_time_seconds,
      stimulusTimeSeconds: item.stimulus_time_seconds,
      globalResponse: item.global_response,
      normalizedResponse: item.normalized_response,
      eventLabel: item.event_label ?? undefined,
    })),
    peakMoments: (row.peak_moments ?? []).map((item: any) => ({
      momentType: item.moment_type,
      startSeconds: item.start_seconds,
      endSeconds: item.end_seconds,
      score: item.score,
      evidence: item.evidence,
      action: item.action,
    })),
    createdAt: row.created_at,
  };
}

export async function loadScoringResultsFromApi(experimentId: string, accessToken: string): Promise<NeuroScoringResult[]> {
  const rows = await apiFetch<any[]>(`/v1/experiments/${experimentId}/scoring-results`, accessToken);
  return rows.map(scoringFromApi);
}

export async function createScoringResultsInApi(runs: AnalysisRun[], accessToken: string): Promise<NeuroScoringResult[]> {
  const created = await Promise.all(runs.map((run) => apiFetch<any>("/v1/scoring/results", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: run.organizationId,
      experiment_id: run.experimentId,
      asset_id: run.assetId,
      analysis_run_id: run.id,
      asset_name: run.assetName,
      model_id: run.modelId,
      n_timesteps: run.nTimesteps ?? 12,
      n_vertices: run.nVertices ?? 20484,
      asset_kind: run.assetKind,
    }),
  })));
  return created.map(scoringFromApi);
}

