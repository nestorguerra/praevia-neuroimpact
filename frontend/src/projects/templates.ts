import type { ExperimentType } from "./types";

export const experimentTypeLabels: Record<ExperimentType, string> = {
  individual: "Individual",
  ab: "A/B",
  abc: "A/B/C",
  script: "Guion",
  event: "Evento",
  training: "Formacion",
};

export const experimentAssetSlots: Record<ExperimentType, number> = {
  individual: 1,
  ab: 2,
  abc: 3,
  script: 1,
  event: 1,
  training: 1,
};

export const projectTemplates = [
  {
    id: "spot-abc",
    label: "Spot A/B/C",
    type: "abc" as ExperimentType,
    objective: "Elegir version master y mix recomendado antes de produccion final.",
    channel: "CTV / Social Video",
    expectedKpi: "VTR / Retencion 30s",
  },
  {
    id: "event-opening",
    label: "Evento",
    type: "event" as ExperimentType,
    objective: "Optimizar apertura, video manifiesto o pieza de escenario.",
    channel: "Evento corporativo",
    expectedKpi: "Feedback evento / recuerdo",
  },
  {
    id: "script-pretest",
    label: "Guion",
    type: "script" as ExperimentType,
    objective: "Pretest de estructura narrativa antes de producir.",
    channel: "Guion / SRT / Texto",
    expectedKpi: "Claridad / comprension",
  },
  {
    id: "training-content",
    label: "Formacion",
    type: "training" as ExperimentType,
    objective: "Detectar fatiga, exceso verbal y tramos planos.",
    channel: "Comunicacion interna",
    expectedKpi: "Finalizacion / aprendizaje",
  },
  {
    id: "single-asset",
    label: "Analisis individual",
    type: "individual" as ExperimentType,
    objective: "Evaluar una pieza creativa y priorizar recomendaciones.",
    channel: "Video / Audio / Texto",
    expectedKpi: "Retencion / engagement",
  },
];

export const channels = [
  "CTV / 30s",
  "Social video",
  "Evento corporativo",
  "Comunicacion interna",
  "Podcast / Audio branded",
  "Guion / SRT / Texto",
];

export const languages = ["Espanol", "Ingles", "Espanol + Ingles", "Frances", "Portugues"];

export const statusLabels = {
  draft: "Draft",
  ready: "Preparado",
  running: "En analisis",
  report_ready: "Informe listo",
  archived: "Archivado",
};

