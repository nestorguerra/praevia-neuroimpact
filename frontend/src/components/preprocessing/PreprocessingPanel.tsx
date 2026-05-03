import { Activity, CheckCircle2, Database, FileAudio, FileJson, FileText, Film, Loader2, Rows3, Waves } from "lucide-react";
import type { UploadAsset } from "../../uploads/types";
import type { AssetDerivative, DerivativeType, PreprocessingJob, PreprocessingStepStatus } from "../../preprocessing/types";
import { Badge, Button } from "../ui";

type PreprocessingPanelProps = {
  assets: UploadAsset[];
  jobs: PreprocessingJob[];
  isRunning: boolean;
  derivativeCount: number;
  onStart: () => void;
};

const derivativeIcon: Record<DerivativeType, typeof FileJson> = {
  normalized_media: Film,
  extracted_audio: FileAudio,
  transcript: FileText,
  metadata: FileJson,
  silence_report: Waves,
  normalized_text: Rows3,
};

const stepTone: Record<PreprocessingStepStatus, "lime" | "amber" | "coral" | "muted"> = {
  completed: "lime",
  running: "amber",
  pending: "muted",
  skipped: "muted",
  failed: "coral",
};

function statusLabel(status: PreprocessingStepStatus) {
  const labels = {
    completed: "Hecho",
    running: "Activo",
    pending: "Pendiente",
    skipped: "No aplica",
    failed: "Error",
  };
  return labels[status];
}

function derivativeLabel(derivative: AssetDerivative) {
  const labels: Record<DerivativeType, string> = {
    normalized_media: "Media normalizada",
    extracted_audio: "Audio extraido",
    transcript: "Transcript",
    metadata: "Metadata",
    silence_report: "Silencios",
    normalized_text: "Texto normalizado",
  };
  return labels[derivative.type];
}

export function PreprocessingPanel({ assets, jobs, isRunning, derivativeCount, onStart }: PreprocessingPanelProps) {
  const canStart = assets.length > 0 && !isRunning;

  return (
    <section className="preprocessing-panel">
      <div className="preprocessing-head">
        <div>
          <span className="workspace-eyebrow">Preprocesamiento multimodal</span>
          <h2>Inputs normalizados para TRIBE.</h2>
          <p>Convierte cada asset en derivados internos: metadata, media normalizada, audio, transcript, silencios y texto temporizado.</p>
        </div>
        <Button disabled={!canStart} icon={isRunning ? <Loader2 size={16} /> : <Activity size={16} />} onClick={onStart}>
          {isRunning ? "Preparando" : "Preparar inputs TRIBE"}
        </Button>
      </div>

      <div className="preprocessing-summary">
        <div><span>Assets</span><strong>{assets.length}</strong></div>
        <div><span>Jobs</span><strong>{jobs.length}</strong></div>
        <div><span>Derivados</span><strong>{derivativeCount}</strong></div>
        <div><span>Estado</span><strong>{isRunning ? "Activo" : jobs.length ? "Listo" : "Pendiente"}</strong></div>
      </div>

      {jobs.length === 0 ? (
        <div className="preprocessing-empty">
          <Database size={22} />
          <strong>Sin jobs todavia.</strong>
          <span>Sube assets y pulsa preparar inputs para generar derivados visibles.</span>
        </div>
      ) : (
        <div className="preprocessing-job-list">
          {jobs.map((job) => (
            <article className="preprocessing-job" key={job.id}>
              <div className="preprocessing-job-title">
                <div>
                  <span>Asset {job.assetKind}</span>
                  <h3>{job.assetName}</h3>
                </div>
                <Badge tone={job.status === "completed" ? "lime" : job.status === "running" ? "amber" : "coral"}>
                  {job.status === "completed" ? "Completado" : job.status === "running" ? "Procesando" : "Error"}
                </Badge>
              </div>

              <div className="job-progress"><span style={{ width: `${job.progress}%` }} /></div>

              <div className="preprocessing-steps">
                {job.steps.map((step) => (
                  <div key={`${job.id}-${step.label}`}>
                    <Badge tone={stepTone[step.status]}>{statusLabel(step.status)}</Badge>
                    <strong>{step.label}</strong>
                    <span>{step.message}</span>
                  </div>
                ))}
              </div>

              {job.derivatives.length > 0 ? (
                <div className="derivative-grid">
                  {job.derivatives.map((item) => {
                    const Icon = derivativeIcon[item.type];
                    return (
                      <div className="derivative-card" key={item.id}>
                        <Icon size={18} />
                        <div>
                          <span>{derivativeLabel(item)}</span>
                          <strong>{item.label}</strong>
                          <small>{item.source}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <details className="preprocessing-logs">
                <summary><CheckCircle2 size={15} /> Logs y storage keys</summary>
                <div>
                  {job.logs.map((log) => <code key={log}>{log}</code>)}
                  {job.derivatives.map((item) => <code key={item.storageKey}>{item.storageKey}</code>)}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
