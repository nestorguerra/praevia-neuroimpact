import type { AdminSnapshot, AdminUsageEvent } from "../admin/types";
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

const storageKey = (organizationId: string) => `praevia:enterprise:${organizationId}:v1`;

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function createSecret() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2).padEnd(24, "0");
  return `nia_beta_${random.slice(0, 28)}`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function saasPlans(): SaasPlan[] {
  return [
    {
      tier: "starter",
      name: "Starter",
      priceLabel: "Beta manual · desde 1.500 €/mes",
      audience: "Primer equipo de marca o agencia pequena.",
      monthlyAssets: "Hasta 20 piezas/mes",
      includedCredits: 120,
      users: "3 usuarios",
      support: "Soporte por email",
      renewalMotion: "Renovacion mensual manual tras piloto.",
      features: ["Analisis individual", "PDF ejecutivo", "Export de uso", "Retencion 30 dias"],
    },
    {
      tier: "professional",
      name: "Professional",
      priceLabel: "Beta manual · 5.000-10.000 €/mes",
      audience: "Equipos de marketing/contenidos con comparativas recurrentes.",
      monthlyAssets: "Hasta 80 piezas/mes",
      includedCredits: 420,
      users: "10 usuarios",
      support: "Soporte prioritario",
      renewalMotion: "Contrato trimestral o semestral.",
      features: ["A/B/C", "Benchmarks privados", "KPIs externos", "Workflow creativo", "Export mensual"],
    },
    {
      tier: "enterprise",
      name: "Enterprise",
      priceLabel: "Contrato anual · precio bajo alcance",
      audience: "Corporates, agencias multi-cliente y procurement/IT.",
      monthlyAssets: "Volumen pactado",
      includedCredits: 1200,
      users: "Usuarios y workspaces pactados",
      support: "SLA piloto + canal dedicado",
      renewalMotion: "MSA/DPA + anexo de seguridad + renovacion SaaS.",
      features: ["API keys", "SSO/SAML bajo contrato", "Retencion configurable", "DPA", "Checklist procurement"],
    },
  ];
}

function defaultRetentionPolicy(organizationId: string): RetentionPolicy {
  return {
    organizationId,
    region: "EU",
    assetRetentionDays: 30,
    reportRetentionDays: 90,
    backupRetentionDays: 30,
    secureDeleteSlaDays: 7,
    dpaStatus: "draft_ready",
    incidentResponseHours: 24,
    updatedAt: new Date().toISOString(),
  };
}

function defaultSsoRoadmap(organizationId: string): SsoRoadmap {
  return {
    organizationId,
    status: "requirements_ready",
    protocol: "SAML 2.0 / OIDC",
    targetPlan: "Enterprise",
    providerExamples: ["Okta", "Microsoft Entra ID", "Google Workspace", "OneLogin"],
    requirements: [
      "Dominio corporativo verificado.",
      "Metadata XML o issuer/client id del proveedor.",
      "Atributos minimos: email, nombre, organizacion y rol.",
      "Ventana de QA con usuario owner y viewer.",
    ],
    updatedAt: new Date().toISOString(),
  };
}

function defaultProcurementChecklist(): ProcurementChecklistItem[] {
  return [
    { id: "dpa", label: "DPA basico", status: "ready", evidence: "Plantilla lista para revision legal y firma en piloto." },
    { id: "retention", label: "Politica de retencion", status: "ready", evidence: "Retencion configurable por organizacion y borrado seguro trazado." },
    { id: "incident", label: "Incident response", status: "ready", evidence: "Playbook con primera respuesta 24h en beta." },
    { id: "sso", label: "SSO/SAML", status: "contractual", evidence: "Roadmap y requisitos listos; activacion bajo plan Enterprise." },
    { id: "billing", label: "Facturacion", status: "ready", evidence: "Export mensual de uso; sin pasarela de pago en beta." },
    { id: "api", label: "API keys", status: "ready", evidence: "Scopes basicos por organizacion y rotacion/revocacion." },
    { id: "hosting", label: "Hosting UE", status: "contractual", evidence: "Parametro de despliegue y anexo de proveedor segun cliente." },
    { id: "ai-language", label: "Lenguaje responsable", status: "ready", evidence: "Guardrails anti-claims absolutos en informes." },
  ];
}

function defaultSla(): SlaPolicy {
  return {
    name: "SLA piloto v1.5",
    uptimeTarget: "Best effort beta, objetivo operativo 99,0% en pilotos.",
    supportWindow: "L-V 09:00-18:00 Europe/Madrid.",
    firstResponse: "24h laborables para incidencias normales; 4h para bloqueo de demo/piloto.",
    incidentResponse: "Registro, contencion, comunicacion inicial, RCA breve y accion correctiva.",
    onboarding: "Kickoff, organizacion, usuarios, demo dataset, criterios de uso y primer benchmark.",
    offboarding: "Export de informes/uso, revocacion de API keys, borrado seguro y cierre de acceso.",
  };
}

