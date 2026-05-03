import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadAdminSnapshotFromApi } from "../admin/apiAdminStore";
import { buildAdminSnapshot } from "../admin/buildAdminSnapshot";
import type { AdminSnapshot } from "../admin/types";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button } from "../components/ui";
import {
  createApiKeyInApi,
  createMonthlyUsageExportInApi,
  loadEnterpriseStoreFromApi,
  revokeApiKeyInApi,
  rotateApiKeyInApi,
  updateRetentionPolicyInApi,
} from "../enterprise/apiEnterpriseStore";
import {
  createApiKey,
  createMonthlyUsageExport,
  loadEnterpriseStore,
  revokeApiKey,
  rotateApiKey,
  updateRetentionPolicy,
} from "../enterprise/localEnterpriseStore";
import { exportEnterprisePackPdf, exportMonthlyUsageCsv, exportMonthlyUsageJson } from "../enterprise/exportEnterprise";
import type { ApiScope, EnterpriseStore } from "../enterprise/types";
import { useProjectStore } from "../projects/useProjectStore";

const apiScopes: ApiScope[] = ["runs:read", "runs:write", "reports:read", "usage:read", "admin:read"];

function formatEur(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function planTone(tier: string) {
  if (tier === "enterprise") return "amber" as const;
  if (tier === "professional") return "cyan" as const;
  return "muted" as const;
}

function statusTone(status: string) {
  if (status === "ready" || status === "active" || status === "signed") return "lime" as const;
  if (status === "contractual" || status === "requirements_ready" || status === "draft_ready") return "amber" as const;
  if (status === "revoked") return "coral" as const;
  return "muted" as const;
}

function PlanCard({ plan, active }: { plan: EnterpriseStore["plans"][number]; active: boolean }) {
  return (
    <article className={`enterprise-plan-card ${active ? "is-active" : ""}`}>
      <div>
        <Badge tone={planTone(plan.tier)}>{active ? "Plan beta activo" : plan.name}</Badge>
        <strong>{plan.name}</strong>
        <span>{plan.audience}</span>
      </div>
      <h3>{plan.priceLabel}</h3>
      <div className="enterprise-plan-metrics">
        <span>{plan.monthlyAssets}</span>
        <span>{plan.includedCredits} creditos</span>
        <span>{plan.users}</span>
      </div>
      <ul>
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <em>{plan.renewalMotion}</em>
    </article>
  );
}

function ApiKeysPanel({
  store,
  onCreate,
  onRotate,
  onRevoke,
  isBusy,
}: {
  store: EnterpriseStore;
  onCreate: (name: string, scopes: ApiScope[]) => void;
  onRotate: (keyId: string) => void;
  onRevoke: (keyId: string) => void;
  isBusy?: boolean;
}) {
  const [name, setName] = useState("Integracion cliente piloto");
  const [scopes, setScopes] = useState<ApiScope[]>(["runs:read", "reports:read", "usage:read"]);

  function toggleScope(scope: ApiScope) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  return (
    <section className="enterprise-panel">
      <div className="enterprise-panel-head">
        <div>
          <span className="workspace-eyebrow">API</span>
          <h3>API keys por organizacion.</h3>
        </div>
        <Badge tone="lime">Beta lista</Badge>
      </div>

      <div className="enterprise-api-create">
        <label className="field">
          <span className="field-label">Nombre</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="enterprise-scope-list">
          {apiScopes.map((scope) => (
            <label key={scope}>
              <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
              <span>{scope}</span>
            </label>
          ))}
        </div>
        <Button icon={<KeyRound size={15} />} onClick={() => onCreate(name, scopes.length ? scopes : ["runs:read"])} disabled={isBusy}>
          Crear API key
        </Button>
      </div>

      <div className="enterprise-key-list">
        {store.apiKeys.map((key) => (
          <article key={key.id}>
            <div>
              <Badge tone={statusTone(key.status)}>{key.status}</Badge>
              <strong>{key.name}</strong>
              <span>{key.secretPreview}</span>
            </div>
            <div>
              <em>Scopes: {key.scopes.join(", ")}</em>
              <em>Expira: {formatDate(key.expiresAt)}</em>
            </div>
            <div className="enterprise-key-actions">
              <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onRotate(key.id)} disabled={isBusy}>Rotar</Button>
              <Button variant="ghost" icon={<LockKeyhole size={14} />} onClick={() => onRevoke(key.id)} disabled={isBusy}>Revocar</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EnterprisePage() {
  const { session } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [month, setMonth] = useState(currentMonth());
  const [apiError, setApiError] = useState("");
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [remoteSnapshot, setRemoteSnapshot] = useState<AdminSnapshot | null>(null);

  if (!session) return null;

  const accessToken = session.accessToken;
  const useApi = session.provider === "supabase" && Boolean(accessToken);
  const { state } = useProjectStore(session.organization.id, session.organization.name);
  const localSnapshot = useMemo(() => buildAdminSnapshot(session, state), [session, state, refreshKey]);
  const snapshot = remoteSnapshot ?? localSnapshot;
  const [store, setStore] = useState(() => loadEnterpriseStore(session.organization.id, session.organization.name));
  const latestExport = store.exports[0];

  useEffect(() => {
    if (!useApi || !accessToken) return;
    let cancelled = false;
    setIsLoadingApi(true);
    setApiError("");
    Promise.all([
      loadEnterpriseStoreFromApi(session.organization.id, session.organization.name, accessToken),
      loadAdminSnapshotFromApi(session, state, accessToken),
    ])
      .then(([nextStore, nextSnapshot]) => {
        if (cancelled) return;
        setStore(nextStore);
        setRemoteSnapshot(nextSnapshot);
      })
      .catch((caught) => {
        if (!cancelled) setApiError(caught instanceof Error ? caught.message : "No se pudo cargar Enterprise desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshKey, session, session.organization.id, session.organization.name, state, useApi]);

  function updateStore(next: EnterpriseStore) {
    setStore({ ...next });
    setRefreshKey((value) => value + 1);
  }

  async function updateStoreFromApi(operation: () => Promise<EnterpriseStore>, fallback: () => EnterpriseStore) {
    if (useApi && accessToken) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        updateStore(await operation());
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio Enterprise en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    updateStore(fallback());
  }

  function generateExport() {
    void updateStoreFromApi(
      () => createMonthlyUsageExportInApi(store, snapshot, month, accessToken || ""),
      () => createMonthlyUsageExport(store, snapshot, month),
    );
  }

  function handleCreateApiKey(name: string, scopes: ApiScope[]) {
    void updateStoreFromApi(
      () => createApiKeyInApi(store.organizationId, store.organizationName, name, scopes, accessToken || ""),
      () => createApiKey(store, name, scopes),
    );
  }

  function handleRotateApiKey(keyId: string) {
    void updateStoreFromApi(
      () => rotateApiKeyInApi(store.organizationId, store.organizationName, keyId, accessToken || ""),
      () => rotateApiKey(store, keyId),
    );
  }

  function handleRevokeApiKey(keyId: string) {
    void updateStoreFromApi(
      () => revokeApiKeyInApi(store.organizationId, store.organizationName, keyId, accessToken || ""),
      () => revokeApiKey(store, keyId),
    );
  }

  function handleRetention(patch: Parameters<typeof updateRetentionPolicy>[1]) {
    void updateStoreFromApi(
      () => updateRetentionPolicyInApi(store, patch, accessToken || ""),
      () => updateRetentionPolicy(store, patch),
    );
  }

  return (
    <AppShell active="enterprise">
      <section className="enterprise-hero">
        <div>
          <span className="workspace-eyebrow">SaaS v1.5 beta</span>
          <h2>Listo para operar 3-5 pilotos sin pasarela de pago.</h2>
          <p>Planes, API keys, export mensual de uso, SSO bajo contrato, DPA, retencion, SLA y checklist procurement. Facturacion manual mientras el producto esta en beta.</p>
        </div>
        <div className="result-hero-actions">
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => setRefreshKey((value) => value + 1)}>Refrescar</Button>
          <Button icon={<CalendarDays size={15} />} onClick={generateExport} disabled={isLoadingApi}>Generar export mensual</Button>
        </div>
      </section>

      {apiError ? <p className="form-error">{apiError}</p> : null}

      <section className="enterprise-status-grid">
        <article><Building2 size={17} /><span>Clientes piloto</span><strong>3-5</strong><em>Aislamiento por organizacion</em></article>
        <article><KeyRound size={17} /><span>API keys activas</span><strong>{store.apiKeys.filter((key) => key.status === "active").length}</strong><em>Scopes basicos</em></article>
        <article><FileCheck2 size={17} /><span>Exports mensuales</span><strong>{store.exports.length}</strong><em>Billing manual beta</em></article>
        <article><ShieldCheck size={17} /><span>Retencion assets</span><strong>{store.retentionPolicy.assetRetentionDays}d</strong><em>Region UE</em></article>
      </section>

      <section className="enterprise-layout">
        <div className="enterprise-main">
          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">Planes beta</span>
                <h3>Starter, Professional y Enterprise definidos.</h3>
              </div>
              <Badge tone="amber">Sin checkout</Badge>
            </div>
            <div className="enterprise-plan-grid">
              {store.plans.map((plan) => <PlanCard key={plan.tier} plan={plan} active={store.activeTier === plan.tier} />)}
            </div>
          </section>

          <ApiKeysPanel store={store} onCreate={handleCreateApiKey} onRotate={handleRotateApiKey} onRevoke={handleRevokeApiKey} isBusy={isLoadingApi} />

          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">Uso mensual</span>
                <h3>Export para renovacion y billing manual.</h3>
              </div>
              <Badge tone="cyan">{latestExport ? latestExport.month : "Pendiente"}</Badge>
            </div>
            <div className="enterprise-export-toolbar">
              <label className="field">
                <span className="field-label">Mes</span>
                <input className="input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </label>
              <Button icon={<CalendarDays size={15} />} onClick={generateExport} disabled={isLoadingApi}>Crear export</Button>
              {latestExport ? (
                <>
                  <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportMonthlyUsageJson(store, snapshot, latestExport)}>JSON</Button>
                  <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportMonthlyUsageCsv(snapshot, latestExport)}>CSV</Button>
                  <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportEnterprisePackPdf(store, latestExport)}>PDF</Button>
                </>
              ) : null}
            </div>
            <div className="enterprise-export-grid">
              <article><span>Creditos</span><strong>{formatNumber(latestExport?.creditsUsed ?? snapshot.credits.consumed)}</strong></article>
              <article><span>Coste estimado</span><strong>{formatEur(latestExport?.estimatedCostEur ?? snapshot.costs.totalEur)}</strong></article>
              <article><span>GPU sec</span><strong>{formatNumber(latestExport?.gpuSeconds ?? snapshot.costs.gpuSeconds)}</strong></article>
              <article><span>Eventos</span><strong>{latestExport?.usageEventCount ?? snapshot.usageEvents.length}</strong></article>
            </div>
            <p className="enterprise-note">La pasarela de pago queda fuera de beta. Este export sirve para factura manual, renovacion SaaS y control de margen.</p>
          </section>
        </div>

        <aside className="enterprise-side">
          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">SSO</span>
                <h3>SSO Enterprise.</h3>
              </div>
              <Badge tone={statusTone(store.ssoRoadmap.status)}>{store.ssoRoadmap.status}</Badge>
            </div>
            <div className="enterprise-compact-list">
              <div><UserCheck size={15} /><strong>{store.ssoRoadmap.protocol}</strong><span>{store.ssoRoadmap.targetPlan}</span></div>
              {store.ssoRoadmap.requirements.map((item) => <div key={item}><CheckCircle2 size={15} /><strong>{item}</strong></div>)}
            </div>
          </section>

          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">Retencion</span>
                <h3>Politica configurable.</h3>
              </div>
              <Badge tone="lime">{store.retentionPolicy.region}</Badge>
            </div>
            <div className="enterprise-retention-controls">
              <label className="field">
                <span className="field-label">Assets</span>
                <select className="input" value={store.retentionPolicy.assetRetentionDays} onChange={(event) => handleRetention({ assetRetentionDays: Number(event.target.value) })}>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Informes</span>
                <select className="input" value={store.retentionPolicy.reportRetentionDays} onChange={(event) => handleRetention({ reportRetentionDays: Number(event.target.value) })}>
                  <option value={90}>90 dias</option>
                  <option value={180}>180 dias</option>
                  <option value={365}>365 dias</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Incidente</span>
                <select className="input" value={store.retentionPolicy.incidentResponseHours} onChange={(event) => handleRetention({ incidentResponseHours: Number(event.target.value) })}>
                  <option value={24}>24h</option>
                  <option value={12}>12h</option>
                  <option value={4}>4h</option>
                </select>
              </label>
            </div>
          </section>

          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">Procurement</span>
                <h3>Checklist IT/legal.</h3>
              </div>
              <Badge tone="lime">{store.procurementChecklist.filter((item) => item.status === "ready").length} ready</Badge>
            </div>
            <div className="enterprise-checklist">
              {store.procurementChecklist.map((item) => (
                <article key={item.id}>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.evidence}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="enterprise-panel">
            <div className="enterprise-panel-head">
              <div>
                <span className="workspace-eyebrow">SLA y soporte</span>
                <h3>{store.sla.name}</h3>
              </div>
              <Badge tone="amber">Beta</Badge>
            </div>
            <div className="enterprise-compact-list">
              <div><BadgeCheck size={15} /><strong>{store.sla.uptimeTarget}</strong></div>
              <div><SlidersHorizontal size={15} /><strong>{store.sla.firstResponse}</strong></div>
              <div><ShieldCheck size={15} /><strong>{store.sla.offboarding}</strong></div>
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
