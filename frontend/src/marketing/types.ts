export type DemoRequestInput = {
  name: string;
  email: string;
  company: string;
  role: string;
  useCase: string;
  assetCount: string;
  timeline: string;
  consent: boolean;
  source: string;
};

export type DemoRequestLead = DemoRequestInput & {
  id: string;
  createdAt: string;
  status: "api_sent" | "pending_sync";
};

export type DemoRequestResult = {
  lead: DemoRequestLead;
  delivery: "api" | "local";
};
