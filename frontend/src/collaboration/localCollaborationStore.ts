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

const storageKey = (organizationId: string) => `praevia:collaboration:${organizationId}`;

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function now() {
  return new Date().toISOString();
}

function readSnapshots(organizationId: string): CollaborationSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshots(organizationId: string, snapshots: CollaborationSnapshot[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(snapshots));
}

function saveSnapshot(snapshot: CollaborationSnapshot) {
  const snapshots = readSnapshots(snapshot.organizationId).filter((item) => item.experimentId !== snapshot.experimentId);
  writeSnapshots(snapshot.organizationId, [snapshot, ...snapshots]);
  return snapshot;
}

function historyEvent(snapshot: CollaborationSnapshot, event: Omit<WorkflowHistoryEvent, "id" | "organizationId" | "experimentId" | "createdAt">): WorkflowHistoryEvent {
  return {
    id: createId("history"),
    organizationId: snapshot.organizationId,
    experimentId: snapshot.experimentId,
    createdAt: now(),
    ...event,
  };
}

function buildRecommendations(organizationId: string, experimentId: string, seeds: RecommendationSeed[]): WorkflowRecommendation[] {
  return seeds.slice(0, 5).map((seed) => ({
    id: createId("rec"),
    organizationId,
    experimentId,
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
    ...seed,
  }));
}

export function defaultRecommendationSeeds(): RecommendationSeed[] {
  return [
    {
      sourceType: "timeline",
      sourceId: "demo-valley",
      timecode: "00:18-00:22",
      layer: "Audio",
      action: "Recortar locucion y adelantar el refuerzo visual del beneficio.",
      confidence: "CONF 0.90",
      impact: "Alto",
    },
    {
      sourceType: "recommendation",
      sourceId: "demo-opening",
      timecode: "00:00-00:06",
      layer: "Video",
      action: "Abrir con plano humano antes del packshot para subir anclaje social.",
      confidence: "CONF 0.86",
      impact: "Medio",
    },
    {
      sourceType: "recommendation",
      sourceId: "demo-cta",
      timecode: "00:24-00:30",
      layer: "Accion",
      action: "Usar cierre de Version B y mantener claim corto junto al CTA.",
      confidence: "CONF 0.92",
      impact: "Alto",
    },
  ];
}

export function ensureCollaborationSnapshot(
  organizationId: string,
  experimentId: string,
  title: string,
  seeds: RecommendationSeed[] = defaultRecommendationSeeds(),
  actorName = "Sistema",
): CollaborationSnapshot {
  const existing = readSnapshots(organizationId).find((item) => item.experimentId === experimentId);
  if (existing) {
    const missingSeeds = seeds.filter((seed) => !existing.recommendations.some((item) => item.sourceId === seed.sourceId));
    if (!missingSeeds.length) return existing;
    return saveSnapshot({
      ...existing,
      recommendations: [...existing.recommendations, ...buildRecommendations(organizationId, experimentId, missingSeeds)],
      history: [
        historyEvent(existing, {
          actorName,
          action: "workflow.seeded",
          entityType: "workflow",
          entityId: experimentId,
          description: "Workflow actualizado con nuevas recomendaciones accionables.",
          metadata: { added: missingSeeds.length },
        }),
        ...existing.history,
      ],
      updatedAt: now(),
    });
  }

  const snapshot: CollaborationSnapshot = {
    organizationId,
    experimentId,
    title,
    recommendations: buildRecommendations(organizationId, experimentId, seeds),
    comments: [],
    tasks: [],
    shareLinks: [],
    history: [],
    updatedAt: now(),
  };
  snapshot.history = [
    historyEvent(snapshot, {
      actorName,
      action: "workflow.created",
      entityType: "workflow",
      entityId: experimentId,
      description: `Workflow creativo creado para ${title}.`,
      metadata: { recommendations: snapshot.recommendations.length },
    }),
  ];
  return saveSnapshot(snapshot);
}

export function loadCollaborationSnapshot(organizationId: string, experimentId: string) {
  return readSnapshots(organizationId).find((item) => item.experimentId === experimentId) ?? null;
}

export function addWorkflowComment(snapshot: CollaborationSnapshot, input: Pick<WorkflowComment, "sourceType" | "sourceId" | "timecode" | "body" | "authorName">) {
  const comment: WorkflowComment = {
    id: createId("comment"),
    organizationId: snapshot.organizationId,
    experimentId: snapshot.experimentId,
    resolved: false,
    createdAt: now(),
    ...input,
  };
  return saveSnapshot({
    ...snapshot,
    comments: [comment, ...snapshot.comments],
    history: [
      historyEvent(snapshot, {
        actorName: input.authorName,
        action: "comment.created",
        entityType: "comment",
        entityId: comment.id,
        description: `${input.authorName} comento ${input.timecode}.`,
        metadata: { timecode: input.timecode },
      }),
      ...snapshot.history,
    ],
    updatedAt: now(),
  });
}

