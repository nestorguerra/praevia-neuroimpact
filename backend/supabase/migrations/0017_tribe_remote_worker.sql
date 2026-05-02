-- Sprint 23 · Worker GPU TRIBE real via RunPod Serverless.

alter table public.analysis_runs
add column if not exists compute_provider text not null default 'local_mock',
add column if not exists provider_job_id text,
add column if not exists worker_timeout_seconds integer not null default 900,
add column if not exists attempt_count integer not null default 0,
add column if not exists callback_received_at timestamptz,
add column if not exists last_provider_status text,
add column if not exists updated_at timestamptz not null default now();

create index if not exists analysis_runs_provider_job_idx
on public.analysis_runs(provider_job_id)
where provider_job_id is not null;

create index if not exists analysis_runs_org_status_created_idx
on public.analysis_runs(organization_id, status, created_at desc);

alter table public.prediction_artifacts
add column if not exists sha256 text;
