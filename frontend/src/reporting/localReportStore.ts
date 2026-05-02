import type { ReportRecord } from "./types";

const storageKey = (organizationId: string) => `praevia:reports:${organizationId}`;

export function loadStoredReports(organizationId: string): ReportRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredReports(organizationId: string, reports: ReportRecord[]) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(reports));
}

export function upsertStoredReport(organizationId: string, report: ReportRecord) {
  const existing = loadStoredReports(organizationId).filter((item) => item.id !== report.id && item.scoringResultId !== report.scoringResultId);
  saveStoredReports(organizationId, [report, ...existing]);
}
