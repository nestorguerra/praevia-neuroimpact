import { type FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, FileCheck2, LockKeyhole, PlayCircle, Presentation, Send } from "lucide-react";
import { PraeviaLockup, PraeviaMark } from "../components/brand/PraeviaLogo";
import { Badge, Card, Input, LinkButton, TimelinePanel } from "../components/ui";
import { acceptedFormats, governanceCards, metrics, plans, trustItems } from "../data/product";
import { submitDemoRequest } from "../marketing/localDemoLeadStore";
import type { DemoRequestInput } from "../marketing/types";
import { publicHref } from "../routing/paths";

const initialDemoRequest: DemoRequestInput = {
  name: "",
  email: "",
  company: "",
  role: "",
  useCase: "",
  assetCount: "10-30 assets",
  timeline: "Piloto creativo",
  consent: false,
  source: "landing",
};

export function LandingPage() {
  const [form, setForm] = useState<DemoRequestInput>(initialDemoRequest);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const canSubmit = Boolean(form.name.trim() && form.email.includes("@") && form.company.trim() && form.useCase.trim() && form.consent);

  function updateField<Key extends keyof DemoRequestInput>(key: Key, value: DemoRequestInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitState === "submitting") return;
    setSubmitState("submitting");
    const result = await submitDemoRequest(form);
    setSubmitState("done");
    setSubmitMessage(
      result.delivery === "api"
        ? "Demo registrada. Queda guardada en el backend comercial del piloto."
        : "Demo guardada localmente. Queda pendiente de sincronizar cuando conectemos el backend publico.",
    );
    setForm(initialDemoRequest);
  }

  return (
    <main className="site-shell bg-grid">
      <header className="public-nav">
        <a href={publicHref("/")} className="brand-link" aria-label="PraevIA NeuroImpact Analyzer">
          <PraeviaLockup size={17} compact />
        </a>
        <nav aria-label="Principal">
          <a href="#producto">Producto</a>
          <a href="#metricas">Metricas</a>
          <a href="#pilotos">Pilotos</a>
          <a href="#kit">Kit piloto</a>
          <a href="#confianza">Confianza</a>
          <a href={publicHref("/design-hub/index.html")}>Design Hub</a>
        </nav>
        <div className="nav-actions">
          <a className="nav-login" href={publicHref("/login")}>Iniciar sesion</a>
          <LinkButton href="#contacto" icon={<Send size={15} />}>Solicitar demo</LinkButton>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-kicker">Pretest neurocognitivo · in silico · B2B</div>
          <h1>Sabe que <em>version</em> usar. Antes de producir.</h1>
          <p>
            NeuroImpact Analyzer compara video, audio y texto para convertir senales neurocognitivas predichas en
            decisiones editoriales con timecode, confianza y benchmark.
          </p>
          <div className="hero-actions">
            <LinkButton href="#pilotos" size="lg" icon={<ArrowRight size={18} />}>Solicitar piloto</LinkButton>
            <LinkButton href="/register" variant="secondary" size="lg">Crear workspace</LinkButton>
          </div>
        </div>

        <div className="instrument-panel" aria-label="Vista sintetica de comparativa A B C">
          <div className="instrument-header">
            <span>NEUROIMPACT_ANALYZER · LIVE</span>
            <span>CONF 0.92</span>
          </div>
          <TimelinePanel />
          <div className="instrument-decision">
            <span>Decision recomendada</span>
            <strong>Usar A como master y donar cierre desde B · 00:24-00:30</strong>
          </div>
        </div>

        <div className="hero-meta">
          <div><span>Modalidades</span><strong>Video · Audio · Texto</strong></div>
          <div><span>Salida</span><strong>Dashboard + PDF</strong></div>
          <div><span>Comparativa</span><strong>A/B/C con mix recomendado</strong></div>
          <div><span>Gobierno</span><strong>Claims controlados</strong></div>
        </div>
      </section>

      <section id="producto" className="section-block">
        <div className="section-heading">
          <span>01 · Producto</span>
          <div>
            <h2>Menos opinion de sala. Mas decision <em>defendible</em>.</h2>
            <p>
              El producto no promete leer consumidores. Ayuda a decidir entre versiones, detectar tramos flojos y
              priorizar cambios antes de produccion, medios o eventos.
            </p>
          </div>
        </div>
        <div className="problem-strip">
          <article>
            <span>Demasiadas versiones</span>
            <h3>A/B/C sin criterio comun</h3>
            <p>Tres cierres, dos locuciones y una reunion eterna. Falta una capa externa para ordenar la decision.</p>
          </article>
          <article>
            <span>Test real tarde</span>
            <h3>La medicion llega cuando ya duele</h3>
            <p>VTR, CTR o feedback de evento llegan despues de producir, aprobar y pagar distribucion.</p>
          </article>
          <article>
            <span>Insights poco editables</span>
            <h3>Recomendaciones sin timecode</h3>
            <p>Marketing necesita saber que tocar, donde tocarlo y que version usar como master.</p>
          </article>
        </div>
      </section>

      <section id="metricas" className="section-block">
        <div className="section-heading">
          <span>02 · Metricas</span>
          <div>
            <h2>Nueve indicadores. Una regla: cada numero necesita <em>accion</em>.</h2>
            <p>
              Los scores no se presentan como decoracion. Cada lectura debe venir con confianza, benchmark, evidencia y
              siguiente paso.
            </p>
          </div>
        </div>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.name}>
              <metric.icon size={23} aria-hidden="true" />
              <h3>{metric.name}</h3>
              <p>{metric.description}</p>
              <span>{metric.decision}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block split-section">
        <div>
          <div className="section-heading compact">
            <span>03 · Input</span>
            <div>
              <h2>Sube piezas reales. El sistema valida antes de analizar.</h2>
              <p>El asset health check bloquea formatos raros, duraciones fuera de plan y problemas basicos de audio/texto.</p>
            </div>
          </div>
        </div>
        <div className="format-list">
          {acceptedFormats.map((format) => (
            <div className="format-row" key={format.label}>
              <format.icon size={18} aria-hidden="true" />
              <strong>{format.label}</strong>
              <span>{format.formats}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="confianza" className="section-block">
        <div className="trust-layout">
          <div>
            <span className="section-label">04 · Confianza</span>
            <h2>Instrumento, no bola de cristal.</h2>
            <p>
              La confianza del producto depende de un lenguaje sobrio: respuesta predicha, comparacion, evidencia y
              recomendacion. Nada de promesas absolutas.
            </p>
          </div>
          <div className="trust-list">
            {trustItems.map((item) => (
              <div className="trust-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="language-grid">
          <div>
            <h3>Usamos</h3>
            <p>Respuesta cerebral predicha</p>
            <p>Hipotesis de mejora editorial</p>
            <p>Indicador comparativo</p>
          </div>
          <div>
            <h3>No usamos</h3>
            <p>Medicion emocional individual</p>
            <p>Lectura mental</p>
            <p>Promesas de negocio garantizadas</p>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="governance-grid">
          {governanceCards.map((card) => (
            <Card key={card.title} title={card.title}>
              <card.icon size={20} aria-hidden="true" />
              <p>{card.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilotos" className="section-block">
        <div className="section-heading">
          <span>05 · Pilotos</span>
          <div>
            <h2>Primero pilotos premium. Luego SaaS.</h2>
            <p>
              La oferta inicial debe cerrar alcance, piezas, workshops, reanalisis e informe. Nada de SaaS barato antes
              de probar valor real.
            </p>
          </div>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={plan.featured ? "plan-card featured" : "plan-card"} key={plan.code}>
              {plan.featured ? <Badge tone="amber">Recomendado</Badge> : <span className="plan-code">{plan.code}</span>}
              <h3>{plan.title}</h3>
              <strong>{plan.price}</strong>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}><CheckCircle2 size={14} />{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="kit" className="section-block commercial-kit-section">
        <div className="section-heading">
          <span>06 · Kit</span>
          <div>
            <h2>Todo lo necesario para vender el primer <em>piloto creativo</em>.</h2>
            <p>
              Landing, deck, teaser, demos, one-pager, ficha de seguridad y propuesta comercial quedan unidos en un
              recorrido de reunion.
            </p>
          </div>
        </div>
        <div className="commercial-kit-grid">
          <article>
            <Presentation size={24} aria-hidden="true" />
            <h3>Deck cliente e interno</h3>
            <p>Version de reunion para CMO/agencia y version interna con pricing, riesgos y operacion.</p>
            <LinkButton href="/pilot-kit" variant="secondary">Abrir kit</LinkButton>
          </article>
          <article>
            <PlayCircle size={24} aria-hidden="true" />
            <h3>Teaser motion 18s</h3>
            <p>Secuencia preparada para explicar el problema, la comparativa y la decision final.</p>
            <LinkButton href="/pilot-kit/motion-teaser.html" variant="secondary">Ver teaser</LinkButton>
          </article>
          <article>
            <FileCheck2 size={24} aria-hidden="true" />
            <h3>Demos limpias</h3>
            <p>Spot A/B/C, evento y guion con archivos de muestra sin datos sensibles.</p>
            <LinkButton href="/pilot-kit#demos" variant="secondary">Ver demos</LinkButton>
          </article>
        </div>
      </section>

      <section id="contacto" className="final-cta">
        <PraeviaMark size={44} />
        <h2>Prepara una demo con piezas reales.</h2>
        <p>Deja empresa, caso de uso y numero aproximado de assets. El siguiente paso es preparar una demo confidencial con piezas reales.</p>
        <form className="contact-form" onSubmit={handleSubmit}>
          <Input label="Nombre" placeholder="Nestor Guerra" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          <Input label="Email corporativo" placeholder="nombre@empresa.com" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          <Input label="Empresa" placeholder="Nombre de la empresa" value={form.company} onChange={(event) => updateField("company", event.target.value)} />
          <Input label="Rol" placeholder="CMO, Head of Content, Agencia..." value={form.role} onChange={(event) => updateField("role", event.target.value)} />
          <Input label="Caso de uso" placeholder="Spot A/B/C, evento, guion, branded content..." value={form.useCase} onChange={(event) => updateField("useCase", event.target.value)} />
          <Input label="Numero de piezas" placeholder="10-30 assets" value={form.assetCount} onChange={(event) => updateField("assetCount", event.target.value)} />
          <Input label="Oferta de interes" placeholder="Piloto creativo / Piloto corporativo / SaaS Professional" value={form.timeline} onChange={(event) => updateField("timeline", event.target.value)} />
          <label className="field checkbox-field">
            <input type="checkbox" checked={form.consent} onChange={(event) => updateField("consent", event.target.checked)} />
            <span>Autorizo el contacto para preparar una demo confidencial del piloto.</span>
          </label>
          <button className="submit-button" type="submit" disabled={!canSubmit || submitState === "submitting"}>
            <LockKeyhole size={15} />
            {submitState === "submitting" ? "Registrando solicitud..." : "Solicitar demo confidencial"}
          </button>
          {submitMessage ? <p className="form-status">{submitMessage}</p> : null}
        </form>
      </section>

      <footer className="public-footer">
        <span>PraevIA · NeuroImpact Analyzer</span>
        <a href={publicHref("/design-hub/index.html")}>Design Hub <ExternalLink size={13} /></a>
      </footer>
    </main>
  );
}
