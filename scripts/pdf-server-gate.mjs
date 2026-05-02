import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

function runRendererCheck() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "praevia-pdf-server-gate-"));
  const bundledPython = "/Users/nestorguerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const python = process.env.PYTHON_BIN || (existsSync(bundledPython) ? bundledPython : "python3");
  const script = `
from pathlib import Path
from uuid import uuid4

from app.schemas.reports import ReportCreate, build_report_from_scoring
from app.schemas.scoring import NeuroScoringCreate, build_mock_scoring
from app.services.report_renderer import build_report_html, render_report_artifacts

scoring = build_mock_scoring(
    NeuroScoringCreate(
        organization_id=uuid4(),
        experiment_id=uuid4(),
        asset_id=uuid4(),
        analysis_run_id=uuid4(),
        asset_name="server-side-report.mp4",
        n_timesteps=24,
        asset_kind="video",
    )
)
report = build_report_from_scoring(scoring, ReportCreate(scoring_result_id=scoring.id, report_type="technical", language="es", audience="technical"))
html = build_report_html(report, scoring, asset_sha256="abc123" * 11)
assert "Instrumento. <em>No oraculo.</em>" in html
assert "Asset hash" in html
assert "prompt" in html
assert "BENCH" in html
assert html.count('class="page"') == 6

artifacts = render_report_artifacts(report, scoring, asset_sha256="abc123" * 11, output_dir=Path(${JSON.stringify(tempRoot)}))
pdf = artifacts.pdf_path.read_bytes()
assert pdf[:8].decode("utf-8") == "%PDF-1.4"
assert artifacts.pdf_bytes > 3000
assert artifacts.html_sha256
assert artifacts.pdf_sha256
print({"pdf_bytes": artifacts.pdf_bytes, "html_bytes": artifacts.html_bytes, "pages": artifacts.page_count})
`;
  const result = spawnSync(python, ["-c", script], {
    cwd: root,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      REPORT_RENDERER_MODE: "node",
      PYTHONPATH: path.join(root, "backend"),
    },
    encoding: "utf8",
  });
  const pdfPath = path.join(tempRoot, "report.pdf");
  const htmlPath = path.join(tempRoot, "report.html");
  const payload = {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim().slice(0, 1000),
    stderr: result.stderr.trim().slice(0, 1000),
    pdfExists: existsSync(pdfPath),
    htmlExists: existsSync(htmlPath),
  };
  rmSync(tempRoot, { recursive: true, force: true });
  return payload;
}

const rendererCheck = runRendererCheck();

const checks = [
  ["backend_renderer_service_exists", has("backend/app/services/report_renderer.py", /build_report_html/, /render_report_artifacts/, /sync_playwright/, /PDF page overflow/, /template == "executive"/, /template == "creative"/, /template == "technical"/)],
  ["backend_renderer_generates_traceable_footer", has("backend/app/services/report_renderer.py", /Report .*model/, /prompt/, /BENCH/, /asset_sha256/, /html_sha256/, /pdf_sha256/)],
  ["backend_reporting_uploads_artifacts", has("backend/app/repositories/reporting_db.py", /render_report_artifacts/, /report_html/, /report_pdf/, /storage_objects/, /html_storage_key/, /pdf_storage_key/, /asset_sha256/)],
  ["backend_reports_download_endpoint", has("backend/app/routes/reports.py", /reports\/\{report_id\}\/download/, /ReportDownloadRead/) && has("backend/app/repositories/reporting_db.py", /create_report_download/, /create_presigned_download_url/)],
  ["frontend_uses_server_artifact_download", has("frontend/src/reporting/apiReportStore.ts", /downloadReportArtifactFromApi/, /signed_url/) && has("frontend/src/pages/ResultsPage.tsx", /handleDownloadPdf/, /downloadReportArtifactFromApi/)],
  ["backend_docker_installs_playwright", has("backend/Dockerfile", /python -m playwright install --with-deps chromium/, /REPORT_RENDERER_MODE=playwright/)],
  ["backend_dependency_has_playwright", has("backend/pyproject.toml", /playwright>=1\.48\.0/)],
  ["node_fallback_renderer_exists", has("reporting/render-html-to-pdf.mjs", /chromium/, /page\.pdf/, /PDF page overflow/) ],
  ["renderer_runtime_check", rendererCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: { rendererCheck },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
