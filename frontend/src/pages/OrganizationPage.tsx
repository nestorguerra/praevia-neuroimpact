import { Building2, Database, KeyRound, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Badge, Card, LinkButton } from "../components/ui";
import { useAuth } from "../auth/AuthContext";

export function OrganizationPage() {
  const { session } = useAuth();
  if (!session) return null;

  return (
    <AppShell active="organization">
      <section className="workspace-hero">
        <div>
          <span className="workspace-eyebrow">Organizacion</span>
          <h2>{session.organization.name}</h2>
          <p>Configuracion corporativa del cliente: plan, creditos, seguridad, retencion y preparacion para entornos reales.</p>
        </div>
        <div className="workspace-actions">
          <LinkButton href="/app/settings" icon={<KeyRound size={15} />}>Ajustes tecnicos</LinkButton>
          <LinkButton href="/app/admin" variant="secondary" icon={<Database size={15} />}>Admin y costes</LinkButton>
        </div>
      </section>

      <section className="workspace-stat-grid">
        <article className="workspace-stat"><span>Plan</span><strong>{session.organization.plan}</strong><em>{session.organization.status}</em></article>
        <article className="workspace-stat"><span>Creditos</span><strong>{session.organization.credits}</strong><em>demo beta</em></article>
        <article className="workspace-stat"><span>Slug</span><strong>{session.organization.slug}</strong><em>workspace</em></article>
        <article className="workspace-stat"><span>Auth</span><strong>{session.provider}</strong><em>modo actual</em></article>
      </section>

      <section className="workspace-grid">
        <div className="workspace-primary">
          <Card eyebrow="Datos de cliente" title="Ficha de organizacion">
            <div className="hierarchy-table">
              <div><span>Organizacion</span><strong>{session.organization.name}</strong></div>
              <div><span>Estado</span><strong>{session.organization.status}</strong></div>
              <div><span>Plan</span><strong>{session.organization.plan}</strong></div>
              <div><span>Owner</span><strong>{session.user.email}</strong></div>
            </div>
          </Card>
        </div>
        <aside className="workspace-side">
          <Card eyebrow="Produccion" title="Preparado para GCP">
            <div className="role-list">
              <div><Building2 size={16} /><strong>Cliente vacio</strong><span>Sin proyectos ni datos precargados en GitHub Pages.</span></div>
              <div><ShieldCheck size={16} /><strong>Seguridad real</strong><span>Requiere Supabase/GCP para salir de demo local.</span></div>
              <div><Database size={16} /><strong>Retencion</strong><span>Configuracion operativa en Admin y Enterprise.</span></div>
            </div>
          </Card>
          <Badge tone="amber">Demo estatica</Badge>
        </aside>
      </section>
    </AppShell>
  );
}
