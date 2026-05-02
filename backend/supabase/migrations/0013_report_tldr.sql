-- Sprint 19 · Persistencia completa del TL;DR de informes.

alter table public.reports
add column if not exists tldr text not null default '';

