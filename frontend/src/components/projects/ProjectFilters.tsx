import { Search } from "lucide-react";
import { statusLabels } from "../../projects/templates";
import type { ExperimentType, ProjectStatus, WorkspaceRecord } from "../../projects/types";

type ProjectFiltersProps = {
  query: string;
  status: "all" | ProjectStatus;
  type: "all" | ExperimentType;
  workspaceId: "all" | string;
  workspaces: WorkspaceRecord[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "all" | ProjectStatus) => void;
  onTypeChange: (value: "all" | ExperimentType) => void;
  onWorkspaceChange: (value: "all" | string) => void;
};

export function ProjectFilters({
  query,
  status,
  type,
  workspaceId,
  workspaces,
  onQueryChange,
  onStatusChange,
  onTypeChange,
  onWorkspaceChange,
}: ProjectFiltersProps) {
  return (
    <div className="project-filters">
      <label className="project-search">
        <Search size={15} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar por marca, campana o audiencia" />
      </label>
      <select value={workspaceId} onChange={(event) => onWorkspaceChange(event.target.value)}>
        <option value="all">Todos los workspaces</option>
        {workspaces.map((workspace) => (
          <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
        ))}
      </select>
      <select value={status} onChange={(event) => onStatusChange(event.target.value as "all" | ProjectStatus)}>
        <option value="all">Todos los estados</option>
        {Object.entries(statusLabels).map(([key, label]) => (
          <option value={key} key={key}>{label}</option>
        ))}
      </select>
      <select value={type} onChange={(event) => onTypeChange(event.target.value as "all" | ExperimentType)}>
        <option value="all">Todos los tipos</option>
        <option value="individual">Individual</option>
        <option value="ab">A/B</option>
        <option value="abc">A/B/C</option>
        <option value="script">Guion</option>
        <option value="event">Evento</option>
        <option value="training">Formacion</option>
      </select>
    </div>
  );
}

