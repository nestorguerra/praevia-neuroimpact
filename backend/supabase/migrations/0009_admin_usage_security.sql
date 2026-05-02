-- Sprint 11 · Admin, credits, costs and production security.

create type public.usage_event_type as enum (
  'asset_upload',
  'preprocessing',
  'tribe_run',
  'scoring',
  'report_generation',
  'comparison_generation',
  'secure_delete',
  'storage_retention',
  'manual_adjustment'
);

create type public.audit_severity as enum ('info', 'warning', 'error', 'critical');
create type public.deletion_status as enum ('requested', 'running', 'completed', 'failed');

create table public.organization_limits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  monthly_credit_limit numeric not null default 250,
  hard_credit_limit numeric not null default 300,
  storage_byte_limit bigint not null default 107374182400,
  max_asset_duration_seconds integer not null default 900,
  max_upload_byte_size bigint not null default 5368709120,
  run_rate_limit_per_hour integer not null default 20,
  report_rate_limit_per_hour integer not null default 30,
  retention_days integer not null default 30,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type public.usage_event_type not null,
  source_table text,
  source_id uuid,
  experiment_id uuid references public.experiments(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  comparison_id uuid references public.comparison_runs(id) on delete set null,
  credits_delta numeric not null default 0,
  estimated_cost_eur numeric not null default 0,
  gpu_seconds numeric not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  storage_bytes_delta bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usage_event_id uuid references public.usage_events(id) on delete set null,
  credits_delta numeric not null,
  balance_after numeric,
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  severity public.audit_severity not null default 'info',
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.secure_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  status public.deletion_status not null default 'requested',
  scope jsonb not null default '{}'::jsonb,
  storage_keys jsonb not null default '[]'::jsonb,
  removed_counts jsonb not null default '{}'::jsonb,
  error_message text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  route text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null,
  limit_count integer not null,
  blocked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source text not null,
  severity public.audit_severity not null default 'error',
  message text not null,
  stack text,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  environment text not null,
  snapshot_type text not null check (snapshot_type in ('db', 'storage_manifest', 'report_manifest')),
  storage_bucket text,
  storage_key text not null,
  byte_size bigint,
  checksum text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index usage_events_org_created_idx on public.usage_events(organization_id, created_at desc);
create index usage_events_org_type_idx on public.usage_events(organization_id, event_type);
create index credit_ledger_org_created_idx on public.credit_ledger(organization_id, created_at desc);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_org_entity_idx on public.audit_logs(organization_id, entity_type, entity_id);
create index secure_deletion_requests_org_created_idx on public.secure_deletion_requests(organization_id, requested_at desc);
create index rate_limit_events_org_created_idx on public.rate_limit_events(organization_id, created_at desc);
create index error_events_org_created_idx on public.error_events(organization_id, created_at desc);
create index backup_snapshots_org_created_idx on public.backup_snapshots(organization_id, created_at desc);

alter table public.organization_limits enable row level security;
alter table public.usage_events enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.audit_logs enable row level security;
alter table public.secure_deletion_requests enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.error_events enable row level security;
alter table public.backup_snapshots enable row level security;

create policy "organization_limits_members"
on public.organization_limits
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "usage_events_members"
on public.usage_events
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "credit_ledger_members"
on public.credit_ledger
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "audit_logs_members"
on public.audit_logs
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "secure_deletion_requests_members"
on public.secure_deletion_requests
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "rate_limit_events_members"
on public.rate_limit_events
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "error_events_members"
on public.error_events
for all
to authenticated
using (organization_id is null or public.is_org_member(organization_id))
with check (organization_id is null or public.is_org_member(organization_id));

create policy "backup_snapshots_members"
on public.backup_snapshots
for all
to authenticated
using (organization_id is null or public.is_org_member(organization_id))
with check (organization_id is null or public.is_org_member(organization_id));
