-- Sprint 21 · Backend API real para workflow creativo y share links.

create table public.workflow_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  source_type text not null check (source_type in ('timeline', 'recommendation', 'report', 'comparison')),
  source_id text not null,
  timecode text not null,
  layer text not null,
  action text not null,
  confidence text not null default 'CONF 0.88',
  impact text not null default 'Medio' check (impact in ('Bajo', 'Medio', 'Alto')),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, source_type, source_id)
);

create table public.workflow_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  source_type text not null check (source_type in ('timeline', 'recommendation', 'report', 'comparison')),
  source_id text not null,
  timecode text not null,
  body text not null,
  author_name text not null,
  resolved boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  source_recommendation_id text not null default '',
  title text not null,
  timecode text not null,
  layer text not null,
  assignee text not null,
  confidence text not null default 'CONF 0.88',
  impact text not null default 'Medio' check (impact in ('Bajo', 'Medio', 'Alto')),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflow_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  token text not null unique,
  title text not null,
  viewer_role text not null default 'client_viewer',
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  created_by_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.workflow_history_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  actor_name text not null,
  action text not null,
  entity_type text not null check (entity_type in ('comment', 'task', 'recommendation', 'share_link', 'workflow')),
  entity_id text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workflow_recommendations_experiment_idx on public.workflow_recommendations(experiment_id, created_at desc);
create index workflow_comments_experiment_idx on public.workflow_comments(experiment_id, created_at desc);
create index workflow_tasks_experiment_idx on public.workflow_tasks(experiment_id, created_at desc);
create index workflow_share_links_experiment_idx on public.workflow_share_links(experiment_id, created_at desc);
create index workflow_share_links_token_idx on public.workflow_share_links(token);
create index workflow_history_events_experiment_idx on public.workflow_history_events(experiment_id, created_at desc);

alter table public.workflow_recommendations enable row level security;
alter table public.workflow_comments enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.workflow_share_links enable row level security;
alter table public.workflow_history_events enable row level security;

create policy "workflow_recommendations_members"
on public.workflow_recommendations
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "workflow_comments_members"
on public.workflow_comments
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "workflow_tasks_members"
on public.workflow_tasks
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "workflow_share_links_members"
on public.workflow_share_links
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "workflow_history_events_members"
on public.workflow_history_events
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
