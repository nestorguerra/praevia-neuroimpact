-- Sprint 9 · LLM interpretation engine and report generation.

create type public.report_type as enum ('executive', 'creative', 'technical');
create type public.report_status as enum ('draft', 'ready', 'failed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  report_type public.report_type not null default 'creative',
  language text not null default 'es',
  status public.report_status not null default 'ready',
  title text not null,
  decision text not null,
  guardrail_status text not null check (guardrail_status in ('passed', 'rewritten', 'blocked')),
  guardrail_findings jsonb not null default '[]'::jsonb,
  llm_provider text not null default 'local',
  draft_model text not null default 'local-draft-v0',
  final_model text not null default 'gpt-5.5',
  reviewer_model text,
  prompt_version text not null default 'report-master-v0.1',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_eur numeric not null default 0,
  html_storage_key text,
  pdf_storage_key text,
  report_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  section_key text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index reports_org_experiment_idx on public.reports(organization_id, experiment_id);
create index reports_scoring_result_idx on public.reports(scoring_result_id);
create index reports_analysis_run_idx on public.reports(analysis_run_id);
create index report_sections_report_idx on public.report_sections(report_id, order_index);

alter table public.reports enable row level security;
alter table public.report_sections enable row level security;

create policy "reports_members"
on public.reports
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "report_sections_members"
on public.report_sections
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
