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

const checks = [
  ["admin_schema_exposes_limits_and_exports", has("backend/app/schemas/admin.py", /AdminLimitsRead/, /AdminMonthlyUsageExportRead/, /credits_allocated/, /can_analyze/, /block_reasons/)],
  ["admin_db_calculates_real_monthly_usage", has("backend/app/repositories/admin_db.py", /_usage_stats_for_current_month/, /storage_objects/, /storage_cost_eur/, /total_cost_eur/, /monthly_usage_exports/)],
  ["admin_db_blocks_by_caps", has("backend/app/repositories/admin_db.py", /_block_reasons/, /hard_credit_limit/, /monthly_cost_limit_eur/, /monthly_gpu_seconds_limit/, /storage_byte_limit/)],
  ["admin_route_generates_monthly_export", has("backend/app/routes/admin.py", /monthly-usage-exports/, /create_monthly_usage_export/, /AdminMonthlyUsageExportRead/)],
  ["inference_blocks_over_caps", has("backend/app/repositories/inference_db.py", /hard_credit_limit/, /monthly_cost_limit_eur/, /monthly_gpu_seconds_limit/, /storage_byte_limit/, /Cap mensual de creditos/)],
  ["uploads_register_real_usage", has("backend/app/repositories/uploads_db.py", /asset_upload/, /storage_bytes_delta/, /Upload /)],
  ["preprocessing_registers_real_usage", has("backend/app/repositories/preprocessing_db.py", /event_type, source_table/, /preprocessing/, /storage_bytes_delta/, /cpu-preprocessor/)],
  ["secure_delete_registers_real_usage", has("backend/app/repositories/admin_db.py", /secure_delete/, /deleted_bytes/, /storage_keys_deleted/)],
  ["settings_expose_cost_rates", has("backend/app/settings.py", /storage_eur_per_gb_month/, /platform_event_eur/)],
  ["migration_adds_org_limit_columns", has("backend/supabase/migrations/0020_admin_costs_credits_real.sql", /monthly_cost_limit_eur/, /monthly_gpu_seconds_limit/, /usage_events_org_type_month_idx/, /storage_objects_org_active_bytes_idx/)],
  ["frontend_maps_admin_limits", has("frontend/src/admin/apiAdminStore.ts", /ApiAdminLimits/, /credits_allocated/, /total_cost_eur/, /createMonthlyUsageExportInApi/, /monthly_exports/)],
  ["frontend_displays_admin_cost_controls", has("frontend/src/pages/AdminPage.tsx", /Observabilidad y seguridad/, /Export mensual/, /Puede analizar/, /Facturacion manual/, /monthlyExports/)],
  ["env_examples_include_cost_rates", has(".env.example", /STORAGE_EUR_PER_GB_MONTH/, /PLATFORM_EVENT_EUR/) && has("infra/env/production.example.env", /STORAGE_EUR_PER_GB_MONTH/, /PLATFORM_EVENT_EUR/)],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
