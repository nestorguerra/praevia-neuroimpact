import { Download, FileText, FileWarning, FolderKanban } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Card, LinkButton } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { loadStoredReports } from "../reporting/localReportStore";

export function ReportsPage() {
  const { session } = useAuth();
  if (!session) return null;

  const reports = loadStoredReports(session.organization.id);

  return (
    <AppShell active="reports">
      <section className="workspace-hero">
        <div>
          <span className="workspace-eyebrow">Informes</span>
          <h2>Repositorio de informes ejecutivos, creativos y tecnicos.</h2>
          <p>Los informes generados desde resultados aparecen aqui con trazabilidad de modelo, prompt, coste y guardrails.</p>
        </div>
        <div className="workspace-actions">
          <LinkButton href="/app/results" icon={<FileText size={15} />}>Generar informe</LinkButton>
          <LinkButton href="/app/compare" variant="secondary" icon={<FolderKanban size={15} />}>Comparativa A/B/C</LinkButton>
        </div>
      </section>

      <section className="workspace-stat-grid">
        <article className="workspace-stat"><span>Informes</span><strong>{reports.length}</strong><em>local/demo</em></article>
        <article className="workspace-stat"><span>Guardrails</span><strong>{reports.filter((report) => report.guardrailStatus !== "blocked").length}</strong><em>aprobados</em></article>
        <article className="workspace-stat"><span>PDF</span><strong>{reports.length}</strong><em>descargables desde resultados</em></article>
        <article className="workspace-stat"><span>Modelo</span><strong>GPT</strong><em>configurable en ajustes</em></article>
      </section>

      <section className="table-section">
        <div className="section-title-row">
          <div>
            <span className="breadcrumbs">Organizacion / Informes</span>
            <h2>Ultimos informes</h2>
          </div>
          <Badge tone="muted">Print-first</Badge>
        </div>
        {reports.length ? (
          <div className="project-list">
            {reports.map((report) => (
              <article className="project-row" key={report.id}>
                <div>
                  <span>{report.reportType} · {report.language.toUpperCase()}</span>
                  <strong>{report.title}</strong>
                  <em>{report.assetName} · {report.usage.finalModel}</em>
                </div>
                <Badge tone={report.guardrailStatus === "blocked" ? "coral" : report.guardrailStatus === "rewritten" ? "amber" : "lime"}>
                  {report.guardrailStatus}
                </Badge>
                <span className="project-date">{new Intl.DateTimeFormat("es-ES").format(new Date(report.createdAt))}</span>
              </article>
            ))}
          </div>
        ) : (
          <Card eyebrow="Sin informes" title="Todavia no hay informes generados.">
            <div className="role-list">
              <div><FileWarning size={16} /><strong>Primero crea un run</strong><span>Sube assets, lanza scoring y genera el PDF desde Resultados.</span></div>
              <div><Download size={16} /><strong>Salida prevista</strong><span>PDF ejecutivo/creativo con decision, timecodes y metodologia.</span></div>
            </div>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
