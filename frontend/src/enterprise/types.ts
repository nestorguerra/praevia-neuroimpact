import type { AdminSnapshot } from "../admin/types";

export type SaasTier = "starter" | "professional" | "enterprise";

export type SaasPlan = {
  tier: SaasTier;
  name: string;
  priceLabel: string;
  audience: string;
  monthlyAssets: string;
  includedCredits: number;
  users: string;
  support: string;
  renewalMotion: string;
  features: string[];
};

export type ApiScope =
  | "runs:read"
  | "runs:write"
  | "reports:read"
  | "usage:read"
  | "admin:read";

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  name: string;
  prefix: string;
  secretPreview: string;
  scopes: ApiScope[];
  status: "active" | "revoked";
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  rotatedAt?: string;
};

export type RetentionPolicy = {
  organizationId: string;
  region: "EU";
  assetRetentionDays: number;
  reportRetentionDays: number;
  backupRetentionDays: number;
  secureDeleteSlaDays: number;
  dpaStatus: "draft_ready" | "under_review" | "signed";
  incidentResponseHours: number;
  updatedAt: string;
};

export type SsoRoadmap = {
  organizationId: string;
  status: "placeholder" | "requirements_ready" | "implementation_ready";
  protocol: "SAML 2.0 / OIDC";
  targetPlan: "Enterprise";
  providerExamples: string[];
  requirements: string[];
  updatedAt: string;
};

export type MonthlyUsageExport = {
  id: string;
  organizationId: string;
  month: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
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
};

export type ProcurementStatus = "ready" | "contractual" | "planned";

export type ProcurementChecklistItem = {
  id: string;
  label: string;
  status: ProcurementStatus;
  evidence: string;
};

export type SlaPolicy = {
  name: string;
  uptimeTarget: string;
  supportWindow: string;
  firstResponse: string;
  incidentResponse: string;
  onboarding: string;
  offboarding: string;
};

export type EnterpriseStore = {
  organizationId: string;
  organizationName: string;
  plans: SaasPlan[];
  activeTier: SaasTier;
  apiKeys: ApiKeyRecord[];
  retentionPolicy: RetentionPolicy;
  ssoRoadmap: SsoRoadmap;
  procurementChecklist: ProcurementChecklistItem[];
  sla: SlaPolicy;
  exports: MonthlyUsageExport[];
  updatedAt: string;
};

export type EnterpriseSnapshot = {
  store: EnterpriseStore;
  admin: AdminSnapshot;
};
