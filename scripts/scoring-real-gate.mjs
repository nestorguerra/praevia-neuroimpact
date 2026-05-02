import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, ...patterns) {
  const absolute = path.join(root, relativePath);
  if (!existsSync(absolute)) return false;
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
}

function runEngineCheck() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "praevia-scoring-gate-"));
  const bundledPython = "/Users/nestorguerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const python = process.env.PYTHON_BIN || (existsSync(bundledPython) ? bundledPython : "python3");
  const script = `
from pathlib import Path
import numpy as np
from app.services.scoring_engine import EXPECTED_VERTICES, score_bold_npz_real

root = Path(${JSON.stringify(tempRoot)})
rng = np.random.default_rng(42)
bold = rng.normal(0, 0.05, size=(30, EXPECTED_VERTICES)).astype("float32")
valid = root / "bold_predictions.npz"
np.savez_compressed(valid, bold=bold)
result = score_bold_npz_real(valid, asset_kind="video", derivative_types={"normalized_media", "extracted_audio", "transcript"})
metrics = {item["metric_key"] for item in result["editorial_scores"]}
expected = {"nri", "visual_salience", "narrative_clarity", "multimodal_coherence", "semantic_load", "social_cueing", "scene_immersion", "action_readiness", "temporal_momentum"}
assert metrics == expected, metrics
assert result["summary"]["n_vertices"] == EXPECTED_VERTICES
assert result["summary"]["n_timesteps"] == 30
assert len(result["network_scores"]) >= 6
assert len(result["region_scores"]) >= 10
assert len(result["timecourse_points"]) == 30
assert {item["moment_type"] for item in result["peak_moments"]} == {"peak", "valley", "flat"}

invalid = root / "bad_predictions.npz"
np.savez_compressed(invalid, bold=np.zeros((4, 12), dtype="float32"))
try:
    score_bold_npz_real(invalid, asset_kind="text", derivative_types=set())
except ValueError as exc:
    assert "vertices esperados" in str(exc)
else:
    raise AssertionError("invalid shape accepted")

print(result["summary"])
`;
  const result = spawnSync(python, ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: path.join(root, "backend") },
    encoding: "utf8",
  });
  rmSync(tempRoot, { recursive: true, force: true });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim().slice(0, 800),
    stderr: result.stderr.trim().slice(0, 800),
  };
}

const engineCheck = runEngineCheck();

const checks = [
  ["backend_scoring_engine_exists", has("backend/app/services/scoring_engine.py", /score_bold_npz_real/, /EXPECTED_VERTICES = 20484/, /SCORING_VERSION = "scoring-v0\.2-real"/)],
  ["backend_scoring_validates_npz", has("backend/app/services/scoring_engine.py", /np\.load\(npz_path, allow_pickle=False\)/, /vertices esperados/, /not np\.isfinite\(bold\)\.all/)],
  ["backend_scoring_outputs_metrics", has("backend/app/services/scoring_engine.py", /visual_salience/, /narrative_clarity/, /multimodal_coherence/, /semantic_load/, /social_cueing/, /scene_immersion/, /action_readiness/, /temporal_momentum/)],
  ["backend_scoring_db_uses_real_storage", has("backend/app/repositories/scoring_db.py", /score_storage_npz/, /prediction_artifacts/, /bold_npz/, /source_prediction_artifact_id/, /event_type, source_table/) && !/build_mock_scoring/.test(read("backend/app/repositories/scoring_db.py"))],
  ["migration_scoring_traceability", has("backend/supabase/migrations/0018_real_scoring_traceability.sql", /source_prediction_artifact_id/, /pipeline_mode/, /input_quality/, /neuro_scoring_results_org_created_idx/)],
  ["backend_numpy_dependency", has("backend/pyproject.toml", /numpy>=1\.26\.0/)],
  ["engine_runtime_check", engineCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: { engineCheck },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
