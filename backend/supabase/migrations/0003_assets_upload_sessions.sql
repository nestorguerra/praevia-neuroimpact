-- Sprint 4 · Assets, asset versions and upload sessions.

create type public.asset_kind as enum ('video', 'audio', 'text');
create type public.asset_status as enum ('pending', 'uploading', 'validated', 'warning', 'error', 'deleted');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  slot text not null check (slot in ('A', 'B', 'C')),
  kind public.asset_kind not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text,
  status public.asset_status not null default 'pending',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, slot)
);

create table public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  version integer not null default 1,
  storage_bucket text not null,
  storage_key text not null,
  duration_seconds numeric,
  width integer,
  height integer,
  fps numeric,
  audio_present boolean,
  subtitles_detected boolean,
  language_guess text,
  health jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  storage_bucket text not null,
  storage_key text not null,
  signed_url_expires_at timestamptz not null,
  status text not null default 'created',
  expected_sha256 text,
  max_byte_size bigint not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index assets_experiment_idx on public.assets(experiment_id);
create index assets_organization_idx on public.assets(organization_id);
create index asset_versions_asset_idx on public.asset_versions(asset_id);
create index upload_sessions_asset_idx on public.upload_sessions(asset_id);
create index upload_sessions_organization_idx on public.upload_sessions(organization_id);

alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.upload_sessions enable row level security;

create policy "assets_select_members"
on public.assets
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "assets_insert_members"
on public.assets
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "assets_update_members"
on public.assets
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "asset_versions_select_members"
on public.asset_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_versions.asset_id
      and public.is_org_member(a.organization_id)
  )
);

create policy "asset_versions_insert_members"
on public.asset_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_versions.asset_id
      and public.is_org_member(a.organization_id)
  )
);

create policy "upload_sessions_select_members"
on public.upload_sessions
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "upload_sessions_insert_members"
on public.upload_sessions
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "upload_sessions_update_members"
on public.upload_sessions
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

