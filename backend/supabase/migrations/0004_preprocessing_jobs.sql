-- Sprint 5 · Preprocessing jobs and derived assets.

create type public.preprocessing_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create table public.preprocessing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  asset_version_id uuid references public.asset_versions(id) on delete set null,
  status public.preprocessing_job_status not null default 'queued',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  worker_name text not null default 'cpu-preprocessor',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  logs jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_derivatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  preprocessing_job_id uuid references public.preprocessing_jobs(id) on delete set null,
  derivative_type text not null,
  storage_bucket text not null,
  storage_key text not null,
  mime_type text not null,
  byte_size bigint,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index preprocessing_jobs_asset_idx on public.preprocessing_jobs(asset_id);
create index preprocessing_jobs_organization_idx on public.preprocessing_jobs(organization_id);
create index asset_derivatives_asset_idx on public.asset_derivatives(asset_id);
create index asset_derivatives_job_idx on public.asset_derivatives(preprocessing_job_id);
create index asset_derivatives_organization_idx on public.asset_derivatives(organization_id);

alter table public.preprocessing_jobs enable row level security;
alter table public.asset_derivatives enable row level security;

create policy "preprocessing_jobs_select_members"
on public.preprocessing_jobs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "preprocessing_jobs_insert_members"
on public.preprocessing_jobs
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "preprocessing_jobs_update_members"
on public.preprocessing_jobs
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "asset_derivatives_select_members"
on public.asset_derivatives
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "asset_derivatives_insert_members"
on public.asset_derivatives
for insert
to authenticated
with check (public.is_org_member(organization_id));

