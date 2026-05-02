-- Sprint 16/19 · Enterprise beta, API keys, retencion, SSO y exports mensuales.

create type public.organization_api_key_status as enum ('active', 'revoked');
create type public.organization_sso_status as enum ('placeholder', 'requirements_ready', 'implementation_ready');
create type public.dpa_status as enum ('draft_ready', 'under_review', 'signed');

create table public.organization_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text,
  scopes text[] not null default array['runs:read', 'reports:read', 'usage:read'],
  status public.organization_api_key_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  rotated_at timestamptz,
  last_used_at timestamptz
);

create table public.organization_retention_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  region text not null default 'EU' check (region in ('EU')),
  asset_retention_days int not null default 30 check (asset_retention_days > 0),
  report_retention_days int not null default 90 check (report_retention_days > 0),
  backup_retention_days int not null default 30 check (backup_retention_days > 0),
  secure_delete_sla_days int not null default 7 check (secure_delete_sla_days > 0),
  incident_response_hours int not null default 24 check (incident_response_hours > 0),
  dpa_status public.dpa_status not null default 'draft_ready',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.organization_sso_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status public.organization_sso_status not null default 'requirements_ready',
  protocol text not null default 'SAML 2.0 / OIDC',
  target_plan text not null default 'Enterprise',
  provider_examples text[] not null default array['Okta', 'Microsoft Entra ID', 'Google Workspace', 'OneLogin'],
  requirements jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.monthly_usage_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  invoice_mode text not null default 'manual_beta' check (invoice_mode in ('manual_beta')),
  credits_used numeric not null default 0,
  estimated_cost_eur numeric not null default 0,
  gpu_seconds numeric not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  storage_bytes bigint not null default 0,
  runs int not null default 0,
  reports int not null default 0,
  comparisons int not null default 0,
  usage_event_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, month)
);

create index organization_api_keys_org_idx on public.organization_api_keys(organization_id);
create index organization_api_keys_prefix_idx on public.organization_api_keys(key_prefix);
create index monthly_usage_exports_org_month_idx on public.monthly_usage_exports(organization_id, month);

alter table public.organization_api_keys enable row level security;
alter table public.organization_retention_policies enable row level security;
alter table public.organization_sso_configs enable row level security;
alter table public.monthly_usage_exports enable row level security;

create policy "organization_api_keys_admins"
on public.organization_api_keys
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "organization_retention_policies_members_select"
on public.organization_retention_policies
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "organization_retention_policies_admins_write"
on public.organization_retention_policies
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "organization_sso_configs_members_select"
on public.organization_sso_configs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "organization_sso_configs_admins_write"
on public.organization_sso_configs
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "monthly_usage_exports_members"
on public.monthly_usage_exports
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "monthly_usage_exports_admins_write"
on public.monthly_usage_exports
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
