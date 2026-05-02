import {
  Activity,
  AlertTriangle,
  Archive,
  Coins,
  Database,
  Download,
  Gauge,
  HardDrive,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Siren,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createMonthlyUsageExportInApi, loadAdminSnapshotFromApi, secureDeleteAssetInApi } from "../admin/apiAdminStore";
import { buildAdminSnapshot } from "../admin/buildAdminSnapshot";
import { secureDeleteAssetTree } from "../admin/secureDelete";
import type { AdminSnapshot, AdminUsageEvent } from "../admin/types";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button } from "../components/ui";
import { useProjectStore } from "../projects/useProjectStore";

function formatEur(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024))} MB`;
  return `${formatNumber(bytes / (1024 * 1024 * 1024))} GB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function usageLabel(type: AdminUsageEvent["eventType"]) {
  const labels: Record<AdminUsageEvent["eventType"], string> = {
    asset_upload: "Upload",
    preprocessing: "Preprocess",
    tribe_run: "TRIBE",
    scoring: "Scoring",
    report_generation: "Informe",
    comparison_generation: "A/B/C",
    secure_delete: "Borrado",
    storage_retention: "Retencion",
    manual_adjustment: "Ajuste",
  };
  return labels[type];
}

function usageTone(type: AdminUsageEvent["eventType"]) {
  if (type === "tribe_run") return "amber" as const;
  if (type === "report_generation") return "violet" as const;
  if (type === "comparison_generation") return "cyan" as const;
  if (type === "secure_delete") return "coral" as const;
  return "muted" as const;
}

