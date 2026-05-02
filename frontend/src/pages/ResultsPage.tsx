import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileJson,
  FileText,
  Gauge,
  Layers3,
  Map,
  MousePointer2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Table2,
  TimerReset,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button, LinkButton } from "../components/ui";
import { loadAnalysisRunsFromApi } from "../inference/apiInferenceStore";
import { loadStoredAnalysisRuns } from "../inference/localInferenceStore";
import type { AnalysisRun } from "../inference/types";
import { useProjectStore } from "../projects/useProjectStore";
import { generateReportFromResult } from "../reporting/generateReport";
import { buildReportHtml, downloadReportHtml } from "../reporting/htmlReport";
import { loadStoredReports, upsertStoredReport } from "../reporting/localReportStore";
import { downloadReportPdf } from "../reporting/pdfReport";
import type { ReportRecord } from "../reporting/types";
import { loadScoringResultsFromApi } from "../scoring/apiScoringStore";
import { loadStoredScoringResults } from "../scoring/localScoringStore";
import type { EditorialScore, NetworkScore, NeuroScoringResult, PeakMoment, RegionScore, TimecoursePoint } from "../scoring/types";
import { loadAssetsFromApi } from "../uploads/apiAssetStore";
import { loadStoredAssets } from "../uploads/localAssetStore";
import type { UploadAsset } from "../uploads/types";

type ResultTab = "resumen" | "timeline" | "modalidades" | "recomendaciones" | "informe";

const tabs: { key: ResultTab; label: string; icon: typeof BarChart3 }[] = [
  { key: "resumen", label: "Resumen", icon: BarChart3 },
  { key: "timeline", label: "Timeline", icon: TimerReset },
  { key: "modalidades", label: "Modalidades", icon: Layers3 },
  { key: "recomendaciones", label: "Recomendaciones", icon: Sparkles },
  { key: "informe", label: "Informe", icon: FileText },
];

