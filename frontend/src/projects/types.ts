export type ExperimentType = "individual" | "ab" | "abc" | "script" | "event" | "training";

export type ProjectStatus = "draft" | "ready" | "running" | "report_ready" | "archived";

export type WorkspaceRecord = {
  id: string;
  organizationId: string;
  name: string;
  clientName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  brand: string;
  campaign: string;
  objective: string;
  channel: string;
  audience: string;
  language: string;
  expectedKpi: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExperimentRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId: string;
  type: ExperimentType;
  name: string;
  template: string;
  assetSlots: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectBundle = {
  project: ProjectRecord;
  experiment: ExperimentRecord;
  workspace: WorkspaceRecord;
};

export type ProjectStoreState = {
  workspaces: WorkspaceRecord[];
  projects: ProjectRecord[];
  experiments: ExperimentRecord[];
};

export type NewProjectInput = {
  workspaceId: string;
  newWorkspaceName?: string;
  brand: string;
  campaign: string;
  objective: string;
  channel: string;
  audience: string;
  language: string;
  expectedKpi: string;
  experimentType: ExperimentType;
  template: string;
};

