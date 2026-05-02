import {
  Archive,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  History,
  Link2,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  addWorkflowCommentInApi,
  createTasksFromTopRecommendationsInApi,
  createWorkflowShareLinkInApi,
  ensureCollaborationSnapshotInApi,
  updateRecommendationStatusInApi,
  updateWorkflowTaskStatusInApi,
} from "../collaboration/apiCollaborationStore";
import {
  addWorkflowComment,
  createTasksFromTopRecommendations,
  createWorkflowShareLink,
  defaultRecommendationSeeds,
  ensureCollaborationSnapshot,
  updateRecommendationStatus,
  updateWorkflowTaskStatus,
} from "../collaboration/localCollaborationStore";
import type { CollaborationSnapshot, RecommendationSeed, WorkflowStatus } from "../collaboration/types";
import { loadStoredComparisons } from "../comparison/localComparisonStore";
import type { ComparisonReport } from "../comparison/types";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Button, Input, LinkButton } from "../components/ui";
import { useProjectStore } from "../projects/useProjectStore";

const statusLabels: Record<WorkflowStatus, string> = {
  draft: "Draft",
  reviewed: "Revisado",
  approved: "Aprobado",
  archived: "Archivado",
};

function toneForStatus(status: WorkflowStatus) {
  if (status === "approved") return "lime" as const;
  if (status === "reviewed") return "cyan" as const;
  if (status === "archived") return "muted" as const;
  return "amber" as const;
}

function seedsFromComparison(comparison?: ComparisonReport | null): RecommendationSeed[] {
  if (!comparison) return defaultRecommendationSeeds();
  return comparison.mix.slice(0, 5).map((segment) => ({
    sourceType: "comparison",
    sourceId: segment.id,
    timecode: segment.timecode,
    layer: segment.label,
    action: segment.action,
    confidence: "CONF 0.91",
    impact: segment.id === "cut" || segment.id === "closing" ? "Alto" : "Medio",
  }));
}

function buildShareUrl(token: string) {
  return `${window.location.origin}/share/${token}`;
}

function statusOptions() {
  return (Object.keys(statusLabels) as WorkflowStatus[]).map((status) => (
    <option key={status} value={status}>{statusLabels[status]}</option>
  ));
}

function WorkflowStats({ snapshot }: { snapshot: CollaborationSnapshot }) {
  const approved = snapshot.tasks.filter((task) => task.status === "approved").length;
  return (
    <section className="workflow-stat-grid">
      <article><span>Comentarios</span><strong>{snapshot.comments.length}</strong><em>por timecode</em></article>
      <article><span>Tareas</span><strong>{snapshot.tasks.length}</strong><em>{approved} aprobadas</em></article>
      <article><span>Recomendaciones</span><strong>{snapshot.recommendations.length}</strong><em>con estado</em></article>
      <article><span>Share links</span><strong>{snapshot.shareLinks.length}</strong><em>solo lectura</em></article>
    </section>
  );
}

