import {
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Cpu,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button, Input } from "../components/ui";
import {
  buildEnvPreview,
  clearRuntimeSecrets,
  getRuntimeReadiness,
  loadRuntimeSettings,
  maskSecret,
  saveRuntimeSettings,
} from "../settings/localRuntimeSettings";
import { loadRuntimeSettingsFromApi, saveRuntimeSettingsToApi } from "../settings/apiRuntimeSettings";
import type { ComputeProvider, ReasoningEffort, RuntimeSettings, WorkerMode } from "../settings/types";

const computeProviderLabels: Record<ComputeProvider, string> = {
  google_cloud_run_gpu: "Google Cloud Run GPU",
  runpod_serverless: "RunPod Serverless GPU",
  modal_gpu: "Modal GPU worker",
  huggingface_endpoint: "Hugging Face Inference Endpoint",
  colab_manual: "Colab manual fallback",
  local_mock: "Mock local sin GPU",
};

const workerModeLabels: Record<WorkerMode, string> = {
  mock: "Mock local beta",
  remote_gpu: "Worker GPU remoto",
  manual_colab: "Colab manual",
};

const reasoningLabels: Record<ReasoningEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
};

function toneForReady(ready: boolean) {
  return ready ? "lime" as const : "coral" as const;
}

function NumberField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
}) {
  return (
    <Input
      label={label}
      type="number"
      min={0}
      value={String(value)}
      help={help}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  help?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {(Object.entries(options) as Array<[T, string]>).map(([key, optionLabel]) => (
          <option key={key} value={key}>{optionLabel}</option>
        ))}
      </select>
      {help ? <span className="field-message">{help}</span> : null}
    </label>
  );
}

