import { CalendarDays, Goal, Languages, RadioTower, Users } from "lucide-react";
import { Badge, LinkButton } from "../ui";
import { experimentTypeLabels, statusLabels } from "../../projects/templates";
import type { ProjectBundle } from "../../projects/types";

type ProjectDetailProps = {
  bundle: ProjectBundle | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function ProjectDetail({ bundle }: ProjectDetailProps) {
  if (!bundle) {
    return (
      <aside className="project-detail empty">
        <h3>Selecciona un proyecto</h3>
        <p>El detalle mostrara workspace, objetivo, experimento, audiencia, canal, idioma y KPI esperado.</p>
      </aside>
    );
  }

  return (
    <aside className="project-detail">
      <div className="detail-top">
        <span>{bundle.workspace.name}</span>
        <Badge tone={bundle.project.status === "report_ready" ? "lime" : bundle.project.status === "draft" ? "amber" : "muted"}>
          {statusLabels[bundle.project.status]}
        </Badge>
      </div>
      <h3>{bundle.project.brand}</h3>
      <h4>{bundle.project.campaign}</h4>
      <div className="detail-experiment">
        <strong>{bundle.experiment.name}</strong>
        <span>{experimentTypeLabels[bundle.experiment.type]} · {bundle.experiment.assetSlots} asset{bundle.experiment.assetSlots > 1 ? "s" : ""}</span>
      </div>
      <div className="detail-grid">
        <div><Goal size={16} /><span>Objetivo</span><strong>{bundle.project.objective}</strong></div>
        <div><RadioTower size={16} /><span>Canal</span><strong>{bundle.project.channel}</strong></div>
        <div><Users size={16} /><span>Audiencia</span><strong>{bundle.project.audience}</strong></div>
        <div><Languages size={16} /><span>Idioma</span><strong>{bundle.project.language}</strong></div>
        <div><CalendarDays size={16} /><span>KPI esperado</span><strong>{bundle.project.expectedKpi}</strong></div>
      </div>
      <LinkButton href={`/app/upload?experimentId=${bundle.experiment.id}`}>Ir a upload</LinkButton>
      <p className="detail-note">Sprint 4 conectara esta accion con storage y Asset Health Check real.</p>
    </aside>
  );
}
