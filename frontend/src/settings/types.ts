export type ComputeProvider =
  | "google_cloud_run_gpu"
  | "runpod_serverless"
  | "modal_gpu"
  | "huggingface_endpoint"
  | "colab_manual"
  | "local_mock";

export type WorkerMode = "mock" | "remote_gpu" | "manual_colab";

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type RuntimeSettings = {
  organizationId: string;
  updatedAt: string;
  tribe: {
    computeProvider: ComputeProvider;
    workerMode: WorkerMode;
    providerApiKey: string;
    workerEndpointUrl: string;
    gpuProfile: string;
    hfToken: string;
    modelId: string;
    maxAssetDurationSeconds: number;
    monthlyGpuCapSeconds: number;
    monthlyCostCapEur: number;
  };
  llm: {
    provider: "openai";
    openaiApiKey: string;
    reportInterpreterModel: string;
    reportWriterModel: string;
    writerReasoningEffort: ReasoningEffort;
    promptVersion: string;
  };
};

export type RuntimeReadiness = {
  tribeComputeReady: boolean;
  huggingFaceReady: boolean;
  llmReady: boolean;
  productionReady: boolean;
};
