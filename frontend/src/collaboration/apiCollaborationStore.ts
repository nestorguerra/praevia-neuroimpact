import { apiFetch } from "../api/client";
import type {
  CollaborationSnapshot,
  RecommendationSeed,
  ShareLink,
  WorkflowComment,
  WorkflowHistoryEvent,
  WorkflowRecommendation,
  WorkflowStatus,
  WorkflowTask,
} from "./types";

type ApiRecommendation = {
  id: string;
  organization_id: string;
  experiment_id: string;
  source_type: WorkflowRecommendation["sourceType"];
  source_id: string;
  timecode: string;
  layer: string;
  action: string;
  confidence: string;
  impact: WorkflowRecommendation["impact"];
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
};

type ApiComment = {
  id: string;
  organization_id: string;
  experiment_id: string;
  source_type: WorkflowComment["sourceType"];
  source_id: string;
  timecode: string;
  body: string;
  author_name: string;
  resolved: boolean;
  created_at: string;
};

type ApiTask = {
  id: string;
  organization_id: string;
  experiment_id: string;
  source_recommendation_id: string;
  title: string;
  timecode: string;
  layer: string;
  assignee: string;
  confidence: string;
  impact: WorkflowTask["impact"];
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
};

type ApiShareLink = {
  id: string;
  organization_id: string;
  experiment_id: string;
  token: string;
  title: string;
  viewer_role: ShareLink["viewerRole"];
  status: ShareLink["status"];
  created_by: string;
  created_at: string;
  expires_at: string;
};

type ApiHistory = {
  id: string;
  organization_id: string;
  experiment_id: string;
  actor_name: string;
  action: string;
  entity_type: WorkflowHistoryEvent["entityType"];
  entity_id: string;
  description: string;
  created_at: string;
  metadata: WorkflowHistoryEvent["metadata"];
};

type ApiSnapshot = {
  organization_id: string;
  experiment_id: string;
  recommendations: ApiRecommendation[];
  comments: ApiComment[];
  tasks: ApiTask[];
  share_links: ApiShareLink[];
  history: ApiHistory[];
};

function recommendationFromApi(row: ApiRecommendation): WorkflowRecommendation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    timecode: row.timecode,
    layer: row.layer,
    action: row.action,
    confidence: row.confidence,
    impact: row.impact,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commentFromApi(row: ApiComment): WorkflowComment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    timecode: row.timecode,
    body: row.body,
    authorName: row.author_name,
    resolved: row.resolved,
    createdAt: row.created_at,
  };
}

function taskFromApi(row: ApiTask): WorkflowTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    sourceRecommendationId: row.source_recommendation_id,
    title: row.title,
    timecode: row.timecode,
    layer: row.layer,
    assignee: row.assignee,
    confidence: row.confidence,
    impact: row.impact,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function shareFromApi(row: ApiShareLink): ShareLink {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    token: row.token,
    title: row.title,
    viewerRole: row.viewer_role,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function historyFromApi(row: ApiHistory): WorkflowHistoryEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    description: row.description,
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

function snapshotFromApi(row: ApiSnapshot, title: string): CollaborationSnapshot {
  const timestamps = [
    ...row.recommendations.map((item) => item.updated_at),
    ...row.comments.map((item) => item.created_at),
    ...row.tasks.map((item) => item.updated_at),
    ...row.history.map((item) => item.created_at),
  ].sort();
  return {
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    title,
    recommendations: row.recommendations.map(recommendationFromApi),
    comments: row.comments.map(commentFromApi),
    tasks: row.tasks.map(taskFromApi),
    shareLinks: row.share_links.map(shareFromApi),
    history: row.history.map(historyFromApi),
    updatedAt: timestamps.at(-1) ?? new Date().toISOString(),
  };
}

export async function loadCollaborationSnapshotFromApi(
  organizationId: string,
  experimentId: string,
  title: string,
  accessToken: string,
): Promise<CollaborationSnapshot> {
  const row = await apiFetch<ApiSnapshot>(`/v1/collaboration/${organizationId}/${experimentId}`, accessToken);
  return snapshotFromApi(row, title);
}

export async function ensureCollaborationSnapshotInApi(
  organizationId: string,
  experimentId: string,
  title: string,
  seeds: RecommendationSeed[],
  actorName: string,
  accessToken: string,
): Promise<CollaborationSnapshot> {
  const current = await loadCollaborationSnapshotFromApi(organizationId, experimentId, title, accessToken);
  const missing = seeds
    .slice(0, 5)
    .filter((seed) => !current.recommendations.some((item) => item.sourceType === seed.sourceType && item.sourceId === seed.sourceId));
  if (!missing.length) return current;
  await Promise.all(missing.map((seed) => apiFetch<ApiRecommendation>("/v1/collaboration/recommendations", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      experiment_id: experimentId,
      source_type: seed.sourceType,
      source_id: seed.sourceId,
      timecode: seed.timecode,
      layer: seed.layer,
      action: seed.action,
      confidence: seed.confidence,
      impact: seed.impact,
      actor_name: actorName,
    }),
  })));
  return loadCollaborationSnapshotFromApi(organizationId, experimentId, title, accessToken);
}

