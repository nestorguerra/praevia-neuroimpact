-- Sprint 27 · Real A/B/C comparison traceability.

create index if not exists comparison_runs_org_created_idx
on public.comparison_runs(organization_id, created_at desc);

create index if not exists comparison_runs_report_payload_algorithm_idx
on public.comparison_runs((report_payload->>'algorithm_version'));

create index if not exists comparison_items_scoring_result_idx
on public.comparison_items(scoring_result_id);

create index if not exists comparison_metric_deltas_winner_idx
on public.comparison_metric_deltas(comparison_id, winner_slot);

create index if not exists comparison_timepoint_deltas_winner_idx
on public.comparison_timepoint_deltas(comparison_id, winner_slot);
