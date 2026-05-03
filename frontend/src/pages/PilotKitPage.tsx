import { ArrowRight, Download, ExternalLink, FileText, PlayCircle, Presentation, ShieldCheck } from "lucide-react";
import { PraeviaLockup, PraeviaMark } from "../components/brand/PraeviaLogo";
import { Badge, LinkButton } from "../components/ui";
import { commercialAssets, demoScenarios, meetingFlow, pilotOffer } from "../data/pilotKit";
import { publicHref } from "../routing/paths";

export function PilotKitPage() {
  return (
    <main className="site-shell pilot-kit-page bg-grid">
      <header className="public-nav">
        <a href={publicHref("/")} className="brand-link" aria-label="PraevIA NeuroImpact Analyzer">
          <PraeviaLockup size={17} compact />
        </a>
        <nav aria-label="Kit comercial">
          <a href="#activos">Activos</a>
          <a href="#demos">Demos</a>
          <a href="#oferta">Piloto</a>
          <a href={publicHref("/")}>Landing</a>
        </nav>
        <div className="nav-actions">
          <LinkButton href="/pilot-kit/deck-cliente.html" icon={<Presentation size={15} />}>Deck cliente</LinkButton>
        </div>
      </header>

      <section className="pilot-hero">
        <div>
          <span className="hero-kicker">Kit comercial · NeuroImpact Analyzer</span>
          <h1>Una reunion. Una demo. Una propuesta cerrada.</h1>
          <p>
            Este kit convierte NeuroImpact Analyzer en una oferta vendible: narrativa, demo real, informe, seguridad,
            alcance de piloto creativo y materiales exportables para cerrar una prueba con cliente.
          </p>
          <div className="hero-actions">
            <LinkButton href="#activos" size="lg" icon={<ArrowRight size={18} />}>Recorrido de reunion</LinkButton>
            <LinkButton href="/pilot-kit/one-pager.html" variant="secondary" size="lg" icon={<Download size={17} />}>One-pager</LinkButton>
          </div>
        </div>
        <div className="pilot-command-panel">
          <div className="instrument-header">
            <span>PILOT_KIT · COMMERCIAL</span>
            <span>READY</span>
          </div>
          <div className="pilot-step-list">
            {meetingFlow.map((step, index) => (
              <div key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="activos" className="section-block">
        <div className="section-heading">
          <span>01 · Activos</span>
          <div>
            <h2>Material comercial preparado para <em>ensenar y enviar</em>.</h2>
            <p>Todo abre desde navegador y puede exportarse a PDF con el gate comercial.</p>
          </div>
        </div>
        <div className="asset-grid">
          {commercialAssets.map((asset) => (
            <a className="asset-card" href={publicHref(asset.href)} key={asset.href}>
              <FileText size={22} aria-hidden="true" />
              <span>{asset.meta}</span>
              <h3>{asset.label}</h3>
              <p>{asset.description}</p>
              <em>Abrir <ExternalLink size={13} /></em>
            </a>
          ))}
        </div>
      </section>

      <section id="demos" className="section-block">
        <div className="section-heading">
          <span>02 · Demos</span>
          <div>
            <h2>Tres historias para probar valor sin datos sensibles.</h2>
            <p>Los assets demo son texto/SRT limpios y estan pensados para recorrer upload, comparativa, dashboard y PDF.</p>
          </div>
        </div>
        <div className="demo-grid">
          {demoScenarios.map((scenario) => (
            <article className="demo-card" key={scenario.id}>
              <Badge tone="amber">{scenario.id}</Badge>
              <h3>{scenario.title}</h3>
              <p>{scenario.objective}</p>
              <ul>
                {scenario.files.map((file) => (
                  <li key={file}>
                    <a href={`/pilot-kit/demo-data/${file}`}>{file}</a>
                  </li>
                ))}
              </ul>
              <strong>{scenario.script}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="oferta" className="section-block offer-section">
        <div>
          <span className="section-label">03 · Oferta</span>
          <h2>Piloto creativo: corto, premium y acotado.</h2>
          <p>
            El objetivo comercial no es vender una suscripcion barata. Es demostrar decision creativa con piezas reales,
            informe ejecutivo y workshop.
          </p>
        </div>
        <div className="offer-card">
          <PraeviaMark size={36} />
          <strong>{pilotOffer.price}</strong>
          <span>{pilotOffer.duration}</span>
          <div className="offer-columns">
            <div>
              <h3>Incluye</h3>
              {pilotOffer.scope.map((item) => <p key={item}>{item}</p>)}
            </div>
            <div>
              <h3>No incluye</h3>
              {pilotOffer.exclusions.map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>
          <LinkButton href="/pilot-kit/pilot-contract-template.html" icon={<ShieldCheck size={15} />}>Ver contrato piloto</LinkButton>
        </div>
      </section>

      <section className="final-cta">
        <PlayCircle size={42} />
        <h2>Gate comercial preparado.</h2>
        <p>La reunion puede arrancar en landing, pasar por deck, demo, PDF y cerrar con propuesta de piloto.</p>
      </section>
    </main>
  );
}
