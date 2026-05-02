import type { AuthSession } from "../auth/types";
import type { ComparisonReport } from "../comparison/types";
import type { AnalysisRun } from "../inference/types";
import type { PreprocessingJob } from "../preprocessing/types";
import type { ProjectStoreState } from "../projects/types";
import type { ReportRecord } from "../reporting/types";
import type { NeuroScoringResult } from "../scoring/types";
import type { UploadAsset } from "../uploads/types";

export type UsageEventType =
  | "asset_upload"
  | "preprocessing"
  | "tribe_run"
  | "scoring"
  | "report_generation"
  | "comparison_generation"
  | "secure_delete"
  | "storage_retention"
  | "manual_adjustment";

export type AdminSeverity = "info" | "warning" | "error" | "critical";

export type AdminUsageEvent = {
  id: string;
  organizationId: string;
  eventType: UsageEventType;
  label: string;
  sourceId?: string;
  experimentId?: string;
  assetId?: string;
  analysisRunId?: string;
  reportId?: string;
  comparisonId?: string;
  creditsDelta: number;
  estimatedCostEur: number;
  gpuSeconds: number;
  inputTokens: number;
  outputTokens: number;
  storageBytesDelta: number;
  actor: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type AdminAuditEvent = {
  id: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId?: string;
  severity: AdminSeverity;
  actor: string;
  message: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type AdminErrorEvent = {
  id: string;
  organizationId?: string;
  source: string;
  severity: AdminSeverity;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata: Record<string, string | number | boolean | null>;
  resolvedAt?: string;
  createdAt: string;
};

export type BackupSnapshot = {
  id: string;
  organizationId: string;
  environment: string;
  snapshotType: "db" | "storage_manifest" | "report_manifest";
  storageBucket?: string;
  storageKey: string;
  byteSize?: number;
  checksum?: string;
  status: string;
  createdAt: string;
};

export type DeletedAssetRecord = {
  id: string;
  organizationId: string;
  assetId: string;
  assetName: string;
  experimentId: string;
  requestedBy: string;
  status: "completed" | "failed";
  storageKeys: string[];
  removedCounts: Record<string, number>;
  createdAt: string;
};

export type MonthlyUsageExport = {
  id: string;
  organizationId: string;
  month: string;
  invoiceMode: "manual_beta";
  creditsUsed: number;
  estimatedCostEur: number;
  gpuSeconds: number;
  inputTokens: number;
  outputTokens: number;
  storageBytes: number;
  runs: number;
  reports: number;
  comparisons: number;
  usageEventCount: number;
  createdAt: string;
};

export type AdminSnapshot = {
  session: AuthSession;
  projectState: ProjectStoreState;
  assets: UploadAsset[];
  preprocessingJobs: PreprocessingJob[];
  analysisRuns: AnalysisRun[];
  scoringResults: NeuroScoringResult[];
  reports: ReportRecord[];
  comparisons: ComparisonReport[];
  usageEvents: AdminUsageEvent[];
  auditEvents: AdminAuditEvent[];
  errorEvents: AdminErrorEvent[];
  backupSnapshots: BackupSnapshot[];
  deletions: DeletedAssetRecord[];
  errors: AdminAuditEvent[];
  summary: {
    organizations: number;
    users: number;
    workspaces: number;
    projects: number;
    experiments: number;
    assets: number;
    runs: number;
    reports: number;
    comparisons: number;
  };
  credits: {
    allocated: number;
    consumed: number;
    remaining: number;
    softLimit: number;
    hardLimit: number;
    status: "ok" | "warning" | "blocked";
    canAnalyze: boolean;
    blockReasons: string[];
  };
  costs: {
    gpuEur: number;
    llmEur: number;
    storageEur: number;
    platformEur: number;
    totalEur: number;
    storageCostEur: number;
    gpuSeconds: number;
    inputTokens: number;
    outputTokens: number;
    storageBytes: number;
  };
  limits: {
    monthlyCreditLimit: number;
    hardCreditLimit: number;
    monthlyCostLimitEur: number;
    monthlyGpuSecondsLimit: number;
    storageByteLimit: number;
    runRateLimitPerHour: number;
    reportRateLimitPerHour: number;
    retentionDays: number;
    signedUrlTtlMinutes: number;
    backups: string;
  };
  monthlyExports: MonthlyUsageExport[];
};
