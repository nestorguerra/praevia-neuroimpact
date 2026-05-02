import { saveStoredComparisons, loadStoredComparisons } from "../comparison/localComparisonStore";
import { loadStoredAnalysisRuns, saveStoredAnalysisRuns } from "../inference/localInferenceStore";
import { loadStoredPreprocessingJobs, saveStoredPreprocessingJobs } from "../preprocessing/localPreprocessingStore";
import { loadStoredReports, saveStoredReports } from "../reporting/localReportStore";
import { loadStoredScoringResults, saveStoredScoringResults } from "../scoring/localScoringStore";
import { loadStoredAssets, saveStoredAssets } from "../uploads/localAssetStore";
import { appendDeletedAssetRecord, appendStoredAuditEvent } from "./localAdminStore";
import type { AdminAuditEvent, DeletedAssetRecord } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function originalStorageKey(organizationId: string, experimentId: string, assetId: string, fileName: string) {
  return `originals/org/${organizationId}/experiment/${experimentId}/asset/${assetId}/${fileName}`;
}

export function secureDeleteAssetTree(organizationId: string, assetId: string, actor: string): DeletedAssetRecord | null {
  const assets = loadStoredAssets(organizationId);
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) return null;

  const preprocessingJobs = loadStoredPreprocessingJobs(organizationId);
  const analysisRuns = loadStoredAnalysisRuns(organizationId);
  const scoringResults = loadStoredScoringResults(organizationId);
  const reports = loadStoredReports(organizationId);
  const comparisons = loadStoredComparisons(organizationId);

  const removedJobs = preprocessingJobs.filter((job) => job.assetId === assetId);
  const removedRuns = analysisRuns.filter((run) => run.assetId === assetId);
  const removedScoring = scoringResults.filter((result) => result.assetId === assetId);
  const removedReports = reports.filter((report) => report.assetId === assetId);
  const removedComparisons = comparisons.filter((comparison) => (
    comparison.experimentId === asset.experimentId
    && comparison.versions.some((version) => version.result.assetId === assetId)
  ));
  const removedResultIds = new Set(removedScoring.map((result) => result.id));
  const storageKeys = [
    originalStorageKey(organizationId, asset.experimentId, asset.id, asset.fileName),
    ...removedJobs.flatMap((job) => job.derivatives.map((derivative) => derivative.storageKey)),
    ...removedRuns.flatMap((run) => run.artifacts.map((artifact) => artifact.storageKey)),
    ...removedReports.flatMap((report) => [report.htmlStorageKey, report.pdfStorageKey]),
  ];

  saveStoredAssets(organizationId, assets.filter((item) => item.id !== assetId));
  saveStoredPreprocessingJobs(organizationId, preprocessingJobs.filter((job) => job.assetId !== assetId));
  saveStoredAnalysisRuns(organizationId, analysisRuns.filter((run) => run.assetId !== assetId));
  saveStoredScoringResults(organizationId, scoringResults.filter((result) => result.assetId !== assetId));
  saveStoredReports(organizationId, reports.filter((report) => report.assetId !== assetId));
  saveStoredComparisons(
    organizationId,
    comparisons.filter((comparison) => (
      !removedComparisons.some((removed) => removed.id === comparison.id)
      && !comparison.versions.some((version) => removedResultIds.has(version.result.id))
    )),
  );

  const record: DeletedAssetRecord = {
    id: createId("del"),
    organizationId,
    assetId,
    assetName: asset.fileName,
    experimentId: asset.experimentId,
    requestedBy: actor,
    status: "completed",
    storageKeys,
    removedCounts: {
      assets: 1,
      preprocessingJobs: removedJobs.length,
      analysisRuns: removedRuns.length,
      scoringResults: removedScoring.length,
      reports: removedReports.length,
      comparisons: removedComparisons.length,
      storageKeys: storageKeys.length,
    },
    createdAt: new Date().toISOString(),
  };

  const auditEvent: AdminAuditEvent = {
    id: createId("audit"),
    organizationId,
    action: "secure_delete.completed",
    entityType: "asset",
    entityId: assetId,
    severity: "warning",
    actor,
    message: `${asset.fileName} borrado con derivados, runs, scoring, informes y comparativas asociadas.`,
    createdAt: record.createdAt,
    metadata: {
      storageKeys: storageKeys.length,
      reports: removedReports.length,
      comparisons: removedComparisons.length,
    },
  };

  appendDeletedAssetRecord(record);
  appendStoredAuditEvent(auditEvent);

  return record;
}
