import { apiFetch } from "../api/client";
import type { AdminSnapshot } from "../admin/types";
import type {
  ApiKeyRecord,
  ApiScope,
  EnterpriseStore,
  MonthlyUsageExport,
  ProcurementChecklistItem,
  RetentionPolicy,
  SaasPlan,
  SlaPolicy,
  SsoRoadmap,
} from "./types";

type ApiKeyRow = {
  id: string;
  organization_id: string;
  name: string;
  prefix: string;
  secret_preview: string;
  scopes: ApiScope[];
  status: ApiKeyRecord["status"];
  created_at: string;
  expires_at?: string | null;
  rotated_at?: string | null;
};

type ApiRetention = {
  organization_id: string;
  region: "EU";
  asset_retention_days: number;
  report_retention_days: number;
  backup_retention_days: number;
  secure_delete_sla_days: number;
  incident_response_hours: number;
  dpa_status: RetentionPolicy["dpaStatus"];
  updated_at: string;
};

type ApiSso = {
  organization_id: string;
  status: SsoRoadmap["status"];
  protocol: SsoRoadmap["protocol"];
  target_plan: SsoRoadmap["targetPlan"];
  provider_examples: string[];
  requirements: string[];
  updated_at: string;
};

type ApiBillingExport = {
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

type ApiPlan = {
  tier: SaasPlan["tier"];
  name: string;
  price_label: string;
  audience?: string;
  monthly_assets: string;
  included_credits: number;
  users?: string;
  support?: string;
  renewal_motion?: string;
  features: string[];
};

type ApiProcurement = {
  id?: string;
  label: string;
  status: ProcurementChecklistItem["status"];
  evidence: string;
};

type ApiSla = {
  name: string;
  uptime_target?: string;
  support_window?: string;
  first_response?: string;
  incident_response?: string;
  onboarding?: string;
  offboarding?: string;
};

type ApiEnterpriseSnapshot = {
  organization_id: string;
  plans: ApiPlan[];
  api_keys: ApiKeyRow[];
  retention_policy: ApiRetention;
  sso_roadmap: ApiSso;
  billing_exports: ApiBillingExport[];
  procurement_checklist: ApiProcurement[];
  sla: ApiSla;
};

function periodForMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

function apiKeyFromApi(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    prefix: row.prefix,
    secretPreview: row.secret_preview,
    scopes: row.scopes,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    rotatedAt: row.rotated_at ?? undefined,
  };
}

function retentionFromApi(row: ApiRetention): RetentionPolicy {
  return {
    organizationId: row.organization_id,
    region: row.region,
    assetRetentionDays: row.asset_retention_days,
    reportRetentionDays: row.report_retention_days,
    backupRetentionDays: row.backup_retention_days,
    secureDeleteSlaDays: row.secure_delete_sla_days,
    incidentResponseHours: row.incident_response_hours,
    dpaStatus: row.dpa_status,
    updatedAt: row.updated_at,
  };
}

function ssoFromApi(row: ApiSso): SsoRoadmap {
  return {
    organizationId: row.organization_id,
    status: row.status,
    protocol: row.protocol,
    targetPlan: row.target_plan,
    providerExamples: row.provider_examples,
    requirements: row.requirements,
    updatedAt: row.updated_at,
  };
}

function exportFromApi(row: ApiBillingExport): MonthlyUsageExport {
  const period = periodForMonth(row.month);
  return {
    id: row.id,
    organizationId: row.organization_id,
    month: row.month,
    periodStart: period.start,
    periodEnd: period.end,
    createdAt: row.created_at,
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
  };
}

function planFromApi(row: ApiPlan): SaasPlan {
  return {
    tier: row.tier,
    name: row.name,
    priceLabel: row.price_label,
    audience: row.audience ?? (row.tier === "enterprise" ? "Corporates y agencias multi-cliente." : "Equipo beta."),
    monthlyAssets: row.monthly_assets,
    includedCredits: Number(row.included_credits),
    users: row.users ?? (row.tier === "starter" ? "3 usuarios" : row.tier === "professional" ? "10 usuarios" : "Usuarios pactados"),
    support: row.support ?? "Soporte beta",
    renewalMotion: row.renewal_motion ?? "Facturacion manual durante beta.",
    features: row.features,
  };
}

function procurementFromApi(row: ApiProcurement, index: number): ProcurementChecklistItem {
  const fallbackId = row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    id: row.id ?? (fallbackId || `item-${index}`),
    label: row.label,
    status: row.status,
    evidence: row.evidence,
  };
}

function slaFromApi(row: ApiSla): SlaPolicy {
  return {
    name: row.name,
    uptimeTarget: row.uptime_target ?? "Best effort beta",
    supportWindow: row.support_window ?? "L-V 09:00-18:00 Europe/Madrid",
    firstResponse: row.first_response ?? "24h laborables",
    incidentResponse: row.incident_response ?? "Registro, contencion y RCA breve",
    onboarding: row.onboarding ?? "Kickoff y configuracion inicial",
    offboarding: row.offboarding ?? "Export, revocacion y borrado seguro",
  };
}

