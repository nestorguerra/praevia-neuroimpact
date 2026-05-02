import type { DemoRequestInput, DemoRequestLead, DemoRequestResult } from "./types";

const STORE_KEY = "praevia.demo_requests.v1";
const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function readLeads(): DemoRequestLead[] {
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DemoRequestLead[];
  } catch {
    return [];
  }
}

function writeLead(lead: DemoRequestLead): void {
  const leads = readLeads();
  window.localStorage.setItem(STORE_KEY, JSON.stringify([lead, ...leads].slice(0, 50)));
}

function buildLocalLead(input: DemoRequestInput, status: DemoRequestLead["status"]): DemoRequestLead {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status,
  };
}

export async function submitDemoRequest(input: DemoRequestInput): Promise<DemoRequestResult> {
  const payload = {
    name: input.name.trim(),
    email: input.email.trim(),
    company: input.company.trim(),
    role: input.role.trim(),
    use_case: input.useCase.trim(),
    asset_count: input.assetCount.trim(),
    timeline: input.timeline.trim(),
    source: input.source,
    consent: input.consent,
    metadata: {
      product: "NeuroImpact Analyzer",
      offer: input.timeline,
    },
  };

  try {
    const response = await fetch(`${apiBaseUrl}/v1/marketing/demo-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const data = await response.json() as { id: string; created_at: string };
    const lead: DemoRequestLead = {
      ...input,
      id: data.id,
      createdAt: data.created_at,
      status: "api_sent",
    };
    writeLead(lead);
    return { lead, delivery: "api" };
  } catch {
    const lead = buildLocalLead(input, "pending_sync");
    writeLead(lead);
    return { lead, delivery: "local" };
  }
}

export function getStoredDemoRequests(): DemoRequestLead[] {
  return readLeads();
}
