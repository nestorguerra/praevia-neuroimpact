-- Sprint 2 · Auth, organizations and app shell foundation.
-- Apply in Supabase SQL editor or via Supabase CLI once the project exists.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'admin', 'analyst', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'Sprint 10',
  status text not null default 'pilot',
  credits integer not null default 50 check (credits >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_members"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "organizations_update_admins"
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "memberships_select_same_org"
on public.memberships
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "memberships_insert_admins"
on public.memberships
for insert
to authenticated
with check (public.is_org_admin(organization_id));

create policy "memberships_update_admins"
on public.memberships
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
  org_slug text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  org_name := coalesce(new.raw_user_meta_data ->> 'organization_name', split_part(split_part(new.email, '@', 2), '.', 1));
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(new.id::text from 1 for 8);

  insert into public.organizations (name, slug, created_by)
  values (org_name, org_slug, new.id)
  returning id into org_id;

  insert into public.memberships (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

