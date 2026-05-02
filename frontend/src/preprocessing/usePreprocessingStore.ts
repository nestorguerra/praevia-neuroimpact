import { useEffect, useMemo, useState } from "react";
import type { UploadAsset } from "../uploads/types";
import { createPreprocessingJobsInApi, loadPreprocessingJobsFromApi } from "./apiPreprocessingStore";
import { buildCompletedJob, buildRunningJob } from "./generatePreprocessing";
import { loadStoredPreprocessingJobs, saveStoredPreprocessingJobs } from "./localPreprocessingStore";
import type { PreprocessingJob } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePreprocessingStore(organizationId: string, experimentId: string, accessToken?: string) {
  const contextKey = `${organizationId}:${experimentId}`;
  const [loadedContextKey, setLoadedContextKey] = useState("");
  const [jobs, setJobs] = useState<PreprocessingJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const useApi = Boolean(accessToken && experimentId !== "no-experiment");

  useEffect(() => {
    if (useApi && accessToken) {
      let cancelled = false;
      setError("");
      loadPreprocessingJobsFromApi(experimentId, accessToken)
        .then((remoteJobs) => {
          if (!cancelled) {
            setJobs(remoteJobs);
            setLoadedContextKey(contextKey);
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar jobs desde API.");
        });
      return () => {
        cancelled = true;
      };
    }
    setJobs(loadStoredPreprocessingJobs(organizationId).filter((job) => job.experimentId === experimentId));
    setLoadedContextKey(contextKey);
  }, [accessToken, contextKey, experimentId, organizationId, useApi]);

  useEffect(() => {
    if (useApi) return;
    if (loadedContextKey !== contextKey) return;
    const otherJobs = loadStoredPreprocessingJobs(organizationId).filter((job) => job.experimentId !== experimentId);
    saveStoredPreprocessingJobs(organizationId, [...otherJobs, ...jobs]);
  }, [contextKey, experimentId, jobs, loadedContextKey, organizationId, useApi]);

  async function startJobs(assets: UploadAsset[]) {
    if (assets.length === 0 || isRunning) return;
    setIsRunning(true);
    setError("");
    const runningJobs = assets.map(buildRunningJob);
    setJobs(runningJobs);
    if (useApi && accessToken) {
      try {
        setJobs(await createPreprocessingJobsInApi(assets, accessToken));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudieron crear jobs en API.");
      }
    } else {
      await delay(450);
      setJobs(assets.map(buildCompletedJob));
    }
    setIsRunning(false);
  }

  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const derivativeCount = useMemo(() => jobs.reduce((sum, job) => sum + job.derivatives.length, 0), [jobs]);

  return {
    jobs,
    isRunning,
    error,
    completedJobs,
    derivativeCount,
    startJobs,
  };
}
