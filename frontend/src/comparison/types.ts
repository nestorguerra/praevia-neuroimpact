import type { NeuroScoringResult } from "../scoring/types";
import type { AssetSlot } from "../uploads/types";

export type ComparisonVersion = {
  slot: AssetSlot;
  label: string;
  result: NeuroScoringResult;
  nri: number;
  rank: number;
  globalDelta: number;
  pipelineMode?: string;
  runStatus?: string;
  assetKind?: string;
  durationSeconds?: number;
  nTimesteps?: number;
  nVertices?: number;
};

export type ComparisonMetricDelta = {
  metricKey: string;
  metricLabel: string;
  winnerSlot: AssetSlot;
  values: Record<AssetSlot, number | undefined>;
  deltas: Record<AssetSlot, number | undefined>;
  category?: string;
};

export type ComparisonTimepoint = {
  pointIndex: number;
  timecode: string;
  winnerSlot: AssetSlot;
  values: Record<AssetSlot, number | undefined>;
  margin?: number;
};

export type MixSegment = {
  id: string;
  label: string;
  timecode: string;
  sourceSlot: AssetSlot;
  reason: string;
  action: string;
  impact?: string;
  confidence?: string;
};

export type ComparabilityIssue = {
  severity: "ok" | "warning" | "error";
  label: string;
  detail: string;
};

export type ComparisonReport = {
  id: string;
  organizationId: string;
  experimentId: string;
  title: string;
  status: "ready" | "needs_review";
  decision: string;
  masterSlot: AssetSlot;
  versions: ComparisonVersion[];
  metricDeltas: ComparisonMetricDelta[];
  timepoints: ComparisonTimepoint[];
  mix: MixSegment[];
  comparability: ComparabilityIssue[];
  winnerByModality: Partial<Record<string, AssetSlot>>;
  reportPayload: Record<string, unknown>;
  createdAt: string;
};
