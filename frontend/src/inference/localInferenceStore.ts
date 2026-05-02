import type { AnalysisRun } from "./types";

const storageKey = (organizationId: string) => `praevia:analysis-runs:${organizationId}`;

export function loadStoredAnalysisRuns(organizationId: string): AnalysisRun[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAnalysisRuns(organizationId: string, runs: AnalysisRun[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(runs));
}

