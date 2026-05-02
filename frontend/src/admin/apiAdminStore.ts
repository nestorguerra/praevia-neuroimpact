import { apiFetch, apiBaseUrl } from "../api/client";
import type { AuthSession } from "../auth/types";
import { loadComparisonsFromApi } from "../comparison/apiComparisonStore";
import type { AnalysisRun } from "../inference/types";
import { loadAnalysisRunsFromApi } from "../inference/apiInferenceStore";
import { loadPreprocessingJobsFromApi } from "../preprocessing/apiPreprocessingStore";
import type { PreprocessingJob } from "../preprocessing/types";
import type { ProjectStoreState } from "../projects/types";
import { loadReportsFromApi } from "../reporting/apiReportStore";
import type { ReportRecord } from "../reporting/types";
import { loadScoringResultsFromApi } from "../scoring/apiScoringStore";
import type { NeuroScoringResult } from "../scoring/types";
import { loadAssetsFromApi } from "../uploads/apiAssetStore";
import type { UploadAsset } from "../uploads/types";
import { buildAdminSnapshot } from "./buildAdminSnapshot";
import type { AdminAuditEvent, AdminErrorEvent, AdminSnapshot, AdminUsageEvent, BackupSnapshot, DeletedAssetRecord, MonthlyUsageExport } from "./types";

type ApiUsageEvent = {
  id: string;
  organization_id: string;
  event_type: AdminUsageEvent["eventType"];
  source_id?: string | null;
  experiment_id?: string | null;
  asset_id?: string | null;
  analysis_run_id?: string | null;
  report_id?: string | null;
  comparison_id?: string | null;
  credits_delta: number;
  estimated_cost_eur: number;
  gpu_seconds: number;
  input_tokens: number;
  output_tokens: number;
  storage_bytes_delta: number;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

type ApiAuditLog = {
  id: string;
  organization_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  severity: AdminAuditEvent["severity"];
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

type ApiDeletion = {
  id: string;
  organization_id: string;
  asset_id: string;
  asset_name: string;
  status: DeletedAssetRecord["status"];
  storage_keys: string[];
  removed_counts: Record<string, number>;
  created_at: string;
};

type ApiErrorEvent = {
  id: string;
  organization_id?: string | null;
  source: string;
  severity: AdminAuditEvent["severity"];
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata: Record<string, string | number | boolean | null>;
  resolved_at?: string | null;
  created_at: string;
};

type ApiBackupSnapshot = {
  id: string;
  organization_id: string;
  environment: string;
  snapshot_type: BackupSnapshot["snapshotType"];
  storage_bucket?: string | null;
  storage_key: string;
  byte_size?: number | null;
  checksum?: string | null;
  status: string;
  created_at: string;
};

type ApiAdminLimits = {
  monthly_credit_limit: number;
  hard_credit_limit: number;
  monthly_cost_limit_eur: number;
  monthly_gpu_seconds_limit: number;
  storage_byte_limit: number;
  run_rate_limit_per_hour: number;
  report_rate_limit_per_hour: number;
  retention_days: number;
  can_analyze: boolean;
  block_reasons: string[];
};

type ApiMonthlyUsageExport = {
  id: string;
  organization_id: string;
  month: string;
  invoice_mode: "manual_beta";
  credits_used: number;
  estimated_cost_eur: number;
  gpu_seconds: number;
  input_tokens: number;
  output_tokens: number;
  storage_bytes: number;
  runs: number;
  reports: number;
  comparisons: number;
  usage_event_count: number;
  created_at: string;
};

type ApiAdminSnapshot = {
  organization_id: string;
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  estimated_cost_eur: number;
  gpu_seconds: number;
  input_tokens: number;
  output_tokens: number;
  storage_bytes: number;
  storage_cost_eur: number;
  total_cost_eur: number;
  limits: ApiAdminLimits;
  monthly_exports: ApiMonthlyUsageExport[];
  usage_events: ApiUsageEvent[];
  audit_logs: ApiAuditLog[];
  error_events: ApiErrorEvent[];
  backup_snapshots: ApiBackupSnapshot[];
  deletions: ApiDeletion[];
};

export type SecureDeleteApiPayload = {
  organization_id: string;
  asset_id: string;
  asset_name: string;
  storage_keys: string[];
  scope: Record<string, string | number | boolean | null>;
};

export async function secureDeleteAssetInApi(payload: SecureDeleteApiPayload, accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/admin/secure-delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{
    id: string;
    status: "completed" | "failed";
    storage_keys: string[];
    removed_counts: Record<string, number>;
  }>;
}

function usageFromApi(row: ApiUsageEvent): AdminUsageEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    label: String(row.metadata?.label ?? row.event_type),
    sourceId: row.source_id ?? undefined,
    experimentId: row.experiment_id ?? undefined,
    assetId: row.asset_id ?? undefined,
    analysisRunId: row.analysis_run_id ?? undefined,
    reportId: row.report_id ?? undefined,
    comparisonId: row.comparison_id ?? undefined,
    creditsDelta: Number(row.credits_delta),
    estimatedCostEur: Number(row.estimated_cost_eur),
    gpuSeconds: Number(row.gpu_seconds),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    storageBytesDelta: row.storage_bytes_delta,
    actor: String(row.metadata?.actor ?? "backend"),
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

function auditFromApi(row: ApiAuditLog): AdminAuditEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    severity: row.severity,
    actor: String(row.metadata?.actor ?? "backend"),
    message: String(row.metadata?.message ?? row.action),
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

function deletionFromApi(row: ApiDeletion): DeletedAssetRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    experimentId: "",
    requestedBy: "backend",
    status: row.status,
    storageKeys: row.storage_keys,
    removedCounts: row.removed_counts,
    createdAt: row.created_at,
  };
}

