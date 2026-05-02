import { useEffect, useMemo, useState } from "react";
import type { AnalysisRun } from "../inference/types";
import { createScoringResultsInApi, loadScoringResultsFromApi } from "./apiScoringStore";
import { buildScoringResult } from "./generateScoringResult";
import { loadStoredScoringResults, saveStoredScoringResults } from "./localScoringStore";
import type { NeuroScoringResult } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useScoringStore(organizationId: string, experimentId: string, accessToken?: string) {
  const contextKey = `${organizationId}:${experimentId}`;
  const [loadedContextKey, setLoadedContextKey] = useState("");
  const [results, setResults] = useState<NeuroScoringResult[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState("");
  const useApi = Boolean(accessToken && experimentId !== "no-experiment");

  useEffect(() => {
    if (useApi && accessToken) {
      let cancelled = false;
      setError("");
      loadScoringResultsFromApi(experimentId, accessToken)
        .then((remoteResults) => {
          if (!cancelled) {
            setResults(remoteResults);
            setLoadedContextKey(contextKey);
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar scoring desde API.");
        });
      return () => {
        cancelled = true;
      };
    }
    setResults(loadStoredScoringResults(organizationId).filter((result) => result.experimentId === experimentId));
    setLoadedContextKey(contextKey);
  }, [accessToken, contextKey, experimentId, organizationId, useApi]);

  useEffect(() => {
    if (useApi) return;
    if (loadedContextKey !== contextKey) return;
    const otherResults = loadStoredScoringResults(organizationId).filter((result) => result.experimentId !== experimentId);
    saveStoredScoringResults(organizationId, [...otherResults, ...results]);
  }, [contextKey, experimentId, loadedContextKey, organizationId, results, useApi]);

  async function startScoring(runs: AnalysisRun[]) {
    const doneRuns = runs.filter((run) => run.status === "done");
    if (doneRuns.length === 0 || isScoring) return;
    setIsScoring(true);
    setError("");
    if (useApi && accessToken) {
      try {
        setResults(await createScoringResultsInApi(doneRuns, accessToken));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo crear scoring en API.");
      }
    } else {
      await delay(450);
      setResults(doneRuns.map(buildScoringResult));
    }
    setIsScoring(false);
  }

  const resultCount = results.length;
  const scoreCount = useMemo(() => results.reduce((sum, result) => sum + result.editorialScores.length, 0), [results]);

  return {
    results,
    isScoring,
    error,
    resultCount,
    scoreCount,
    startScoring,
  };
}
