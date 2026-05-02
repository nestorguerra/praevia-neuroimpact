import { ArrowLeft, ArrowRight, CheckCircle2, FolderPlus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Input } from "../ui";
import { channels, experimentTypeLabels, languages, projectTemplates } from "../../projects/templates";
import type { ExperimentType, NewProjectInput, WorkspaceRecord } from "../../projects/types";

type ProjectWizardProps = {
  workspaces: WorkspaceRecord[];
  onCancel: () => void;
  onCreate: (input: NewProjectInput) => void | Promise<void>;
};

const steps = ["Template", "Proyecto", "Audiencia", "Revisar"];

export function ProjectWizard({ workspaces, onCancel, onCreate }: ProjectWizardProps) {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState("spot-abc");
  const template = useMemo(() => projectTemplates.find((item) => item.id === templateId) ?? projectTemplates[0], [templateId]);
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "new");
  const [newWorkspaceName, setNewWorkspaceName] = useState("Banco Atlas / Marketing");
  const [brand, setBrand] = useState("Banco Atlas");
  const [campaign, setCampaign] = useState("Hipotecas Q2");
  const [objective, setObjective] = useState(template.objective);
  const [channel, setChannel] = useState(template.channel);
  const [audience, setAudience] = useState("Familias urbanas 35-55");
  const [language, setLanguage] = useState("Espanol");
  const [expectedKpi, setExpectedKpi] = useState(template.expectedKpi);
  const [experimentType, setExperimentType] = useState<ExperimentType>(template.type);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(nextTemplateId: string) {
    const nextTemplate = projectTemplates.find((item) => item.id === nextTemplateId) ?? projectTemplates[0];
    setTemplateId(nextTemplate.id);
    setObjective(nextTemplate.objective);
    setChannel(nextTemplate.channel);
    setExpectedKpi(nextTemplate.expectedKpi);
    setExperimentType(nextTemplate.type);
  }

  async function create() {
    setIsCreating(true);
    setError(null);
    try {
      await onCreate({
        workspaceId,
        newWorkspaceName,
        brand,
        campaign,
        objective,
        channel,
        audience,
        language,
        expectedKpi,
        experimentType,
        template: templateId,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el proyecto.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="wizard-shell" aria-label="Wizard de nuevo proyecto">
      <div className="wizard-head">
        <div>
          <span className="breadcrumbs">Nuevo proyecto / Experimento</span>
          <h2>Crear proyecto de analisis</h2>
        </div>
        <button className="wizard-close" onClick={onCancel} type="button">Cerrar</button>
      </div>

      <div className="wizard-steps">
        {steps.map((item, index) => (
          <button key={item} className={index === step ? "active" : ""} onClick={() => setStep(index)} type="button">
            <span>{index + 1}</span>
            {item}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div className="template-grid">
          {projectTemplates.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === templateId ? "template-card active" : "template-card"}
              onClick={() => applyTemplate(item.id)}
            >
              <Sparkles size={17} />
              <strong>{item.label}</strong>
              <span>{item.objective}</span>
              <em>{experimentTypeLabels[item.type]}</em>
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="wizard-form-grid">
          <label className="field">
            <span className="field-label">Workspace</span>
            <select className="input" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
              ))}
              <option value="new">Crear nuevo workspace</option>
            </select>
          </label>
          {workspaceId === "new" ? (
            <Input label="Nuevo workspace" value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} />
          ) : null}
          <Input label="Marca / Cliente" value={brand} onChange={(event) => setBrand(event.target.value)} required />
          <Input label="Campana" value={campaign} onChange={(event) => setCampaign(event.target.value)} required />
          <label className="field wide">
            <span className="field-label">Objetivo</span>
            <textarea className="input textarea" value={objective} onChange={(event) => setObjective(event.target.value)} rows={4} />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wizard-form-grid">
          <label className="field">
            <span className="field-label">Tipo de experimento</span>
            <select className="input" value={experimentType} onChange={(event) => setExperimentType(event.target.value as ExperimentType)}>
              {Object.entries(experimentTypeLabels).map(([key, label]) => (
                <option value={key} key={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Canal</span>
            <select className="input" value={channel} onChange={(event) => setChannel(event.target.value)}>
              {channels.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Input label="Audiencia" value={audience} onChange={(event) => setAudience(event.target.value)} />
          <label className="field">
            <span className="field-label">Idioma</span>
            <select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Input label="KPI esperado" value={expectedKpi} onChange={(event) => setExpectedKpi(event.target.value)} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-review">
          <div><span>Workspace</span><strong>{workspaceId === "new" ? newWorkspaceName : workspaces.find((item) => item.id === workspaceId)?.name}</strong></div>
          <div><span>Proyecto</span><strong>{brand} / {campaign}</strong></div>
          <div><span>Experimento</span><strong>{experimentTypeLabels[experimentType]} · {template.label}</strong></div>
          <div><span>Canal</span><strong>{channel}</strong></div>
          <div><span>Audiencia</span><strong>{audience}</strong></div>
          <div><span>KPI</span><strong>{expectedKpi}</strong></div>
        </div>
      ) : null}

      <div className="wizard-actions">
        <Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={step === 0 ? onCancel : () => setStep((value) => value - 1)}>
          {step === 0 ? "Cancelar" : "Anterior"}
        </Button>
        {step < steps.length - 1 ? (
          <Button icon={<ArrowRight size={15} />} onClick={() => setStep((value) => value + 1)}>Siguiente</Button>
        ) : (
          <Button icon={<FolderPlus size={15} />} onClick={create} disabled={isCreating}>{isCreating ? "Creando..." : "Crear proyecto"}</Button>
        )}
      </div>

      {error ? <div className="wizard-error">{error}</div> : null}

      <div className="wizard-acceptance">
        <CheckCircle2 size={15} />
        Crea workspace, proyecto y experimento asociado sin tocar base de datos ni consola.
      </div>
    </section>
  );
}