export function SettingsPage() {
  const { session } = useAuth();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [remoteLoading, setRemoteLoading] = useState(false);

  if (!session) return null;
  const activeSession = session;

  const [settings, setSettings] = useState<RuntimeSettings>(() => loadRuntimeSettings(activeSession.organization.id));
  const useApi = activeSession.provider === "supabase" && Boolean(activeSession.accessToken);
  const readiness = useMemo(() => getRuntimeReadiness(settings), [settings]);
  const envPreview = useMemo(() => buildEnvPreview(settings), [settings]);
  const isGoogleCloudGpu = settings.tribe.computeProvider === "google_cloud_run_gpu";

  useEffect(() => {
    if (!useApi || !activeSession.accessToken) return;
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError("");
    loadRuntimeSettingsFromApi(activeSession.organization.id, activeSession.accessToken, settings)
      .then((remoteSettings) => {
        if (!cancelled) setSettings(remoteSettings);
      })
      .catch((error: unknown) => {
        if (!cancelled) setRemoteError(error instanceof Error ? error.message : "No se pudieron cargar ajustes remotos.");
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession.accessToken, activeSession.organization.id, useApi]);

  function patchTribe(patch: Partial<RuntimeSettings["tribe"]>) {
    setSettings((current) => ({ ...current, tribe: { ...current.tribe, ...patch } }));
    setSaved(false);
  }

  function patchLlm(patch: Partial<RuntimeSettings["llm"]>) {
    setSettings((current) => ({ ...current, llm: { ...current.llm, ...patch } }));
    setSaved(false);
  }

  async function persist() {
    saveRuntimeSettings(settings);
    if (useApi && activeSession.accessToken) {
      try {
        setRemoteError("");
        await saveRuntimeSettingsToApi(settings, activeSession.accessToken);
      } catch (error) {
        setRemoteError(error instanceof Error ? error.message : "No se pudieron guardar ajustes remotos.");
        return;
      }
    }
    setSaved(true);
  }

  async function copyEnvPreview() {
    await navigator.clipboard.writeText(envPreview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function removeSecrets() {
    setSettings(clearRuntimeSecrets(settings));
    setSaved(true);
  }

  return (
    <AppShell active="settings">
      <section className="settings-hero">
        <div>
          <span className="workspace-eyebrow">Ajustes · Computo y modelos</span>
          <h2>TRIBE corre en Google Cloud GPU. Las claves reales viven en Secret Manager.</h2>
          <p>Para produccion usamos Cloud Run GPU, Cloud Tasks, Cloud Storage y Secret Manager. Este panel ayuda a revisar la configuracion; las claves privadas no deben quedarse en GitHub Pages.</p>
        </div>
        <div className="result-hero-actions">
          <Button variant="secondary" icon={<Trash2 size={15} />} onClick={removeSecrets}>Vaciar claves</Button>
          <Button icon={<Save size={15} />} onClick={persist}>{saved ? "Guardado" : "Guardar ajustes"}</Button>
        </div>
      </section>

      <section className="settings-status-grid">
        <article>
          <Cpu size={17} />
          <span>Compute TRIBE</span>
          <strong>{readiness.tribeComputeReady ? "Listo" : "Pendiente"}</strong>
          <Badge tone={toneForReady(readiness.tribeComputeReady)}>{workerModeLabels[settings.tribe.workerMode]}</Badge>
        </article>
        <article>
          <BrainCircuit size={17} />
          <span>Hugging Face</span>
          <strong>{readiness.huggingFaceReady ? "Listo" : "Pendiente"}</strong>
          <em>{maskSecret(settings.tribe.hfToken)}</em>
        </article>
        <article>
          <Sparkles size={17} />
          <span>LLM informes</span>
          <strong>{readiness.llmReady ? "Listo" : "Pendiente"}</strong>
          <em>{maskSecret(settings.llm.openaiApiKey)}</em>
        </article>
        <article>
          <ShieldAlert size={17} />
          <span>Config remota</span>
          <strong>{useApi ? remoteLoading ? "Cargando" : "Postgres" : "Local beta"}</strong>
          <em>{useApi ? "Se guardan referencias seguras, no secretos en claro." : "Produccion real exige mover claves al backend."}</em>
        </article>
      </section>

      {remoteError ? <section className="settings-remote-error">{remoteError}</section> : null}

      <section className="settings-layout">
        <div className="settings-main">
          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <span className="workspace-eyebrow">TRIBE v2</span>
                <h3>Computacion GPU para inferencia.</h3>
              </div>
              <Badge tone="amber">{computeProviderLabels[settings.tribe.computeProvider]}</Badge>
            </div>

            <div className="settings-form-grid">
              <SelectField
                label="Proveedor compute"
                value={settings.tribe.computeProvider}
                options={computeProviderLabels}
                onChange={(value) => patchTribe({
                  computeProvider: value,
                  workerMode: value === "colab_manual" ? "manual_colab" : value === "local_mock" ? "mock" : settings.tribe.workerMode,
                })}
                help="Recomendado para PraevIA: Google Cloud Run GPU con NVIDIA L4 en europe-west1."
              />
              <SelectField
                label="Modo worker"
                value={settings.tribe.workerMode}
                options={workerModeLabels}
                onChange={(value) => patchTribe({ workerMode: value })}
                help="Mock local para demo; remote GPU para analisis real."
              />
              <Input
                label="API key proveedor GPU"
                type="password"
                autoComplete="off"
                value={settings.tribe.providerApiKey}
                disabled={isGoogleCloudGpu}
                placeholder={isGoogleCloudGpu ? "No aplica en Google Cloud" : "RunPod / Modal / proveedor GPU"}
                help={isGoogleCloudGpu ? "Google usa IAM y service accounts; este campo queda vacio." : "En produccion esto debe ir en secret vault del backend, no en el navegador."}
                onChange={(event) => patchTribe({ providerApiKey: event.target.value })}
              />
              <Input
                label="Endpoint worker TRIBE"
                value={settings.tribe.workerEndpointUrl}
                placeholder={isGoogleCloudGpu ? "https://praevia-tribe-worker-xxxxx-ew.a.run.app" : "https://api.runpod.ai/v2/<endpoint-id>"}
                help={isGoogleCloudGpu ? "Lo tendremos cuando despleguemos el worker TRIBE en Cloud Run GPU." : "URL base del endpoint RunPod Serverless; la API anade /run al lanzar el job."}
                onChange={(event) => patchTribe({ workerEndpointUrl: event.target.value })}
              />
              <Input
                label="Hugging Face token"
                type="password"
                autoComplete="off"
                value={settings.tribe.hfToken}
                placeholder="hf_..."
                help="En produccion debe estar en Google Secret Manager como HF_TOKEN."
                onChange={(event) => patchTribe({ hfToken: event.target.value })}
              />
              <Input
                label="Modelo TRIBE"
                value={settings.tribe.modelId}
                onChange={(event) => patchTribe({ modelId: event.target.value })}
              />
              <Input
                label="Perfil GPU"
                value={settings.tribe.gpuProfile}
                onChange={(event) => patchTribe({ gpuProfile: event.target.value })}
              />
              <NumberField
                label="Duracion maxima asset"
                value={settings.tribe.maxAssetDurationSeconds}
                help="Segundos por asset en beta para no quemar coste."
                onChange={(value) => patchTribe({ maxAssetDurationSeconds: value })}
              />
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <span className="workspace-eyebrow">LLM informes</span>
                <h3>OpenAI para interpretacion y redaccion.</h3>
              </div>
              <Badge tone={readiness.llmReady ? "lime" : "coral"}>{readiness.llmReady ? "Configurado" : "Falta API key"}</Badge>
            </div>

            <div className="settings-form-grid">
              <Input
                label="OpenAI API key"
                type="password"
                autoComplete="off"
                value={settings.llm.openaiApiKey}
                placeholder="sk-..."
                help="Una sola API key sirve para interpretacion y redaccion si ambos modelos son de OpenAI."
                onChange={(event) => patchLlm({ openaiApiKey: event.target.value })}
              />
              <Input
                label="Modelo interpretacion"
                value={settings.llm.reportInterpreterModel}
                help="Por defecto: GPT-5.5 para lectura final del informe."
                onChange={(event) => patchLlm({ reportInterpreterModel: event.target.value })}
              />
              <Input
                label="Modelo redaccion"
                value={settings.llm.reportWriterModel}
                help="Por defecto: GPT-5.5 con reasoning alto para redaccion razonada."
                onChange={(event) => patchLlm({ reportWriterModel: event.target.value })}
              />
              <SelectField
                label="Reasoning redaccion"
                value={settings.llm.writerReasoningEffort}
                options={reasoningLabels}
                onChange={(value) => patchLlm({ writerReasoningEffort: value })}
              />
              <Input
                label="Prompt version"
                value={settings.llm.promptVersion}
                onChange={(event) => patchLlm({ promptVersion: event.target.value })}
              />
            </div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <span className="workspace-eyebrow">Decision tecnica</span>
                <h3>Proveedor recomendado.</h3>
              </div>
              <ServerCog size={18} />
            </div>
            <div className="settings-decision-list">
              <article>
                <CheckCircle2 size={15} />
                <div>
                  <strong>Beta local</strong>
                  <span>Mock para demo visual y QA de producto.</span>
                </div>
              </article>
              <article>
                <CheckCircle2 size={15} />
                <div>
                  <strong>Piloto real</strong>
                  <span>Google Cloud Run GPU con NVIDIA L4, cola Cloud Tasks y secretos en Secret Manager.</span>
                </div>
              </article>
              <article>
                <RefreshCw size={15} />
                <div>
                  <strong>Fallback</strong>
                  <span>Colab manual solo si el proveedor GPU falla.</span>
                </div>
              </article>
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <span className="workspace-eyebrow">Caps</span>
                <h3>Control de gasto beta.</h3>
              </div>
              <LockKeyhole size={18} />
            </div>
            <div className="settings-mini-grid">
              <NumberField
                label="GPU seconds/mes"
                value={settings.tribe.monthlyGpuCapSeconds}
                onChange={(value) => patchTribe({ monthlyGpuCapSeconds: value })}
              />
              <NumberField
                label="Coste max EUR/mes"
                value={settings.tribe.monthlyCostCapEur}
                onChange={(value) => patchTribe({ monthlyCostCapEur: value })}
              />
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <span className="workspace-eyebrow">.env produccion</span>
                <h3>Mapa para backend seguro.</h3>
              </div>
              <Button variant="ghost" size="sm" icon={<Clipboard size={14} />} onClick={copyEnvPreview}>{copied ? "Copiado" : "Copiar"}</Button>
            </div>
            <pre className="settings-env-preview">{envPreview}</pre>
          </section>

          <section className="settings-warning">
            <KeyRound size={17} />
            <div>
              <strong>Importante</strong>
              <span>Esta pantalla guarda claves en este navegador para la beta. En produccion, las claves deben almacenarse como secretos del backend y el frontend solo debe mostrar si estan configuradas.</span>
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