function storeFromApi(row: ApiEnterpriseSnapshot, organizationName: string): EnterpriseStore {
  return {
    organizationId: row.organization_id,
    organizationName,
    plans: row.plans.map(planFromApi),
    activeTier: "professional",
    apiKeys: row.api_keys.map(apiKeyFromApi),
    retentionPolicy: retentionFromApi(row.retention_policy),
    ssoRoadmap: ssoFromApi(row.sso_roadmap),
    procurementChecklist: row.procurement_checklist.map(procurementFromApi),
    sla: slaFromApi(row.sla),
    exports: row.billing_exports.map(exportFromApi),
    updatedAt: new Date().toISOString(),
  };
}

export async function loadEnterpriseStoreFromApi(
  organizationId: string,
  organizationName: string,
  accessToken: string,
): Promise<EnterpriseStore> {
  const row = await apiFetch<ApiEnterpriseSnapshot>(`/v1/enterprise/${organizationId}/snapshot`, accessToken);
  return storeFromApi(row, organizationName);
}

export async function createApiKeyInApi(
  organizationId: string,
  organizationName: string,
  name: string,
  scopes: ApiScope[],
  accessToken: string,
): Promise<EnterpriseStore> {
  await apiFetch<ApiKeyRow>("/v1/enterprise/api-keys", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      name: name.trim() || "API key piloto",
      scopes,
    }),
  });
  return loadEnterpriseStoreFromApi(organizationId, organizationName, accessToken);
}

export async function rotateApiKeyInApi(
  organizationId: string,
  organizationName: string,
  keyId: string,
  accessToken: string,
): Promise<EnterpriseStore> {
  await apiFetch<ApiKeyRow>(`/v1/enterprise/api-keys/${keyId}/rotate`, accessToken, { method: "POST" });
  return loadEnterpriseStoreFromApi(organizationId, organizationName, accessToken);
}

export async function revokeApiKeyInApi(
  organizationId: string,
  organizationName: string,
  keyId: string,
  accessToken: string,
): Promise<EnterpriseStore> {
  await apiFetch<ApiKeyRow>(`/v1/enterprise/api-keys/${keyId}/revoke`, accessToken, { method: "POST" });
  return loadEnterpriseStoreFromApi(organizationId, organizationName, accessToken);
}

export async function updateRetentionPolicyInApi(
  store: EnterpriseStore,
  patch: Partial<RetentionPolicy>,
  accessToken: string,
): Promise<EnterpriseStore> {
  const next = { ...store.retentionPolicy, ...patch };
  await apiFetch<ApiRetention>("/v1/enterprise/retention-policy", accessToken, {
    method: "PUT",
    body: JSON.stringify({
      organization_id: store.organizationId,
      asset_retention_days: next.assetRetentionDays,
      report_retention_days: next.reportRetentionDays,
      backup_retention_days: next.backupRetentionDays,
      secure_delete_sla_days: next.secureDeleteSlaDays,
      incident_response_hours: next.incidentResponseHours,
      dpa_status: next.dpaStatus,
    }),
  });
  return loadEnterpriseStoreFromApi(store.organizationId, store.organizationName, accessToken);
}

export async function createMonthlyUsageExportInApi(
  store: EnterpriseStore,
  snapshot: AdminSnapshot,
  month: string,
  accessToken: string,
): Promise<EnterpriseStore> {
  const events = snapshot.usageEvents.filter((event) => event.createdAt.startsWith(month));
  const scoped = events.length ? events : snapshot.usageEvents;
  await apiFetch<ApiBillingExport>("/v1/enterprise/billing-exports", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: store.organizationId,
      month,
      credits_used: scoped.reduce((sum, event) => sum + event.creditsDelta, 0),
      estimated_cost_eur: scoped.reduce((sum, event) => sum + event.estimatedCostEur, 0),
      gpu_seconds: scoped.reduce((sum, event) => sum + event.gpuSeconds, 0),
      input_tokens: scoped.reduce((sum, event) => sum + event.inputTokens, 0),
      output_tokens: scoped.reduce((sum, event) => sum + event.outputTokens, 0),
      storage_bytes: Math.max(0, scoped.reduce((sum, event) => sum + event.storageBytesDelta, 0)),
      runs: scoped.filter((event) => event.eventType === "tribe_run").length,
      reports: scoped.filter((event) => event.eventType === "report_generation").length,
      comparisons: scoped.filter((event) => event.eventType === "comparison_generation").length,
      usage_event_count: scoped.length,
    }),
  });
  return loadEnterpriseStoreFromApi(store.organizationId, store.organizationName, accessToken);
}
