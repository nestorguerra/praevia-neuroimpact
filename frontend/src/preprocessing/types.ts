import type { AssetKind } from "../uploads/types";

export type PreprocessingStatus = "queued" | "running" | "completed" | "failed";

export type PreprocessingStepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

export type DerivativeType =
  | "normalized_media"
  | "extracted_audio"
  | "transcript"
  | "metadata"
  | "silence_report"
  | "normalized_text";

export type PreprocessingStep = {
  label: string;
  status: PreprocessingStepStatus;
  message: string;
};

export type AssetDerivative = {
  id: string;
  assetId: string;
  type: DerivativeType;
  label: string;
  storageKey: string;
  mimeType: string;
  source: string;
  details: string[];
};

export type PreprocessingJob = {
  id: string;
  organizationId: string;
  experimentId: string;
  assetId: string;
  assetName: string;
  assetKind: AssetKind;
  status: PreprocessingStatus;
  progress: number;
  steps: PreprocessingStep[];
  derivatives: AssetDerivative[];
  logs: string[];
  createdAt: string;
  completedAt?: string;
};

