import type { PreprocessingJob } from "../preprocessing/types";
import type { AnalysisRun, PredictionArtifact, PredictionArtifactType } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function outputBase(run: AnalysisRun | Pick<AnalysisRun, "organizationId" | "experimentId" | "assetId" | "id">) {
  return `predictions/org/${run.organizationId}/experiment/${run.experimentId}/asset/${run.assetId}/run/${run.id}`;
}

function artifact(run: AnalysisRun, type: PredictionArtifactType, label: string, mimeType: string, shape: string | undefined, metadata: string[]): PredictionArtifact {
  return {
    id: createId("artifact"),
    runId: run.id,
    assetId: run.assetId,
    type,
    label,
    storageKey: `${outputBase(run)}/${label}`,
    mimeType,
    shape,
    metadata,
  };
}

export function buildRunningRun(job: PreprocessingJob): AnalysisRun {
  return {
    id: createId("run"),
    organizationId: job.organizationId,
    experimentId: job.experimentId,
    assetId: job.assetId,
    preprocessingJobId: job.id,
    assetName: job.assetName,
    assetKind: job.assetKind,
    status: "running",
    progress: 42,
    modelId: "facebook/tribev2",
    modelRevision: "main",
    workerImage: "praevia/tribe-worker:local",
    computeProvider: "local_mock",
    logs: [
      "analysis run accepted",
      "model cache requested: facebook/tribev2",
      "events dataframe generation queued",
    ],
    artifacts: [],
    createdAt: new Date().toISOString(),
  };
}

export function completeRun(run: AnalysisRun): AnalysisRun {
  const completed: AnalysisRun = {
    ...run,
    status: "done",
    progress: 100,
    nTimesteps: 12,
    nVertices: 20484,
    gpuSeconds: 0,
    gpuVramMb: 0,
    durationSeconds: 0.8,
    logs: [
      ...run.logs,
      "worker mode=mock_contract",
      "TRIBE output shape=(12, 20484)",
      "bold_predictions.npz registered",
      "segments.parquet registered",
      "run status=done",
    ],
    completedAt: new Date().toISOString(),
  };
  return {
    ...completed,
    artifacts: [
      artifact(completed, "bold_npz", "bold_predictions.npz", "application/octet-stream", "12 x 20484 · fsaverage5", ["dtype float32", "mesh fsaverage5", "subject average"]),
      artifact(completed, "segments_parquet", "segments.parquet", "application/vnd.apache.parquet", "12 rows", ["stimulus time", "segment index"]),
      artifact(completed, "metrics_json", "run_metrics.json", "application/json", undefined, ["gpu_seconds 0.0 local", "vram 0 MB local"]),
    ],
  };
}
