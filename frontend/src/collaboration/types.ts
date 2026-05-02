export type WorkflowStatus = "draft" | "reviewed" | "approved" | "archived";

export type WorkflowRecommendation = {
  id: string;
  organizationId: string;
  experimentId: string;
  sourceType: "timeline" | "recommendation" | "report" | "comparison";
  sourceId: string;
  timecode: string;
  layer: string;
  action: string;
  confidence: string;
  impact: "Bajo" | "Medio" | "Alto";
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowComment = {
  id: string;
  organizationId: string;
  experimentId: string;
  sourceType: "timeline" | "recommendation" | "report" | "comparison";
  sourceId: string;
  timecode: string;
  body: string;
  authorName: string;
  resolved: boolean;
  createdAt: string;
};

export type WorkflowTask = {
  id: string;
  organizationId: string;
  experimentId: string;
  sourceRecommendationId: string;
  title: string;
  timecode: string;
  layer: string;
  assignee: string;
  confidence: string;
  impact: "Bajo" | "Medio" | "Alto";
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
};

export type ShareLink = {
  id: string;
  organizationId: string;
  experimentId: string;
  token: string;
  title: string;
  viewerRole: "client_viewer" | "agency_viewer" | "internal_viewer";
  status: "active" | "revoked" | "expired";
  createdBy: string;
  createdAt: string;
  expiresAt: string;
};

export type WorkflowHistoryEvent = {
  id: string;
  organizationId: string;
  experimentId: string;
  actorName: string;
  action: string;
  entityType: "comment" | "task" | "recommendation" | "share_link" | "workflow";
  entityId: string;
  description: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
};

export type CollaborationSnapshot = {
  organizationId: string;
  experimentId: string;
  title: string;
  recommendations: WorkflowRecommendation[];
  comments: WorkflowComment[];
  tasks: WorkflowTask[];
  shareLinks: ShareLink[];
  history: WorkflowHistoryEvent[];
  updatedAt: string;
};

export type RecommendationSeed = Pick<WorkflowRecommendation, "sourceType" | "sourceId" | "timecode" | "layer" | "action" | "confidence" | "impact">;
