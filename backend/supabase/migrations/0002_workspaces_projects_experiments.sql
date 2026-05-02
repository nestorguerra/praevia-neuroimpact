-- Sprint 3 · Workspaces, projects and experiments.

create type public.experiment_type as enum ('individual', 'ab', 'abc', 'script', 'event', 'training');
create type public.project_status as enum ('draft', 'ready', 'running', 'report_ready', 'archived');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  client_name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand text not null,
  campaign text not null,
  objective text not null,
  channel text not null,
  audience text not null,
  language text not null default 'Espanol',
  expected_kpi text not null,
  status public.project_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  type public.experiment_type not null,
  name text not null,
  template text not null,
  asset_slots integer not null default 1 check (asset_slots between 1 and 3),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_organization_id_idx on public.workspaces(organization_id);
create index projects_organization_workspace_idx on public.projects(organization_id, workspace_id);
create index projects_status_idx on public.projects(status);
create index experiments_project_idx on public.experiments(project_id);
create index experiments_type_idx on public.experiments(type);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.experiments enable row level security;

create policy "workspaces_select_members"
on public.workspaces
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "workspaces_insert_members"
on public.workspaces
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "workspaces_update_admins"
on public.workspaces
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "projects_select_members"
on public.projects
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "projects_insert_members"
on public.projects
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "projects_update_members"
on public.projects
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "experiments_select_members"
on public.experiments
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "experiments_insert_members"
on public.experiments
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "experiments_update_members"
on public.experiments
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

