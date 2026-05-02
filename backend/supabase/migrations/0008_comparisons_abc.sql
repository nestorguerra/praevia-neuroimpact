-- Sprint 10 · A/B/C comparison and recommended creative mix.

create type public.comparison_status as enum ('ready', 'needs_review', 'failed');
create type public.asset_slot as enum ('A', 'B', 'C');

create table public.comparison_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  status public.comparison_status not null default 'ready',
  title text not null default 'Comparativa A/B/C',
  decision text not null,
  master_slot public.asset_slot not null,
  comparability jsonb not null default '[]'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comparison_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  comparison_id uuid not null references public.comparison_runs(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  slot public.asset_slot not null,
  rank integer not null,
  nri numeric not null,
  global_delta numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.comparison_metric_deltas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  comparison_id uuid not null references public.comparison_runs(id) on delete cascade,
  metric_key text not null,
  metric_label text not null,
  winner_slot public.asset_slot not null,
  values jsonb not null default '{}'::jsonb,
  deltas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.comparison_timepoint_deltas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  comparison_id uuid not null references public.comparison_runs(id) on delete cascade,
  point_index integer not null,
  timecode text not null,
  winner_slot public.asset_slot not null,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.comparison_mix_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  comparison_id uuid not null references public.comparison_runs(id) on delete cascade,
  segment_key text not null,
  label text not null,
  timecode text not null,
  source_slot public.asset_slot not null,
  reason text not null,
  action text not null,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index comparison_runs_experiment_idx on public.comparison_runs(experiment_id);
create index comparison_items_comparison_idx on public.comparison_items(comparison_id);
create index comparison_metric_deltas_comparison_idx on public.comparison_metric_deltas(comparison_id);
create index comparison_timepoint_deltas_comparison_idx on public.comparison_timepoint_deltas(comparison_id);
create index comparison_mix_segments_comparison_idx on public.comparison_mix_segments(comparison_id);

alter table public.comparison_runs enable row level security;
alter table public.comparison_items enable row level security;
alter table public.comparison_metric_deltas enable row level security;
alter table public.comparison_timepoint_deltas enable row level security;
alter table public.comparison_mix_segments enable row level security;

create policy "comparison_runs_members"
on public.comparison_runs
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "comparison_items_members"
on public.comparison_items
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "comparison_metric_deltas_members"
on public.comparison_metric_deltas
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "comparison_timepoint_deltas_members"
on public.comparison_timepoint_deltas
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "comparison_mix_segments_members"
on public.comparison_mix_segments
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
