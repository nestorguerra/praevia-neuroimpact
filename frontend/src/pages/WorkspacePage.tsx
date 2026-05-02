import { FileText, FolderPlus, Plus, ShieldCheck, UploadCloud, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ProjectDetail } from "../components/projects/ProjectDetail";
import { ProjectFilters } from "../components/projects/ProjectFilters";
import { ProjectWizard } from "../components/projects/ProjectWizard";
import { Badge, Button, Card, LinkButton, ScoreCard, TimelinePanel, UploadRow } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { experimentTypeLabels, statusLabels } from "../projects/templates";
import type { ExperimentType, ProjectStatus } from "../projects/types";
import { useProjectStore } from "../projects/useProjectStore";

export function WorkspacePage() {
  const { session } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProjectStatus>("all");
  const [type, setType] = useState<"all" | ExperimentType>("all");
  const [workspaceId, setWorkspaceId] = useState<"all" | string>("all");

  if (!session) return null;

  const { state, selectedBundle, selectedProjectId, setSelectedProjectId, isLoading, error, createBundle } = useProjectStore(session.organization.id, session.organization.name);

  const projectBundles = useMemo(() => state.projects.map((project) => {
    const workspace = state.workspaces.find((item) => item.id === project.workspaceId);
    const experiment = state.experiments.find((item) => item.projectId === project.id);
    if (!workspace || !experiment) return null;
    return { project, workspace, experiment };
  }).filter((bundle) => bundle !== null), [state]);

  const filteredBundles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projectBundles.filter((bundle) => {
      const matchesQuery = !needle || [
        bundle.project.brand,
        bundle.project.campaign,
        bundle.project.objective,
        bundle.project.audience,
        bundle.project.channel,
        bundle.workspace.name,
      ].join(" ").toLowerCase().includes(needle);
      const matchesStatus = status === "all" || bundle.project.status === status;
      const matchesType = type === "all" || bundle.experiment.type === type;
      const matchesWorkspace = workspaceId === "all" || bundle.workspace.id === workspaceId;
      return matchesQuery && matchesStatus && matchesType && matchesWorkspace;
    });
  }, [projectBundles, query, status, type, workspaceId]);

  const stats = [
    { label: "Workspaces", value: String(state.workspaces.length), delta: "multi-marca listo" },
    { label: "Proyectos", value: String(state.projects.length), delta: "+ wizard activo" },
    { label: "Experimentos", value: String(state.experiments.length), delta: "individual / A/B/C" },
    { label: "Creditos", value: String(session.organization.credits), delta: session.organization.plan },
  ];

  return (
    <AppShell active="workspace">
      {showWizard ? (
        <ProjectWizard
          workspaces={state.workspaces}
          onCancel={() => setShowWizard(false)}
          onCreate={async (input) => {
            await createBundle(input);
            setShowWizard(false);
          }}
        />
      ) : null}

      <section className="workspace-hero">
        <div>
          <span className="workspace-eyebrow">Workspace privado</span>
          <h2>Workspaces, proyectos y experimentos ya tienen estructura funcional.</h2>
          <p>{session.provider === "supabase" ? "Modo Postgres activo: los proyectos se cargan desde API y sobreviven a reinicios." : "Modo local: demo en navegador hasta conectar Supabase/Postgres."}</p>
        </div>
        <div className="workspace-actions">
          <Button icon={<FolderPlus size={16} />} onClick={() => setShowWizard(true)}>Crear proyecto</Button>
          <LinkButton href="/design-hub/prototype.html" variant="secondary">Ver prototipo</LinkButton>
        </div>
      </section>

      <section className="workspace-stat-grid">
        {stats.map((stat) => (
          <article className="workspace-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <em>{stat.delta}</em>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <div className="workspace-primary">
          <div className="section-title-row">
            <div>
              <span className="breadcrumbs">Organizacion / Proyectos</span>
              <h2>Proyectos y experimentos</h2>
            </div>
            <Button icon={<Plus size={15} />} onClick={() => setShowWizard(true)}>Nuevo proyecto</Button>
          </div>

          <ProjectFilters
            query={query}
            status={status}
            type={type}
            workspaceId={workspaceId}
            workspaces={state.workspaces}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onTypeChange={setType}
            onWorkspaceChange={setWorkspaceId}
          />

          {isLoading ? <div className="project-empty"><strong>Cargando desde base de datos.</strong><span>Sincronizando proyectos persistentes.</span></div> : null}
          {error ? <div className="project-empty"><strong>Error de base de datos.</strong><span>{error}</span></div> : null}

          <div className="project-list">
            {filteredBundles.map((bundle) => (
              <button
                type="button"
                className={bundle.project.id === selectedProjectId ? "project-row selected" : "project-row"}
                key={bundle.project.id}
                onClick={() => setSelectedProjectId(bundle.project.id)}
              >
                <div>
                  <span>{bundle.workspace.name}</span>
                  <strong>{bundle.project.brand} / {bundle.project.campaign}</strong>
                  <em>{experimentTypeLabels[bundle.experiment.type]} · {bundle.project.channel}</em>
                </div>
                <Badge tone={bundle.project.status === "report_ready" ? "lime" : bundle.project.status === "draft" ? "amber" : "muted"}>
                  {statusLabels[bundle.project.status]}
                </Badge>
                <span className="project-date">{new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(bundle.project.updatedAt))}</span>
              </button>
            ))}
            {filteredBundles.length === 0 ? (
              <div className="project-empty">
                <strong>No hay proyectos con esos filtros.</strong>
                <span>Cambia filtros o crea un proyecto nuevo desde el wizard.</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="workspace-side">
          <ProjectDetail bundle={selectedBundle} />

          <Card eyebrow="Equipo" title="Acceso y roles">
            <div className="role-list">
              <div><Users size={16} /><strong>{session.user.name}</strong><span>Owner · {session.user.email}</span></div>
              <div><ShieldCheck size={16} /><strong>RLS preparado</strong><span>Politicas por organizacion listas en SQL.</span></div>
            </div>
          </Card>

          <Card eyebrow="Siguiente accion" title="Primer analisis">
            <UploadRow name="spot_A_master.mp4" meta="Video · pendiente Sprint 4" status="warning" />
            <LinkButton href={selectedBundle ? `/app/upload?experimentId=${selectedBundle.experiment.id}` : "/app/upload"} icon={<UploadCloud size={15} />}>Preparar upload</LinkButton>
          </Card>
        </aside>
      </section>

      <section className="workspace-preview">
        <div className="section-title-row">
          <div>
            <span className="breadcrumbs">Preview / Resultados</span>
            <h2>Detalle preparado para upload y runs</h2>
          </div>
          <Badge tone="muted">Sprint 3</Badge>
        </div>
        <section className="score-grid">
          <ScoreCard label="Neural Response Index" value={0.78} delta="+0.12 vs B" confidence="CONF 0.92" benchmark="BENCH +14%" />
          <ScoreCard label="Visual Salience" value={0.71} delta="+0.08" confidence="CONF 0.88" benchmark="BENCH +6%" tone="cyan" />
          <ScoreCard label="Narrative Clarity" value={0.84} delta="+0.21" confidence="CONF 0.94" benchmark="BENCH +28%" tone="violet" />
          <ScoreCard label="Action Readiness" value={0.42} delta="-0.05" confidence="CONF 0.81" benchmark="BENCH -12%" tone="coral" />
        </section>
        <TimelinePanel />
      </section>

      <section className="table-section">
        <div className="section-title-row">
          <h2>Jerarquia funcional</h2>
          <Button variant="secondary" icon={<FileText size={15} />}>Exportar vista</Button>
        </div>
        <div className="hierarchy-table">
          <div><span>Organizacion</span><strong>{session.organization.name}</strong></div>
          <div><span>Workspace</span><strong>{selectedBundle?.workspace.name ?? "Sin seleccion"}</strong></div>
          <div><span>Proyecto</span><strong>{selectedBundle ? `${selectedBundle.project.brand} / ${selectedBundle.project.campaign}` : "Sin seleccion"}</strong></div>
          <div><span>Experimento</span><strong>{selectedBundle?.experiment.name ?? "Sin seleccion"}</strong></div>
          <div><span>Siguiente</span><strong>Asset → Run → Informe</strong></div>
        </div>
      </section>
    </AppShell>
  );
}
