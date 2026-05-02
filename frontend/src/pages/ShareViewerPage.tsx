import { Clock3, Eye, FileText, ShieldCheck } from "lucide-react";
import { findSharedSnapshotByToken } from "../collaboration/localCollaborationStore";
import { Badge, LinkButton } from "../components/ui";
import { PraeviaLockup } from "../components/brand/PraeviaLogo";

function statusTone(status: string) {
  if (status === "approved") return "lime" as const;
  if (status === "reviewed") return "cyan" as const;
  if (status === "archived") return "muted" as const;
  return "amber" as const;
}

export function ShareViewerPage({ token }: { token: string }) {
  const shared = findSharedSnapshotByToken(token);

  if (!shared) {
    return (
      <main className="share-viewer-shell">
        <header><PraeviaLockup size={16} compact /><Badge tone="coral">No disponible</Badge></header>
        <section className="share-empty">
          <h1>Este enlace no existe o ha expirado.</h1>
          <p>Pide al equipo PraevIA un nuevo viewer externo para revisar el informe.</p>
          <LinkButton href="/">Volver a PraevIA</LinkButton>
        </section>
      </main>
    );
  }

  const { snapshot, share } = shared;

  return (
    <main className="share-viewer-shell">
      <header>
        <PraeviaLockup size={16} compact />
        <div>
          <Badge tone="lime"><Eye size={13} /> Solo lectura</Badge>
          <Badge tone="muted">Expira {new Intl.DateTimeFormat("es-ES").format(new Date(share.expiresAt))}</Badge>
        </div>
      </header>

      <section className="share-hero">
        <div>
          <span className="workspace-eyebrow">Viewer externo</span>
          <h1>{share.title}</h1>
          <p>{snapshot.title} · tareas, comentarios e historial del workflow creativo.</p>
        </div>
        <div className="share-summary">
          <div><span>Tareas</span><strong>{snapshot.tasks.length}</strong></div>
          <div><span>Comentarios</span><strong>{snapshot.comments.length}</strong></div>
          <div><span>Recomendaciones</span><strong>{snapshot.recommendations.length}</strong></div>
        </div>
      </section>

      <section className="share-grid">
        <article className="share-panel">
          <div className="workflow-panel-head">
            <div><span className="workspace-eyebrow">Tareas</span><h3>Estado de ejecucion.</h3></div>
            <FileText size={18} />
          </div>
          {snapshot.tasks.map((task) => (
            <div className="share-row" key={task.id}>
              <Badge tone={statusTone(task.status)}>{task.status}</Badge>
              <div>
                <span>{task.timecode} · {task.layer} · {task.assignee}</span>
                <strong>{task.title}</strong>
              </div>
            </div>
          ))}
        </article>

        <article className="share-panel">
          <div className="workflow-panel-head">
            <div><span className="workspace-eyebrow">Comentarios</span><h3>Notas por timecode.</h3></div>
            <ShieldCheck size={18} />
          </div>
          {snapshot.comments.map((comment) => (
            <div className="share-row" key={comment.id}>
              <Badge tone="amber">{comment.timecode}</Badge>
              <div>
                <span>{comment.authorName}</span>
                <strong>{comment.body}</strong>
              </div>
            </div>
          ))}
        </article>
      </section>

      <section className="share-panel">
        <div className="workflow-panel-head">
          <div><span className="workspace-eyebrow">Historial</span><h3>Ultimos cambios.</h3></div>
          <Clock3 size={18} />
        </div>
        <div className="workflow-history-list">
          {snapshot.history.slice(0, 10).map((event) => (
            <article key={event.id}>
              <Clock3 size={13} />
              <div>
                <span>{event.action}</span>
                <strong>{event.description}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
