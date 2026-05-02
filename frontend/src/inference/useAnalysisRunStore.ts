import { useEffect, useMemo, useState } from "react";
import type { PreprocessingJob } from "../preprocessing/types";
import { createAnalysisRunsInApi, loadAnalysisRunsFromApi } from "./apiInferenceStore";
import { buildRunningRun, completeRun } from "./generateAnalysisRun";
import { loadStoredAnalysisRuns, saveStoredAnalysisRuns } from "./localInferenceStore";
import type { AnalysisRun } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useAnalysisRunStore(organizationId: string, experimentId: string, accessToken?: string) {
  const contextKey = `${organizationId}:${experimentId}`;
  const [loadedContextKey, setLoadedContextKey] = useState("");
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const useApi = Boolean(accessToken && experimentId !== "no-experiment");

  useEffect(() => {
    if (useApi && accessToken) {
      let cancelled = false;
      setError("");
      loadAnalysisRunsFromApi(experimentId, accessToken)
        .then((remoteRuns) => {
          if (!cancelled) {
            setRuns(remoteRuns);
            setLoadedContextKey(contextKey);
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar runs desde API.");
        });
      return () => {
        cancelled = true;
      };
    }
    setRuns(loadStoredAnalysisRuns(organizationId).filter((run) => run.experimentId === experimentId));
    setLoadedContextKey(contextKey);
  }, [accessToken, contextKey, experimentId, organizationId, useApi]);

  useEffect(() => {
    if (useApi) return;
    if (loadedContextKey !== contextKey) return;
    const otherRuns = loadStoredAnalysisRuns(organizationId).filter((run) => run.experimentId !== experimentId);
    saveStoredAnalysisRuns(organizationId, [...otherRuns, ...runs]);
  }, [contextKey, experimentId, loadedContextKey, organizationId, runs, useApi]);

  async function startRuns(jobs: PreprocessingJob[]) {
    const runnableJobs = jobs.filter((job) => job.status === "completed");
    if (runnableJobs.length === 0 || isRunning) return;
    setIsRunning(true);
    setError("");
    const runningRuns = runnableJobs.map(buildRunningRun);
    setRuns(runningRuns);
    if (useApi && accessToken) {
      try {
        setRuns(await createAnalysisRunsInApi(runnableJobs, accessToken));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudieron crear runs en API.");
      }
    } else {
      await delay(650);
      setRuns(runningRuns.map(completeRun));
    }
    setIsRunning(false);
  }

  const doneRuns = runs.filter((run) => run.status === "done").length;
  const artifactCount = useMemo(() => runs.reduce((sum, run) => sum + run.artifacts.length, 0), [runs]);

  return {
    runs,
    isRunning,
    error,
    doneRuns,
    artifactCount,
    startRuns,
  };
}
