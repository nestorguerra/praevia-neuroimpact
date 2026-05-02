import type { NeuroScoringResult } from "../scoring/types";
import type { ReportRecord } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(accessToken),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

function reportFromApi(row: any, scoringSnapshot: NeuroScoringResult): ReportRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experimentId: row.experiment_id,
    assetId: row.asset_id,
    analysisRunId: row.analysis_run_id,
    scoringResultId: row.scoring_result_id,
    assetName: scoringSnapshot.assetName,
    reportType: row.report_type,
    language: row.language,
    status: row.status,
    title: row.title,
    decision: row.decision,
    tldr: row.tldr,
    guardrailStatus: row.guardrail_status,
    guardrailFindings: row.guardrail_findings ?? [],
    usage: {
      provider: row.usage.provider,
      draftModel: row.usage.draft_model,
      finalModel: row.usage.final_model,
      reviewerModel: row.usage.reviewer_model ?? undefined,
      promptVersion: row.usage.prompt_version,
      inputTokens: row.usage.input_tokens,
      outputTokens: row.usage.output_tokens,
      estimatedCostEur: row.usage.estimated_cost_eur,
    },
    htmlStorageKey: row.html_storage_key,
    pdfStorageKey: row.pdf_storage_key,
    sections: (row.sections ?? []).map((section: any) => ({
      id: section.id,
      sectionKey: section.section_key,
      title: section.title,
      body: section.body,
      payload: section.payload ?? {},
      orderIndex: section.order_index,
    })),
    scoringSnapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadReportsFromApi(
  experimentId: string,
  accessToken: string,
  scoringResults: NeuroScoringResult[],
): Promise<ReportRecord[]> {
  const rows = await apiFetch<any[]>(`/v1/experiments/${experimentId}/reports`, accessToken);
  return rows.flatMap((row) => {
    const scoring = scoringResults.find((item) => item.id === row.scoring_result_id);
    return scoring ? [reportFromApi(row, scoring)] : [];
  });
}

export async function createReportInApi(result: NeuroScoringResult, accessToken: string): Promise<ReportRecord> {
  const row = await apiFetch<any>("/v1/reports", accessToken, {
    method: "POST",
    body: JSON.stringify({
      scoring_result_id: result.id,
      report_type: "creative",
      language: "es",
      audience: "creative",
    }),
  });
  return reportFromApi(row, result);
}

export async function downloadReportArtifactFromApi(report: ReportRecord, accessToken: string, format: "pdf" | "html") {
  const row = await apiFetch<any>(`/v1/reports/${report.id}/download?format=${format}`, accessToken);
  const anchor = document.createElement("a");
  anchor.href = row.signed_url;
  anchor.download = `${report.assetName}-report.${format}`;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
