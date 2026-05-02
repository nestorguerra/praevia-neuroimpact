-- Sprint 15/19 · Benchmarks, KPIs externos y calibracion en Postgres real.

create type public.benchmark_status as enum ('active', 'archived');
create type public.external_kpi_type as enum ('vtr', 'ctr', 'retention', 'brand_lift', 'survey', 'event_feedback');

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null,
  sector text not null,
  channel text not null,
  duration_label text not null default '30s',
  language text not null default 'es',
  owner_name text not null default 'PraevIA',
  status public.benchmark_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.benchmark_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  benchmark_id uuid not null references public.benchmarks(id) on delete cascade,
  scoring_result_id uuid references public.neuro_scoring_results(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  asset_name text not null,
  source_label text not null default 'manual',
  scores jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.external_kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  benchmark_id uuid not null references public.benchmarks(id) on delete cascade,
  benchmark_item_id uuid not null references public.benchmark_items(id) on delete cascade,
  kpi_type public.external_kpi_type not null,
  value numeric not null,
  unit text not null default '%',
  source text not null default 'manual',
  period text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index benchmarks_org_status_idx on public.benchmarks(organization_id, status);
create index benchmarks_org_category_idx on public.benchmarks(organization_id, category, channel);
create index benchmark_items_benchmark_idx on public.benchmark_items(benchmark_id);
create index benchmark_items_org_scoring_idx on public.benchmark_items(organization_id, scoring_result_id);
create index external_kpis_item_idx on public.external_kpis(benchmark_item_id);
create index external_kpis_org_type_idx on public.external_kpis(organization_id, kpi_type);

alter table public.benchmarks enable row level security;
alter table public.benchmark_items enable row level security;
alter table public.external_kpis enable row level security;

create policy "benchmarks_members"
on public.benchmarks
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "benchmark_items_members"
on public.benchmark_items
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "external_kpis_members"
on public.external_kpis
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
