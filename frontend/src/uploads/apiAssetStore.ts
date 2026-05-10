import type { UploadAsset } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

type ApiAsset = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string;
  experiment_id: string;
  slot: "A" | "B" | "C";
  kind: "video" | "audio" | "text";
  original_filename: string;
  mime_type: string;
  byte_size: number;
  sha256?: string | null;
  status: string;
  storage_bucket?: string | null;
  storage_key?: string | null;
  health?: Record<string, unknown>;
  created_at: string;
};

type UploadContext = {
  workspaceId: string;
  projectId: string;
};

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

function assetFromApi(row: ApiAsset): UploadAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    slot: row.slot,
    fileName: row.original_filename,
    fileSize: row.byte_size,
    mimeType: row.mime_type,
    hash: row.sha256 ?? "",
    storageBucket: row.storage_bucket ?? undefined,
    storageKey: row.storage_key ?? undefined,
    progress: row.status === "validated" ? 100 : 76,
    status: row.status === "error" ? "error" : row.status === "validated" ? "validated" : "uploading",
    createdAt: row.created_at,
    health: {
      kind: row.kind,
      extension: row.original_filename.slice(row.original_filename.lastIndexOf(".")),
      sizeLabel: `${(row.byte_size / (1024 * 1024)).toFixed(1)} MB`,
      durationLabel: "Persistido en Postgres",
      resolutionLabel: "Pendiente worker",
      fpsLabel: "Pendiente worker",
      audioLabel: row.kind === "audio" ? "Audio detectado" : "Pendiente worker",
      textLabel: row.kind === "text" ? "Texto persistido" : "No detectado",
      languageLabel: "Pendiente transcript",
      credits: Math.max(1, Math.ceil(row.byte_size / (25 * 1024 * 1024))),
      issues: [],
    },
  };
}

function isMockSignedUrl(url: string, isMock?: boolean) {
  return isMock || url.includes("storage.local") || url.includes("/mock-upload/");
}

async function putFileToSignedUrl(file: File, intent: { signed_url: string; headers: Record<string, string>; is_mock?: boolean }) {
  if (isMockSignedUrl(intent.signed_url, intent.is_mock)) return;
  const uploadResponse = await fetch(intent.signed_url, {
    method: "PUT",
    headers: intent.headers,
    body: file,
  });
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => "");
    throw new Error(detail || `No se pudo subir el archivo al storage (${uploadResponse.status}).`);
  }
}

export async function loadAssetsFromApi(experimentId: string, accessToken: string): Promise<UploadAsset[]> {
  const rows = await apiFetch<ApiAsset[]>(`/v1/experiments/${experimentId}/assets`, accessToken);
  return rows.filter((row) => row.status !== "deleted").map(assetFromApi);
}

export async function registerAssetInApi(
  asset: UploadAsset,
  file: File,
  context: UploadContext,
  accessToken: string,
): Promise<UploadAsset> {
  if (asset.status === "error") return asset;
  const intent = await apiFetch<{
    upload_session_id: string;
    asset_id: string;
    signed_url: string;
    storage_bucket: string;
    storage_key: string;
    headers: Record<string, string>;
    is_mock?: boolean;
  }>("/v1/upload-intents", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: asset.organizationId,
      workspace_id: context.workspaceId,
      project_id: context.projectId,
      experiment_id: asset.experimentId,
      slot: asset.slot,
      file_name: asset.fileName,
      mime_type: asset.mimeType,
      byte_size: asset.fileSize,
      sha256: asset.hash,
      kind: asset.health.kind,
    }),
  });
  await putFileToSignedUrl(file, intent);
  await apiFetch("/v1/upload-sessions/complete", accessToken, {
    method: "POST",
    body: JSON.stringify({
      upload_session_id: intent.upload_session_id,
      sha256: asset.hash,
      byte_size: asset.fileSize,
    }),
  });
  return {
    ...asset,
    id: intent.asset_id,
    uploadSessionId: intent.upload_session_id,
    storageBucket: intent.storage_bucket,
    storageKey: intent.storage_key,
    status: asset.status === "uploading" ? "validated" : asset.status,
  };
}
