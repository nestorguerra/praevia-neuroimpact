import { Mail, ShieldCheck, UserRound, Users } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Card } from "../components/ui";
import { useAuth } from "../auth/AuthContext";

export function TeamPage() {
  const { session } = useAuth();
  if (!session) return null;

  return (
    <AppShell active="team">
      <section className="workspace-hero">
        <div>
          <span className="workspace-eyebrow">Equipo</span>
          <h2>Roles y accesos del workspace.</h2>
          <p>Vista preparada para owner, admin, analyst, viewer y client viewer. En modo demo solo existe el owner local.</p>
        </div>
        <div className="workspace-actions">
          <Badge tone="amber">Owner activo</Badge>
          <Badge tone="muted">RLS preparado</Badge>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="workspace-primary">
          <div className="section-title-row">
            <div>
              <span className="breadcrumbs">Cuenta / Equipo</span>
              <h2>Miembros</h2>
            </div>
          </div>
          <div className="project-list">
            <article className="project-row">
              <div>
                <span>{session.organization.name}</span>
                <strong>{session.user.name}</strong>
                <em>{session.user.email}</em>
              </div>
              <Badge tone="lime">Owner</Badge>
              <span className="project-date">Activo</span>
            </article>
          </div>
        </div>

        <aside className="workspace-side">
          <Card eyebrow="Permisos" title="Modelo de acceso">
            <div className="role-list">
              <div><UserRound size={16} /><strong>Owner</strong><span>Gestiona organizacion, creditos, ajustes y borrado.</span></div>
              <div><Users size={16} /><strong>Analyst / Viewer</strong><span>Preparado para Supabase Auth y memberships reales.</span></div>
              <div><ShieldCheck size={16} /><strong>Aislamiento</strong><span>Las policies SQL separan datos por organizacion.</span></div>
              <div><Mail size={16} /><strong>Invitaciones</strong><span>Pendiente de email transaccional en produccion GCP.</span></div>
            </div>
          </Card>
        </aside>
      </section>
    </AppShell>
  );
}
