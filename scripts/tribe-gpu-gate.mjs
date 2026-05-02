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

function runMockWorkerCheck() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "praevia-tribe-gate-"));
  const bundledPython = "/Users/nestorguerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const python = process.env.PYTHON_BIN || (existsSync(bundledPython) ? bundledPython : "python3");
  const result = spawnSync(
    python,
    ["-m", "tribe_worker.cli", "--run-spec", path.join(root, "worker/tribe/examples/run-spec.json"), "--output-dir", tempRoot, "--mock"],
    {
      cwd: path.join(root, "worker/tribe"),
      env: { ...process.env, PYTHONPATH: path.join(root, "worker/tribe") },
      encoding: "utf8",
    },
  );
  const npzExists = existsSync(path.join(tempRoot, "bold_predictions.npz"));
  const segmentsExists = existsSync(path.join(tempRoot, "segments.parquet"));
  const metricsExists = existsSync(path.join(tempRoot, "run_metrics.json"));
  const stdoutLooksValid = result.stdout.includes("\"n_vertices\": 20484") && result.stdout.includes("bold_predictions.npz");
  rmSync(tempRoot, { recursive: true, force: true });
  return {
    ok: result.status === 0 && npzExists && segmentsExists && metricsExists && stdoutLooksValid,
    status: result.status,
    stderr: result.stderr.trim().slice(0, 600),
  };
}

const mockWorkerCheck = runMockWorkerCheck();

const envFiles = [
  ".env.example",
  ".env.staging.example",
  ".env.production.example",
  "infra/env/local.example.env",
  "infra/env/staging.example.env",
  "infra/env/production.example.env",
];

const checks = [
  ["backend_settings_runpod", has("backend/app/settings.py", /RUNPOD_API_KEY/, /TRIBE_CALLBACK_SECRET/, /TRIBE_RUN_TIMEOUT_SECONDS/, /TRIBE_GPU_EUR_PER_SECOND/)],
  ["runpod_client_contract", has("backend/app/services/runpod_client.py", /class RunPodClient/, /_endpoint_url\("run"\)/, /_endpoint_url\(f"status\/\{job_id\}"\)/, /Authorization/)],
  ["inference_db_remote_mode", has("backend/app/repositories/inference_db.py", /settings\.tribe_worker_mode == "remote_gpu"/, /runpod_client\.enqueue/, /provider_job_id/, /_assert_gpu_caps/, /usage_events/)],
  ["callback_route_secured", has("backend/app/routes/tribe_internal.py", /X-TRIBE-CALLBACK-SECRET|x_tribe_callback_secret/, /hmac\.compare_digest/, /apply_callback/)],
  ["migration_remote_worker", has("backend/supabase/migrations/0017_tribe_remote_worker.sql", /provider_job_id/, /callback_received_at/, /sha256/, /analysis_runs_provider_job_idx/)],
  ["worker_handler_runpod", has("worker/tribe/tribe_worker/handler.py", /runpod\.serverless\.start/, /download_s3_object/, /upload_s3_object/, /TRIBE_CALLBACK_SECRET/, /bold_predictions\.npz/)],
  ["worker_uses_demo_utils_import", has("worker/tribe/tribe_worker/runner.py", /tribev2\.demo_utils import TribeModel/, /EXPECTED_VERTICES = 20484/)],
  ["worker_docker_serverless", has("worker/tribe/Dockerfile", /pytorch\/pytorch/, /cuda/, /storage_client\.py/, /tribe_worker\.handler/) && !read("worker/tribe/Dockerfile").includes("ENTRYPOINT [\"python\", \"-m\", \"tribe_worker.cli\"]")],
  ["worker_requirements_runpod", has("worker/tribe/requirements.txt", /runpod/, /huggingface_hub/, /nilearn/)],
  ["frontend_polls_runs", has("frontend/src/inference/apiInferenceStore.ts", /waitForRun/, /\/v1\/analysis-runs\/\$\{runId\}/, /Promise\.all/)],
  ["env_examples_remote_gpu", envFiles.every((file) => has(file, /RUNPOD_API_KEY|GPU_PROVIDER_API_KEY/, /TRIBE_CALLBACK_SECRET/, /TRIBE_RUN_TIMEOUT_SECONDS/))],
  ["mock_worker_runtime_check", mockWorkerCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: {
    mockWorkerCheck,
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
