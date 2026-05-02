import type { AuthSession } from "../auth/types";
import { loadStoredComparisons } from "../comparison/localComparisonStore";
import { loadStoredAnalysisRuns } from "../inference/localInferenceStore";
import { loadStoredPreprocessingJobs } from "../preprocessing/localPreprocessingStore";
import type { ProjectStoreState } from "../projects/types";
import { loadStoredReports } from "../reporting/localReportStore";
import { loadStoredScoringResults } from "../scoring/localScoringStore";
import { loadStoredAssets } from "../uploads/localAssetStore";
import { loadDeletedAssetRecords, loadStoredAuditEvents } from "./localAdminStore";
import type { AdminAuditEvent, AdminSnapshot, AdminUsageEvent } from "./types";

const GPU_SECOND_EUR = 0.0018;
const LOCAL_TRIBE_FLOOR_EUR = 0.12;
const STORAGE_EUR_GB_MONTH = 0.015;
const PLATFORM_EVENT_EUR = 0.015;
const CREDIT_PER_RUN = 2;
const CREDIT_PER_REPORT = 1;
const CREDIT_PER_COMPARISON = 2;

function createId(prefix: string, seed: string) {
  return `${prefix}_${seed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function estimateDerivativeBytes(count: number, kind: "video" | "audio" | "text") {
  if (kind === "video") return count * 1_200_000;
  if (kind === "audio") return count * 420_000;
  return count * 80_000;
}

function estimateArtifactBytes(count: number) {
  return count * 1_800_000;
}

function estimateReportBytes() {
  return 280_000;
}

function estimateLlmCost(inputTokens: number, outputTokens: number, explicitCost: number) {
  if (explicitCost > 0) return explicitCost;
  if (inputTokens + outputTokens === 0) return 0;
  return inputTokens * 0.000002 + outputTokens * 0.00001;
}

function eventBase(session: AuthSession, type: AdminUsageEvent["eventType"], id: string, label: string): AdminUsageEvent {
  return {
    id: createId(`usage_${type}`, id),
    organizationId: session.organization.id,
    eventType: type,
    label,
    creditsDelta: 0,
    estimatedCostEur: 0,
    gpuSeconds: 0,
    inputTokens: 0,
    outputTokens: 0,
    storageBytesDelta: 0,
    actor: session.user.email,
    createdAt: session.createdAt,
    metadata: {},
  };
}

export function buildAdminSnapshot(session: AuthSession, projectState: ProjectStoreState): AdminSnapshot {
  const organizationId = session.organization.id;
  const assets = loadStoredAssets(organizationId);
  const preprocessingJobs = loadStoredPreprocessingJobs(organizationId);
  const analysisRuns = loadStoredAnalysisRuns(organizationId);
  const scoringResults = loadStoredScoringResults(organizationId);
  const reports = loadStoredReports(organizationId);
  const comparisons = loadStoredComparisons(organizationId);
  const deletions = loadDeletedAssetRecords(organizationId);
  const storedAudit = loadStoredAuditEvents(organizationId);

  const usageEvents: AdminUsageEvent[] = [];

  assets.forEach((asset) => {
    usageEvents.push({
      ...eventBase(session, "asset_upload", asset.id, `Upload ${asset.fileName}`),
      sourceId: asset.id,
      experimentId: asset.experimentId,
      assetId: asset.id,
      creditsDelta: asset.health.credits,
      estimatedCostEur: PLATFORM_EVENT_EUR,
      storageBytesDelta: asset.fileSize,
      createdAt: asset.createdAt,
      metadata: { slot: asset.slot, kind: asset.health.kind, status: asset.status },
    });
  });

  preprocessingJobs.forEach((job) => {
    usageEvents.push({
      ...eventBase(session, "preprocessing", job.id, `Preprocesamiento ${job.assetName}`),
      sourceId: job.id,
      experimentId: job.experimentId,
      assetId: job.assetId,
      creditsDelta: 0.25,
      estimatedCostEur: PLATFORM_EVENT_EUR,
      storageBytesDelta: estimateDerivativeBytes(job.derivatives.length, job.assetKind),
      createdAt: job.completedAt ?? job.createdAt,
      metadata: { derivatives: job.derivatives.length, status: job.status },
    });
  });

  analysisRuns.forEach((run) => {
    const gpuCost = Math.max(run.gpuSeconds ?? 0, run.status === "done" ? 1 : 0) * GPU_SECOND_EUR;
    usageEvents.push({
      ...eventBase(session, "tribe_run", run.id, `TRIBE ${run.assetName}`),
      sourceId: run.id,
      experimentId: run.experimentId,
      assetId: run.assetId,
      analysisRunId: run.id,
      creditsDelta: CREDIT_PER_RUN,
      estimatedCostEur: round(Math.max(gpuCost, run.status === "done" ? LOCAL_TRIBE_FLOOR_EUR : 0), 4),
      gpuSeconds: run.gpuSeconds ?? 0,
      storageBytesDelta: estimateArtifactBytes(run.artifacts.length),
      createdAt: run.completedAt ?? run.createdAt,
      metadata: { model: run.modelId, status: run.status, artifacts: run.artifacts.length },
    });
  });

  scoringResults.forEach((result) => {
    usageEvents.push({
      ...eventBase(session, "scoring", result.id, `Scoring ${result.assetName}`),
      sourceId: result.id,
      experimentId: result.experimentId,
      assetId: result.assetId,
      analysisRunId: result.analysisRunId,
      creditsDelta: 0.5,
      estimatedCostEur: PLATFORM_EVENT_EUR,
      storageBytesDelta: 120_000,
      createdAt: result.createdAt,
      metadata: { nri: result.summary.nri, scoringVersion: result.scoringVersion },
    });
  });

  reports.forEach((report) => {
    const llmCost = estimateLlmCost(report.usage.inputTokens, report.usage.outputTokens, report.usage.estimatedCostEur);
    usageEvents.push({
      ...eventBase(session, "report_generation", report.id, `Informe ${report.assetName}`),
      sourceId: report.id,
      experimentId: report.experimentId,
      assetId: report.assetId,
      analysisRunId: report.analysisRunId,
      reportId: report.id,
      creditsDelta: CREDIT_PER_REPORT,
      estimatedCostEur: round(llmCost + PLATFORM_EVENT_EUR, 4),
      inputTokens: report.usage.inputTokens,
      outputTokens: report.usage.outputTokens,
      storageBytesDelta: estimateReportBytes(),
      createdAt: report.createdAt,
      metadata: { finalModel: report.usage.finalModel, guardrail: report.guardrailStatus },
    });
  });

  comparisons.forEach((comparison) => {
    usageEvents.push({
      ...eventBase(session, "comparison_generation", comparison.id, comparison.title),
      sourceId: comparison.id,
      experimentId: comparison.experimentId,
      comparisonId: comparison.id,
      creditsDelta: CREDIT_PER_COMPARISON,
      estimatedCostEur: 0.05,
      storageBytesDelta: 180_000,
      createdAt: comparison.createdAt,
      metadata: { masterSlot: comparison.masterSlot, versions: comparison.versions.length },
    });
  });

  deletions.forEach((deletion) => {
    usageEvents.push({
      ...eventBase(session, "secure_delete", deletion.id, `Borrado seguro ${deletion.assetName}`),
      sourceId: deletion.id,
      experimentId: deletion.experimentId,
      assetId: deletion.assetId,
      creditsDelta: 0,
      estimatedCostEur: PLATFORM_EVENT_EUR,
      storageBytesDelta: -deletion.storageKeys.length * 350_000,
      createdAt: deletion.createdAt,
      metadata: { status: deletion.status, storageKeys: deletion.storageKeys.length },
    });
  });

  const derivedAudit: AdminAuditEvent[] = [
    {
      id: createId("audit_session", session.createdAt),
      organizationId,
      action: "session.active",
      entityType: "organization",
      entityId: organizationId,
      severity: "info",
      actor: session.user.email,
      message: "Sesion de owner activa con aislamiento por organizacion.",
      createdAt: session.createdAt,
      metadata: { role: session.membership.role, plan: session.organization.plan },
    },
    ...analysisRuns.map((run) => ({
      id: createId("audit_run", run.id),
      organizationId,
      action: run.status === "failed" ? "analysis_run.failed" : "analysis_run.completed",
      entityType: "analysis_run",
      entityId: run.id,
      severity: run.status === "failed" ? "error" as const : "info" as const,
      actor: session.user.email,
      message: `${run.assetName} · ${run.status}`,
      createdAt: run.completedAt ?? run.createdAt,
      metadata: { model: run.modelId, gpuSeconds: run.gpuSeconds ?? 0 },
    })),
    ...reports.map((report) => ({
      id: createId("audit_report", report.id),
      organizationId,
      action: "report.generated",
      entityType: "report",
      entityId: report.id,
      severity: report.guardrailStatus === "blocked" ? "error" as const : report.guardrailStatus === "rewritten" ? "warning" as const : "info" as const,
      actor: session.user.email,
      message: `${report.title} · guardrail ${report.guardrailStatus}`,
      createdAt: report.createdAt,
      metadata: { finalModel: report.usage.finalModel, tokens: report.usage.inputTokens + report.usage.outputTokens },
    })),
  ];

  const auditEvents = [...storedAudit, ...derivedAudit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const errors = auditEvents.filter((event) => event.severity === "error" || event.severity === "critical");
  const creditsConsumed = usageEvents.reduce((sum, event) => sum + event.creditsDelta, 0);
  const storageBytes = usageEvents.reduce((sum, event) => sum + event.storageBytesDelta, 0);
  const totalCost = usageEvents.reduce((sum, event) => sum + event.estimatedCostEur, 0);
  const gpuCost = usageEvents.filter((event) => event.eventType === "tribe_run").reduce((sum, event) => sum + event.estimatedCostEur, 0);
  const llmCost = usageEvents.filter((event) => event.eventType === "report_generation").reduce((sum, event) => sum + event.estimatedCostEur, 0);
  const storageEur = Math.max(0, storageBytes / 1_073_741_824) * STORAGE_EUR_GB_MONTH;
  const hardLimit = Math.max(session.organization.credits, 180);
  const softLimit = Math.round(hardLimit * 0.85);

  return {
    session,
    projectState,
    assets,
    preprocessingJobs,
    analysisRuns,
    scoringResults,
    reports,
    comparisons,
    usageEvents: usageEvents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditEvents,
    errorEvents: [],
    backupSnapshots: [],
    deletions,
    errors,
    summary: {
      organizations: 1,
      users: 1,
      workspaces: projectState.workspaces.length,
      projects: projectState.projects.length,
      experiments: projectState.experiments.length,
      assets: assets.length,
      runs: analysisRuns.length,
      reports: reports.length,
      comparisons: comparisons.length,
    },
    credits: {
      allocated: session.organization.credits,
      consumed: round(creditsConsumed, 1),
      remaining: round(session.organization.credits - creditsConsumed, 1),
      softLimit,
      hardLimit,
      status: creditsConsumed >= hardLimit ? "blocked" : creditsConsumed >= softLimit ? "warning" : "ok",
      canAnalyze: creditsConsumed < hardLimit,
      blockReasons: creditsConsumed >= hardLimit ? ["hard_credit_limit"] : [],
    },
    costs: {
      gpuEur: round(gpuCost, 2),
      llmEur: round(llmCost, 2),
      storageEur: round(storageEur, 4),
      platformEur: round(Math.max(0, totalCost - gpuCost - llmCost), 2),
      totalEur: round(totalCost + storageEur, 2),
      storageCostEur: round(storageEur, 4),
      gpuSeconds: round(usageEvents.reduce((sum, event) => sum + event.gpuSeconds, 0), 2),
      inputTokens: usageEvents.reduce((sum, event) => sum + event.inputTokens, 0),
      outputTokens: usageEvents.reduce((sum, event) => sum + event.outputTokens, 0),
      storageBytes: Math.max(0, storageBytes),
    },
    limits: {
      monthlyCreditLimit: session.organization.credits,
      hardCreditLimit: hardLimit,
      monthlyCostLimitEur: 350,
      monthlyGpuSecondsLimit: 7200,
      storageByteLimit: 107_374_182_400,
      runRateLimitPerHour: 20,
      reportRateLimitPerHour: 30,
      retentionDays: 30,
      signedUrlTtlMinutes: 15,
      backups: "DB diario + manifest storage diario",
    },
    monthlyExports: [],
  };
}
