import { BarChart3, FileUp, LogOut, Plus, Settings, Users } from "lucide-react";
import { PraeviaLockup } from "../components/brand/PraeviaLogo";
import { Avatar, Badge, Button, Card, DataTable, Input, LinkButton, ScoreCard, Tabs, TimelinePanel, UploadRow } from "../components/ui";
import { publicHref } from "../routing/paths";

export function ComponentLab() {
  return (
    <main className="app-preview-shell">
      <aside className="left-rail">
        <PraeviaLockup size={15} compact />
        <nav>
          <a className="active" href={publicHref("/app")}><BarChart3 size={16} /> Workspace</a>
          <a href={publicHref("/app")}><Plus size={16} /> Nuevo analisis</a>
          <a href={publicHref("/app")}><FileUp size={16} /> Uploads</a>
          <a href={publicHref("/app")}><Users size={16} /> Equipo</a>
          <a href={publicHref("/app")}><Settings size={16} /> Ajustes</a>
        </nav>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div>
            <span className="breadcrumbs">PraevIA / Banco Atlas / Hipotecas Q2</span>
            <h1>Design System operativo</h1>
          </div>
          <div className="topbar-actions">
            <Badge tone="amber">142 creditos</Badge>
            <Avatar initials="NG" />
            <Button variant="ghost" icon={<LogOut size={15} />}>Salir</Button>
          </div>
        </header>

        <section className="decision-band">
          <div>
            <span>Decision recomendada</span>
            <h2>Usar Version A como master. Sustituir cierre por Version B · 00:24-00:30.</h2>
          </div>
          <LinkButton href="/design-hub/prototype.html" variant="secondary">Ver prototipo original</LinkButton>
        </section>

        <Tabs />

        <section className="score-grid">
          <ScoreCard label="Neural Response Index" value={0.78} delta="+0.12 vs B" confidence="CONF 0.92" benchmark="BENCH +14%" />
          <ScoreCard label="Visual Salience" value={0.71} delta="+0.08" confidence="CONF 0.88" benchmark="BENCH +6%" tone="cyan" />
          <ScoreCard label="Narrative Clarity" value={0.84} delta="+0.21" confidence="CONF 0.94" benchmark="BENCH +28%" tone="violet" />
          <ScoreCard label="Action Readiness" value={0.42} delta="-0.05" confidence="CONF 0.81" benchmark="BENCH -12%" tone="coral" />
        </section>

        <section className="dashboard-layout">
          <TimelinePanel />
          <div className="side-stack">
            <Card eyebrow="Upload UX" title="Asset Health Check">
              <UploadRow name="spot_A_master.mp4" meta="00:30 · 1920x1080 · audio OK" status="validated" />
              <UploadRow name="spot_B_cierre.mov" meta="00:30 · 1920x1080 · subiendo" status="uploading" progress={64} />
              <UploadRow name="spot_C_social.mp4" meta="00:24 · duracion distinta" status="warning" progress={100} />
            </Card>
            <Card eyebrow="Formulario" title="Nuevo proyecto">
              <Input label="Marca" defaultValue="Banco Atlas" />
              <Input label="Canal" defaultValue="CTV · 30s" />
            </Card>
          </div>
        </section>

        <section className="table-section">
          <div className="section-title-row">
            <h2>Proyectos recientes</h2>
            <Button icon={<Plus size={15} />}>Nuevo analisis</Button>
          </div>
          <DataTable />
        </section>
      </section>
    </main>
  );
}