function downloadJson(snapshot: AdminSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `admin-snapshot-${snapshot.session.organization.slug}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function downloadMonthlyExport(snapshot: AdminSnapshot) {
  const month = currentMonth();
  const payload = {
    organization: snapshot.session.organization.name,
    month,
    invoiceMode: "manual_beta",
    creditsUsed: snapshot.credits.consumed,
    estimatedCostEur: snapshot.costs.totalEur,
    gpuSeconds: snapshot.costs.gpuSeconds,
    inputTokens: snapshot.costs.inputTokens,
    outputTokens: snapshot.costs.outputTokens,
    storageBytes: snapshot.costs.storageBytes,
    runs: snapshot.summary.runs,
    reports: snapshot.summary.reports,
    comparisons: snapshot.summary.comparisons,
    usageEventCount: snapshot.usageEvents.length,
    usageEvents: snapshot.usageEvents,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `praevia-usage-${month}-${snapshot.session.organization.slug}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  meta,
  tone = "muted",
}: {
  label: string;
  value: string;
  meta: string;
  tone?: "amber" | "cyan" | "lime" | "coral" | "violet" | "muted";
}) {
  return (
    <article className={`admin-stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{meta}</em>
    </article>
  );
}

function CostBreakdown({ snapshot }: { snapshot: AdminSnapshot }) {
  const rows = [
    { label: "GPU / Worker", value: snapshot.costs.gpuEur, detail: `${formatNumber(snapshot.costs.gpuSeconds)} GPU sec`, tone: "amber" as const },
    { label: "LLM / informes", value: snapshot.costs.llmEur, detail: `${snapshot.costs.inputTokens + snapshot.costs.outputTokens} tokens`, tone: "violet" as const },
    { label: "Storage", value: snapshot.costs.storageEur, detail: formatBytes(snapshot.costs.storageBytes), tone: "cyan" as const },
    { label: "Plataforma", value: snapshot.costs.platformEur, detail: "jobs, scoring y control", tone: "muted" as const },
  ];
  const max = Math.max(...rows.map((row) => row.value), 0.01);

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Costes</span>
          <h3>Coste por run y por capa.</h3>
        </div>
        <Badge tone="amber">{formatEur(snapshot.costs.totalEur)}</Badge>
      </div>
      <div className="admin-cost-list">
        {rows.map((row) => (
          <div key={row.label}>
            <div>
              <Badge tone={row.tone}>{row.label}</Badge>
              <strong>{formatEur(row.value)}</strong>
            </div>
            <span>{row.detail}</span>
            <i style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function UsageTable({ events }: { events: AdminUsageEvent[] }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Usage events</span>
          <h3>Ledger de consumo.</h3>
        </div>
        <Badge tone="muted">{events.length} eventos</Badge>
      </div>
      <div className="admin-usage-table">
        <div className="admin-table-head">
          <span>Evento</span>
          <span>Creditos</span>
          <span>Coste</span>
          <span>Storage</span>
          <span>Fecha</span>
        </div>
        {events.slice(0, 18).map((event) => (
          <div className="admin-table-row" key={event.id}>
            <div>
              <Badge tone={usageTone(event.eventType)}>{usageLabel(event.eventType)}</Badge>
              <strong>{event.label}</strong>
            </div>
            <span>{event.creditsDelta > 0 ? "-" : ""}{formatNumber(event.creditsDelta)}</span>
            <span>{formatEur(event.estimatedCostEur)}</span>
            <span>{event.storageBytesDelta < 0 ? "-" : ""}{formatBytes(Math.abs(event.storageBytesDelta))}</span>
            <span>{formatDate(event.createdAt)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecureDeletePanel({
  snapshot,
  selectedAssetId,
  onSelectedAssetId,
  onDeleted,
  accessToken,
}: {
  snapshot: AdminSnapshot;
  selectedAssetId: string;
  onSelectedAssetId: (value: string) => void;
  onDeleted: () => void;
  accessToken?: string;
}) {
  const selectedAsset = snapshot.assets.find((asset) => asset.id === selectedAssetId) ?? snapshot.assets[0];
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const related = selectedAsset ? {
    jobs: snapshot.preprocessingJobs.filter((job) => job.assetId === selectedAsset.id).length,
    runs: snapshot.analysisRuns.filter((run) => run.assetId === selectedAsset.id).length,
    scores: snapshot.scoringResults.filter((result) => result.assetId === selectedAsset.id).length,
    reports: snapshot.reports.filter((report) => report.assetId === selectedAsset.id).length,
    comparisons: snapshot.comparisons.filter((comparison) => comparison.versions.some((version) => version.result.assetId === selectedAsset.id)).length,
  } : null;

  async function deleteSelected() {
    if (!selectedAsset) return;
    setDeleteError("");
    setIsDeleting(true);
    const storageKeys = [
      selectedAsset.storageKey,
      ...snapshot.preprocessingJobs
        .filter((job) => job.assetId === selectedAsset.id)
        .flatMap((job) => job.derivatives.map((derivative) => derivative.storageKey)),
      ...snapshot.analysisRuns
        .filter((run) => run.assetId === selectedAsset.id)
        .flatMap((run) => run.artifacts.map((artifact) => artifact.storageKey)),
      ...snapshot.reports
        .filter((report) => report.assetId === selectedAsset.id)
        .flatMap((report) => [report.htmlStorageKey, report.pdfStorageKey]),
    ].filter(Boolean) as string[];
    try {
      if (accessToken) {
        await secureDeleteAssetInApi({
          organization_id: snapshot.session.organization.id,
          asset_id: selectedAsset.id,
          asset_name: selectedAsset.fileName,
          storage_keys: storageKeys,
          scope: {
            assets: 1,
            preprocessing_jobs: related?.jobs ?? 0,
            analysis_runs: related?.runs ?? 0,
            scoring_results: related?.scores ?? 0,
            reports: related?.reports ?? 0,
            comparisons: related?.comparisons ?? 0,
          },
        }, accessToken);
      } else {
        const result = secureDeleteAssetTree(snapshot.session.organization.id, selectedAsset.id, snapshot.session.user.email);
        if (!result) throw new Error("No se pudo borrar el asset local.");
      }
      onDeleted();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "No se pudo completar el borrado seguro.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="admin-panel admin-delete-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Borrado seguro</span>
          <h3>Eliminar asset y derivados.</h3>
        </div>
        <Badge tone="coral"><Trash2 size={13} /> DSR</Badge>
      </div>

      {selectedAsset ? (
        <>
          <label className="field">
            <span className="field-label">Asset</span>
            <select className="input" value={selectedAsset.id} onChange={(event) => onSelectedAssetId(event.target.value)}>
              {snapshot.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.slot} · {asset.fileName}</option>
              ))}
            </select>
          </label>

          <div className="admin-delete-scope">
            <div><span>Original</span><strong>1</strong></div>
            <div><span>Derivados</span><strong>{related?.jobs ?? 0}</strong></div>
            <div><span>Runs</span><strong>{related?.runs ?? 0}</strong></div>
            <div><span>Scoring</span><strong>{related?.scores ?? 0}</strong></div>
            <div><span>Informes</span><strong>{related?.reports ?? 0}</strong></div>
            <div><span>Comparativas</span><strong>{related?.comparisons ?? 0}</strong></div>
          </div>

          {deleteError ? <p className="form-error">{deleteError}</p> : null}

          <Button variant="secondary" icon={<Trash2 size={15} />} onClick={deleteSelected} disabled={isDeleting}>
            {isDeleting ? "Borrando..." : "Borrar asset y derivados"}
          </Button>
        </>
      ) : (
        <div className="admin-empty">
          <Archive size={20} />
          <strong>No hay assets activos.</strong>
          <span>Los borrados quedan trazados en el audit log.</span>
        </div>
      )}
    </section>
  );
}

function AuditPanel({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Audit logs</span>
          <h3>Quien hizo que.</h3>
        </div>
        <Badge tone={snapshot.errors.length ? "coral" : "lime"}>{snapshot.errors.length} errores</Badge>
      </div>
      <div className="admin-audit-list">
        {snapshot.auditEvents.slice(0, 12).map((event) => (
          <article key={event.id}>
            <Badge tone={event.severity === "error" || event.severity === "critical" ? "coral" : event.severity === "warning" ? "amber" : "muted"}>
              {event.severity}
            </Badge>
            <div>
              <strong>{event.action}</strong>
              <span>{event.message}</span>
              <em>{event.actor} · {formatDate(event.createdAt)}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ObservabilityPanel({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Observabilidad</span>
          <h3>Errores accionables.</h3>
        </div>
        <Badge tone={snapshot.errorEvents.length ? "coral" : "lime"}>{snapshot.errorEvents.length} eventos</Badge>
      </div>
      <div className="admin-audit-list">
        {snapshot.errorEvents.slice(0, 8).map((event) => (
          <article key={event.id}>
            <Badge tone={event.severity === "critical" || event.severity === "error" ? "coral" : "amber"}>{event.source}</Badge>
            <div>
              <strong>{event.message}</strong>
              <span>{event.entityType ?? "sistema"} {event.entityId ? `· ${event.entityId.slice(0, 8)}` : ""}</span>
              <em>{event.resolvedAt ? "resuelto" : "pendiente"} · {formatDate(event.createdAt)}</em>
            </div>
          </article>
        ))}
        {snapshot.errorEvents.length === 0 ? (
          <div className="admin-empty"><ShieldCheck size={20} /><strong>Sin errores abiertos.</strong><span>Worker, API, LLM y storage registraran fallos aqui.</span></div>
        ) : null}
      </div>
    </section>
  );
}

function BackupPanel({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Backups</span>
          <h3>Snapshots registrados.</h3>
        </div>
        <Badge tone="muted">{snapshot.backupSnapshots.length} snapshots</Badge>
      </div>
      <div className="admin-audit-list">
        {snapshot.backupSnapshots.slice(0, 6).map((backup) => (
          <article key={backup.id}>
            <Badge tone="cyan">{backup.snapshotType}</Badge>
            <div>
              <strong>{backup.storageKey}</strong>
              <span>{backup.environment} · {backup.byteSize ? formatBytes(backup.byteSize) : "sin tamano"}</span>
              <em>{backup.status} · {formatDate(backup.createdAt)}</em>
            </div>
          </article>
        ))}
        {snapshot.backupSnapshots.length === 0 ? (
          <div className="admin-empty"><Archive size={20} /><strong>Sin snapshots registrados.</strong><span>Produccion debe registrar backups DB y manifests.</span></div>
        ) : null}
      </div>
    </section>
  );
}

function LimitsPanel({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="workspace-eyebrow">Seguridad</span>
          <h3>Limites y operacion.</h3>
        </div>
        <Badge tone={snapshot.credits.status === "blocked" ? "coral" : snapshot.credits.status === "warning" ? "amber" : "lime"}>
          {snapshot.credits.status}
        </Badge>
      </div>
      <div className="admin-security-list">
        <div><Coins size={16} /><strong>{formatNumber(snapshot.limits.monthlyCreditLimit)}</strong><span>Creditos mes</span></div>
        <div><AlertTriangle size={16} /><strong>{formatNumber(snapshot.limits.hardCreditLimit)}</strong><span>Hard cap creditos</span></div>
        <div><Gauge size={16} /><strong>{formatEur(snapshot.limits.monthlyCostLimitEur)}</strong><span>Cap coste mes</span></div>
        <div><HardDrive size={16} /><strong>{formatBytes(snapshot.limits.storageByteLimit)}</strong><span>Cap storage</span></div>
        <div><Gauge size={16} /><strong>{snapshot.limits.runRateLimitPerHour}/h</strong><span>Rate limit runs</span></div>
        <div><ReceiptText size={16} /><strong>{snapshot.limits.reportRateLimitPerHour}/h</strong><span>Rate limit informes</span></div>
        <div><KeyRound size={16} /><strong>{snapshot.limits.signedUrlTtlMinutes} min</strong><span>TTL URLs firmadas</span></div>
        <div><Database size={16} /><strong>{snapshot.limits.retentionDays} dias</strong><span>Retencion por defecto</span></div>
        <div><Archive size={16} /><strong>Activo</strong><span>{snapshot.limits.backups}</span></div>
        <div><LockKeyhole size={16} /><strong>RLS</strong><span>Aislamiento por organizacion</span></div>
      </div>
    </section>
  );
}

export function AdminPage() {
  const { session } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [remoteSnapshot, setRemoteSnapshot] = useState<AdminSnapshot | null>(null);
  const [apiError, setApiError] = useState("");
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isExportingMonth, setIsExportingMonth] = useState(false);

  if (!session) return null;

  const accessToken = session.accessToken;
  const { state } = useProjectStore(session.organization.id, session.organization.name);
  const localSnapshot = useMemo(() => buildAdminSnapshot(session, state), [session, state, refreshKey]);
  const snapshot = remoteSnapshot ?? localSnapshot;
  const activeAssetId = selectedAssetId || snapshot.assets[0]?.id || "";

  useEffect(() => {
    if (session.provider !== "supabase" || !accessToken) return;
    let cancelled = false;
    setIsLoadingApi(true);
    setApiError("");
    loadAdminSnapshotFromApi(session, state, accessToken)
      .then((next) => {
        if (!cancelled) setRemoteSnapshot(next);
      })
      .catch((caught) => {
        if (!cancelled) setApiError(caught instanceof Error ? caught.message : "No se pudo cargar Admin desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshKey, session, state]);

  const stats = [
    { label: "Creditos usados", value: `${formatNumber(snapshot.credits.consumed)}/${snapshot.credits.allocated}`, meta: `${formatNumber(snapshot.credits.remaining)} restantes`, tone: snapshot.credits.status === "ok" ? "lime" as const : snapshot.credits.status === "warning" ? "amber" as const : "coral" as const },
    { label: "Puede analizar", value: snapshot.credits.canAnalyze ? "Si" : "Bloqueado", meta: snapshot.credits.blockReasons.join(", ") || "caps correctos", tone: snapshot.credits.canAnalyze ? "lime" as const : "coral" as const },
    { label: "Coste estimado", value: formatEur(snapshot.costs.totalEur), meta: "GPU + LLM + storage", tone: "amber" as const },
    { label: "Tokens LLM", value: String(snapshot.costs.inputTokens + snapshot.costs.outputTokens), meta: `${snapshot.reports.length} informes`, tone: "violet" as const },
    { label: "Storage vivo", value: formatBytes(snapshot.costs.storageBytes), meta: `${snapshot.assets.length} assets activos`, tone: "cyan" as const },
    { label: "Runs", value: String(snapshot.summary.runs), meta: `${formatNumber(snapshot.costs.gpuSeconds)} GPU sec`, tone: "muted" as const },
    { label: "Errores", value: String(snapshot.errors.length), meta: snapshot.errors.length ? "requiere revision" : "sin errores abiertos", tone: snapshot.errors.length ? "coral" as const : "lime" as const },
  ];

  async function handleMonthlyExport() {
    if (snapshot.session.provider !== "supabase" || !accessToken) {
      downloadMonthlyExport(snapshot);
      return;
    }
    setIsExportingMonth(true);
    setApiError("");
    try {
      const exportRow = await createMonthlyUsageExportInApi(snapshot.session.organization.id, currentMonth(), accessToken);
      const blob = new Blob([JSON.stringify({ export: exportRow, usageEvents: snapshot.usageEvents }, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `praevia-usage-${exportRow.month}-${snapshot.session.organization.slug}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setApiError(caught instanceof Error ? caught.message : "No se pudo generar el export mensual.");
    } finally {
      setIsExportingMonth(false);
    }
  }

  return (
    <AppShell active="admin">
      <section className="admin-hero">
        <div>
          <span className="workspace-eyebrow">Sprint 29 · Observabilidad y seguridad</span>
          <h2>Opera sin ir a ciegas.</h2>
          <p>Vista operativa para coste, creditos, errores accionables, audit logs, backups, rate limits, borrado seguro y continuidad de analisis.</p>
        </div>
        <div className="result-hero-actions">
          <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoadingApi}>Refrescar</Button>
          <Button variant="secondary" icon={<ReceiptText size={15} />} onClick={handleMonthlyExport} disabled={isExportingMonth}>{isExportingMonth ? "Generando..." : "Export mensual"}</Button>
          <Button icon={<Download size={15} />} onClick={() => downloadJson(snapshot)}>Export admin JSON</Button>
        </div>
      </section>

      {apiError ? <p className="form-error">{apiError}</p> : null}

      <section className="admin-stat-grid">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <section className="admin-layout">
        <div className="admin-main">
          <CostBreakdown snapshot={snapshot} />
          <UsageTable events={snapshot.usageEvents} />

          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span className="workspace-eyebrow">Facturacion manual</span>
                <h3>Exports mensuales beta.</h3>
              </div>
              <Badge tone="muted">{snapshot.monthlyExports.length} exports</Badge>
            </div>
            <div className="admin-usage-table">
              <div className="admin-table-head">
                <span>Mes</span>
                <span>Creditos</span>
                <span>Coste</span>
                <span>GPU</span>
                <span>Eventos</span>
              </div>
              {snapshot.monthlyExports.slice(0, 6).map((item) => (
                <div className="admin-table-row" key={item.id}>
                  <div>
                    <Badge tone="cyan">{item.invoiceMode}</Badge>
                    <strong>{item.month}</strong>
                  </div>
                  <span>{formatNumber(item.creditsUsed)}</span>
                  <span>{formatEur(item.estimatedCostEur)}</span>
                  <span>{formatNumber(item.gpuSeconds)}</span>
                  <span>{item.usageEventCount}</span>
                </div>
              ))}
              {snapshot.monthlyExports.length === 0 ? (
                <div className="admin-empty"><ReceiptText size={20} /><strong>Sin exports mensuales.</strong><span>Genera uno para facturacion manual beta.</span></div>
              ) : null}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span className="workspace-eyebrow">Runs y margen</span>
                <h3>Analisis lanzados.</h3>
              </div>
              <Badge tone="muted">{snapshot.analysisRuns.length} runs</Badge>
            </div>
            <div className="admin-run-grid">
              {snapshot.analysisRuns.map((run) => (
                <article key={run.id}>
                  <div>
                    <Badge tone={run.status === "done" ? "lime" : run.status === "failed" ? "coral" : "amber"}>{run.status}</Badge>
                    <strong>{run.assetName}</strong>
                  </div>
                  <span>{run.modelId}</span>
                  <div className="admin-run-metrics">
                    <em>{run.gpuSeconds ?? 0} GPU sec</em>
                    <em>{run.artifacts.length} artefactos</em>
                    <em>{run.nTimesteps ?? "-"} x {run.nVertices ?? "-"}</em>
                  </div>
                </article>
              ))}
              {snapshot.analysisRuns.length === 0 ? (
                <div className="admin-empty"><Activity size={20} /><strong>Sin runs todavia.</strong><span>Lanza TRIBE para ver coste por analisis.</span></div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="admin-side">
          <SecureDeletePanel
            snapshot={snapshot}
            selectedAssetId={activeAssetId}
            onSelectedAssetId={setSelectedAssetId}
            onDeleted={() => {
              setSelectedAssetId("");
              setRefreshKey((value) => value + 1);
            }}
            accessToken={session.provider === "supabase" ? session.accessToken : undefined}
          />
          <LimitsPanel snapshot={snapshot} />
          <ObservabilityPanel snapshot={snapshot} />
          <BackupPanel snapshot={snapshot} />
          <AuditPanel snapshot={snapshot} />
        </aside>
      </section>

      <section className="admin-panel admin-footer-grid">
        <article><Users size={16} /><span>Usuarios</span><strong>{snapshot.summary.users}</strong></article>
        <article><ShieldCheck size={16} /><span>Organizaciones</span><strong>{snapshot.summary.organizations}</strong></article>
        <article><HardDrive size={16} /><span>Workspaces</span><strong>{snapshot.summary.workspaces}</strong></article>
        <article><Coins size={16} /><span>Proyectos</span><strong>{snapshot.summary.projects}</strong></article>
        <article><AlertTriangle size={16} /><span>Experimentos</span><strong>{snapshot.summary.experiments}</strong></article>
        <article><Siren size={16} /><span>Borrados</span><strong>{snapshot.deletions.length}</strong></article>
      </section>
    </AppShell>
  );
}