function defaultApiKey(organizationId: string): ApiKeyRecord {
  const secret = createSecret();
  return {
    id: createId("apikey"),
    organizationId,
    name: "Backend piloto",
    prefix: secret.slice(0, 16),
    secretPreview: `${secret.slice(0, 16)}...${secret.slice(-4)}`,
    scopes: ["runs:read", "reports:read", "usage:read"],
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
  };
}

export function createDefaultEnterpriseStore(organizationId: string, organizationName: string): EnterpriseStore {
  const now = new Date().toISOString();
  return {
    organizationId,
    organizationName,
    plans: saasPlans(),
    activeTier: "professional",
    apiKeys: [defaultApiKey(organizationId)],
    retentionPolicy: defaultRetentionPolicy(organizationId),
    ssoRoadmap: defaultSsoRoadmap(organizationId),
    procurementChecklist: defaultProcurementChecklist(),
    sla: defaultSla(),
    exports: [],
    updatedAt: now,
  };
}

export function loadEnterpriseStore(organizationId: string, organizationName: string): EnterpriseStore {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) {
      const store = createDefaultEnterpriseStore(organizationId, organizationName);
      saveEnterpriseStore(store);
      return store;
    }
    const parsed = JSON.parse(raw) as EnterpriseStore;
    return {
      ...createDefaultEnterpriseStore(organizationId, organizationName),
      ...parsed,
      plans: saasPlans(),
      organizationName,
    };
  } catch {
    const store = createDefaultEnterpriseStore(organizationId, organizationName);
    saveEnterpriseStore(store);
    return store;
  }
}

export function saveEnterpriseStore(store: EnterpriseStore) {
  localStorage.setItem(storageKey(store.organizationId), JSON.stringify({ ...store, updatedAt: new Date().toISOString() }));
}

export function createApiKey(store: EnterpriseStore, name: string, scopes: ApiScope[]): EnterpriseStore {
  const secret = createSecret();
  const key: ApiKeyRecord = {
    id: createId("apikey"),
    organizationId: store.organizationId,
    name: name.trim() || "API key piloto",
    prefix: secret.slice(0, 16),
    secretPreview: `${secret.slice(0, 16)}...${secret.slice(-4)}`,
    scopes,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
  };
  const next = { ...store, apiKeys: [key, ...store.apiKeys] };
  saveEnterpriseStore(next);
  return next;
}

export function rotateApiKey(store: EnterpriseStore, keyId: string): EnterpriseStore {
  const secret = createSecret();
  const next = {
    ...store,
    apiKeys: store.apiKeys.map((key) => key.id === keyId ? {
      ...key,
      prefix: secret.slice(0, 16),
      secretPreview: `${secret.slice(0, 16)}...${secret.slice(-4)}`,
      rotatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    } : key),
  };
  saveEnterpriseStore(next);
  return next;
}

export function revokeApiKey(store: EnterpriseStore, keyId: string): EnterpriseStore {
  const next = {
    ...store,
    apiKeys: store.apiKeys.map((key) => key.id === keyId ? { ...key, status: "revoked" as const } : key),
  };
  saveEnterpriseStore(next);
  return next;
}

export function updateRetentionPolicy(store: EnterpriseStore, patch: Partial<RetentionPolicy>): EnterpriseStore {
  const next = {
    ...store,
    retentionPolicy: { ...store.retentionPolicy, ...patch, updatedAt: new Date().toISOString() },
  };
  saveEnterpriseStore(next);
  return next;
}

function eventInMonth(event: AdminUsageEvent, month: string) {
  return event.createdAt.startsWith(month);
}

function periodForMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createMonthlyUsageExport(store: EnterpriseStore, snapshot: AdminSnapshot, month: string): EnterpriseStore {
  const eventsInMonth = snapshot.usageEvents.filter((event) => eventInMonth(event, month));
  const scopedEvents = eventsInMonth.length ? eventsInMonth : snapshot.usageEvents;
  const period = periodForMonth(month);
  const exportRecord: MonthlyUsageExport = {
    id: createId("usage_export"),
    organizationId: store.organizationId,
    month,
    periodStart: period.start,
    periodEnd: period.end,
    createdAt: new Date().toISOString(),
    invoiceMode: "manual_beta",
    creditsUsed: round(scopedEvents.reduce((sum, event) => sum + event.creditsDelta, 0), 1),
    estimatedCostEur: round(scopedEvents.reduce((sum, event) => sum + event.estimatedCostEur, 0), 2),
    gpuSeconds: round(scopedEvents.reduce((sum, event) => sum + event.gpuSeconds, 0), 1),
    inputTokens: scopedEvents.reduce((sum, event) => sum + event.inputTokens, 0),
    outputTokens: scopedEvents.reduce((sum, event) => sum + event.outputTokens, 0),
    storageBytes: Math.max(0, scopedEvents.reduce((sum, event) => sum + event.storageBytesDelta, 0)),
    runs: scopedEvents.filter((event) => event.eventType === "tribe_run").length,
    reports: scopedEvents.filter((event) => event.eventType === "report_generation").length,
    comparisons: scopedEvents.filter((event) => event.eventType === "comparison_generation").length,
    usageEventCount: scopedEvents.length,
  };
  const next = { ...store, exports: [exportRecord, ...store.exports].slice(0, 24) };
  saveEnterpriseStore(next);
  return next;
}
