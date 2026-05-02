import type { AssetKind } from "../uploads/types";

export type AnalysisRunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type PredictionArtifactType = "bold_npz" | "bold_npy" | "segments_parquet" | "metrics_json";

export type PredictionArtifact = {
  id: string;
  runId: string;
  assetId: string;
  type: PredictionArtifactType;
  label: string;
  storageKey: string;
  mimeType: string;
  shape?: string;
  metadata: string[];
};

export type AnalysisRun = {
  id: string;
  organizationId: string;
  experimentId: string;
  assetId: string;
  preprocessingJobId?: string;
  assetName: string;
  assetKind: AssetKind;
  status: AnalysisRunStatus;
  progress: number;
  modelId: string;
  modelRevision: string;
  workerImage: string;
  computeProvider?: string;
  providerJobId?: string;
  nTimesteps?: number;
  nVertices?: number;
  gpuSeconds?: number;
  gpuVramMb?: number;
  durationSeconds?: number;
  logs: string[];
  artifacts: PredictionArtifact[];
  createdAt: string;
  completedAt?: string;
};
