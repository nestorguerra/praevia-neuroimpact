import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  GitCompare,
  Layers3,
  Medal,
  PlayCircle,
  Route,
  Scissors,
  Sparkles,
  TimerReset,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button, LinkButton } from "../components/ui";
import { createComparisonInApi, loadComparisonsFromApi } from "../comparison/apiComparisonStore";
import { buildComparisonReport } from "../comparison/generateComparison";
import { exportComparisonCsv, exportComparisonJson, exportComparisonPdf } from "../comparison/exportComparison";
import { loadStoredComparisons, upsertStoredComparison } from "../comparison/localComparisonStore";
import type { ComparisonReport, ComparisonVersion, MixSegment } from "../comparison/types";
import { useProjectStore } from "../projects/useProjectStore";
import { loadScoringResultsFromApi } from "../scoring/apiScoringStore";
import { loadStoredScoringResults } from "../scoring/localScoringStore";
import type { NeuroScoringResult } from "../scoring/types";
import { loadAssetsFromApi } from "../uploads/apiAssetStore";
import { loadStoredAssets } from "../uploads/localAssetStore";
import type { UploadAsset, AssetSlot } from "../uploads/types";

const slotLabels: Record<AssetSlot, string> = {
  A: "Version A",
  B: "Version B",
  C: "Version C",
};