function errorFromApi(row: ApiErrorEvent): AdminErrorEvent {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    source: row.source,
    severity: row.severity,
    message: row.message,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    metadata: row.metadata ?? {},
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at,
  };
}

function backupFromApi(row: ApiBackupSnapshot): BackupSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    environment: row.environment,
    snapshotType: row.snapshot_type,
    storageBucket: row.storage_bucket ?? undefined,
    storageKey: row.storage_key,
    byteSize: row.byte_size ?? undefined,
    checksum: row.checksum ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function monthlyExportFromApi(row: ApiMonthlyUsageExport): MonthlyUsageExport {
  return {
    id: row.id,
    organizationId: row.organization_id,
    month: row.month,
    invoiceMode: row.invoice_mode,
    creditsUsed: Number(row.credits_used),
    estimatedCostEur: Number(row.estimated_cost_eur),
    gpuSeconds: Number(row.gpu_seconds),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    storageBytes: row.storage_bytes,
    runs: row.runs,
    reports: row.reports,
    comparisons: row.comparisons,
    usageEventCount: row.usage_event_count,
    createdAt: row.created_at,
  };
}

export async function loadAdminSnapshotFromApi(
  session: AuthSession,
  projectState: ProjectStoreState,
  accessToken: string,
): Promise<AdminSnapshot> {
  const base = buildAdminSnapshot(session, projectState);
  const [row, operational] = await Promise.all([
    apiFetch<ApiAdminSnapshot>(`/v1/admin/organizations/${session.organization.id}/snapshot`, accessToken),
    loadOperationalData(projectState.experiments.map((experiment) => experiment.id), accessToken),
  ]);
  const usageEvents = row.usage_events.map(usageFromApi);
  const auditEvents = row.audit_logs.map(auditFromApi);
  const errorEvents = row.error_events.map(errorFromApi);
  const backupSnapshots = row.backup_snapshots.map(backupFromApi);
  const deletions = row.deletions.map(deletionFromApi);
  return {
    ...base,
    assets: operational.assets,
    preprocessingJobs: operational.preprocessingJobs,
    analysisRuns: operational.analysisRuns,
    scoringResults: operational.scoringResults,
    reports: operational.reports,
    comparisons: operational.comparisons,
    usageEvents,
    auditEvents: [...auditEvents, ...base.auditEvents],
    errorEvents,
    backupSnapshots,
    deletions,
    errors: [
      ...errorEvents.map((event): AdminAuditEvent => ({
        id: event.id,
        organizationId: event.organizationId ?? session.organization.id,
        action: `${event.source}.error`,
        entityType: event.entityType ?? "error_event",
        entityId: event.entityId,
        severity: event.severity,
        actor: "backend",
        message: event.message,
        createdAt: event.createdAt,
        metadata: event.metadata,
      })),
      ...auditEvents,
      ...base.auditEvents,
    ].filter((event) => event.severity === "error" || event.severity === "critical"),
    costs: {
      ...base.costs,
      totalEur: Number(row.total_cost_eur),
      gpuEur: Math.max(base.costs.gpuEur, Number(row.gpu_seconds) * 0.0009),
      llmEur: Math.max(base.costs.llmEur, (row.input_tokens + row.output_tokens) * 0.000004),
      storageEur: Number(row.storage_cost_eur),
      gpuSeconds: Number(row.gpu_seconds),
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      storageBytes: Math.max(0, row.storage_bytes),
      storageCostEur: Number(row.storage_cost_eur),
    },
    credits: {
      ...base.credits,
      allocated: Number(row.credits_allocated),
      consumed: Number(row.credits_used),
      remaining: Number(row.credits_remaining),
      softLimit: Number(row.limits.monthly_credit_limit),
      hardLimit: Number(row.limits.hard_credit_limit),
      status: row.limits.can_analyze ? (Number(row.credits_used) >= Number(row.limits.monthly_credit_limit) ? "warning" : "ok") : "blocked",
      canAnalyze: row.limits.can_analyze,
      blockReasons: row.limits.block_reasons ?? [],
    },
    limits: {
      ...base.limits,
      monthlyCreditLimit: Number(row.limits.monthly_credit_limit),
      hardCreditLimit: Number(row.limits.hard_credit_limit),
      monthlyCostLimitEur: Number(row.limits.monthly_cost_limit_eur),
      monthlyGpuSecondsLimit: Number(row.limits.monthly_gpu_seconds_limit),
      storageByteLimit: Number(row.limits.storage_byte_limit),
      runRateLimitPerHour: row.limits.run_rate_limit_per_hour,
      reportRateLimitPerHour: row.limits.report_rate_limit_per_hour,
      retentionDays: row.limits.retention_days,
    },
    monthlyExports: row.monthly_exports.map(monthlyExportFromApi),
    summary: {
      ...base.summary,
      assets: operational.assets.length,
      runs: operational.analysisRuns.length,
      reports: operational.reports.length,
      comparisons: operational.comparisons.length,
    },
  };
}

