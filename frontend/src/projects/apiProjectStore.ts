import { experimentAssetSlots, experimentTypeLabels, projectTemplates } from "./templates";
import type { ExperimentRecord, NewProjectInput, ProjectBundle, ProjectRecord, ProjectStoreState, WorkspaceRecord } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

type ApiWorkspace = {
  id: string;
  organization_id: string;
  name: string;
  client_name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

type ApiProject = {
  id: string;
  organization_id: string;
  workspace_id: string;
  brand: string;
  campaign: string;
  objective: string;
  channel: string;
  audience: string;
  language: string;
  expected_kpi: string;
  status: ProjectRecord["status"];
  created_at: string;
  updated_at: string;
};

type ApiExperiment = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string;
  type: ExperimentRecord["type"];
  name: string;
  template: string;
  asset_slots: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

function headers(accessToken: string) {
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(accessToken),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function workspaceFromApi(row: ApiWorkspace): WorkspaceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    clientName: row.client_name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectFromApi(row: ApiProject): ProjectRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    brand: row.brand,
    campaign: row.campaign,
    objective: row.objective,
    channel: row.channel,
    audience: row.audience,
    language: row.language,
    expectedKpi: row.expected_kpi,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function experimentFromApi(row: ApiExperiment): ExperimentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    type: row.type,
    name: row.name,
    template: row.template,
    assetSlots: row.asset_slots,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadProjectStoreFromApi(organizationId: string, accessToken: string): Promise<ProjectStoreState> {
  const [workspaces, projects, experiments] = await Promise.all([
    apiFetch<ApiWorkspace[]>(`/v1/organizations/${organizationId}/workspaces`, accessToken),
    apiFetch<ApiProject[]>(`/v1/organizations/${organizationId}/projects`, accessToken),
    apiFetch<ApiExperiment[]>(`/v1/organizations/${organizationId}/experiments`, accessToken),
  ]);
  return {
    workspaces: workspaces.map(workspaceFromApi),
    projects: projects.map(projectFromApi),
    experiments: experiments.map(experimentFromApi),
  };
}

export async function createProjectBundleInApi(organizationId: string, accessToken: string, input: NewProjectInput): Promise<ProjectBundle> {
  let workspaceId = input.workspaceId;
  let workspace: WorkspaceRecord | undefined;

  if (input.workspaceId === "new") {
    const workspaceName = input.newWorkspaceName?.trim() || `${input.brand} / Marketing`;
    const created = await apiFetch<ApiWorkspace>("/v1/workspaces", accessToken, {
      method: "POST",
      body: JSON.stringify({
        organization_id: organizationId,
        name: workspaceName,
        client_name: workspaceName.split("/")[0]?.trim() || workspaceName,
        description: "Workspace creado desde Sprint 19 DB.",
      }),
    });
    workspace = workspaceFromApi(created);
    workspaceId = workspace.id;
  }

  const project = projectFromApi(await apiFetch<ApiProject>("/v1/projects", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      workspace_id: workspaceId,
      brand: input.brand,
      campaign: input.campaign,
      objective: input.objective,
      channel: input.channel,
      audience: input.audience,
      language: input.language,
      expected_kpi: input.expectedKpi,
      status: "draft",
    }),
  }));

  const template = projectTemplates.find((item) => item.id === input.template);
  const experiment = experimentFromApi(await apiFetch<ApiExperiment>("/v1/experiments", accessToken, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      workspace_id: workspaceId,
      project_id: project.id,
      type: input.experimentType,
      name: template?.label ?? experimentTypeLabels[input.experimentType],
      template: input.template,
      asset_slots: experimentAssetSlots[input.experimentType],
      notes: "Creado desde wizard Sprint 19 DB.",
    }),
  }));

  if (!workspace) {
    const state = await loadProjectStoreFromApi(organizationId, accessToken);
    workspace = state.workspaces.find((item) => item.id === workspaceId);
  }

  if (!workspace) throw new Error("Workspace no encontrado despues de crear el proyecto.");

  return { workspace, project, experiment };
}
