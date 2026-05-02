import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createProjectBundleInApi, loadProjectStoreFromApi } from "./apiProjectStore";
import { createProjectBundle, findProjectBundle, loadProjectStore, saveProjectStore } from "./localProjectStore";
import type { NewProjectInput, ProjectBundle, ProjectStoreState } from "./types";

export function useProjectStore(organizationId: string, organizationName: string) {
  const { session } = useAuth();
  const [state, setState] = useState<ProjectStoreState>(() => loadProjectStore(organizationId, organizationName));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => state.projects[0]?.id ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = session?.accessToken;
  const useApi = session?.provider === "supabase" && Boolean(accessToken);

  useEffect(() => {
    if (!useApi) saveProjectStore(organizationId, state);
  }, [organizationId, state, useApi]);

  useEffect(() => {
    if (!useApi || !accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadProjectStoreFromApi(organizationId, accessToken)
      .then((nextState) => {
        if (cancelled) return;
        setState(nextState);
        setSelectedProjectId((current) => (
          current && nextState.projects.some((project) => project.id === current)
            ? current
            : nextState.projects[0]?.id ?? null
        ));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar proyectos desde API.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, organizationId, useApi]);

  const selectedBundle = useMemo(() => {
    if (!selectedProjectId) return null;
    return findProjectBundle(state, selectedProjectId);
  }, [selectedProjectId, state]);

  async function createBundle(input: NewProjectInput): Promise<ProjectBundle> {
    if (useApi && accessToken) {
      setIsLoading(true);
      setError(null);
      try {
        const bundle = await createProjectBundleInApi(organizationId, accessToken, input);
        setState((current) => ({
          workspaces: current.workspaces.some((item) => item.id === bundle.workspace.id) ? current.workspaces : [bundle.workspace, ...current.workspaces],
          projects: [bundle.project, ...current.projects],
          experiments: [bundle.experiment, ...current.experiments],
        }));
        setSelectedProjectId(bundle.project.id);
        return bundle;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo crear el proyecto en API.");
        throw caught;
      } finally {
        setIsLoading(false);
      }
    }

    const [nextState, bundle] = createProjectBundle(state, organizationId, input);
    setState(nextState);
    setSelectedProjectId(bundle.project.id);
    return bundle;
  }

  return {
    state,
    selectedBundle,
    selectedProjectId,
    setSelectedProjectId,
    isLoading,
    error,
    createBundle,
  };
}
