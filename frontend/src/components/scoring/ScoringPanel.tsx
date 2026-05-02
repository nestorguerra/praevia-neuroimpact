import { Activity, BarChart3, Brain, CheckCircle2, Gauge, Loader2, Map, Sparkles, TimerReset, Waves } from "lucide-react";
import type { AnalysisRun } from "../../inference/types";
import type { EditorialScore, NeuroScoringResult, PeakMoment } from "../../scoring/types";
import { Badge, Button, LinkButton } from "../ui";

type ScoringPanelProps = {
  runs: AnalysisRun[];
  results: NeuroScoringResult[];
  isScoring: boolean;
  scoreCount: number;
  onStart: () => void;
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

function metricShort(metric: EditorialScore) {
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
  return labels[metric.metricKey] ?? metric.metricLabel;
}

function momentLabel(moment: PeakMoment) {
  if (moment.momentType === "peak") return "Peak";
  if (moment.momentType === "valley") return "Valley";
  return "Flat";
}

export function ScoringPanel({ runs, results, isScoring, scoreCount, onStart }: ScoringPanelProps) {
  const doneRuns = runs.filter((run) => run.status === "done");
  const canScore = doneRuns.length > 0 && !isScoring;
  const primary = results[0];

  return (
    <section className="scoring-panel">
      <div className="scoring-head">
        <div>
          <span className="workspace-eyebrow">Sprint 24 · Scoring real</span>
          <h2>Scores calculados desde predicciones TRIBE.</h2>
          <p>Convierte `bold_predictions.npz` en indices 0-100 con confianza, benchmark, evidencia, timeline y accion por timecode.</p>
        </div>
        <Button disabled={!canScore} icon={isScoring ? <Loader2 size={16} /> : <Gauge size={16} />} onClick={onStart}>
          {isScoring ? "Calculando" : "Calcular scoring"}
        </Button>
      </div>

      <div className="scoring-summary">
        <div><span>NRI</span><strong>{primary ? primary.summary.nri : "-"}</strong></div>
        <div><span>Confianza</span><strong>{primary ? primary.confidenceLabel : "-"}</strong></div>
        <div><span>Scores</span><strong>{scoreCount}</strong></div>
        <div><span>Delay BOLD</span><strong>{primary ? `${primary.boldDelaySeconds}s` : "-"}</strong></div>
      </div>

      {!primary ? (
        <div className="scoring-empty">
          <Brain size={22} />
          <strong>Esperando run TRIBE.</strong>
          <span>Lanza TRIBE y despues calcula scores internos para revisar JSON/API y dashboard.</span>
        </div>
      ) : (
        <div className="scoring-result-list">
          {results.map((result) => (
            <article className="scoring-result-card" key={result.id}>
              <div className="scoring-result-title">
                <div>
                  <span>{result.scoringVersion} · {result.benchmarkLabel}</span>
                  <h3>{result.assetName}</h3>
                  <p>{result.summary.decision}</p>
                </div>
                <div className="scoring-result-actions">
                  <Badge tone={result.confidenceLabel === "alta" ? "lime" : result.confidenceLabel === "media" ? "amber" : "coral"}>
                    CONF {result.confidenceLabel}
                  </Badge>
                  <LinkButton
                    href={`/app/results?experimentId=${result.experimentId}&resultId=${result.id}`}
                    variant="secondary"
                    size="sm"
                    icon={<BarChart3 size={14} />}
                  >
                    Abrir dashboard
                  </LinkButton>
                </div>
              </div>

              <div className="editorial-score-grid">
                {result.editorialScores.map((score) => (
                  <div className="editorial-score-card" key={score.metricKey}>
                    <div>
                      <span>{metricShort(score)}</span>
                      <Badge tone={toneFor(score.score)}>{score.score}</Badge>
                    </div>
                    <strong>{score.metricLabel}</strong>
                    <small>Bench {score.benchmarkDelta >= 0 ? "+" : ""}{score.benchmarkDelta}% · conf {score.confidence.toFixed(2)}</small>
                  </div>
                ))}
              </div>

              <div className="timeline-card">
                <div className="timeline-head">
                  <span><TimerReset size={15} /> Timeline corregido por BOLD</span>
                  <strong>-{result.boldDelaySeconds}s hacia tiempo de estimulo</strong>
                </div>
                <div className="scoring-timeline">
                  {result.timecoursePoints.map((point) => (
                    <div
                      key={point.pointIndex}
                      className={`timeline-bar ${point.eventLabel ?? ""}`}
                      style={{ height: `${Math.max(10, point.normalizedResponse)}px` }}
                      title={`${formatTime(point.stimulusTimeSeconds)} · ${point.normalizedResponse}`}
                    />
                  ))}
                </div>
              </div>

              <div className="score-detail-grid">
                <div className="score-detail-card">
                  <h4><Waves size={16} /> Redes funcionales</h4>
                  {result.networkScores.map((network) => (
                    <div className="score-row" key={network.networkKey}>
                      <span>{network.networkLabel}</span>
                      <strong>{network.score}</strong>
                    </div>
                  ))}
                </div>
                <div className="score-detail-card">
                  <h4><Map size={16} /> Regiones / ROIs</h4>
                  {result.regionScores.slice(0, 6).map((region) => (
                    <div className="score-row" key={region.regionKey}>
                      <span>{region.regionLabel}</span>
                      <strong>{region.score}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="peak-moment-list">
                {result.peakMoments.map((moment) => (
                  <div className="peak-moment" key={`${moment.momentType}-${moment.startSeconds}`}>
                    <Badge tone={moment.momentType === "peak" ? "lime" : moment.momentType === "valley" ? "coral" : "amber"}>
                      {momentLabel(moment)}
                    </Badge>
                    <div>
                      <strong>{formatTime(moment.startSeconds)}-{formatTime(moment.endSeconds)} · score {moment.score}</strong>
                      <span>{moment.evidence}</span>
                      <p><Sparkles size={14} /> {moment.action}</p>
                    </div>
                  </div>
                ))}
              </div>

              <details className="preprocessing-logs">
                <summary><CheckCircle2 size={15} /> JSON interno</summary>
                <div>
                  <code>GET /v1/scoring/results/{result.id}</code>
                  <code>GET /v1/analysis-runs/{result.analysisRunId}/scoring-results</code>
                  <code>region_scores={result.regionScores.length} network_scores={result.networkScores.length} timecourse_points={result.timecoursePoints.length}</code>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
