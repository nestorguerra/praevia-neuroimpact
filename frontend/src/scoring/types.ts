export type ConfidenceLabel = "baja" | "media" | "alta";

export type EditorialMetricKey =
  | "nri"
  | "visual_salience"
  | "narrative_clarity"
  | "multimodal_coherence"
  | "semantic_load"
  | "social_cueing"
  | "scene_immersion"
  | "action_readiness"
  | "temporal_momentum";

export type EditorialScore = {
  metricKey: EditorialMetricKey;
  metricLabel: string;
  score: number;
  confidence: number;
  benchmarkDelta: number;
  evidence: string;
  action: string;
};

export type RegionScore = {
  regionKey: string;
  regionLabel: string;
  networkKey: string;
  score: number;
  meanResponse: number;
  peakResponse: number;
  evidence: string;
};

export type NetworkScore = {
  networkKey: string;
  networkLabel: string;
  score: number;
  confidence: number;
  evidence: string;
};

export type TimecoursePoint = {
  pointIndex: number;
  boldTimeSeconds: number;
  stimulusTimeSeconds: number;
  globalResponse: number;
  normalizedResponse: number;
  eventLabel?: "peak" | "valley" | "flat";
};

export type PeakMoment = {
  momentType: "peak" | "valley" | "flat";
  startSeconds: number;
  endSeconds: number;
  score: number;
  evidence: string;
  action: string;
};

export type NeuroScoringResult = {
  id: string;
  organizationId: string;
  experimentId: string;
  assetId: string;
  analysisRunId: string;
  assetName: string;
  modelId: string;
  scoringVersion: string;
  confidenceLabel: ConfidenceLabel;
  benchmarkLabel: string;
  boldDelaySeconds: number;
  summary: {
    nri: number;
    confidence: ConfidenceLabel;
    benchmark: string;
    decision: string;
  };
  editorialScores: EditorialScore[];
  regionScores: RegionScore[];
  networkScores: NetworkScore[];
  timecoursePoints: TimecoursePoint[];
  peakMoments: PeakMoment[];
  createdAt: string;
};

