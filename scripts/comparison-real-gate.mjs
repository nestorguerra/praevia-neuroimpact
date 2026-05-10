import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, ...patterns) {
  if (!existsSync(path.join(root, relativePath))) return false;
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
}

function runComparisonCheck() {
  const bundledPython = "/Users/nestorguerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const python = existsSync(bundledPython) ? bundledPython : "python3";
  const script = `
from uuid import uuid4

from app.schemas.comparisons import ComparisonCreate, build_comparison
from app.schemas.scoring import NeuroScoringCreate, build_mock_scoring

org_id = uuid4()
experiment_id = uuid4()

def make_result(name, nri):
    result = build_mock_scoring(
        NeuroScoringCreate(
            organization_id=org_id,
            experiment_id=experiment_id,
            asset_id=uuid4(),
            analysis_run_id=uuid4(),
            asset_name=name,
            n_timesteps=24,
            asset_kind="video",
        )
    )
    result.summary["nri"] = nri
    return result

results = [
    make_result("Version A.mp4", 74),
    make_result("Version B.mp4", 86),
    make_result("Version C.mp4", 79),
]
payload = ComparisonCreate(
    organization_id=org_id,
    experiment_id=experiment_id,
    scoring_result_ids=[item.id for item in results],
    slots={str(results[0].id): "A", str(results[1].id): "B", str(results[2].id): "C"},
)
comparison = build_comparison(results, payload)
assert comparison.master_slot == "B", comparison.master_slot
assert comparison.winner_by_modality, comparison.winner_by_modality
assert comparison.report_payload["algorithm_version"] == "comparison-real-v0.1"
assert comparison.report_payload["timepoints_compared"] == len(comparison.timepoints)
assert {"master", "opening", "middle", "closing", "cut"} == {item.segment_key for item in comparison.mix}
assert all(point.margin >= 0 for point in comparison.timepoints)
assert any(delta.category == "visual" for delta in comparison.metric_deltas)
assert any(segment.impact == "alto" for segment in comparison.mix)
print({"master": comparison.master_slot, "timepoints": len(comparison.timepoints)})
`;
  const result = spawnSync(python, ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: path.join(root, "backend") },
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim().slice(0, 1000),
    stderr: result.stderr.trim().slice(0, 1000),
  };
}

const runtimeCheck = runComparisonCheck();

const checks = [
  ["schema_exposes_real_comparison_contract", has("backend/app/schemas/comparisons.py", /winner_by_modality/, /report_payload/, /margin: float/, /category: str/, /comparison-real-v0\.1/)],
  ["backend_checks_real_scoring_traceability", has("backend/app/repositories/comparison_db.py", /pipeline_mode/, /source_prediction_artifact_id/, /analysis_runs/, /prediction_artifacts/, /EXPECTED_TRIBE_VERTICES/)],
  ["backend_records_comparison_usage", has("backend/app/repositories/comparison_db.py", /usage_events/, /comparison_generation/, /credits_delta/, /COMPARISON_ALGORITHM_VERSION/)],
  ["migration_adds_comparison_trace_indexes", has("backend/supabase/migrations/0019_real_comparison_traceability.sql", /comparison_runs_report_payload_algorithm_idx/, /comparison_items_scoring_result_idx/, /comparison_timepoint_deltas_winner_idx/)],
  ["frontend_maps_real_fields", has("frontend/src/comparison/apiComparisonStore.ts", /pipeline_mode/, /run_status/, /winner_by_modality/, /report_payload/, /margin/)],
  ["frontend_displays_real_origin", has("frontend/src/pages/ComparisonPage.tsx", /Comparativa A\/B\/C real/, /reportPayload\.source/, /pipelineMode/)],
  ["runtime_build_comparison_check", runtimeCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: { runtimeCheck },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
