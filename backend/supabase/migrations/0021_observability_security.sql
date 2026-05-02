-- Sprint 29 · Observability and security hardening.

alter table public.error_events
  add column if not exists fingerprint text,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists actionable boolean not null default true;

create index if not exists error_events_org_unresolved_idx
on public.error_events(organization_id, created_at desc)
where resolved_at is null;

create index if not exists error_events_source_created_idx
on public.error_events(source, created_at desc);

create index if not exists rate_limit_events_route_blocked_idx
on public.rate_limit_events(organization_id, route, created_at desc)
where blocked = true;

create index if not exists backup_snapshots_org_type_created_idx
on public.backup_snapshots(organization_id, snapshot_type, created_at desc);

create index if not exists audit_logs_action_created_idx
on public.audit_logs(organization_id, action, created_at desc);