function slotTone(slot: AssetSlot) {
  if (slot === "A") return "amber" as const;
  if (slot === "B") return "cyan" as const;
  return "violet" as const;
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

function slotClass(slot: AssetSlot) {
  return `slot-${slot.toLowerCase()}`;
}

function WinnerCard({ version, isMaster }: { version: ComparisonVersion; isMaster: boolean }) {
  const visual = version.result.editorialScores.find((score) => score.metricKey === "visual_salience")?.score ?? 0;
  const narrative = version.result.editorialScores.find((score) => score.metricKey === "narrative_clarity")?.score ?? 0;
  const action = version.result.editorialScores.find((score) => score.metricKey === "action_readiness")?.score ?? 0;

  return (
    <article className={`comparison-version-card ${slotClass(version.slot)} ${isMaster ? "master" : ""}`}>
      <div className="comparison-version-top">
        <Badge tone={slotTone(version.slot)}>{slotLabels[version.slot]}</Badge>
        <Badge tone={isMaster ? "amber" : "muted"}>{isMaster ? "Master" : `Rank ${version.rank}`}</Badge>
      </div>
      <h3>{version.result.assetName}</h3>
      {version.pipelineMode || version.runStatus ? (
        <p className="comparison-trace">
          {version.pipelineMode ?? "pipeline"} · {version.runStatus ?? "run"} · {version.nTimesteps ?? "-"} TR
        </p>
      ) : null}
      <div className="comparison-nri">
        <span>NRI</span>
        <strong>{version.nri}</strong>
        <em>{version.globalDelta === 0 ? "Ganador global" : `${version.globalDelta} vs master`}</em>
      </div>
      <div className="comparison-mini-scores">
        <div><span>Visual</span><strong>{visual}</strong></div>
        <div><span>Narr.</span><strong>{narrative}</strong></div>
        <div><span>Accion</span><strong>{action}</strong></div>
      </div>
    </article>
  );
}

function MixRow({ segment }: { segment: MixSegment }) {
  return (
    <article className="mix-row">
      <Badge tone={slotTone(segment.sourceSlot)}>{segment.sourceSlot}</Badge>
      <div>
        <span>{segment.timecode} · {segment.label}</span>
        <strong>{segment.action}</strong>
        <em>{segment.reason}{segment.impact ? ` · Impacto ${segment.impact}` : ""}</em>
      </div>
    </article>
  );
}

function ComparisonTimeline({ comparison }: { comparison: ComparisonReport }) {
  return (
    <section className="comparison-timeline-panel">
      <div className="comparison-section-head">
        <div>
          <span className="workspace-eyebrow">Timeline comparado</span>
          <h3>Ganador por tramo, no solo ganador global.</h3>
        </div>
        <div className="timeline-mini-legend">
          <Badge tone="amber" dot>A</Badge>
          <Badge tone="cyan" dot>B</Badge>
          <Badge tone="violet" dot>C</Badge>
        </div>
      </div>
      <div className="comparison-timeline-grid">
        {comparison.timepoints.map((point) => (
          <div className="comparison-timepoint" key={point.pointIndex}>
            <span>{point.timecode}</span>
            <div className="comparison-point-bars">
              {comparison.versions.map((version) => (
                <i
                  key={version.slot}
                  className={slotClass(version.slot)}
                  style={{ height: `${Math.max(8, point.values[version.slot] ?? 0)}px` }}
                  title={`${version.slot}: ${point.values[version.slot] ?? "-"}`}
                />
              ))}
            </div>
            <Badge tone={slotTone(point.winnerSlot)}>{point.winnerSlot}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricDeltaTable({ comparison }: { comparison: ComparisonReport }) {
  return (
    <section className="comparison-table-card">
      <div className="comparison-section-head">
        <div>
          <span className="workspace-eyebrow">Deltas por metrica</span>
          <h3>Quien gana cada capa.</h3>
        </div>
        <Badge tone="muted">A/B/C</Badge>
      </div>
      <div className="metric-delta-table">
        {comparison.metricDeltas.map((metric) => (
          <div key={metric.metricKey}>
            <span>{metricShort(metric.metricKey)}</span>
            {comparison.versions.map((version) => (
              <strong key={version.slot} className={metric.winnerSlot === version.slot ? slotClass(version.slot) : ""}>
                {version.slot} {metric.values[version.slot] ?? "-"}
              </strong>
            ))}
            <Badge tone={slotTone(metric.winnerSlot)}>Gana {metric.winnerSlot}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComparabilityPanel({ comparison }: { comparison: ComparisonReport }) {
  return (
    <section className="comparison-qa-panel">
      {comparison.comparability.map((issue) => (
        <article key={issue.label}>
          <Badge tone={issue.severity === "ok" ? "lime" : issue.severity === "warning" ? "amber" : "coral"}>{issue.severity}</Badge>
          <div>
            <strong>{issue.label}</strong>
            <span>{issue.detail}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function EmptyComparison({ experimentId }: { experimentId?: string }) {
  return (
    <section className="result-empty-state">
      <GitCompare size={24} />
      <h3>Todavia no hay comparativa A/B/C.</h3>
      <p>Necesitas al menos dos versiones con scoring. Para la demo comercial ideal, sube tres assets A/B/C, prepara TRIBE, calcula scoring y vuelve aqui.</p>
      <LinkButton href={experimentId ? `/app/upload?experimentId=${experimentId}` : "/app/upload"} icon={<ArrowUpRight size={15} />}>Preparar versiones</LinkButton>
    </section>
  );
}

export function ComparisonPage() {
  const { session } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [remoteResults, setRemoteResults] = useState<NeuroScoringResult[]>([]);
  const [remoteAssets, setRemoteAssets] = useState<UploadAsset[]>([]);
  const [remoteComparisons, setRemoteComparisons] = useState<ComparisonReport[]>([]);
  const [apiError, setApiError] = useState("");
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  if (!session) return null;

  const organizationId = session.organization.id;
  const accessToken = session.accessToken;
  const useApi = session.provider === "supabase" && Boolean(accessToken);
  const query = new URLSearchParams(window.location.search);
  const queryExperimentId = query.get("experimentId");
  const { state, selectedBundle } = useProjectStore(organizationId, session.organization.name);
  const localResults = loadStoredScoringResults(organizationId);
  const localAssets = loadStoredAssets(organizationId) as UploadAsset[];
  const allResults = useApi ? remoteResults : localResults;
  const allAssets = useApi ? remoteAssets : localAssets;
  const storedComparisons = useApi ? remoteComparisons : loadStoredComparisons(organizationId);
  const experimentWithResults = state.experiments.find((experiment) => allResults.filter((result) => result.experimentId === experiment.id).length >= 2)
    ?? state.experiments.find((experiment) => localResults.filter((result) => result.experimentId === experiment.id).length >= 2);
  const experimentId = queryExperimentId ?? experimentWithResults?.id ?? selectedBundle?.experiment.id ?? state.experiments[0]?.id;
  const activeBundle = useMemo(() => {
    const experiment = state.experiments.find((item) => item.id === experimentId);
    if (!experiment) return selectedBundle;
    const project = state.projects.find((item) => item.id === experiment.projectId);
    const workspace = state.workspaces.find((item) => item.id === experiment.workspaceId);
    return project && workspace ? { project, experiment, workspace } : selectedBundle;
  }, [experimentId, selectedBundle, state.experiments, state.projects, state.workspaces]);
  const results = allResults
    .filter((result) => result.experimentId === experimentId)
    .sort((a, b) => {
      const slotA = allAssets.find((asset) => asset.id === a.assetId)?.slot ?? "A";
      const slotB = allAssets.find((asset) => asset.id === b.assetId)?.slot ?? "A";
      return slotA.localeCompare(slotB);
    });
  const stored = storedComparisons.find((comparison) => comparison.experimentId === experimentId);
  const comparison = stored ?? buildComparisonReport(results, allAssets, organizationId, experimentId ?? "no-experiment");

  useEffect(() => {
    if (!useApi || !accessToken || !experimentId) return;
    let cancelled = false;
    setIsLoadingApi(true);
    setApiError("");
    Promise.all([
      loadScoringResultsFromApi(experimentId, accessToken),
      loadAssetsFromApi(experimentId, accessToken),
    ])
      .then(async ([nextResults, nextAssets]) => {
        const nextComparisons = await loadComparisonsFromApi(experimentId, accessToken, nextResults);
        if (cancelled) return;
        setRemoteResults(nextResults);
        setRemoteAssets(nextAssets);
        setRemoteComparisons(nextComparisons);
      })
      .catch((caught) => {
        if (!cancelled) setApiError(caught instanceof Error ? caught.message : "No se pudo cargar la comparativa desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, experimentId, useApi]);

  async function handleGenerate() {
    if (useApi && accessToken && experimentId) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        const next = await createComparisonInApi(organizationId, experimentId, results, allAssets, accessToken);
        if (next) setRemoteComparisons((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo generar la comparativa en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    const next = buildComparisonReport(results, allAssets, organizationId, experimentId ?? "no-experiment");
    if (!next) return;
    upsertStoredComparison(organizationId, next);
    setRefreshKey((value) => value + 1);
  }

  void refreshKey;

  return (
    <AppShell active="comparisons">
      <section className="comparison-hero">
        <div>
          <span className="workspace-eyebrow">Comparativa A/B/C real</span>
          <h2>Elige master. Roba los mejores tramos. Recorta el valle.</h2>
          <p>{activeBundle ? `${activeBundle.project.brand} / ${activeBundle.project.campaign} · ${activeBundle.experiment.name}` : "Caso estrella comercial: ranking, timeline comparado y mix recomendado."}</p>
        </div>
        <div className="result-hero-actions">
          <LinkButton href={experimentId ? `/app/upload?experimentId=${experimentId}` : "/app/upload"} variant="secondary" icon={<PlayCircle size={15} />}>Volver al run</LinkButton>
          <LinkButton href={experimentId ? `/app/workflow?experimentId=${experimentId}` : "/app/workflow"} variant="secondary" icon={<Route size={15} />}>Abrir workflow</LinkButton>
          <Button icon={<GitCompare size={15} />} disabled={results.length < 2 || isLoadingApi} onClick={handleGenerate}>{comparison ? "Regenerar mix" : "Generar comparativa"}</Button>
        </div>
      </section>

      {apiError ? <p className="form-error">{apiError}</p> : null}

      {!comparison ? (
        <EmptyComparison experimentId={experimentId} />
      ) : (
        <>
          <section className="comparison-decision">
            <div>
              <span className="workspace-eyebrow">Decision defendible</span>
              <h2>{comparison.decision}</h2>
              <p>La version ganadora no lo tiene que ganar todo. La recomendacion separa master, donantes de tramo y recorte accionable.</p>
            </div>
            <div className="comparison-decision-meta">
              <div><span>Master</span><strong>{comparison.masterSlot}</strong></div>
              <div><span>Versiones</span><strong>{comparison.versions.length}</strong></div>
              <div><span>Estado</span><strong>{comparison.status}</strong></div>
              <div><span>Origen</span><strong>{String(comparison.reportPayload.source ?? (useApi ? "API" : "local"))}</strong></div>
            </div>
          </section>

          <section className="comparison-version-grid">
            {comparison.versions.map((version) => (
              <WinnerCard key={version.result.id} version={version} isMaster={version.slot === comparison.masterSlot} />
            ))}
          </section>

          <section className="comparison-layout">
            <div className="comparison-main">
              <ComparisonTimeline comparison={comparison} />
              <MetricDeltaTable comparison={comparison} />
            </div>
            <aside className="comparison-side">
              <section className="comparison-table-card">
                <div className="comparison-section-head">
                  <div>
                    <span className="workspace-eyebrow">Mix recomendado</span>
                    <h3>Master + donantes + recorte.</h3>
                  </div>
                  <Badge tone="amber"><Scissors size={13} /> Edit</Badge>
                </div>
                <div className="mix-list">
                  {comparison.mix.map((segment) => <MixRow key={segment.id} segment={segment} />)}
                </div>
              </section>

              <section className="comparison-table-card">
                <div className="comparison-section-head">
                  <div>
                    <span className="workspace-eyebrow">Informe A/B/C</span>
                    <h3>Export comercial.</h3>
                  </div>
                  <Badge tone="lime"><CheckCircle2 size={13} /> Ready</Badge>
                </div>
                <div className="comparison-export-actions">
                  <Button icon={<Download size={15} />} onClick={() => exportComparisonPdf(comparison)}>PDF A/B/C</Button>
                  <Button variant="secondary" icon={<FileJson size={15} />} onClick={() => exportComparisonJson(comparison)}>JSON</Button>
                  <Button variant="ghost" icon={<FileText size={15} />} onClick={() => exportComparisonCsv(comparison)}>CSV</Button>
                </div>
              </section>

              <ComparabilityPanel comparison={comparison} />
            </aside>
          </section>

          <section className="comparison-winners">
            <article><Trophy size={16} /><span>Ganador global</span><strong>Version {comparison.masterSlot}</strong></article>
            <article><Layers3 size={16} /><span>Ganadores por modalidad</span><strong>{Object.entries(comparison.winnerByModality).filter(([, slot]) => Boolean(slot)).slice(0, 4).map(([key, slot]) => `${key} ${slot}`).join(" · ") || comparison.metricDeltas.filter((metric) => ["visual_salience", "narrative_clarity", "action_readiness"].includes(metric.metricKey)).map((metric) => `${metricShort(metric.metricKey)} ${metric.winnerSlot}`).join(" · ")}</strong></article>
            <article><TimerReset size={16} /><span>Ganador por tramo</span><strong>{comparison.timepoints.slice(0, 4).map((point) => `${point.timecode}/${point.winnerSlot}${point.margin ? ` +${point.margin}` : ""}`).join(" · ")}</strong></article>
            <article><Medal size={16} /><span>Criterio comercial</span><strong>Decision lista para comite</strong></article>
          </section>
        </>
      )}
    </AppShell>
  );
}
