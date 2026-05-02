import type { PreprocessingJob } from "./types";

const storageKey = (organizationId: string) => `praevia:preprocessing:${organizationId}`;

export function loadStoredPreprocessingJobs(organizationId: string): PreprocessingJob[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredPreprocessingJobs(organizationId: string, jobs: PreprocessingJob[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(jobs));
}

