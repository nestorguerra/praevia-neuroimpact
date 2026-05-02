import type { UploadAsset } from "./types";

function storageKey(organizationId: string) {
  return `praevia.assets.${organizationId}.v1`;
}

type StoredAsset = Omit<UploadAsset, "previewUrl">;

export function loadStoredAssets(organizationId: string): StoredAsset[] {
  const raw = localStorage.getItem(storageKey(organizationId));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as StoredAsset[];
  } catch {
    localStorage.removeItem(storageKey(organizationId));
    return [];
  }
}

export function saveStoredAssets(organizationId: string, assets: UploadAsset[]) {
  const serializable = assets.map(({ previewUrl: _previewUrl, ...asset }) => asset);
  localStorage.setItem(storageKey(organizationId), JSON.stringify(serializable));
}

