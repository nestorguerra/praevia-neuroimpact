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

const productionGate = read("scripts/production-gate.mjs");

const checks = [
  ["demo_gate_exists_and_allows_missing_api", has("scripts/demo-gate.mjs", /ALLOW_MISSING_API: "true"/, /commercial-gate/, /workflow-gate/, /benchmark-gate/, /enterprise-gate/)],
  ["production_gate_requires_api", !productionGate.includes("ALLOW_MISSING_API") && productionGate.includes("production-dependencies-gate.mjs")],
  ["dependency_gate_checks_backend_db_storage_worker", has("scripts/production-dependencies-gate.mjs", /\/health/, /\/ready/, /\/ready\/dependencies/, /database/, /storage/, /worker/)],
  ["backend_dependency_readiness_endpoint", has("backend/app/main.py", /\/ready\/dependencies/, /dependencies_readiness/, /X-Readiness-Token|x_readiness_token/)],
  ["backend_readiness_checks_real_dependencies", has("backend/app/services/readiness.py", /select 1 as ok/, /create_presigned_upload_url/, /check_worker/, /require_remote_worker/)],
  ["worker_real_gate_manual", has("scripts/tribe-real-worker-gate.mjs", /RUN_TRIBE_REAL_GATE/, /REQUIRE_REMOTE_WORKER/)],
  ["github_actions_runs_strict_stack", has(".github/workflows/production-gate.yml", /docker compose -f infra\/docker-compose\.local\.yml up -d/, /Start backend API/, /Production dependency gate/, /Full strict production gate/)],
  ["github_actions_runs_product_gates", has(".github/workflows/production-gate.yml", /Commercial gate/, /Workflow gate/, /Benchmark gate/, /Enterprise gate/, /Worker mock gate/, /Worker real gate optional/)],
  ["docs_sprint30_exists", has("docs/sprint-30-strict-production-cicd.md", /production:gate/, /backend, DB, storage o worker/, /worker:real-gate/)],
  ["deploy_env_gate_is_part_of_pipeline", has("scripts/production-gate.mjs", /deploy-env-gate/) && has("scripts/demo-gate.mjs", /deploy-env-gate/) && has("frontend\/package.json", /deploy:gate/)],
  ["qa_functional_gate_exists", has("scripts/qa-functional-gate.mjs", /qa_script_covers_full_checklist/, /QA_REAL_MODE/) && has("scripts/production-gate.mjs", /qa-functional-gate\.mjs/) && has("scripts/demo-gate.mjs", /qa-functional-gate\.mjs/)],
  ["legal_commercial_gate_exists", has("scripts/legal-commercial-gate.mjs", /required_docs_exist/, /public_surfaces_have_no_blocked_claims/) && has("scripts/production-gate.mjs", /legal-commercial-gate\.mjs/) && has("scripts/demo-gate.mjs", /legal-commercial-gate\.mjs/)],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
