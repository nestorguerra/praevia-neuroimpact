import type { UploadAsset } from "../uploads/types";
import type { PreprocessingJob } from "./types";

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

function jobFromApi(row: any): PreprocessingJob {
  const derivatives = row.derivatives ?? [];
  const hasTextDerivative = derivatives.some((item: any) => item.derivative_type === "normalized_text");
  const hasOnlyAudio = derivatives.some((item: any) => item.label === "audio_16k_mono.wav") && !derivatives.some((item: any) => item.label === "normalized_video.mp4");
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    assetId: row.asset_id,
    assetName: row.file_name,
    assetKind: hasTextDerivative ? "text" : hasOnlyAudio ? "audio" : "video",
    status: row.status,
    progress: row.progress,
    steps: (row.steps ?? []).map((step: any) => ({
      label: step.label,
      status: step.status,
      message: step.message,
    })),
    derivatives: derivatives.map((item: any) => ({
      id: item.id,
      assetId: item.asset_id,
      type: item.derivative_type,
      label: item.label,
      storageKey: item.storage_key,
      mimeType: item.mime_type,
      source: item.metadata?.source ?? "worker",
      details: Object.entries(item.metadata ?? {}).map(([key, value]) => `${key}: ${String(value)}`),
    })),
    logs: row.logs ?? [],
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function loadPreprocessingJobsFromApi(experimentId: string, accessToken: string): Promise<PreprocessingJob[]> {
  const rows = await apiFetch<any[]>(`/v1/experiments/${experimentId}/preprocessing-jobs`, accessToken);
  return rows.map(jobFromApi);
}

export async function createPreprocessingJobsInApi(assets: UploadAsset[], accessToken: string): Promise<PreprocessingJob[]> {
  const response = await apiFetch<{ jobs: any[] }>("/v1/preprocessing/jobs", accessToken, {
    method: "POST",
    body: JSON.stringify({
      assets: assets.map((asset) => ({
        asset_id: asset.id,
        organization_id: asset.organizationId,
        experiment_id: asset.experimentId,
        file_name: asset.fileName,
        kind: asset.health.kind,
        mime_type: asset.mimeType,
        byte_size: asset.fileSize,
        storage_bucket: asset.storageBucket ?? "neuroimpact-assets",
        storage_key: asset.storageKey,
        extension: asset.health.extension,
        duration_label: asset.health.durationLabel,
        text_label: asset.health.textLabel,
        language_label: asset.health.languageLabel,
        has_srt_timecodes: Boolean(asset.hasSrtTimecodes),
      })),
    }),
  });
  return response.jobs.map(jobFromApi);
}

