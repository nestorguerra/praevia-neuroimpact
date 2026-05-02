-- Sprint 19 · Runtime settings persistentes y alias de scoring.

create table public.runtime_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  environment text not null default 'production' check (environment in ('local', 'staging', 'production')),
  compute_provider text not null default 'runpod_serverless',
  worker_mode text not null default 'remote_gpu',
  tribe_worker_endpoint_url text,
  tribe_model_id text not null default 'facebook/tribev2',
  tribe_max_asset_duration_seconds integer not null default 180 check (tribe_max_asset_duration_seconds > 0),
  monthly_gpu_cap_seconds integer not null default 7200 check (monthly_gpu_cap_seconds >= 0),
  monthly_cost_cap_eur numeric not null default 350 check (monthly_cost_cap_eur >= 0),
  llm_provider text not null default 'openai',
  llm_interpreter_model text not null default 'gpt-5.5-pro',
  llm_writer_model text not null default 'gpt-5.5-thinking',
  llm_writer_reasoning_effort text not null default 'high',
  llm_prompt_version text not null default 'report-master-v0.1',
  secret_refs jsonb not null default '{}'::jsonb,
  configured_flags jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, environment)
);

create index runtime_settings_org_env_idx on public.runtime_settings(organization_id, environment);

alter table public.runtime_settings enable row level security;

create policy "runtime_settings_members_select"
on public.runtime_settings
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "runtime_settings_admins_write"
on public.runtime_settings
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Alias de compatibilidad con el nombre de producto usado en el roadmap.
create or replace view public.scoring_results
with (security_invoker = true)
as
select *
from public.neuro_scoring_results;
