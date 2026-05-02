import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  FileUp,
  FolderKanban,
  Gauge,
  Landmark,
  LineChart,
  LogOut,
  Plus,
  MessagesSquare,
  ShieldCheck,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { PraeviaLockup } from "../brand/PraeviaLogo";
import { Avatar, Badge, Button } from "../ui";
import { useAuth } from "../../auth/AuthContext";
import { publicHref } from "../../routing/paths";

type AppShellProps = {
  children: ReactNode;
  active?: string;
};

const navGroups = [
  {
    title: "Principal",
    items: [
      { label: "Workspace", icon: BarChart3, key: "workspace", href: "/app" },
      { label: "Nuevo analisis", icon: Plus, key: "new-analysis", href: "/app" },
      { label: "Comparativas", icon: FolderKanban, key: "comparisons", href: "/app/compare" },
      { label: "Workflow", icon: MessagesSquare, key: "workflow", href: "/app/workflow" },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Benchmarks", icon: Gauge, key: "benchmarks", href: "/app/benchmarks" },
      { label: "Resultados", icon: LineChart, key: "results", href: "/app/results" },
      { label: "Informes", icon: FileText, key: "reports", href: "/app" },
      { label: "Uploads", icon: FileUp, key: "uploads", href: "/app/upload" },
    ],
  },
  {
    title: "Cuenta",
    items: [
      { label: "Equipo", icon: Users, key: "team", href: "/app" },
      { label: "Organizacion", icon: Landmark, key: "organization", href: "/app" },
      { label: "Admin", icon: ShieldCheck, key: "admin", href: "/app/admin" },
      { label: "SaaS v1.5", icon: BriefcaseBusiness, key: "enterprise", href: "/app/enterprise" },
      { label: "Ajustes", icon: Settings, key: "settings", href: "/app/settings" },
    ],
  },
];

export function AppShell({ children, active = "workspace" }: AppShellProps) {
  const { session, logout } = useAuth();

  if (!session) return null;

  return (
    <main className="private-shell">
      <aside className="private-rail">
        <a href={publicHref("/app")} className="private-brand" aria-label="PraevIA NeuroImpact Analyzer">
          <PraeviaLockup size={15} compact />
        </a>

        <nav aria-label="Navegacion privada">
          {navGroups.map((group) => (
            <div className="rail-group" key={group.title}>
              <span>{group.title}</span>
              {group.items.map((item) => (
                <a key={item.key} className={active === item.key ? "active" : ""} href={publicHref(item.href)}>
                  <item.icon size={16} />
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <section className="private-main">
        <header className="private-topbar">
          <div>
            <span className="breadcrumbs">{session.organization.name} / Workspace / NeuroImpact Analyzer</span>
            <h1>{session.organization.name}</h1>
          </div>
          <div className="topbar-actions">
            <Badge tone="amber">{session.organization.credits} creditos</Badge>
            <Badge tone="muted">{session.organization.plan}</Badge>
            <Avatar initials={session.user.initials} />
            <Button variant="ghost" icon={<LogOut size={15} />} onClick={logout}>Salir</Button>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}
