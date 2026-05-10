import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function runTextWorkerCheck() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "praevia-preprocess-gate-"));
  const inputPath = path.join(tempRoot, "sample.srt");
  const outputPath = path.join(tempRoot, "out");
  writeFileSync(
    inputPath,
    [
      "1",
      "00:00:00,000 --> 00:00:02,000",
      "La apertura presenta el producto con claridad.",
      "",
      "2",
      "00:00:02,000 --> 00:00:04,500",
      "El cierre refuerza la decision editorial.",
      "",
    ].join("\n"),
    "utf8",
  );
  const python = process.env.PYTHON_BIN || "python3";
  const result = spawnSync(
    python,
    ["-m", "preprocessing.cli", "--input", inputPath, "--kind", "text", "--output", outputPath],
    {
      cwd: path.join(root, "worker"),
      env: { ...process.env, PYTHONPATH: path.join(root, "worker") },
      encoding: "utf8",
    },
  );
  const transcriptExists = existsSync(path.join(outputPath, "transcript.srt.json"));
  const normalizedExists = existsSync(path.join(outputPath, "normalized_text.json"));
  const stdoutLooksValid = result.stdout.includes("\"derivative_type\": \"transcript\"")
    && result.stdout.includes("\"derivative_type\": \"normalized_text\"");
  rmSync(tempRoot, { recursive: true, force: true });
  return {
    ok: result.status === 0 && transcriptExists && normalizedExists && stdoutLooksValid,
    status: result.status,
    stderr: result.stderr.trim().slice(0, 500),
  };
}

const workerTextCheck = runTextWorkerCheck();
const ffmpegAvailable = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
const ffprobeAvailable = spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;

const checks = [
  ["backend_settings_preprocessing", has("backend/app/settings.py", /PREPROCESSING_WORKER_MODE/, /WHISPER_PROVIDER/, /WHISPER_MODEL/, /WHISPER_DEVICE/, /WHISPER_COMPUTE_TYPE/)],
  ["storage_download_upload_methods", has("backend/app/services/storage.py", /def download_file/, /def upload_file/, /client\.get_object/, /client\.put_object/, /ContentLength/)],
  ["backend_local_cpu_runner", has("backend/app/services/preprocessing_cpu.py", /run_local_cpu_preprocessing/, /ffprobe/, /ffmpeg/, /faster_whisper/, /storage_service\.download_file/, /storage_service\.upload_file/)],
  ["db_repository_uses_real_worker", has("backend/app/repositories/preprocessing_db.py", /PREPROCESSING|preprocessing_worker_mode|local_cpu/, /run_local_cpu_preprocessing/, /asset_derivatives/, /storage_objects/)],
  ["worker_transcribes_with_faster_whisper", has("worker/preprocessing/service.py", /def transcribe_audio/, /faster_whisper/, /transcript\.whisper\.json/) && !read("worker/preprocessing/service.py").includes("whisper_mock")],
  ["worker_cli_can_upload_derivatives", has("worker/preprocessing/service.py", /--upload-bucket/, /--upload-prefix/, /upload_s3_object/, /uploaded_derivatives/)],
  ["worker_docker_installs_ffmpeg", has("worker/preprocessing/Dockerfile", /ffmpeg/, /requirements\.txt/, /python", "-m", "preprocessing\.cli"/)],
  ["worker_requirements_include_whisper", has("worker/preprocessing/requirements.txt", /faster-whisper/, /boto3/)],
  ["backend_docker_supports_cpu_preprocess", has("backend/Dockerfile", /ffmpeg/, /\.\[preprocessing\]/, /WHISPER_PROVIDER/)],
  ["env_examples_include_preprocessing", [".env.example", "infra/env/local.example.env", "infra/env/staging.example.env", "infra/env/production.example.env"].every((file) => has(file, /PREPROCESSING_WORKER_MODE/, /WHISPER_PROVIDER/, /WHISPER_MODEL/))],
  ["worker_text_runtime_check", workerTextCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: {
    ffmpegAvailable,
    ffprobeAvailable,
    workerTextCheck,
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
