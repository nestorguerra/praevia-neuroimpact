import {
  BarChart3,
  Database,
  Download,
  FileJson,
  FileText,
  Gauge,
  LineChart,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  addExternalKpiInApi,
  addManualBenchmarkItemInApi,
  addRunToBenchmarkInApi,
  createDemoBenchmarkInApi,
  loadBenchmarkStoreFromApi,
} from "../benchmarks/apiBenchmarkStore";
import {
  addExternalKpi,
  addManualBenchmarkItem,
  addRunToBenchmark,
  applyBenchmark,
  benchmarkCorrelation,
  createDemoBenchmark,
  kpiLabels,
  loadBenchmarkStore,
} from "../benchmarks/localBenchmarkStore";
import { exportBenchmarkCsv, exportBenchmarkJson, exportBenchmarkPdf } from "../benchmarks/exportBenchmark";
import type { BenchmarkItem, BenchmarkStore, KpiType } from "../benchmarks/types";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button, Input } from "../components/ui";
import { useProjectStore } from "../projects/useProjectStore";
import { loadScoringResultsFromApi } from "../scoring/apiScoringStore";
import { loadStoredScoringResults } from "../scoring/localScoringStore";
import type { NeuroScoringResult } from "../scoring/types";

const kpiOptions: KpiType[] = ["vtr", "ctr", "retention", "brand_lift", "survey", "event_feedback"];

function percentileTone(value: number) {
  if (value >= 75) return "lime" as const;
  if (value >= 45) return "amber" as const;
  return "coral" as const;
}

function metricShort(metricKey: string) {
  const labels: Record<string, string> = {
    nri: "NRI",
    visual_salience: "Visual",
    narrative_clarity: "Narrativa",
    multimodal_coherence: "Coherencia",
    semantic_load: "Carga",
    social_cueing: "Social",
    scene_immersion: "Escena",
    action_readiness: "Accion",
    temporal_momentum: "Momentum",
  };
  return labels[metricKey] ?? metricKey;
}