export function createTaskFromRecommendation(snapshot: CollaborationSnapshot, recommendation: WorkflowRecommendation, assignee: string) {
  if (snapshot.tasks.some((task) => task.sourceRecommendationId === recommendation.id)) return snapshot;
  const task: WorkflowTask = {
    id: createId("task"),
    organizationId: snapshot.organizationId,
    experimentId: snapshot.experimentId,
    sourceRecommendationId: recommendation.id,
    title: recommendation.action,
    timecode: recommendation.timecode,
    layer: recommendation.layer,
    assignee,
    confidence: recommendation.confidence,
    impact: recommendation.impact,
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
  };
  return saveSnapshot({
    ...snapshot,
    tasks: [task, ...snapshot.tasks],
    history: [
      historyEvent(snapshot, {
        actorName: assignee,
        action: "task.created",
        entityType: "task",
        entityId: task.id,
        description: `Tarea creada para ${task.timecode}: ${task.title}`,
        metadata: { layer: task.layer, impact: task.impact },
      }),
      ...snapshot.history,
    ],
    updatedAt: now(),
  });
}

export function createTasksFromTopRecommendations(snapshot: CollaborationSnapshot, assignee: string, limit = 3) {
  return snapshot.recommendations.slice(0, limit).reduce((current, recommendation) => createTaskFromRecommendation(current, recommendation, assignee), snapshot);
}

export function updateWorkflowTaskStatus(snapshot: CollaborationSnapshot, taskId: string, status: WorkflowStatus, actorName: string) {
  const task = snapshot.tasks.find((item) => item.id === taskId);
  return saveSnapshot({
    ...snapshot,
    tasks: snapshot.tasks.map((item) => item.id === taskId ? { ...item, status, updatedAt: now() } : item),
    history: task ? [
      historyEvent(snapshot, {
        actorName,
        action: `task.${status}`,
        entityType: "task",
        entityId: taskId,
        description: `${actorName} marco "${task.title}" como ${status}.`,
        metadata: { status, timecode: task.timecode },
      }),
      ...snapshot.history,
    ] : snapshot.history,
    updatedAt: now(),
  });
}

export function updateRecommendationStatus(snapshot: CollaborationSnapshot, recommendationId: string, status: WorkflowStatus, actorName: string) {
  const recommendation = snapshot.recommendations.find((item) => item.id === recommendationId);
  return saveSnapshot({
    ...snapshot,
    recommendations: snapshot.recommendations.map((item) => item.id === recommendationId ? { ...item, status, updatedAt: now() } : item),
    history: recommendation ? [
      historyEvent(snapshot, {
        actorName,
        action: `recommendation.${status}`,
        entityType: "recommendation",
        entityId: recommendationId,
        description: `${actorName} marco la recomendacion ${recommendation.timecode} como ${status}.`,
        metadata: { status, timecode: recommendation.timecode },
      }),
      ...snapshot.history,
    ] : snapshot.history,
    updatedAt: now(),
  });
}

export function createWorkflowShareLink(snapshot: CollaborationSnapshot, title: string, createdBy: string, expiresInDays = 14) {
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const share: ShareLink = {
    id: createId("share"),
    organizationId: snapshot.organizationId,
    experimentId: snapshot.experimentId,
    token: createId("token").replace("token_", ""),
    title,
    viewerRole: "client_viewer",
    status: "active",
    createdBy,
    createdAt: now(),
    expiresAt,
  };
  return saveSnapshot({
    ...snapshot,
    shareLinks: [share, ...snapshot.shareLinks],
    history: [
      historyEvent(snapshot, {
        actorName: createdBy,
        action: "share.created",
        entityType: "share_link",
        entityId: share.token,
        description: `${createdBy} creo un viewer externo solo lectura.`,
        metadata: { expiresInDays },
      }),
      ...snapshot.history,
    ],
    updatedAt: now(),
  });
}

export function findSharedSnapshotByToken(token: string) {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("praevia:collaboration:")) continue;
    const organizationId = key.replace("praevia:collaboration:", "");
    const snapshots = readSnapshots(organizationId);
    const snapshot = snapshots.find((item) => item.shareLinks.some((share) => share.token === token));
    if (!snapshot) continue;
    const share = snapshot.shareLinks.find((item) => item.token === token);
    if (!share || share.status !== "active" || new Date(share.expiresAt).getTime() < Date.now()) return null;
    return { snapshot, share };
  }
  return null;
}
