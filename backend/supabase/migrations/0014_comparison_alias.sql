-- Sprint 19 · Alias de compatibilidad para el nombre de roadmap.

create or replace view public.comparisons
with (security_invoker = true)
as
select *
from public.comparison_runs;