export function WorkflowPage() {
  const { session } = useAuth();
  const [commentTimecode, setCommentTimecode] = useState("00:18-00:22");
  const [commentBody, setCommentBody] = useState("Recortar locucion y adelantar el refuerzo visual.");
  const [assignee, setAssignee] = useState("Edicion");
  const [shareTitle, setShareTitle] = useState("Revision cliente · Sprint 10");
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState("");
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  if (!session) return null;

  const organizationId = session.organization.id;
  const accessToken = session.accessToken;
  const useApi = session.provider === "supabase" && Boolean(accessToken);
  const userName = session.user.name;
  const { state, selectedBundle } = useProjectStore(organizationId, session.organization.name);
  const comparisons = loadStoredComparisons(organizationId);
  const query = new URLSearchParams(window.location.search);
  const queryExperimentId = query.get("experimentId");
  const comparison = comparisons.find((item) => item.experimentId === queryExperimentId) ?? comparisons[0] ?? null;
  const experimentId = queryExperimentId ?? comparison?.experimentId ?? selectedBundle?.experiment.id ?? state.experiments[0]?.id ?? "demo-workflow";
  const activeBundle = useMemo(() => {
    const experiment = state.experiments.find((item) => item.id === experimentId);
    if (!experiment) return selectedBundle;
    const project = state.projects.find((item) => item.id === experiment.projectId);
    const workspace = state.workspaces.find((item) => item.id === experiment.workspaceId);
    return project && workspace ? { project, experiment, workspace } : selectedBundle;
  }, [experimentId, selectedBundle, state.experiments, state.projects, state.workspaces]);
  const title = activeBundle ? `${activeBundle.project.brand} / ${activeBundle.project.campaign}` : "Demo workflow creativo";
  const seeds = useMemo(() => seedsFromComparison(comparison), [comparison?.id, comparison?.createdAt]);
  const [snapshot, setSnapshot] = useState(() => ensureCollaborationSnapshot(organizationId, experimentId, title, seeds, userName));
  const latestShare = snapshot.shareLinks[0];

  useEffect(() => {
    if (!useApi || !accessToken) return;
    let cancelled = false;
    setIsLoadingApi(true);
    setApiError("");
    ensureCollaborationSnapshotInApi(organizationId, experimentId, title, seeds, userName, accessToken)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((caught) => {
        if (!cancelled) setApiError(caught instanceof Error ? caught.message : "No se pudo cargar workflow desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, experimentId, organizationId, seeds, title, useApi, userName]);

  function apply(next: CollaborationSnapshot) {
    setSnapshot(next);
    setCopied(false);
  }

  async function applyRemote(operation: () => Promise<CollaborationSnapshot>, fallback: () => CollaborationSnapshot) {
    if (useApi && accessToken) {
      setIsLoadingApi(true);
      setApiError("");
      try {
        apply(await operation());
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio en API.");
      } finally {
        setIsLoadingApi(false);
      }
      return;
    }
    apply(fallback());
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentTimecode.trim() || !commentBody.trim()) return;
    const input = {
      sourceType: "timeline",
      sourceId: "manual-comment",
      timecode: commentTimecode.trim(),
      body: commentBody.trim(),
      authorName: userName,
    } as const;
    await applyRemote(
      () => addWorkflowCommentInApi(snapshot, input, accessToken || ""),
      () => addWorkflowComment(snapshot, input),
    );
    setCommentBody("");
  }

  function handleCreateTasks() {
    void applyRemote(
      () => createTasksFromTopRecommendationsInApi(snapshot, assignee.trim() || "Edicion", accessToken || "", 3),
      () => createTasksFromTopRecommendations(snapshot, assignee.trim() || "Edicion", 3),
    );
  }

  function handleRecommendationStatus(recommendationId: string, status: WorkflowStatus) {
    void applyRemote(
      () => updateRecommendationStatusInApi(snapshot, recommendationId, status, userName, accessToken || ""),
      () => updateRecommendationStatus(snapshot, recommendationId, status, userName),
    );
  }

  function handleTaskStatus(taskId: string, status: WorkflowStatus) {
    void applyRemote(
      () => updateWorkflowTaskStatusInApi(snapshot, taskId, status, userName, accessToken || ""),
      () => updateWorkflowTaskStatus(snapshot, taskId, status, userName),
    );
  }

  function handleCreateShareLink() {
    void applyRemote(
      () => createWorkflowShareLinkInApi(snapshot, shareTitle, userName, accessToken || "", 14),
      () => createWorkflowShareLink(snapshot, shareTitle, userName, 14),
    );
  }

  async function handleCopyShare(token: string) {
    await navigator.clipboard?.writeText(buildShareUrl(token));
    setCopied(true);
  }

  return (
    <AppShell active="workflow">
      <section className="workflow-hero">
        <div>
          <span className="workspace-eyebrow">Sprint 14 · Workflow creativo</span>
          <h2>Del informe a la ejecucion editorial.</h2>
          <p>{title} · comentarios por timecode, tareas asignables, estados y viewer externo solo lectura.</p>
        </div>
        <div className="result-hero-actions">
          <LinkButton href={latestShare ? `/share/${latestShare.token}` : "#share"} variant="secondary" icon={<ExternalLink size={15} />}>Viewer externo</LinkButton>
          <Button icon={<Link2 size={15} />} onClick={handleCreateShareLink} disabled={isLoadingApi}>Crear share link</Button>
        </div>
      </section>

      {apiError ? <p className="form-error">{apiError}</p> : null}

      <WorkflowStats snapshot={snapshot} />

      <section className="workflow-layout">
        <div className="workflow-main">
          <section className="workflow-panel">
            <div className="workflow-panel-head">
              <div>
                <span className="workspace-eyebrow">Recomendaciones</span>
                <h3>Estado editorial por accion.</h3>
              </div>
              <Badge tone="amber">max 5</Badge>
            </div>
            <div className="workflow-recommendation-list">
              {snapshot.recommendations.map((recommendation) => (
                <article key={recommendation.id}>
                  <Badge tone={recommendation.impact === "Alto" ? "coral" : "amber"}>{recommendation.impact}</Badge>
                  <div>
                    <span>{recommendation.timecode} · {recommendation.layer} · {recommendation.confidence}</span>
                    <strong>{recommendation.action}</strong>
                  </div>
                  <select
                    value={recommendation.status}
                    onChange={(event) => handleRecommendationStatus(recommendation.id, event.target.value as WorkflowStatus)}
                  >
                    {statusOptions()}
                  </select>
                </article>
              ))}
            </div>
          </section>

          <section className="workflow-panel">
            <div className="workflow-panel-head">
              <div>
                <span className="workspace-eyebrow">Tareas</span>
                <h3>De recomendacion a trabajo asignado.</h3>
              </div>
              <div className="workflow-inline-action">
                <Input label="Responsable" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
                <Button icon={<UserCheck size={15} />} onClick={handleCreateTasks} disabled={isLoadingApi}>Crear 3 tareas</Button>
              </div>
            </div>
            <div className="workflow-task-list">
              {snapshot.tasks.length ? snapshot.tasks.map((task) => (
                <article key={task.id}>
                  <div>
                    <Badge tone={toneForStatus(task.status)}>{statusLabels[task.status]}</Badge>
                    <Badge tone={task.impact === "Alto" ? "coral" : "muted"}>{task.impact}</Badge>
                  </div>
                  <div>
                    <span>{task.timecode} · {task.layer} · {task.assignee}</span>
                    <strong>{task.title}</strong>
                    <em>{task.confidence}</em>
                  </div>
                  <div className="task-actions">
                    <Button size="sm" variant="secondary" onClick={() => handleTaskStatus(task.id, "reviewed")}>Revisado</Button>
                    <Button size="sm" onClick={() => handleTaskStatus(task.id, "approved")}>Aprobar</Button>
                    <Button size="sm" variant="ghost" icon={<Archive size={13} />} onClick={() => handleTaskStatus(task.id, "archived")}>Archivar</Button>
                  </div>
                </article>
              )) : (
                <div className="workflow-empty">
                  <CheckCircle2 size={18} />
                  <strong>Aun no hay tareas.</strong>
                  <span>Crea 3 tareas desde las recomendaciones para preparar el handoff creativo.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="workflow-side">
          <section className="workflow-panel">
            <div className="workflow-panel-head">
              <div>
                <span className="workspace-eyebrow">Comentarios</span>
                <h3>Comentar sobre timeline.</h3>
              </div>
              <MessageSquarePlus size={18} />
            </div>
            <form className="workflow-comment-form" onSubmit={handleComment}>
              <Input label="Timecode" value={commentTimecode} onChange={(event) => setCommentTimecode(event.target.value)} />
              <label className="field">
                <span className="field-label">Comentario</span>
                <textarea className="input workflow-textarea" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
              </label>
              <Button icon={<Send size={15} />}>Anadir comentario</Button>
            </form>
            <div className="workflow-comment-list">
              {snapshot.comments.map((comment) => (
                <article key={comment.id}>
                  <span>{comment.timecode} · {comment.authorName}</span>
                  <strong>{comment.body}</strong>
                </article>
              ))}
            </div>
          </section>

          <section id="share" className="workflow-panel">
            <div className="workflow-panel-head">
              <div>
                <span className="workspace-eyebrow">Share link</span>
                <h3>Viewer externo solo lectura.</h3>
              </div>
              <ShieldCheck size={18} />
            </div>
            <Input label="Titulo" value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} />
            {latestShare ? (
              <div className="share-card">
                <span>{latestShare.viewerRole} · expira {new Intl.DateTimeFormat("es-ES").format(new Date(latestShare.expiresAt))}</span>
                <strong>{buildShareUrl(latestShare.token)}</strong>
                <div>
                  <Button size="sm" variant="secondary" icon={<Copy size={13} />} onClick={() => handleCopyShare(latestShare.token)}>{copied ? "Copiado" : "Copiar"}</Button>
                  <LinkButton size="sm" href={`/share/${latestShare.token}`} icon={<ExternalLink size={13} />}>Abrir viewer</LinkButton>
                </div>
              </div>
            ) : (
              <p className="workflow-note">Crea un enlace para compartir tareas, comentarios e historial sin acceso de edicion.</p>
            )}
          </section>

          <section className="workflow-panel">
            <div className="workflow-panel-head">
              <div>
                <span className="workspace-eyebrow">Historial</span>
                <h3>Trazabilidad basica.</h3>
              </div>
              <History size={18} />
            </div>
            <div className="workflow-history-list">
              {snapshot.history.slice(0, 8).map((event) => (
                <article key={event.id}>
                  <Clock3 size={13} />
                  <div>
                    <span>{event.action} · {new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(event.createdAt))}</span>
                    <strong>{event.description}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
