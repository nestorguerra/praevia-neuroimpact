import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, ...patterns) {
  if (!existsSync(path.join(root, relativePath))) return false;
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
}

const files = [
  "frontend/src/api/client.ts",
  "frontend/src/benchmarks/apiBenchmarkStore.ts",
  "frontend/src/comparison/apiComparisonStore.ts",
  "frontend/src/collaboration/apiCollaborationStore.ts",
  "frontend/src/enterprise/apiEnterpriseStore.ts",
  "frontend/src/admin/apiAdminStore.ts",
  "backend/app/repositories/collaboration_db.py",
  "backend/app/repositories/collaboration_repository.py",
  "backend/app/routes/collaboration.py",
  "backend/supabase/migrations/0016_backend_api_real_collaboration.sql",
];

const fileChecks = files.map((file) => ({ file, exists: existsSync(path.join(root, file)) }));

const frontendChecks = [
  {
    name: "shared_api_client_uses_bearer",
    ok: has("frontend/src/api/client.ts", /Authorization:\s*`Bearer/, /ApiFetchError/, /VITE_API_PUBLIC_URL/),
  },
  {
    name: "benchmarks_page_loads_api",
    ok: has("frontend/src/pages/BenchmarksPage.tsx", /loadBenchmarkStoreFromApi/, /createDemoBenchmarkInApi/, /addExternalKpiInApi/, /useApi/),
  },
  {
    name: "comparison_page_loads_api",
    ok: has("frontend/src/pages/ComparisonPage.tsx", /loadComparisonsFromApi/, /createComparisonInApi/, /loadScoringResultsFromApi/, /loadAssetsFromApi/, /useApi/),
  },
  {
    name: "workflow_page_loads_api",
    ok: has("frontend/src/pages/WorkflowPage.tsx", /ensureCollaborationSnapshotInApi/, /addWorkflowCommentInApi/, /createWorkflowShareLinkInApi/, /useApi/),
  },
  {
    name: "enterprise_page_loads_api",
    ok: has("frontend/src/pages/EnterprisePage.tsx", /loadEnterpriseStoreFromApi/, /createMonthlyUsageExportInApi/, /loadAdminSnapshotFromApi/, /useApi/),
  },
  {
    name: "admin_page_loads_api_snapshot",
    ok: has("frontend/src/pages/AdminPage.tsx", /loadAdminSnapshotFromApi/, /remoteSnapshot/, /session\.provider !== "supabase"/)
      && has("frontend/src/admin/apiAdminStore.ts", /loadOperationalData/, /loadAssetsFromApi/, /loadAnalysisRunsFromApi/, /loadReportsFromApi/, /loadComparisonsFromApi/),
  },
];

const backendChecks = [
  {
    name: "collaboration_route_uses_repository_selector",
    ok: has("backend/app/routes/collaboration.py", /collaboration_repository\(\)/, /Depends\(require_auth\)/)
      && !/repositories\.collaboration_memory/.test(read("backend/app/routes/collaboration.py")),
  },
  {
    name: "collaboration_db_reads_shared_viewer_without_fake_user",
    ok: has("backend/app/repositories/collaboration_db.py", /def _snapshot_from_connection/, /def shared_viewer/)
      && !/role="viewer"/.test(read("backend/app/repositories/collaboration_db.py")),
  },
  {
    name: "collaboration_migration_has_rls",
    ok: has(
      "backend/supabase/migrations/0016_backend_api_real_collaboration.sql",
      /create table public\.workflow_recommendations/,
      /create table public\.workflow_comments/,
      /create table public\.workflow_tasks/,
      /create table public\.workflow_share_links/,
      /enable row level security/i,
      /create policy/i,
    ),
  },
];

const checks = [...fileChecks.map((check) => ({ name: `file:${check.file}`, ok: check.exists })), ...frontendChecks, ...backendChecks];
const ok = checks.every((check) => check.ok);

console.log(JSON.stringify({ ok, checks }, null, 2));

if (!ok) process.exit(1);
