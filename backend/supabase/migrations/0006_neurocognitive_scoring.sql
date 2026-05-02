-- Sprint 7 · Neurocognitive scoring and internal results.

create table public.neuro_scoring_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  model_id text not null default 'facebook/tribev2',
  scoring_version text not null default 'scoring-v0.1',
  confidence_label text not null check (confidence_label in ('baja', 'media', 'alta')),
  benchmark_label text not null default 'demo baseline',
  bold_delay_seconds numeric not null default 4.5,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.editorial_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  metric_key text not null,
  metric_label text not null,
  score numeric not null check (score >= 0 and score <= 100),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  benchmark_delta numeric,
  evidence text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table public.region_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  region_key text not null,
  region_label text not null,
  network_key text not null,
  score numeric not null check (score >= 0 and score <= 100),
  mean_response numeric not null,
  peak_response numeric not null,
  evidence text not null,
  created_at timestamptz not null default now()
);

create table public.network_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  network_key text not null,
  network_label text not null,
  score numeric not null check (score >= 0 and score <= 100),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence text not null,
  created_at timestamptz not null default now()
);

create table public.timecourse_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  point_index integer not null,
  bold_time_seconds numeric not null,
  stimulus_time_seconds numeric not null,
  global_response numeric not null,
  normalized_response numeric not null,
  event_label text,
  created_at timestamptz not null default now()
);

create table public.peak_moments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scoring_result_id uuid not null references public.neuro_scoring_results(id) on delete cascade,
  moment_type text not null check (moment_type in ('peak', 'valley', 'flat')),
  start_seconds numeric not null,
  end_seconds numeric not null,
  score numeric not null check (score >= 0 and score <= 100),
  evidence text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index neuro_scoring_results_run_idx on public.neuro_scoring_results(analysis_run_id);
create index neuro_scoring_results_experiment_idx on public.neuro_scoring_results(experiment_id);
create index editorial_scores_result_idx on public.editorial_scores(scoring_result_id);
create index region_scores_result_idx on public.region_scores(scoring_result_id);
create index network_scores_result_idx on public.network_scores(scoring_result_id);
create index timecourse_points_result_idx on public.timecourse_points(scoring_result_id);
create index peak_moments_result_idx on public.peak_moments(scoring_result_id);

alter table public.neuro_scoring_results enable row level security;
alter table public.editorial_scores enable row level security;
alter table public.region_scores enable row level security;
alter table public.network_scores enable row level security;
alter table public.timecourse_points enable row level security;
alter table public.peak_moments enable row level security;

create policy "neuro_scoring_results_members"
on public.neuro_scoring_results
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "editorial_scores_members"
on public.editorial_scores
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "region_scores_members"
on public.region_scores
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "network_scores_members"
on public.network_scores
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "timecourse_points_members"
on public.timecourse_points
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "peak_moments_members"
on public.peak_moments
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