export async function createMonthlyUsageExportInApi(
  organizationId: string,
  month: string,
  accessToken: string,
): Promise<MonthlyUsageExport> {
  const row = await apiFetch<ApiMonthlyUsageExport>(`/v1/admin/organizations/${organizationId}/monthly-usage-exports/${month}`, accessToken, {
    method: "POST",
  });
  return monthlyExportFromApi(row);
}

async function loadOperationalData(experimentIds: string[], accessToken: string) {
  const bundles = await Promise.all(experimentIds.map(async (experimentId) => {
    const [assets, preprocessingJobs, analysisRuns, scoringResults] = await Promise.all([
      loadAssetsFromApi(experimentId, accessToken),
      loadPreprocessingJobsFromApi(experimentId, accessToken),
      loadAnalysisRunsFromApi(experimentId, accessToken),
      loadScoringResultsFromApi(experimentId, accessToken),
    ]);
    const [reports, comparisons] = await Promise.all([
      loadReportsFromApi(experimentId, accessToken, scoringResults),
      loadComparisonsFromApi(experimentId, accessToken, scoringResults),
    ]);
    return { assets, preprocessingJobs, analysisRuns, scoringResults, reports, comparisons };
  }));

  return bundles.reduce((merged, bundle) => ({
    assets: [...merged.assets, ...bundle.assets],
    preprocessingJobs: [...merged.preprocessingJobs, ...bundle.preprocessingJobs],
    analysisRuns: [...merged.analysisRuns, ...bundle.analysisRuns],
    scoringResults: [...merged.scoringResults, ...bundle.scoringResults],
    reports: [...merged.reports, ...bundle.reports],
    comparisons: [...merged.comparisons, ...bundle.comparisons],
  }), {
    assets: [] as UploadAsset[],
    preprocessingJobs: [] as PreprocessingJob[],
    analysisRuns: [] as AnalysisRun[],
    scoringResults: [] as NeuroScoringResult[],
    reports: [] as ReportRecord[],
    comparisons: [] as AdminSnapshot["comparisons"],
  });
}
