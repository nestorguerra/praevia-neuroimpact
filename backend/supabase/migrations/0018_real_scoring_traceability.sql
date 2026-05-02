-- Sprint 24 · Real scoring traceability from TRIBE prediction artifacts.

alter table public.neuro_scoring_results
  add column if not exists source_prediction_artifact_id uuid references public.prediction_artifacts(id) on delete set null,
  add column if not exists pipeline_mode text not null default 'mock_contract',
  add column if not exists input_quality numeric,
  add column if not exists n_timesteps integer,
  add column if not exists n_vertices integer;

create index if not exists neuro_scoring_results_source_artifact_idx
on public.neuro_scoring_results(source_prediction_artifact_id);

create index if not exists neuro_scoring_results_org_created_idx
on public.neuro_scoring_results(organization_id, created_at desc);
