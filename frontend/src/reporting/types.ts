import type { NeuroScoringResult } from "../scoring/types";

export type ReportType = "executive" | "creative" | "technical";
export type ReportStatus = "draft" | "ready" | "failed";

export type ReportSection = {
  id: string;
  sectionKey: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  orderIndex: number;
};

export type ReportUsage = {
  provider: "local" | "openai" | "anthropic";
  draftModel: string;
  finalModel: string;
  reviewerModel?: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostEur: number;
};

export type ReportRecord = {
  id: string;
  organizationId: string;
  experimentId: string;
  assetId: string;
  analysisRunId: string;
  scoringResultId: string;
  assetName: string;
  reportType: ReportType;
  language: "es" | "en";
  status: ReportStatus;
  title: string;
  decision: string;
  tldr: string;
  guardrailStatus: "passed" | "rewritten" | "blocked";
  guardrailFindings: Array<{ pattern: string; replacement: string; count: number }>;
  usage: ReportUsage;
  htmlStorageKey: string;
  pdfStorageKey: string;
  sections: ReportSection[];
  scoringSnapshot: NeuroScoringResult;
  createdAt: string;
  updatedAt: string;
};
