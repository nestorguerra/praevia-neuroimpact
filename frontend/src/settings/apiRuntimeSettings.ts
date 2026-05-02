import type { RuntimeSettings } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

type ApiRuntimeSettings = {
  organization_id: string;
  environment: "local" | "staging" | "production";
  compute_provider: RuntimeSettings["tribe"]["computeProvider"];
  worker_mode: RuntimeSettings["tribe"]["workerMode"];
  tribe_worker_endpoint_url?: string | null;
  tribe_model_id: string;
  tribe_max_asset_duration_seconds: number;
  monthly_gpu_cap_seconds: number;
  monthly_cost_cap_eur: number;
  llm_provider: "openai";
  llm_interpreter_model: string;
  llm_writer_model: string;
  llm_writer_reasoning_effort: RuntimeSettings["llm"]["writerReasoningEffort"];
  llm_prompt_version: string;
  secret_refs: Record<string, string>;
  configured_flags: Record<string, boolean>;
};

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function loadRuntimeSettingsFromApi(
  organizationId: string,
  accessToken: string,
  local: RuntimeSettings,
): Promise<RuntimeSettings> {
  const response = await fetch(`${apiBaseUrl}/v1/runtime-settings/${organizationId}?environment=production`, {
    headers: headers(accessToken),
  });
  if (!response.ok) throw new Error(await response.text());
  const row = await response.json() as ApiRuntimeSettings | null;
  if (!row) return local;
  return {
    ...local,
    tribe: {
      ...local.tribe,
      computeProvider: row.compute_provider,
      workerMode: row.worker_mode,
      workerEndpointUrl: row.tribe_worker_endpoint_url ?? "",
      modelId: row.tribe_model_id,
      maxAssetDurationSeconds: row.tribe_max_asset_duration_seconds,
      monthlyGpuCapSeconds: row.monthly_gpu_cap_seconds,
      monthlyCostCapEur: row.monthly_cost_cap_eur,
    },
    llm: {
      ...local.llm,
      provider: row.llm_provider,
      reportInterpreterModel: row.llm_interpreter_model,
      reportWriterModel: row.llm_writer_model,
      writerReasoningEffort: row.llm_writer_reasoning_effort,
      promptVersion: row.llm_prompt_version,
    },
  };
}

export async function saveRuntimeSettingsToApi(settings: RuntimeSettings, accessToken: string): Promise<void> {
  const configuredFlags = {
    gpu_provider_api_key: Boolean(settings.tribe.providerApiKey.trim()),
    huggingface_token: Boolean(settings.tribe.hfToken.trim()),
    openai_api_key: Boolean(settings.llm.openaiApiKey.trim()),
  };
  const secretRefs = {
    gpu_provider_api_key: "secret://praevia/gpu-provider-api-key",
    huggingface_token: "secret://praevia/huggingface-token",
    openai_api_key: "secret://praevia/openai-api-key",
  };
  const payload: ApiRuntimeSettings = {
    organization_id: settings.organizationId,
    environment: "production",
    compute_provider: settings.tribe.computeProvider,
    worker_mode: settings.tribe.workerMode,
    tribe_worker_endpoint_url: settings.tribe.workerEndpointUrl || null,
    tribe_model_id: settings.tribe.modelId,
    tribe_max_asset_duration_seconds: settings.tribe.maxAssetDurationSeconds,
    monthly_gpu_cap_seconds: settings.tribe.monthlyGpuCapSeconds,
    monthly_cost_cap_eur: settings.tribe.monthlyCostCapEur,
    llm_provider: settings.llm.provider,
    llm_interpreter_model: settings.llm.reportInterpreterModel,
    llm_writer_model: settings.llm.reportWriterModel,
    llm_writer_reasoning_effort: settings.llm.writerReasoningEffort,
    llm_prompt_version: settings.llm.promptVersion,
    configured_flags: configuredFlags,
    secret_refs: secretRefs,
  };
  const response = await fetch(`${apiBaseUrl}/v1/runtime-settings`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
}

