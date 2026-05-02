import type { ComparisonReport } from "./types";

const storageKey = (organizationId: string) => `praevia:comparisons:${organizationId}`;

export function loadStoredComparisons(organizationId: string): ComparisonReport[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredComparisons(organizationId: string, comparisons: ComparisonReport[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(comparisons));
}

export function upsertStoredComparison(organizationId: string, comparison: ComparisonReport) {
  const existing = loadStoredComparisons(organizationId).filter((item) => item.experimentId !== comparison.experimentId);
  saveStoredComparisons(organizationId, [comparison, ...existing]);
}
