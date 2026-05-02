-- Sprint 6 · TRIBE analysis runs and prediction artifacts.

create type public.analysis_run_status as enum ('queued', 'running', 'done', 'failed', 'cancelled');

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  preprocessing_job_id uuid references public.preprocessing_jobs(id) on delete set null,
  status public.analysis_run_status not null default 'queued',
  model_id text not null default 'facebook/tribev2',
  model_revision text,
  worker_image text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  n_timesteps integer,
  n_vertices integer,
  gpu_seconds numeric,
  gpu_vram_mb numeric,
  duration_seconds numeric,
  error_message text,
  logs jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.prediction_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  artifact_type text not null,
  storage_bucket text not null,
  storage_key text not null,
  mime_type text not null,
  byte_size bigint,
  shape jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analysis_runs_experiment_idx on public.analysis_runs(experiment_id);
create index analysis_runs_asset_idx on public.analysis_runs(asset_id);
create index analysis_runs_organization_idx on public.analysis_runs(organization_id);
create index prediction_artifacts_run_idx on public.prediction_artifacts(analysis_run_id);
create index prediction_artifacts_organization_idx on public.prediction_artifacts(organization_id);

alter table public.analysis_runs enable row level security;
alter table public.prediction_artifacts enable row level security;

create policy "analysis_runs_select_members"
on public.analysis_runs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "analysis_runs_insert_members"
on public.analysis_runs
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "analysis_runs_update_members"
on public.analysis_runs
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "prediction_artifacts_select_members"
on public.prediction_artifacts
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "prediction_artifacts_insert_members"
on public.prediction_artifacts
for insert
to authenticated
with check (public.is_org_member(organization_id));