function buildDemoNewPieceName() {
  return `Pieza nueva · Hipotecas Q2 · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

function itemVtr(store: BenchmarkStore, item: BenchmarkItem) {
  return store.kpis.find((kpi) => kpi.benchmarkItemId === item.id && kpi.kpiType === "vtr")?.value;
}

function CorrelationChart({ store, benchmarkId, kpiType }: { store: BenchmarkStore; benchmarkId: string; kpiType: KpiType }) {
  const correlation = benchmarkCorrelation(store, benchmarkId, kpiType);
  const maxScore = Math.max(...correlation.points.map((point) => point.score), 100);
  const maxKpi = Math.max(...correlation.points.map((point) => point.kpi), 100);

  return (
    <section className="benchmark-panel">
      <div className="benchmark-panel-head">
        <div>
          <span className="workspace-eyebrow">Score vs KPI real</span>
          <h3>Vista exploratoria de calibracion.</h3>
        </div>
        <Badge tone={correlation.r && correlation.r > 0.45 ? "lime" : "amber"}>r {correlation.r ?? "pendiente"}</Badge>
      </div>
      <div className="correlation-plot" aria-label="Grafica score vs KPI">
        {correlation.points.map((point) => (
          <i
            key={point.itemId}
            title={`${point.assetName}: NRI ${point.score} · ${correlation.label} ${point.kpi}`}
            style={{
              left: `${Math.min(94, Math.max(4, (point.score / maxScore) * 92))}%`,
              bottom: `${Math.min(88, Math.max(8, (point.kpi / maxKpi) * 82))}%`,
            }}
          />
        ))}
      </div>
      <div className="correlation-list">
        {correlation.points.slice(0, 6).map((point) => (
          <div key={point.itemId}>
            <span>{point.assetName}</span>
            <strong>NRI {point.score} · {correlation.label} {point.kpi}%</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BenchmarksPage() {
  const { session } = useAuth();
  const [kpiType, setKpiType] = useState<KpiType>("vtr");
  const [kpiValue, setKpiValue] = useState("71");
  const [kpiSource, setKpiSource] = useState("VTR post-campaign manual");

  if (!session) return null;

  const organizationId = session.organization.id;
  const accessToken = session.accessToken;
  const useApi = session.provider === "supabase" && Boolean(accessToken);
  const { selectedBundle } = useProjectStore(organizationId, session.organization.name);
  const [store, setStore] = useState(() => loadBenchmarkStore(organizationId));
  const [remoteScoringResults, setRemoteScoringResults] = useState<NeuroScoringResult[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [apiError, setApiError] = useState("");
  const benchmarks = store.benchmarks;
  const benchmark = benchmarks[0] ?? createDemoBenchmark(organizationId).benchmarks[0];
  const benchmarkId = benchmark.id;
  const scoringResults = useApi ? remoteScoringResults : loadStoredScoringResults(organizationId);
  const activeResult = scoringResults[0];
  const items = store.items.filter((item) => item.benchmarkId === benchmarkId);
  const latestRunItem = items.find((item) => item.sourceLabel === "run" || item.sourceLabel === "manual");
  const appliedMetrics = useMemo(() => {
    if (activeResult) return applyBenchmark(activeResult, benchmarkId, store);
    if (!latestRunItem) return [];
    const fakeResult = {
      editorialScores: Object.entries(latestRunItem.scores).map(([metricKey, score]) => ({
        metricKey,
        metricLabel: metricShort(metricKey),
        score,
      })),
    };
    return fakeResult.editorialScores.map((score) => {
      const values = items.filter((item) => item.id !== latestRunItem.id).map((item) => item.scores[score.metricKey as keyof typeof item.scores]).filter((value): value is number => typeof value === "number");
      const mean = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
      const below = values.filter((value) => value <= Number(score.score)).length;
      return { metricKey: score.metricKey, metricLabel: score.metricLabel, score: Number(score.score), mean, percentile: values.length ? Math.round((below / values.length) * 100) : 0, delta: Math.round((Number(score.score) - mean) * 10) / 10, sampleSize: values.length };
    });
  }, [activeResult, benchmarkId, items, latestRunItem, store]);
  const selectedKpiItem = latestRunItem ?? items[0];

  useEffect(() => {
    if (!useApi || !accessToken) return;
    let cancelled = false;
    setIsLoadingApi(true);
    setApiError("");
    const scoringPromise = selectedBundle?.experiment.id
      ? loadScoringResultsFromApi(selectedBundle.experiment.id, accessToken)
      : Promise.resolve([]);
    Promise.all([
      loadBenchmarkStoreFromApi(organizationId, accessToken),
      scoringPromise,
    ])
      .then(([nextStore, nextScoring]) => {
        if (cancelled) return;
        setStore(nextStore);
        setRemoteScoringResults(nextScoring);
      })
      .catch((caught) => {
        if (!cancelled) setApiError(caught instanceof Error ? caught.message : "No se pudo cargar benchmarks desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, organizationId, selectedBundle?.experiment.id, useApi]);

  function refresh(next: BenchmarkStore) {
    setStore(next);
  }

  async function handleCreateDemo() {
    if (useApi && accessToken) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        refresh(await createDemoBenchmarkInApi(organizationId, accessToken));
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo crear benchmark demo en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    refresh(createDemoBenchmark(organizationId));
  }

  async function handleAssignNewPiece() {
    if (useApi && accessToken) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        refresh(activeResult
          ? await addRunToBenchmarkInApi(organizationId, benchmarkId, activeResult, accessToken)
          : await addManualBenchmarkItemInApi(organizationId, benchmarkId, buildDemoNewPieceName(), {
            nri: 74,
            visual_salience: 79,
            narrative_clarity: 72,
            multimodal_coherence: 76,
            action_readiness: 78,
            social_cueing: 68,
            temporal_momentum: 71,
          }, accessToken));
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo asignar la pieza en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    if (activeResult) {
      refresh(addRunToBenchmark(organizationId, benchmarkId, activeResult));
      return;
    }
    refresh(addManualBenchmarkItem(organizationId, benchmarkId, buildDemoNewPieceName(), {
      nri: 74,
      visual_salience: 79,
      narrative_clarity: 72,
      multimodal_coherence: 76,
      action_readiness: 78,
      social_cueing: 68,
      temporal_momentum: 71,
    }));
  }

  async function handleImportKpi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKpiItem) return;
    if (useApi && accessToken) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        refresh(await addExternalKpiInApi(organizationId, {
          benchmarkId,
          benchmarkItemId: selectedKpiItem.id,
          kpiType,
          value: Number(kpiValue),
          unit: "%",
          source: kpiSource,
          period: "Q2",
          notes: "Import manual Sprint 21 via API.",
        }, accessToken));
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo importar KPI en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    refresh(addExternalKpi(organizationId, {
      benchmarkId,
      benchmarkItemId: selectedKpiItem.id,
      kpiType,
      value: Number(kpiValue),
      unit: "%",
      source: kpiSource,
      period: "Q2",
      notes: "Import manual Sprint 15.",
    }));
  }

  return (
    <AppShell active="benchmarks">
      <section className="benchmark-hero">
        <div>
          <span className="workspace-eyebrow">Sprint 15 · Benchmarks y KPIs</span>
          <h2>El moat empieza cuando el cliente compara contra su propio historico.</h2>
          <p>{selectedBundle ? `${selectedBundle.project.brand} / ${selectedBundle.project.campaign}` : "Benchmark privado por categoria, percentiles e import manual de KPIs reales."}</p>
        </div>
        <div className="result-hero-actions">
          <Button variant="secondary" icon={<Database size={15} />} onClick={handleCreateDemo}>Crear benchmark demo</Button>
          <Button icon={<Plus size={15} />} onClick={handleAssignNewPiece} disabled={isLoadingApi}>Asignar pieza nueva</Button>
        </div>
      </section>

      {apiError ? <p className="form-error">{apiError}</p> : null}

      <section className="benchmark-stat-grid">
        <article><span>Benchmark</span><strong>{benchmark.name}</strong><em>{benchmark.sector} · {benchmark.channel} · {benchmark.durationLabel}</em></article>
        <article><span>Muestra</span><strong>{items.length}</strong><em>piezas internas</em></article>
        <article><span>KPIs</span><strong>{store.kpis.filter((kpi) => kpi.benchmarkId === benchmarkId).length}</strong><em>resultados reales</em></article>
        <article><span>Aplicado</span><strong>{appliedMetrics[0]?.percentile ?? "-"}</strong><em>percentil NRI</em></article>
      </section>

      <section className="benchmark-layout">
        <div className="benchmark-main">
          <section className="benchmark-panel">
            <div className="benchmark-panel-head">
              <div>
                <span className="workspace-eyebrow">Pieza nueva vs benchmark</span>
                <h3>Score absoluto convertido en percentil interno.</h3>
              </div>
              <Badge tone="amber">{benchmark.category}</Badge>
            </div>
            <div className="benchmark-percentile-grid">
              {appliedMetrics.slice(0, 6).map((metric) => (
                <article key={metric.metricKey}>
                  <Badge tone={percentileTone(metric.percentile)}>P{metric.percentile}</Badge>
                  <span>{metric.metricLabel}</span>
                  <strong>{metric.score}</strong>
                  <div className="benchmark-bar"><i style={{ width: `${metric.percentile}%` }} /></div>
                  <em>Media {metric.mean} · delta {metric.delta >= 0 ? "+" : ""}{metric.delta} · n={metric.sampleSize}</em>
                </article>
              ))}
            </div>
          </section>

          <section className="benchmark-panel">
            <div className="benchmark-panel-head">
              <div>
                <span className="workspace-eyebrow">Items del benchmark</span>
                <h3>Categoria privada Banca / CTV / 30s.</h3>
              </div>
              <Badge tone="muted">cliente</Badge>
            </div>
            <div className="benchmark-table">
              <div className="benchmark-table-head"><span>Asset</span><span>NRI</span><span>Visual</span><span>Accion</span><span>VTR</span></div>
              {items.map((item) => (
                <div className="benchmark-table-row" key={item.id}>
                  <strong>{item.assetName}</strong>
                  <span>{item.scores.nri ?? "-"}</span>
                  <span>{item.scores.visual_salience ?? "-"}</span>
                  <span>{item.scores.action_readiness ?? "-"}</span>
                  <Badge tone={itemVtr(store, item) ? "lime" : "muted"}>{itemVtr(store, item) ? `${itemVtr(store, item)}%` : "sin KPI"}</Badge>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="benchmark-side">
          <section className="benchmark-panel">
            <div className="benchmark-panel-head">
              <div>
                <span className="workspace-eyebrow">Import KPI</span>
                <h3>Resultado real posterior.</h3>
              </div>
              <Target size={18} />
            </div>
            <form className="benchmark-kpi-form" onSubmit={handleImportKpi}>
              <label className="field">
                <span className="field-label">KPI</span>
                <select className="input" value={kpiType} onChange={(event) => setKpiType(event.target.value as KpiType)}>
                  {kpiOptions.map((item) => <option key={item} value={item}>{kpiLabels[item]}</option>)}
                </select>
              </label>
              <Input label="Valor" value={kpiValue} onChange={(event) => setKpiValue(event.target.value)} />
              <Input label="Fuente" value={kpiSource} onChange={(event) => setKpiSource(event.target.value)} />
              <Button icon={<TrendingUp size={15} />}>Importar KPI</Button>
            </form>
            <p className="benchmark-note">Demo Sprint 15: asigna la pieza nueva y registra VTR real manual para empezar a calibrar.</p>
          </section>

          <CorrelationChart store={store} benchmarkId={benchmarkId} kpiType={kpiType} />

          <section className="benchmark-panel">
            <div className="benchmark-panel-head">
              <div>
                <span className="workspace-eyebrow">Reporting</span>
                <h3>Informe con percentiles.</h3>
              </div>
              <FileText size={18} />
            </div>
            <div className="benchmark-export-actions">
              <Button icon={<Download size={15} />} onClick={() => exportBenchmarkPdf(store, benchmarkId, activeResult)}>PDF</Button>
              <Button variant="secondary" icon={<FileJson size={15} />} onClick={() => exportBenchmarkJson(store, benchmarkId, activeResult)}>JSON</Button>
              <Button variant="ghost" icon={<BarChart3 size={15} />} onClick={() => exportBenchmarkCsv(store, benchmarkId)}>CSV</Button>
            </div>
          </section>
        </aside>
      </section>

      <section className="benchmark-footer-note">
        <Gauge size={15} />
        <span>Lectura: los percentiles son internos por categoria. Sirven para aprendizaje de marca, no para prometer causalidad ni resultado de negocio.</span>
      </section>
    </AppShell>
  );
}
