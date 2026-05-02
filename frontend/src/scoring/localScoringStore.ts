import type { NeuroScoringResult } from "./types";

const storageKey = (organizationId: string) => `praevia:scoring:${organizationId}`;

export function loadStoredScoringResults(organizationId: string): NeuroScoringResult[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredScoringResults(organizationId: string, results: NeuroScoringResult[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(results));
}

