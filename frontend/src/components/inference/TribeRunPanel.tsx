import { BrainCircuit, CheckCircle2, Cpu, FileArchive, Gauge, HardDrive, Loader2, PlayCircle, Server } from "lucide-react";
import type { PreprocessingJob } from "../../preprocessing/types";
import type { AnalysisRun, PredictionArtifact, PredictionArtifactType } from "../../inference/types";
import { Badge, Button } from "../ui";

type TribeRunPanelProps = {
  preprocessingJobs: PreprocessingJob[];
  runs: AnalysisRun[];
  isRunning: boolean;
  artifactCount: number;
  onStart: () => void;
};

const artifactIcon: Record<PredictionArtifactType, typeof FileArchive> = {
  bold_npz: BrainCircuit,
  bold_npy: BrainCircuit,
  segments_parquet: HardDrive,
  metrics_json: Gauge,
};

function artifactLabel(artifact: PredictionArtifact) {
  const labels: Record<PredictionArtifactType, string> = {
    bold_npz: "Prediccion BOLD",
    bold_npy: "Array BOLD",
    segments_parquet: "Segmentos",
    metrics_json: "Metricas GPU",
  };
  return labels[artifact.type];
}

export function TribeRunPanel({ preprocessingJobs, runs, isRunning, artifactCount, onStart }: TribeRunPanelProps) {
  const completedPreprocessing = preprocessingJobs.filter((job) => job.status === "completed");
  const canRun = completedPreprocessing.length > 0 && !isRunning;
  const doneRuns = runs.filter((run) => run.status === "done").length;

  return (
    <section className="tribe-panel">
      <div className="tribe-head">
        <div>
          <span className="workspace-eyebrow">Sprint 23 · Worker GPU TRIBE real</span>
          <h2>Prediccion cortical guardada como artefacto.</h2>
          <p>El worker recibe derivados reales, ejecuta TRIBE en GPU externa y guarda predicciones BOLD en fsaverage5.</p>
        </div>
        <Button disabled={!canRun} icon={isRunning ? <Loader2 size={16} /> : <PlayCircle size={16} />} onClick={onStart}>
          {isRunning ? "Ejecutando TRIBE" : "Lanzar TRIBE"}
        </Button>
      </div>

      <div className="tribe-summary">
        <div><span>Modelo</span><strong>facebook/tribev2</strong></div>
        <div><span>Runs done</span><strong>{doneRuns}</strong></div>
        <div><span>Artefactos</span><strong>{artifactCount}</strong></div>
        <div><span>Vertices</span><strong>20.484</strong></div>
      </div>

      <div className="tribe-runtime-note">
        <Server size={17} />
        <span>Local: contrato mock. Produccion: RunPod Serverless con imagen CUDA, token Hugging Face, callback privado y cap de coste.</span>
      </div>

      {runs.length === 0 ? (
        <div className="tribe-empty">
          <Cpu size={22} />
          <strong>Esperando inputs preprocesados.</strong>
          <span>Primero completa preprocesamiento y luego lanza TRIBE sobre un asset corto.</span>
        </div>
      ) : (
        <div className="analysis-run-list">
          {runs.map((run) => (
            <article className="analysis-run-card" key={run.id}>
              <div className="analysis-run-title">
                <div>
                  <span>Run individual · {run.assetKind}</span>
                  <h3>{run.assetName}</h3>
                </div>
                <Badge tone={run.status === "done" ? "lime" : run.status === "running" || run.status === "queued" ? "amber" : "coral"}>
                  {run.status === "done" ? "Done" : run.status === "queued" ? "Queued" : run.status === "running" ? "Running" : "Error"}
                </Badge>
              </div>

              <div className="job-progress tribe-progress"><span style={{ width: `${run.progress}%` }} /></div>

              <div className="run-metrics-grid">
                <div><span>Shape</span><strong>{run.nTimesteps ?? "-"} x {run.nVertices ?? "-"}</strong></div>
                <div><span>GPU sec</span><strong>{run.gpuSeconds ?? "-"}</strong></div>
                <div><span>VRAM</span><strong>{run.gpuVramMb ?? "-"} MB</strong></div>
                <div><span>Duracion</span><strong>{run.durationSeconds ?? "-"}s</strong></div>
                <div><span>Proveedor</span><strong>{run.computeProvider ?? "-"}</strong></div>
              </div>

              <div className="prediction-grid">
                {run.artifacts.map((artifact) => {
                  const Icon = artifactIcon[artifact.type];
                  return (
                    <div className="prediction-card" key={artifact.id}>
                      <Icon size={18} />
                      <div>
                        <span>{artifactLabel(artifact)}</span>
                        <strong>{artifact.label}</strong>
                        {artifact.shape ? <small>{artifact.shape}</small> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <details className="preprocessing-logs">
                <summary><CheckCircle2 size={15} /> Logs y prediction keys</summary>
                <div>
                  {run.logs.map((log) => <code key={log}>{log}</code>)}
                  {run.artifacts.map((artifact) => <code key={artifact.storageKey}>{artifact.storageKey}</code>)}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
