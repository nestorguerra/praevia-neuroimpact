-- Sprint 28 · Admin, real costs, credits and manual billing controls.

alter table public.organization_limits
  add column if not exists monthly_cost_limit_eur numeric not null default 350,
  add column if not exists monthly_gpu_seconds_limit numeric not null default 7200;

create index if not exists usage_events_org_month_idx
on public.usage_events(organization_id, created_at desc);

create index if not exists usage_events_org_type_month_idx
on public.usage_events(organization_id, event_type, created_at desc);

create index if not exists storage_objects_org_active_bytes_idx
on public.storage_objects(organization_id, status, byte_size)
where status = 'active';
