-- Sprint 20 · Storage seguro real, manifiesto de objetos y retencion.

create table public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  upload_session_id uuid references public.upload_sessions(id) on delete set null,
  source_table text not null,
  source_id uuid,
  object_role text not null check (
    object_role in ('original', 'derivative', 'prediction', 'report_html', 'report_pdf', 'backup', 'other')
  ),
  storage_bucket text not null,
  storage_key text not null,
  content_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0 check (byte_size >= 0),
  sha256 text,
  extension text,
  status text not null default 'active' check (status in ('active', 'deleted', 'retention_due', 'delete_failed')),
  retention_delete_after timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_error text,
  unique (storage_bucket, storage_key)
);

create index storage_objects_org_status_idx on public.storage_objects(organization_id, status);
create index storage_objects_org_retention_idx on public.storage_objects(organization_id, retention_delete_after)
where status = 'active';
create index storage_objects_asset_idx on public.storage_objects(asset_id);
create index storage_objects_upload_session_idx on public.storage_objects(upload_session_id);

alter table public.storage_objects enable row level security;

create policy "storage_objects_select_members"
on public.storage_objects
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "storage_objects_insert_members"
on public.storage_objects
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "storage_objects_update_admins"
on public.storage_objects
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
