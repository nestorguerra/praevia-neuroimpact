import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

function walkFiles(directory) {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    const full = path.join(absolute, entry);
    const relative = path.relative(root, full);
    if (statSync(full).isDirectory()) return walkFiles(relative);
    return [relative];
  });
}

function frontendHasForbiddenSecret() {
  const forbidden = [
    /OPENAI_API_KEY/,
    /ANTHROPIC_API_KEY/,
    /HF_TOKEN/,
    /RUNPOD_API_KEY/,
    /GPU_PROVIDER_API_KEY/,
    /SUPABASE_SERVICE_ROLE_KEY/,
    /S3_SECRET_ACCESS_KEY/,
    /TRIBE_CALLBACK_SECRET/,
  ];
  return walkFiles("frontend/src").some((relativePath) => {
    const source = read(relativePath);
    return forbidden.some((pattern) => pattern.test(source));
  });
}

function envHasAll(relativePath, keys) {
  if (!existsSync(path.join(root, relativePath))) return false;
  const source = read(relativePath);
  return keys.every((key) => new RegExp(`^${key}=`, "m").test(source));
}

const observabilityKeys = [
  "SENTRY_DSN",
  "SENTRY_TRACES_SAMPLE_RATE",
  "SENTRY_PROFILES_SAMPLE_RATE",
  "STRUCTURED_LOGS",
  "RATE_LIMIT_WINDOW_SECONDS",
  "RATE_LIMIT_REQUESTS",
  "COST_ALERT_THRESHOLD_EUR",
  "VITE_SENTRY_DSN",
  "VITE_SENTRY_TRACES_SAMPLE_RATE",
  "VITE_APP_ENV",
];

const productionEnv = existsSync(path.join(root, "infra/env/production.example.env"))
  ? read("infra/env/production.example.env")
  : "";

const checks = [
  ["backend_sentry_dependency", has("backend/pyproject.toml", /sentry-sdk\[fastapi\]/)],
  ["frontend_sentry_dependency", has("frontend/package.json", /"@sentry\/react"/)],
  ["settings_expose_observability", has("backend/app/settings.py", /sentry_dsn/, /structured_logs/, /rate_limit_window_seconds/, /cost_alert_threshold_eur/)],
  ["observability_service_records_errors", has("backend/app/services/observability.py", /JsonFormatter/, /init_sentry/, /check_rate_limit/, /record_rate_limit_event/, /record_error_event/, /record_exception/)],
  ["api_middleware_has_request_ids_and_rate_limits", has("backend/app/main.py", /X-Request-ID/, /Retry-After/, /record_rate_limit_event/, /record_exception/, /Strict-Transport-Security/, /X-Organization-ID/)],
  ["api_uses_strict_cors_and_https_controls", has("backend/app/main.py", /CORSMiddleware/, /HTTPSRedirectMiddleware/, /TrustedHostMiddleware/, /allow_origins=settings\.allowed_origins/)],
  ["worker_errors_are_recorded", has("backend/app/repositories/inference_db.py", /record_error_event/, /source='worker'|source="worker"/, /provider_enqueue|provider_callback/)],
  ["llm_errors_are_recorded", has("backend/app/services/llm_router.py", /record_exception/, /source="llm"/)],
  ["storage_errors_are_recorded", has("backend/app/services/storage.py", /record_exception/, /source="storage"/)],
  ["admin_exposes_error_events_and_backups", has("backend/app/schemas/admin.py", /ErrorEventRead/, /BackupSnapshotRead/, /error_events/, /backup_snapshots/)],
  ["admin_records_cost_alerts", has("backend/app/repositories/admin_db.py", /_maybe_record_cost_alert/, /source = 'cost'|source, severity, message/, /Cost alert threshold reached/)],
  ["migration_indexes_observability_tables", has("backend/supabase/migrations/0021_observability_security.sql", /error_events_org_unresolved_idx/, /rate_limit_events_route_blocked_idx/, /backup_snapshots_org_type_created_idx/, /audit_logs_action_created_idx/)],
  ["frontend_initializes_sentry", has("frontend/src/observability/sentry.ts", /Sentry\.init/, /VITE_SENTRY_DSN/, /sendDefaultPii: false/) && has("frontend/src/main.tsx", /initFrontendObservability/, /ErrorBoundary/)],
  ["frontend_admin_displays_observability", has("frontend/src/pages/AdminPage.tsx", /ObservabilityPanel/, /BackupPanel/, /Observabilidad y seguridad/) && has("frontend/src/admin/apiAdminStore.ts", /error_events/, /backup_snapshots/)],
  ["env_templates_include_observability", [".env.example", "infra/env/local.example.env", "infra/env/staging.example.env", "infra/env/production.example.env"].every((file) => envHasAll(file, observabilityKeys))],
  ["production_cors_not_wildcard", !/^CORS_ALLOWED_ORIGINS=\*/m.test(productionEnv)],
  ["frontend_does_not_expose_backend_secrets", !frontendHasForbiddenSecret()],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
