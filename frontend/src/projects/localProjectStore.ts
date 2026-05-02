import { experimentAssetSlots, experimentTypeLabels, projectTemplates } from "./templates";
import type { ExperimentRecord, NewProjectInput, ProjectBundle, ProjectRecord, ProjectStoreState, WorkspaceRecord } from "./types";

function storageKey(organizationId: string) {
  return `praevia.project-store.${organizationId}.v1`;
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function now() {
  return new Date().toISOString();
}

function seedState(organizationId: string, organizationName: string): ProjectStoreState {
  if ((import.meta.env.VITE_EMPTY_CLIENT as string | undefined) === "true") {
    return {
      workspaces: [],
      projects: [],
      experiments: [],
    };
  }

  const workspaceId = createId("ws");
  const projectId = createId("proj");
  const experimentId = createId("exp");
  const createdAt = now();

  return {
    workspaces: [
      {
        id: workspaceId,
        organizationId,
        name: `${organizationName} / Marketing`,
        clientName: organizationName,
        description: "Workspace inicial para pilotos de marketing, contenido y eventos.",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    projects: [
      {
        id: projectId,
        organizationId,
        workspaceId,
        brand: "Banco Atlas",
        campaign: "Hipotecas Q2",
        objective: "Elegir version master y mix recomendado antes de produccion final.",
        channel: "CTV / 30s",
        audience: "Familias urbanas 35-55",
        language: "Espanol",
        expectedKpi: "VTR / Retencion 30s",
        status: "ready",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    experiments: [
      {
        id: experimentId,
        organizationId,
        workspaceId,
        projectId,
        type: "abc",
        name: "Spot 30s A/B/C",
        template: "spot-abc",
        assetSlots: 3,
        notes: "Demo comercial del caso estrella.",
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
}

export function loadProjectStore(organizationId: string, organizationName: string): ProjectStoreState {
  const raw = localStorage.getItem(storageKey(organizationId));
  if (!raw) {
    const seeded = seedState(organizationId, organizationName);
    saveProjectStore(organizationId, seeded);
    return seeded;
  }

  try {
    return JSON.parse(raw) as ProjectStoreState;
  } catch {
    const seeded = seedState(organizationId, organizationName);
    saveProjectStore(organizationId, seeded);
    return seeded;
  }
}

export function saveProjectStore(organizationId: string, state: ProjectStoreState) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(state));
}

export function createWorkspace(state: ProjectStoreState, organizationId: string, name: string): [ProjectStoreState, WorkspaceRecord] {
  const createdAt = now();
  const workspace: WorkspaceRecord = {
    id: createId("ws"),
    organizationId,
    name,
    clientName: name.split("/")[0]?.trim() || name,
    description: "Workspace creado desde Sprint 3.",
    createdAt,
    updatedAt: createdAt,
  };

  return [{ ...state, workspaces: [workspace, ...state.workspaces] }, workspace];
}

export function createProjectBundle(state: ProjectStoreState, organizationId: string, input: NewProjectInput): [ProjectStoreState, ProjectBundle] {
  let nextState = state;
  let workspace = state.workspaces.find((item) => item.id === input.workspaceId);

  if (input.workspaceId === "new") {
    [nextState, workspace] = createWorkspace(state, organizationId, input.newWorkspaceName?.trim() || `${input.brand} / Marketing`);
  }

  if (!workspace) {
    throw new Error("Workspace no encontrado");
  }

  const createdAt = now();
  const template = projectTemplates.find((item) => item.id === input.template);
  const project: ProjectRecord = {
    id: createId("proj"),
    organizationId,
    workspaceId: workspace.id,
    brand: input.brand,
    campaign: input.campaign,
    objective: input.objective,
    channel: input.channel,
    audience: input.audience,
    language: input.language,
    expectedKpi: input.expectedKpi,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
  };
  const experiment: ExperimentRecord = {
    id: createId("exp"),
    organizationId,
    workspaceId: workspace.id,
    projectId: project.id,
    type: input.experimentType,
    name: template?.label ?? experimentTypeLabels[input.experimentType],
    template: input.template,
    assetSlots: experimentAssetSlots[input.experimentType],
    notes: "Creado desde wizard Sprint 3.",
    createdAt,
    updatedAt: createdAt,
  };

  nextState = {
    ...nextState,
    projects: [project, ...nextState.projects],
    experiments: [experiment, ...nextState.experiments],
  };

  return [nextState, { project, experiment, workspace }];
}

export function findProjectBundle(state: ProjectStoreState, projectId: string): ProjectBundle | null {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return null;
  const workspace = state.workspaces.find((item) => item.id === project.workspaceId);
  const experiment = state.experiments.find((item) => item.projectId === project.id);
  if (!workspace || !experiment) return null;
  return { project, workspace, experiment };
}
