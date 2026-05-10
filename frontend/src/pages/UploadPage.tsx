import { FolderKanban, Info, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { ProjectDetail } from "../components/projects/ProjectDetail";
import { TribeRunPanel } from "../components/inference/TribeRunPanel";
import { AssetDropzone } from "../components/uploads/AssetDropzone";
import { ScoringPanel } from "../components/scoring/ScoringPanel";
import { AssetHealthCheck, AssetRows } from "../components/uploads/AssetRows";
import { AssetPreview } from "../components/uploads/AssetPreview";
import { CreditEstimate } from "../components/uploads/CreditEstimate";
import { PreprocessingPanel } from "../components/preprocessing/PreprocessingPanel";
import { Badge, Card } from "../components/ui";
import { useAnalysisRunStore } from "../inference/useAnalysisRunStore";
import { usePreprocessingStore } from "../preprocessing/usePreprocessingStore";
import { useScoringStore } from "../scoring/useScoringStore";
import { experimentTypeLabels } from "../projects/templates";
import { useProjectStore } from "../projects/useProjectStore";
import { useAssetUploadStore } from "../uploads/useAssetUploadStore";

export function UploadPage() {
  const { session } = useAuth();

  if (!session) return null;

  return (
    <UploadPageContent
      organizationId={session.organization.id}
      organizationName={session.organization.name}
      accessToken={session.provider === "supabase" ? session.accessToken : undefined}
      provider={session.provider}
    />
  );
}

function UploadPageContent({
  organizationId,
  organizationName,
  accessToken,
  provider,
}: {
  organizationId: string;
  organizationName: string;
  accessToken?: string;
  provider: string;
}) {
  const { state, selectedBundle, setSelectedProjectId } = useProjectStore(organizationId, organizationName);
  const queryExperimentId = new URLSearchParams(window.location.search).get("experimentId");
  const experimentFromQuery = state.experiments.find((experiment) => experiment.id === queryExperimentId);
  const initialBundle = useMemo(() => {
    if (!experimentFromQuery) return selectedBundle;
    const project = state.projects.find((item) => item.id === experimentFromQuery.projectId);
    const workspace = state.workspaces.find((item) => item.id === experimentFromQuery.workspaceId);
    return project && workspace ? { project, experiment: experimentFromQuery, workspace } : selectedBundle;
  }, [experimentFromQuery, selectedBundle, state.projects, state.workspaces]);

  const [experimentId, setExperimentId] = useState(initialBundle?.experiment.id ?? state.experiments[0]?.id ?? "");
  useEffect(() => {
    if (experimentFromQuery && experimentId !== experimentFromQuery.id) {
      setExperimentId(experimentFromQuery.id);
      setSelectedProjectId(experimentFromQuery.projectId);
      return;
    }
    if (!experimentId && state.experiments[0]) {
      setExperimentId(state.experiments[0].id);
    }
  }, [experimentFromQuery, experimentId, setSelectedProjectId, state.experiments]);

  const activeBundle = useMemo(() => {
    const experiment = state.experiments.find((item) => item.id === experimentId);
    if (!experiment) return initialBundle;
    const project = state.projects.find((item) => item.id === experiment.projectId);
    const workspace = state.workspaces.find((item) => item.id === experiment.workspaceId);
    return project && workspace ? { project, experiment, workspace } : initialBundle;
  }, [experimentId, initialBundle, state.experiments, state.projects, state.workspaces]);

  const uploadStore = useAssetUploadStore(
    organizationId,
    experimentId || "no-experiment",
    activeBundle && provider === "supabase"
      ? { workspaceId: activeBundle.workspace.id, projectId: activeBundle.project.id, accessToken }
      : undefined,
  );
  const preprocessingStore = usePreprocessingStore(
    organizationId,
    experimentId || "no-experiment",
    provider === "supabase" ? accessToken : undefined,
  );
  const analysisRunStore = useAnalysisRunStore(
    organizationId,
    experimentId || "no-experiment",
    provider === "supabase" ? accessToken : undefined,
  );
  const scoringStore = useScoringStore(
    organizationId,
    experimentId || "no-experiment",
    provider === "supabase" ? accessToken : undefined,
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const selectedAsset = uploadStore.assets.find((asset) => asset.id === selectedAssetId) ?? uploadStore.assets[0];

  function changeExperiment(nextExperimentId: string) {
    setExperimentId(nextExperimentId);
    const experiment = state.experiments.find((item) => item.id === nextExperimentId);
    if (experiment) setSelectedProjectId(experiment.projectId);
    setSelectedAssetId(null);
  }

  return (
    <AppShell active="uploads">
      <section className="upload-hero">
        <div>
          <span className="workspace-eyebrow">Upload seguro</span>
          <h2>Sube assets reales y valida si estan listos para analisis.</h2>
          <p>La UI simula el flujo correcto de producto: upload firmado, hash, health check, previews y creditos antes de lanzar TRIBE.</p>
        </div>
        <div className="upload-hero-meta">
          <Badge tone="amber">Max 3 assets</Badge>
          <Badge tone="muted">A/B/C compatible</Badge>
        </div>
      </section>

      <section className="upload-context-grid">
        <Card eyebrow="Experimento activo" title="Asociar assets">
          <label className="field">
            <span className="field-label">Proyecto / experimento</span>
            <select className="input" value={experimentId} onChange={(event) => changeExperiment(event.target.value)}>
              {state.experiments.map((experiment) => {
                const project = state.projects.find((item) => item.id === experiment.projectId);
                return (
                  <option value={experiment.id} key={experiment.id}>
                    {project?.brand} / {project?.campaign} · {experimentTypeLabels[experiment.type]}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="upload-context-note">
            <FolderKanban size={16} />
            {activeBundle ? `${activeBundle.workspace.name} -> ${activeBundle.project.brand} / ${activeBundle.project.campaign}` : "Crea un proyecto antes de subir assets."}
          </div>
        </Card>

        <Card eyebrow="Seguridad" title="Storage seguro">
          <div className="storage-contract">
            <div><span>Metodo</span><strong>Presigned URL</strong></div>
            <div><span>Destino</span><strong>R2/S3 por entorno</strong></div>
            <div><span>Hash</span><strong>SHA-256</strong></div>
          </div>
        </Card>
      </section>

      {activeBundle ? <ProjectDetail bundle={activeBundle} /> : null}

      <AssetDropzone slotsRemaining={uploadStore.slotsRemaining} disabled={!experimentId || uploadStore.isInspecting} onFiles={uploadStore.addFiles} />

      <section className="upload-layout">
        <div className="upload-main-panel">
          <div className="section-title-row">
            <div>
              <span className="breadcrumbs">Assets / Versiones</span>
              <h2>Archivos asociados</h2>
            </div>
            <Badge tone={uploadStore.hasErrors ? "coral" : uploadStore.hasWarnings ? "amber" : "lime"}>
              {uploadStore.assets.length}/3 slots
            </Badge>
          </div>
          <AssetRows
            assets={uploadStore.assets}
            onRemove={uploadStore.removeAsset}
          />
          {uploadStore.error ? <div className="wizard-error">{uploadStore.error}</div> : null}
          <div className="asset-select-row">
            {uploadStore.assets.map((asset) => (
              <button key={asset.id} type="button" className={selectedAsset?.id === asset.id ? "active" : ""} onClick={() => setSelectedAssetId(asset.id)}>
                Version {asset.slot}
              </button>
            ))}
          </div>
          <AssetPreview asset={selectedAsset} />
        </div>

        <aside className="upload-side-panel">
          <CreditEstimate
            assets={uploadStore.assets}
            totalCredits={uploadStore.totalCredits}
            hasErrors={uploadStore.hasErrors}
            hasWarnings={uploadStore.hasWarnings}
            actionLabel="Preparar inputs TRIBE"
            isPreparing={preprocessingStore.isRunning}
            onStart={() => preprocessingStore.startJobs(uploadStore.assets.filter((asset) => asset.status !== "error"))}
          />
          {selectedAsset ? <AssetHealthCheck asset={selectedAsset} /> : (
            <section className="asset-health-card">
              <div className="health-head"><span>Health check</span><Badge tone="muted">Pendiente</Badge></div>
              <h3>Esperando asset</h3>
              <p className="detail-note"><Info size={14} /> Sube video, audio o texto para ver validacion completa.</p>
            </section>
          )}
        </aside>
      </section>

      <PreprocessingPanel
        assets={uploadStore.assets.filter((asset) => asset.status !== "error")}
        jobs={preprocessingStore.jobs}
        isRunning={preprocessingStore.isRunning}
        derivativeCount={preprocessingStore.derivativeCount}
        onStart={() => preprocessingStore.startJobs(uploadStore.assets.filter((asset) => asset.status !== "error"))}
      />

      <TribeRunPanel
        preprocessingJobs={preprocessingStore.jobs}
        runs={analysisRunStore.runs}
        isRunning={analysisRunStore.isRunning}
        artifactCount={analysisRunStore.artifactCount}
        onStart={() => analysisRunStore.startRuns(preprocessingStore.jobs)}
      />

      <ScoringPanel
        runs={analysisRunStore.runs}
        results={scoringStore.results}
        isScoring={scoringStore.isScoring}
        scoreCount={scoringStore.scoreCount}
        onStart={() => scoringStore.startScoring(analysisRunStore.runs)}
      />
    </AppShell>
  );
}
