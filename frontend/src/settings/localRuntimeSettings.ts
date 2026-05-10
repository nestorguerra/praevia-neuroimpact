import type { RuntimeReadiness, RuntimeSettings } from "./types";

const STORAGE_PREFIX = "praevia:runtime-settings:";

function keyFor(organizationId: string) {
  return `${STORAGE_PREFIX}${organizationId}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultRuntimeSettings(organizationId: string): RuntimeSettings {
  return {
    organizationId,
    updatedAt: nowIso(),
    tribe: {
      computeProvider: "google_cloud_run_gpu",
      workerMode: "remote_gpu",
      providerApiKey: "",
      workerEndpointUrl: "",
      gpuProfile: "Google Cloud Run GPU · NVIDIA L4 · europe-west1 · max 1 instancia en beta.",
      hfToken: "",
      modelId: "facebook/tribev2",
      maxAssetDurationSeconds: 180,
      monthlyGpuCapSeconds: 7200,
      monthlyCostCapEur: 350,
    },
    llm: {
      provider: "openai",
      openaiApiKey: "",
      reportInterpreterModel: "gpt-5.5",
      reportWriterModel: "gpt-5.5",
      writerReasoningEffort: "high",
      promptVersion: "report-master-v0.1",
    },
  };
}

export function loadRuntimeSettings(organizationId: string): RuntimeSettings {
  if (typeof window === "undefined") return createDefaultRuntimeSettings(organizationId);
  const raw = window.localStorage.getItem(keyFor(organizationId));
  const defaults = createDefaultRuntimeSettings(organizationId);
  if (!raw) {
    saveRuntimeSettings(defaults);
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as RuntimeSettings;
    return {
      ...defaults,
      ...parsed,
      organizationId,
      tribe: {
        ...defaults.tribe,
        ...parsed.tribe,
      },
      llm: {
        ...defaults.llm,
        ...parsed.llm,
      },
    };
  } catch {
    saveRuntimeSettings(defaults);
    return defaults;
  }
}

export function saveRuntimeSettings(settings: RuntimeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(settings.organizationId), JSON.stringify({ ...settings, updatedAt: nowIso() }));
}

export function clearRuntimeSecrets(settings: RuntimeSettings): RuntimeSettings {
  const next: RuntimeSettings = {
    ...settings,
    updatedAt: nowIso(),
    tribe: {
      ...settings.tribe,
      providerApiKey: "",
      hfToken: "",
    },
    llm: {
      ...settings.llm,
      openaiApiKey: "",
    },
  };
  saveRuntimeSettings(next);
  return next;
}

export function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "No configurada";
  if (trimmed.length <= 8) return "Configurada";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function getRuntimeReadiness(settings: RuntimeSettings): RuntimeReadiness {
  const remoteWorker = settings.tribe.workerMode === "remote_gpu";
  const providerNeedsApiKey = settings.tribe.computeProvider !== "google_cloud_run_gpu";
  const providerAuthReady = !providerNeedsApiKey || Boolean(settings.tribe.providerApiKey.trim());
  const tribeComputeReady = remoteWorker && providerAuthReady && Boolean(settings.tribe.workerEndpointUrl.trim());
  const huggingFaceReady = Boolean(settings.tribe.hfToken.trim()) && Boolean(settings.tribe.modelId.trim());
  const llmReady = Boolean(settings.llm.openaiApiKey.trim()) && Boolean(settings.llm.reportInterpreterModel.trim()) && Boolean(settings.llm.reportWriterModel.trim());
  return {
    tribeComputeReady,
    huggingFaceReady,
    llmReady,
    productionReady: tribeComputeReady && huggingFaceReady && llmReady,
  };
}

export function buildEnvPreview(settings: RuntimeSettings) {
  return [
    `GPU_PROVIDER=${settings.tribe.computeProvider}`,
    settings.tribe.computeProvider === "google_cloud_run_gpu"
      ? "# Google Cloud usa IAM/Service Account; no necesita API key de proveedor GPU"
      : "# API key del proveedor GPU: guardada solo en backend",
    `TRIBE_WORKER_MODE=${settings.tribe.workerMode}`,
    `TRIBE_WORKER_ENDPOINT_URL=${settings.tribe.workerEndpointUrl}`,
    "TRIBE_CALLBACK_URL=https://api.tu-dominio.com/v1/internal/tribe/callback",
    "# Secreto del callback TRIBE: guardado solo en backend",
    `TRIBE_MODEL_ID=${settings.tribe.modelId}`,
    `TRIBE_MAX_ASSET_DURATION_SECONDS=${settings.tribe.maxAssetDurationSeconds}`,
    "TRIBE_RUN_TIMEOUT_SECONDS=900",
    "TRIBE_RUN_POLL_SECONDS=5",
    "TRIBE_RUN_MAX_RETRIES=2",
    settings.tribe.computeProvider === "google_cloud_run_gpu"
      ? "TRIBE_GPU_EUR_PER_SECOND=0.00035"
      : "TRIBE_GPU_EUR_PER_SECOND=0.00025",
    `MONTHLY_GPU_CAP_SECONDS=${settings.tribe.monthlyGpuCapSeconds}`,
    `MONTHLY_COST_CAP_EUR=${settings.tribe.monthlyCostCapEur}`,
    "# Token Hugging Face: guardado solo en backend",
    "# API key OpenAI: guardada solo en backend",
    "OPENAI_BASE_URL=https://api.openai.com/v1",
    "OPENAI_TIMEOUT_SECONDS=60",
    `LLM_INTERPRETER_MODEL=${settings.llm.reportInterpreterModel}`,
    `LLM_WRITER_MODEL=${settings.llm.reportWriterModel}`,
    `LLM_WRITER_REASONING_EFFORT=${settings.llm.writerReasoningEffort}`,
    `LLM_PROMPT_VERSION=${settings.llm.promptVersion}`,
    "LLM_JSON_MAX_RETRIES=2",
    "LLM_INPUT_EUR_PER_1K=0",
    "LLM_OUTPUT_EUR_PER_1K=0",
  ].join("\n");
}
