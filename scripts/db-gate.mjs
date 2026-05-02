import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const expectedMigrations = [
  "backend/supabase/migrations/0001_auth_organizations.sql",
  "backend/supabase/migrations/0002_workspaces_projects_experiments.sql",
  "backend/supabase/migrations/0003_assets_upload_sessions.sql",
  "backend/supabase/migrations/0004_preprocessing_jobs.sql",
  "backend/supabase/migrations/0005_analysis_runs_predictions.sql",
  "backend/supabase/migrations/0006_neurocognitive_scoring.sql",
  "backend/supabase/migrations/0007_reports_llm.sql",
  "backend/supabase/migrations/0008_comparisons_abc.sql",
  "backend/supabase/migrations/0009_admin_usage_security.sql",
  "backend/supabase/migrations/0010_benchmarks_kpis.sql",
  "backend/supabase/migrations/0011_enterprise_saas_v15.sql",
  "backend/supabase/migrations/0012_runtime_settings_and_scoring_view.sql",
  "backend/supabase/migrations/0013_report_tldr.sql",
  "backend/supabase/migrations/0014_comparison_alias.sql",
  "backend/supabase/migrations/0015_secure_storage_manifest.sql",
  "backend/supabase/migrations/0016_backend_api_real_collaboration.sql",
];

const requiredTables = [
  "profiles",
  "organizations",
  "memberships",
  "workspaces",
  "projects",
  "experiments",
  "assets",
  "asset_versions",
  "upload_sessions",
  "preprocessing_jobs",
  "analysis_runs",
  "prediction_artifacts",
  "neuro_scoring_results",
  "reports",
  "comparison_runs",
  "benchmarks",
  "benchmark_items",
  "external_kpis",
  "usage_events",
  "audit_logs",
  "organization_api_keys",
  "organization_retention_policies",
  "organization_sso_configs",
  "monthly_usage_exports",
  "runtime_settings",
  "storage_objects",
  "workflow_recommendations",
  "workflow_comments",
  "workflow_tasks",
  "workflow_share_links",
  "workflow_history_events",
];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const migrationChecks = expectedMigrations.map((relativePath) => {
  const exists = existsSync(path.join(root, relativePath));
  const sql = exists ? read(relativePath) : "";
  return {
    file: relativePath,
    exists,
    hasRls: /0013_|0014_/.test(relativePath) || /enable row level security/i.test(sql),
    hasOrgFk: /0013_|0014_/.test(relativePath) || /references public\.organizations\(id\)/i.test(sql),
    hasPolicies: /0013_|0014_/.test(relativePath) || /create policy/i.test(sql),
  };
});

const combinedSql = expectedMigrations.filter((relativePath) => existsSync(path.join(root, relativePath))).map(read).join("\n");
const tableChecks = requiredTables.map((table) => ({
  table,
  present: new RegExp(`create table public\\.${table}\\b`, "i").test(combinedSql),
}));
const viewChecks = ["scoring_results", "comparisons"].map((view) => ({
  view,
  present: new RegExp(`create or replace view public\\.${view}\\b`, "i").test(combinedSql),
}));

const backendDb = read("backend/app/repositories/db.py");
const repositorySelectors = [
  "projects_repository.py",
  "uploads_repository.py",
  "preprocessing_repository.py",
  "inference_repository.py",
  "scoring_repository.py",
  "reporting_repository.py",
  "comparison_repository.py",
  "benchmarks_repository.py",
  "admin_repository.py",
  "enterprise_repository.py",
  "runtime_settings_repository.py",
  "collaboration_repository.py",
].map((file) => existsSync(path.join(root, "backend/app/repositories", file)));
const routeFiles = [
  "uploads.py",
  "preprocessing.py",
  "inference.py",
  "scoring.py",
  "reports.py",
  "comparisons.py",
  "benchmarks.py",
  "admin.py",
  "enterprise.py",
  "runtime_settings.py",
  "collaboration.py",
].map((file) => read(`backend/app/routes/${file}`));
const criticalRoutesAvoidDirectMemory = routeFiles.every((source) => !/repositories\.[a-z_]+_memory/.test(source));
const frontendApiStores = [
  "frontend/src/projects/apiProjectStore.ts",
  "frontend/src/uploads/apiAssetStore.ts",
  "frontend/src/preprocessing/apiPreprocessingStore.ts",
  "frontend/src/inference/apiInferenceStore.ts",
  "frontend/src/scoring/apiScoringStore.ts",
  "frontend/src/reporting/apiReportStore.ts",
  "frontend/src/settings/apiRuntimeSettings.ts",
  "frontend/src/api/client.ts",
  "frontend/src/benchmarks/apiBenchmarkStore.ts",
  "frontend/src/comparison/apiComparisonStore.ts",
  "frontend/src/collaboration/apiCollaborationStore.ts",
  "frontend/src/enterprise/apiEnterpriseStore.ts",
  "frontend/src/admin/apiAdminStore.ts",
].map((file) => existsSync(path.join(root, file)));
const infraSqlMoved = !existsSync(path.join(root, "infra/sql/0010_benchmarks_kpis.sql"))
  && !existsSync(path.join(root, "infra/sql/0011_enterprise_saas_v15.sql"));

const ok = migrationChecks.every((check) => check.exists && check.hasRls && check.hasOrgFk && check.hasPolicies)
  && tableChecks.every((check) => check.present)
  && viewChecks.every((check) => check.present)
  && backendDb.includes("psycopg.connect")
  && backendDb.includes("assert_org_member")
  && repositorySelectors.every(Boolean)
  && criticalRoutesAvoidDirectMemory
  && frontendApiStores.every(Boolean)
  && infraSqlMoved;

console.log(JSON.stringify({
  ok,
  migrationChecks,
  tableChecks,
  viewChecks,
  infraSqlMoved,
  backendDbConnection: backendDb.includes("psycopg.connect"),
  repositorySelectors,
  criticalRoutesAvoidDirectMemory,
  frontendApiStores,
}, null, 2));

if (!ok) process.exit(1);