export async function addWorkflowCommentInApi(
  snapshot: CollaborationSnapshot,
  input: Pick<WorkflowComment, "sourceType" | "sourceId" | "timecode" | "body" | "authorName">,
  accessToken: string,
): Promise<CollaborationSnapshot> {
  await apiFetch<ApiComment>("/v1/collaboration/comments", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: snapshot.organizationId,
      experiment_id: snapshot.experimentId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      timecode: input.timecode,
      body: input.body,
      author_name: input.authorName,
    }),
  });
  return loadCollaborationSnapshotFromApi(snapshot.organizationId, snapshot.experimentId, snapshot.title, accessToken);
}

export async function createTasksFromTopRecommendationsInApi(
  snapshot: CollaborationSnapshot,
  assignee: string,
  accessToken: string,
  limit = 3,
): Promise<CollaborationSnapshot> {
  const missing = snapshot.recommendations
    .slice(0, limit)
    .filter((recommendation) => !snapshot.tasks.some((task) => task.sourceRecommendationId === recommendation.id));
  await Promise.all(missing.map((recommendation) => apiFetch<ApiTask>("/v1/collaboration/tasks", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: snapshot.organizationId,
      experiment_id: snapshot.experimentId,
      source_recommendation_id: recommendation.id,
      title: recommendation.action,
      timecode: recommendation.timecode,
      layer: recommendation.layer,
      assignee,
      confidence: recommendation.confidence,
      impact: recommendation.impact,
    }),
  })));
  return loadCollaborationSnapshotFromApi(snapshot.organizationId, snapshot.experimentId, snapshot.title, accessToken);
}

export async function updateWorkflowTaskStatusInApi(
  snapshot: CollaborationSnapshot,
  taskId: string,
  status: WorkflowStatus,
  actorName: string,
  accessToken: string,
): Promise<CollaborationSnapshot> {
  await apiFetch<ApiTask>(`/v1/collaboration/tasks/${taskId}/status`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status, actor_name: actorName }),
  });
  return loadCollaborationSnapshotFromApi(snapshot.organizationId, snapshot.experimentId, snapshot.title, accessToken);
}

export async function updateRecommendationStatusInApi(
  snapshot: CollaborationSnapshot,
  recommendationId: string,
  status: WorkflowStatus,
  actorName: string,
  accessToken: string,
): Promise<CollaborationSnapshot> {
  await apiFetch<ApiRecommendation>(`/v1/collaboration/recommendations/${recommendationId}/status`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status, actor_name: actorName }),
  });
  return loadCollaborationSnapshotFromApi(snapshot.organizationId, snapshot.experimentId, snapshot.title, accessToken);
}

export async function createWorkflowShareLinkInApi(
  snapshot: CollaborationSnapshot,
  title: string,
  createdBy: string,
  accessToken: string,
  expiresInDays = 14,
): Promise<CollaborationSnapshot> {
  await apiFetch<ApiShareLink>("/v1/collaboration/share-links", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: snapshot.organizationId,
      experiment_id: snapshot.experimentId,
      title,
      viewer_role: "client_viewer",
      expires_in_days: expiresInDays,
      created_by: createdBy,
    }),
  });
  return loadCollaborationSnapshotFromApi(snapshot.organizationId, snapshot.experimentId, snapshot.title, accessToken);
}
