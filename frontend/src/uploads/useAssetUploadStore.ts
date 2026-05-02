import { useEffect, useMemo, useState } from "react";
import { inspectFile } from "./inspectFile";
import { loadAssetsFromApi, registerAssetInApi } from "./apiAssetStore";
import { loadStoredAssets, saveStoredAssets } from "./localAssetStore";
import type { AssetSlot, UploadAsset } from "./types";

const slots: AssetSlot[] = ["A", "B", "C"];

export function useAssetUploadStore(
  organizationId: string,
  experimentId: string,
  apiContext?: { workspaceId: string; projectId: string; accessToken?: string },
) {
  const contextKey = `${organizationId}:${experimentId}`;
  const [loadedContextKey, setLoadedContextKey] = useState("");
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [error, setError] = useState("");
  const useApi = Boolean(apiContext?.accessToken && apiContext.workspaceId && apiContext.projectId && experimentId !== "no-experiment");

  useEffect(() => {
    if (useApi && apiContext?.accessToken) {
      let cancelled = false;
      setError("");
      loadAssetsFromApi(experimentId, apiContext.accessToken)
        .then((remoteAssets) => {
          if (!cancelled) {
            setAssets(remoteAssets);
            setLoadedContextKey(contextKey);
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar assets desde API.");
        });
      return () => {
        cancelled = true;
      };
    }
    setAssets(loadStoredAssets(organizationId).filter((asset) => asset.experimentId === experimentId));
    setLoadedContextKey(contextKey);
  }, [apiContext?.accessToken, apiContext?.projectId, apiContext?.workspaceId, contextKey, experimentId, organizationId, useApi]);

  useEffect(() => {
    if (useApi) return;
    if (loadedContextKey !== contextKey) return;
    const allStored = loadStoredAssets(organizationId).filter((asset) => asset.experimentId !== experimentId);
    saveStoredAssets(organizationId, [...allStored, ...assets]);
  }, [assets, contextKey, experimentId, loadedContextKey, organizationId, useApi]);

  const usedSlots = new Set(assets.map((asset) => asset.slot));
  const nextAvailableSlots = slots.filter((slot) => !usedSlots.has(slot));

  const totalCredits = useMemo(() => assets.reduce((sum, asset) => sum + asset.health.credits, 0), [assets]);
  const hasErrors = assets.some((asset) => asset.status === "error");
  const hasWarnings = assets.some((asset) => asset.status === "warning");

  async function addFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).slice(0, nextAvailableSlots.length);
    if (fileArray.length === 0) return;
    setIsInspecting(true);

    const uploading = fileArray.map((file, index): UploadAsset => ({
      id: `uploading_${Date.now()}_${index}`,
      organizationId,
      experimentId,
      slot: nextAvailableSlots[index],
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      hash: "calculando",
      progress: 38 + index * 12,
      status: "uploading",
      createdAt: new Date().toISOString(),
      health: {
        kind: "text",
        extension: "",
        sizeLabel: "Calculando",
        durationLabel: "Calculando",
        resolutionLabel: "Calculando",
        fpsLabel: "Calculando",
        audioLabel: "Calculando",
        textLabel: "Calculando",
        languageLabel: "Calculando",
        credits: 0,
        issues: [],
      },
    }));

    setAssets((current) => [...uploading, ...current]);

    const inspected = await Promise.all(fileArray.map((file, index) => inspectFile(file, nextAvailableSlots[index], organizationId, experimentId)));
    let persisted = inspected;
    if (useApi && apiContext?.accessToken) {
      try {
        persisted = await Promise.all(inspected.map((asset, index) => registerAssetInApi(asset, fileArray[index], apiContext, apiContext.accessToken || "")));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudieron persistir assets en API.";
        setError(message);
        persisted = inspected.map((asset) => ({
          ...asset,
          status: "error",
          health: { ...asset.health, issues: [...asset.health.issues, message] },
        }));
      }
    }
    setAssets((current) => {
      const withoutUploading = current.filter((asset) => !asset.id.startsWith("uploading_"));
      return [...persisted, ...withoutUploading].slice(0, 3);
    });
    setIsInspecting(false);
  }

  function removeAsset(assetId: string) {
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
  }

  return {
    assets,
    addFiles,
    removeAsset,
    totalCredits,
    hasErrors,
    hasWarnings,
    isInspecting,
    error,
    slotsRemaining: nextAvailableSlots.length,
  };
}
