import type { PreprocessingJob } from "../preprocessing/types";
import type { AnalysisRun } from "./types";

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

function runFromApi(row: any): AnalysisRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    assetId: row.asset_id,
    preprocessingJobId: row.preprocessing_job_id ?? undefined,
    assetName: row.asset_name,
    assetKind: row.asset_kind,
    status: row.status,
    progress: row.progress,
    modelId: row.model_id,
    modelRevision: row.model_revision ?? "main",
    workerImage: row.worker_image,
    computeProvider: row.compute_provider ?? "local_mock",
    providerJobId: row.provider_job_id ?? undefined,
    nTimesteps: row.n_timesteps ?? undefined,
    nVertices: row.n_vertices ?? undefined,
    gpuSeconds: row.gpu_seconds ?? undefined,
    gpuVramMb: row.gpu_vram_mb ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    logs: row.logs ?? [],
    artifacts: (row.artifacts ?? []).map((item: any) => ({
      id: item.id,
      runId: item.analysis_run_id,
      assetId: item.asset_id,
      type: item.artifact_type,
      label: item.storage_key.split("/").pop() ?? item.artifact_type,
      storageKey: item.storage_key,
      mimeType: item.mime_type,
      shape: item.shape ? Object.entries(item.shape).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : undefined,
      metadata: Object.entries(item.metadata ?? {}).map(([key, value]) => `${key}: ${String(value)}`),
    })),
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function loadAnalysisRunsFromApi(experimentId: string, accessToken: string): Promise<AnalysisRun[]> {
  const rows = await apiFetch<any[]>(`/v1/experiments/${experimentId}/analysis-runs`, accessToken);
  return rows.map(runFromApi);
}

async function loadAnalysisRunFromApi(runId: string, accessToken: string): Promise<AnalysisRun> {
  const row = await apiFetch<any>(`/v1/analysis-runs/${runId}`, accessToken);
  return runFromApi(row);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRun(run: AnalysisRun, accessToken: string): Promise<AnalysisRun> {
  if (run.status === "done" || run.status === "failed" || run.status === "cancelled") return run;
  let current = run;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    await delay(4000);
    current = await loadAnalysisRunFromApi(run.id, accessToken);
    if (current.status === "done" || current.status === "failed" || current.status === "cancelled") return current;
  }
  return current;
}

export async function createAnalysisRunsInApi(jobs: PreprocessingJob[], accessToken: string): Promise<AnalysisRun[]> {
  const response = await apiFetch<{ runs: any[] }>("/v1/analysis-runs/batch", accessToken, {
    method: "POST",
    body: JSON.stringify(jobs.map((job) => ({
      organization_id: job.organizationId,
      experiment_id: job.experimentId,
      asset_id: job.assetId,
      preprocessing_job_id: job.id,
      asset_name: job.assetName,
      asset_kind: job.assetKind,
      model_id: "facebook/tribev2",
      derivative_keys: job.derivatives.map((derivative) => derivative.storageKey),
    }))),
  });
  const initialRuns = response.runs.map(runFromApi);
  return Promise.all(initialRuns.map((run) => waitForRun(run, accessToken)));
}