const metricLabels: Record<string, string> = {
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

const layerMap: Record<string, { layer: string; description: string; action: string }> = {
  visual: {
    layer: "Video",
    description: "Lectura de saliencia visual, escena y ritmo de imagen.",
    action: "Refuerza planos utiles y evita tramos visualmente planos.",
  },
  auditory: {
    layer: "Audio",
    description: "Lectura de procesamiento auditivo y soporte sonoro.",
    action: "Alinea locucion, silencio y acento sonoro con cambios visuales.",
  },
  language: {
    layer: "Texto",
    description: "Lectura de carga semantica y estructura verbal.",
    action: "Simplifica frases largas y separa conceptos cuando el score caiga.",
  },
  social: {
    layer: "Social",
    description: "Senales compatibles con interaccion, persona o contexto social.",
    action: "Usa rostro, gesto o situacion humana cuando el tramo necesite anclaje.",
  },
  control: {
    layer: "Narrativa",
    description: "Control narrativo y continuidad del mensaje.",
    action: "Ordena causa, beneficio y cierre para bajar friccion cognitiva.",
  },
  motor: {
    layer: "Accion",
    description: "Proximidad a cierre, CTA o disposicion a accion.",
    action: "Acerca el CTA al pico temporal o refuerza packshot/gesto final.",
  },
};

function toneFor(score: number) {
  if (score >= 74) return "lime" as const;
  if (score >= 55) return "amber" as const;
  return "coral" as const;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.round(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function metricShort(score: EditorialScore) {
  return metricLabels[score.metricKey] ?? score.metricLabel;
}

function strongestScore(result: NeuroScoringResult) {
  return [...result.editorialScores].sort((a, b) => b.score - a.score)[0];
}

function weakestScore(result: NeuroScoringResult) {
  return [...result.editorialScores].sort((a, b) => a.score - b.score)[0];
}

function momentLabel(moment: PeakMoment) {
  if (moment.momentType === "peak") return "Peak";
  if (moment.momentType === "valley") return "Valley";
  return "Flat";
}

function buildDecision(result: NeuroScoringResult) {
  const weak = weakestScore(result);
  const peak = result.peakMoments.find((moment) => moment.momentType === "peak");
  const valley = result.peakMoments.find((moment) => moment.momentType === "valley");

  if (result.summary.nri >= 72) {
    return {
      label: "Avanzar con ajustes",
      text: `Usar esta pieza como base de iteracion. Mantener el tramo fuerte ${peak ? `${formatTime(peak.startSeconds)}-${formatTime(peak.endSeconds)}` : "principal"} y corregir ${metricShort(weak).toLowerCase()} antes de informe final.`,
    };
  }

  if (result.summary.nri >= 55) {
    return {
      label: "Revisar montaje",
      text: `No cambiar toda la pieza: revisar el tramo debil ${valley ? `${formatTime(valley.startSeconds)}-${formatTime(valley.endSeconds)}` : "inicial"} y reforzar ${metricShort(weak).toLowerCase()} con una accion editorial concreta.`,
    };
  }

  return {
    label: "No usar como master",
    text: `La pieza necesita nueva iteracion antes de circular. Prioridad: corregir ${metricShort(weak).toLowerCase()} y reanalizar contra benchmark interno.`,
  };
}

function buildRecommendations(result: NeuroScoringResult) {
  const weakScores = [...result.editorialScores].sort((a, b) => a.score - b.score).slice(0, 2);
  const momentRows = result.peakMoments.map((moment) => ({
    id: `${moment.momentType}-${moment.startSeconds}`,
    timecode: `${formatTime(moment.startSeconds)}-${formatTime(moment.endSeconds)}`,
    layer: moment.momentType === "peak" ? "Ritmo" : moment.momentType === "valley" ? "Montaje" : "Narrativa",
    action: moment.action,
    confidence: result.confidenceLabel,
    impact: moment.momentType === "peak" ? "Alto" : "Medio",
  }));
  const scoreRows = weakScores.map((score) => ({
    id: score.metricKey,
    timecode: "Global",
    layer: metricShort(score),
    action: score.action,
    confidence: result.confidenceLabel,
    impact: score.score < 55 ? "Alto" : "Medio",
  }));
  return [...momentRows, ...scoreRows].slice(0, 5);
}

function modalityRows(result: NeuroScoringResult) {
  return result.networkScores.map((network) => {
    const meta = layerMap[network.networkKey] ?? {
      layer: network.networkLabel,
      description: network.evidence,
      action: "Revisar score contra benchmark interno.",
    };
    return { ...network, ...meta };
  });
}

function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number) {
  return `"${String(value).replaceAll("\"", "\"\"")}"`;
}

function exportCsv(result: NeuroScoringResult) {
  const rows = [
    ["section", "key", "label", "score", "confidence", "evidence", "action"],
    ...result.editorialScores.map((score) => [
      "editorial_score",
      score.metricKey,
      score.metricLabel,
      score.score,
      score.confidence,
      score.evidence,
      score.action,
    ]),
    ...result.networkScores.map((network) => [
      "network_score",
      network.networkKey,
      network.networkLabel,
      network.score,
      network.confidence,
      network.evidence,
      "",
    ]),
    ...buildRecommendations(result).map((row) => [
      "recommendation",
      row.timecode,
      row.layer,
      "",
      row.confidence,
      row.impact,
      row.action,
    ]),
  ];
  downloadText(`${result.assetName}-dashboard.csv`, "text/csv;charset=utf-8", rows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

function exportJson(result: NeuroScoringResult) {
  downloadText(`${result.assetName}-dashboard.json`, "application/json;charset=utf-8", JSON.stringify(result, null, 2));
}

function ResultSelector({
  results,
  activeResult,
  onSelect,
}: {
  results: NeuroScoringResult[];
  activeResult?: NeuroScoringResult;
  onSelect: (resultId: string) => void;
}) {
  if (results.length <= 1) return null;
  return (
    <div className="result-selector" aria-label="Seleccion de resultado">
      {results.map((result) => (
        <button
          type="button"
          key={result.id}
          className={activeResult?.id === result.id ? "active" : ""}
          onClick={() => onSelect(result.id)}
        >
          <span>{result.assetName}</span>
          <strong>NRI {result.summary.nri}</strong>
        </button>
      ))}
    </div>
  );
}

function DecisionHero({ result }: { result: NeuroScoringResult }) {
  const decision = buildDecision(result);
  const strong = strongestScore(result);
  const weak = weakestScore(result);

  return (
    <section className="result-decision">
      <div>
        <span className="workspace-eyebrow">Decision recomendada</span>
        <h2>{decision.label}</h2>
        <p>{decision.text}</p>
      </div>
      <div className="decision-evidence">
        <div><span>NRI</span><strong>{result.summary.nri}</strong></div>
        <div><span>Fuerte</span><strong>{metricShort(strong)} {strong.score}</strong></div>
        <div><span>Debil</span><strong>{metricShort(weak)} {weak.score}</strong></div>
        <div><span>Confianza</span><strong>{result.confidenceLabel}</strong></div>
      </div>
    </section>
  );
}

function ScoreGrid({ result }: { result: NeuroScoringResult }) {
  return (
    <section className="result-score-grid">
      {result.editorialScores.map((score) => (
        <article className="result-score-card" key={score.metricKey}>
          <div>
            <span>{metricShort(score)}</span>
            <Badge tone={toneFor(score.score)}>{score.score}</Badge>
          </div>
          <strong>{score.metricLabel}</strong>
          <div className="result-score-bar"><span style={{ width: `${score.score}%` }} /></div>
          <p>{score.action}</p>
          <small>CONF {score.confidence.toFixed(2)} · BENCH {score.benchmarkDelta >= 0 ? "+" : ""}{score.benchmarkDelta}%</small>
        </article>
      ))}
    </section>
  );
}

function InteractiveTimeline({
  result,
  selectedPoint,
  onSelectPoint,
}: {
  result: NeuroScoringResult;
  selectedPoint: TimecoursePoint;
  onSelectPoint: (point: TimecoursePoint) => void;
}) {
  const peak = result.peakMoments.find((moment) => moment.momentType === "peak");
  const valley = result.peakMoments.find((moment) => moment.momentType === "valley");

  return (
    <section className="result-timeline-panel">
      <div className="result-panel-head">
        <div>
          <span className="workspace-eyebrow">Timeline accionable</span>
          <h3>Respuesta temporal corregida a tiempo de estimulo.</h3>
        </div>
        <div className="timeline-mini-legend">
          <Badge tone="lime" dot>Peak</Badge>
          <Badge tone="coral" dot>Valley</Badge>
          <Badge tone="cyan" dot>Neutral</Badge>
        </div>
      </div>

      <div className="result-timeline-chart" role="list" aria-label="Puntos temporales del analisis">
        {result.timecoursePoints.map((point) => (
          <button
            type="button"
            role="listitem"
            key={point.pointIndex}
            className={`result-timeline-point ${point.eventLabel ?? ""} ${selectedPoint.pointIndex === point.pointIndex ? "active" : ""}`}
            onClick={() => onSelectPoint(point)}
            title={`${formatTime(point.stimulusTimeSeconds)} · ${point.normalizedResponse}`}
          >
            <span style={{ height: `${Math.max(10, point.normalizedResponse)}px` }} />
            <em>{formatTime(point.stimulusTimeSeconds)}</em>
          </button>
        ))}
      </div>

      <div className="selected-timecode">
        <div>
          <span><Clock3 size={15} /> Timecode</span>
          <strong>{formatTime(selectedPoint.stimulusTimeSeconds)}</strong>
        </div>
        <div>
          <span><Activity size={15} /> Respuesta</span>
          <strong>{selectedPoint.normalizedResponse}</strong>
        </div>
        <div>
          <span><TimerReset size={15} /> BOLD</span>
          <strong>{formatTime(selectedPoint.boldTimeSeconds)}</strong>
        </div>
        <p>
          {selectedPoint.eventLabel === "peak"
            ? "Tramo de mayor respuesta relativa. Conviene revisar que coincida con claim, imagen clave o cierre."
            : selectedPoint.eventLabel === "valley"
              ? "Tramo de baja respuesta relativa. Conviene reforzar entrada, contraste o claridad."
              : "Tramo neutral. Usalo para mantener continuidad sin cargar la pieza."}
        </p>
      </div>

      <div className="timeline-anchor-grid">
        <div><Badge tone="lime">Peak</Badge><strong>{peak ? `${formatTime(peak.startSeconds)}-${formatTime(peak.endSeconds)}` : "Sin pico"}</strong></div>
        <div><Badge tone="coral">Valley</Badge><strong>{valley ? `${formatTime(valley.startSeconds)}-${formatTime(valley.endSeconds)}` : "Sin valle"}</strong></div>
      </div>
    </section>
  );
}

function ModalityTable({ result }: { result: NeuroScoringResult }) {
  return (
    <section className="result-table-card">
      <div className="result-panel-head">
        <div>
          <span className="workspace-eyebrow">Diagnostico por modalidad</span>
          <h3>Que aporta cada capa al resultado.</h3>
        </div>
        <Badge tone="muted">V0.1</Badge>
      </div>
      <div className="modality-table">
        {modalityRows(result).map((row) => (
          <div key={row.networkKey}>
            <span>{row.layer}</span>
            <strong>{row.score}</strong>
            <p>{row.description}</p>
            <em>{row.action}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function RegionNetworkTable({ regions, networks }: { regions: RegionScore[]; networks: NetworkScore[] }) {
  return (
    <section className="region-network-grid">
      <article className="result-table-card">
        <h3><Waves size={16} /> Redes funcionales</h3>
        {networks.map((network) => (
          <div className="result-data-row" key={network.networkKey}>
            <span>{network.networkLabel}</span>
            <strong>{network.score}</strong>
          </div>
        ))}
      </article>
      <article className="result-table-card">
        <h3><Map size={16} /> Regiones / ROIs</h3>
        {regions.map((region) => (
          <div className="result-data-row" key={region.regionKey}>
            <span>{region.regionLabel}</span>
            <strong>{region.score}</strong>
          </div>
        ))}
      </article>
    </section>
  );
}

function RecommendationList({ result }: { result: NeuroScoringResult }) {
  const rows = buildRecommendations(result);
  return (
    <section className="recommendation-panel">
      <div className="result-panel-head">
        <div>
          <span className="workspace-eyebrow">Maximo cinco acciones</span>
          <h3>Recomendaciones priorizadas por timecode.</h3>
        </div>
        <Badge tone="amber">Accion editorial</Badge>
      </div>
      <div className="recommendation-table">
        {rows.map((row, index) => (
          <article key={row.id}>
            <Badge tone={index === 0 ? "amber" : row.impact === "Alto" ? "coral" : "muted"}>{String(index + 1).padStart(2, "0")}</Badge>
            <div>
              <span>{row.timecode} · {row.layer} · CONF {row.confidence}</span>
              <strong>{row.action}</strong>
              <em>Impacto estimado: {row.impact}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function exportReportJson(report: ReportRecord) {
  downloadText(`${report.assetName}-report.json`, "application/json;charset=utf-8", JSON.stringify(report, null, 2));
}

function ReportExportPanel({
  result,
  run,
  asset,
  report,
  onGenerateReport,
  onDownloadPdf,
  onDownloadHtml,
}: {
  result: NeuroScoringResult;
  run?: AnalysisRun;
  asset?: UploadAsset;
  report?: ReportRecord;
  onGenerateReport: () => void;
  onDownloadPdf: (report: ReportRecord) => void;
  onDownloadHtml: (report: ReportRecord) => void;
}) {
  return (
    <section className="report-export-panel">
      <div>
        <span className="workspace-eyebrow">Sprint 9 · LLM + PDF</span>
        <h3>Informe ejecutivo/creativo con lenguaje controlado.</h3>
        <p>Genera interpretacion estructurada, aplica guardrails de claims y descarga PDF, HTML print-first o JSON trazable.</p>
      </div>
      <div className="export-actions">
        <Button icon={<FileText size={15} />} onClick={onGenerateReport}>{report ? "Regenerar informe" : "Generar informe"}</Button>
        {report ? <Button variant="secondary" icon={<Download size={15} />} onClick={() => onDownloadPdf(report)}>PDF</Button> : null}
        {report ? <Button variant="secondary" icon={<FileText size={15} />} onClick={() => onDownloadHtml(report)}>HTML</Button> : null}
        {report ? <Button variant="ghost" icon={<FileJson size={15} />} onClick={() => exportReportJson(report)}>Report JSON</Button> : null}
      </div>
      <div className="report-meta-grid">
        <div><span>Final model</span><strong>{report?.usage.finalModel ?? "gpt-5.5"}</strong></div>
        <div><span>Reviewer</span><strong>{report?.usage.reviewerModel ?? "claude-opus-4.7"}</strong></div>
        <div><span>Guardrails</span><strong>{report?.guardrailStatus ?? "pendiente"}</strong></div>
        <div><span>Coste</span><strong>{report ? `${report.usage.estimatedCostEur} EUR` : "pendiente"}</strong></div>
      </div>
      {report ? (
        <>
          <div className="report-generated-card">
            <ShieldCheck size={17} />
            <div>
              <strong>{report.title}</strong>
              <span>{report.decision}</span>
            </div>
          </div>
          <div className="report-section-preview">
            {report.sections.map((section) => (
              <article key={section.id}>
                <span>{String(section.orderIndex).padStart(2, "0")} · {section.sectionKey}</span>
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </>
      ) : null}
      <pre>{JSON.stringify({
        reportEndpoint: report ? `/v1/reports/${report.id}` : "POST /v1/reports",
        scoringResultId: result.id,
        analysisRunId: result.analysisRunId,
        assetKind: asset?.health.kind ?? "media",
        runStatus: run?.status ?? "done",
        htmlStorageKey: report?.htmlStorageKey,
        pdfStorageKey: report?.pdfStorageKey,
        scores: result.editorialScores.length,
        timeline: result.timecoursePoints.length,
        recommendations: buildRecommendations(result).length,
      }, null, 2)}</pre>
    </section>
  );
}

export function ResultsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<ResultTab>("resumen");
  const [manualResultId, setManualResultId] = useState<string | null>(null);

  if (!session) return null;
  const activeSession = session;

  const organizationId = activeSession.organization.id;
  const useApi = activeSession.provider === "supabase" && Boolean(activeSession.accessToken);
  const query = new URLSearchParams(window.location.search);
  const queryExperimentId = query.get("experimentId");
  const queryResultId = query.get("resultId");
  const { state, selectedBundle } = useProjectStore(organizationId, activeSession.organization.name);
  const [remoteResults, setRemoteResults] = useState<NeuroScoringResult[]>([]);
  const [remoteRuns, setRemoteRuns] = useState<AnalysisRun[]>([]);
  const [remoteAssets, setRemoteAssets] = useState<UploadAsset[]>([]);
  const allResults = useApi ? remoteResults : loadStoredScoringResults(organizationId);
  const allRuns = useApi ? remoteRuns : loadStoredAnalysisRuns(organizationId);
  const allAssets = useApi ? remoteAssets : loadStoredAssets(organizationId) as UploadAsset[];
  const [reports, setReports] = useState<ReportRecord[]>(() => loadStoredReports(organizationId));
  const fallbackExperimentId = queryExperimentId ?? allResults[0]?.experimentId ?? selectedBundle?.experiment.id ?? state.experiments[0]?.id ?? "";
  const activeBundle = useMemo(() => {
    const experiment = state.experiments.find((item) => item.id === fallbackExperimentId);
    if (!experiment) return selectedBundle;
    const project = state.projects.find((item) => item.id === experiment.projectId);
    const workspace = state.workspaces.find((item) => item.id === experiment.workspaceId);
    return project && workspace ? { project, experiment, workspace } : selectedBundle;
  }, [fallbackExperimentId, selectedBundle, state.experiments, state.projects, state.workspaces]);
  const results = allResults.filter((result) => !fallbackExperimentId || result.experimentId === fallbackExperimentId);
  const activeResult = results.find((result) => result.id === (manualResultId ?? queryResultId)) ?? results[0];
  const activeRun = activeResult ? allRuns.find((run) => run.id === activeResult.analysisRunId) : undefined;
  const activeAsset = activeResult ? allAssets.find((asset) => asset.id === activeResult.assetId) : undefined;
  const activeReport = activeResult ? reports.find((report) => report.scoringResultId === activeResult.id) : undefined;
  const defaultPoint = activeResult?.timecoursePoints.find((point) => point.eventLabel === "peak") ?? activeResult?.timecoursePoints[0];
  const [selectedPointIndex, setSelectedPointIndex] = useState(defaultPoint?.pointIndex ?? 0);
  const selectedPoint = activeResult?.timecoursePoints.find((point) => point.pointIndex === selectedPointIndex) ?? defaultPoint;

  useEffect(() => {
    if (!useApi || !activeSession.accessToken || !fallbackExperimentId) return;
    let cancelled = false;
    Promise.all([
      loadScoringResultsFromApi(fallbackExperimentId, activeSession.accessToken),
      loadAnalysisRunsFromApi(fallbackExperimentId, activeSession.accessToken),
      loadAssetsFromApi(fallbackExperimentId, activeSession.accessToken),
    ]).then(([nextResults, nextRuns, nextAssets]) => {
      if (cancelled) return;
      setRemoteResults(nextResults);
      setRemoteRuns(nextRuns);
      setRemoteAssets(nextAssets);
      return loadReportsFromApi(fallbackExperimentId, activeSession.accessToken || "", nextResults);
    }).then((nextReports) => {
      if (!cancelled && nextReports) setReports(nextReports);
    }).catch(() => {
      if (!cancelled) {
        setRemoteResults([]);
        setRemoteRuns([]);
        setRemoteAssets([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeSession.accessToken, fallbackExperimentId, useApi]);

  async function handleGenerateReport() {
    if (!activeResult) return;
    if (useApi && activeSession.accessToken) {
      const report = await createReportInApi(activeResult, activeSession.accessToken);
      setReports((current) => [report, ...current.filter((item) => item.scoringResultId !== activeResult.id)]);
      return;
    }
    const report = generateReportFromResult({ result: activeResult, bundle: activeBundle, run: activeRun, asset: activeAsset });
    upsertStoredReport(organizationId, report);
    setReports(loadStoredReports(organizationId));
  }

  function handleDownloadPdf(report: ReportRecord) {
    if (useApi && activeSession.accessToken) {
      downloadReportArtifactFromApi(report, activeSession.accessToken, "pdf").catch(() => downloadReportPdf(report));
      return;
    }
    downloadReportPdf(report);
  }

  function handleDownloadHtml(report: ReportRecord) {
    if (useApi && activeSession.accessToken) {
      downloadReportArtifactFromApi(report, activeSession.accessToken, "html").catch(() => downloadReportHtml(report));
      return;
    }
    downloadReportHtml(report);
  }

  return (
    <AppShell active="results">
      <section className="results-hero">
        <div>
          <span className="workspace-eyebrow">Sprint 9 · Dashboard + informes</span>
          <h2>Empieza por la decision. Termina en informe.</h2>
          <p>{activeBundle ? `${activeBundle.project.brand} / ${activeBundle.project.campaign} · ${activeBundle.experiment.name}` : "Selecciona un experimento con scoring para abrir resultados accionables."}</p>
        </div>
        <div className="result-hero-actions">
          <LinkButton href={activeBundle ? `/app/upload?experimentId=${activeBundle.experiment.id}` : "/app/upload"} variant="secondary" icon={<PlayCircle size={15} />}>Volver al run</LinkButton>
          {activeResult ? <Button icon={<FileJson size={15} />} onClick={() => exportJson(activeResult)}>JSON</Button> : null}
        </div>
      </section>

      {!activeResult || !selectedPoint ? (
        <section className="result-empty-state">
          <Gauge size={24} />
          <h3>Todavia no hay resultados de scoring.</h3>
          <p>Sube un asset, prepara inputs TRIBE, lanza el run y calcula scoring. Despues este dashboard se rellenara automaticamente.</p>
          <LinkButton href={activeBundle ? `/app/upload?experimentId=${activeBundle.experiment.id}` : "/app/upload"} icon={<ArrowUpRight size={15} />}>Ir a upload</LinkButton>
        </section>
      ) : (
        <>
          <ResultSelector results={results} activeResult={activeResult} onSelect={setManualResultId} />
          <DecisionHero result={activeResult} />

          <nav className="result-tabs" aria-label="Vistas del resultado">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "resumen" ? (
            <section className="result-tab-panel">
              <ScoreGrid result={activeResult} />
              <div className="result-summary-grid">
                <InteractiveTimeline result={activeResult} selectedPoint={selectedPoint} onSelectPoint={(point) => setSelectedPointIndex(point.pointIndex)} />
                <RecommendationList result={activeResult} />
              </div>
            </section>
          ) : null}

          {activeTab === "timeline" ? (
            <section className="result-tab-panel">
              <InteractiveTimeline result={activeResult} selectedPoint={selectedPoint} onSelectPoint={(point) => setSelectedPointIndex(point.pointIndex)} />
              <div className="timeline-points-table">
                {activeResult.timecoursePoints.map((point) => (
                  <button type="button" key={point.pointIndex} onClick={() => setSelectedPointIndex(point.pointIndex)}>
                    <span>{formatTime(point.stimulusTimeSeconds)}</span>
                    <strong>{point.normalizedResponse}</strong>
                    <em>{point.eventLabel ?? "neutral"}</em>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "modalidades" ? (
            <section className="result-tab-panel">
              <ModalityTable result={activeResult} />
              <RegionNetworkTable regions={activeResult.regionScores} networks={activeResult.networkScores} />
            </section>
          ) : null}

          {activeTab === "recomendaciones" ? (
            <section className="result-tab-panel">
              <RecommendationList result={activeResult} />
              <section className="result-method-note">
                <CheckCircle2 size={16} />
                <p>Cada recomendacion mantiene timecode, capa, confianza e impacto estimado. No se interpreta emocion real ni comportamiento individual.</p>
              </section>
            </section>
          ) : null}

          {activeTab === "informe" ? (
            <section className="result-tab-panel">
              <ReportExportPanel
                result={activeResult}
                run={activeRun}
                asset={activeAsset}
                report={activeReport}
                onGenerateReport={handleGenerateReport}
                onDownloadPdf={handleDownloadPdf}
                onDownloadHtml={handleDownloadHtml}
              />
              <section className="result-table-card">
                <h3><Table2 size={16} /> Resumen tecnico</h3>
                <div className="result-data-row"><span>Scoring</span><strong>{activeResult.scoringVersion}</strong></div>
                <div className="result-data-row"><span>Delay BOLD</span><strong>{activeResult.boldDelaySeconds}s</strong></div>
                <div className="result-data-row"><span>Vertices</span><strong>{activeRun?.nVertices ?? "20.484"}</strong></div>
                <div className="result-data-row"><span>Timesteps</span><strong>{activeRun?.nTimesteps ?? activeResult.timecoursePoints.length}</strong></div>
                <div className="result-data-row"><span>HTML chars</span><strong>{activeReport ? buildReportHtml(activeReport).length : "pendiente"}</strong></div>
              </section>
            </section>
          ) : null}

          <section className="result-footer-note">
            <MousePointer2 size={15} />
            <span>Dashboard Sprint 9: decision, timeline, modalidades, recomendaciones, guardrails e informe PDF/HTML/JSON.</span>
          </section>
        </>
      )}
    </AppShell>
  );
}
import { createReportInApi, downloadReportArtifactFromApi, loadReportsFromApi } from "../reporting/apiReportStore";
