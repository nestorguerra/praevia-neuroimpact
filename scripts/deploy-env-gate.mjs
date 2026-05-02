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

function parseEnv(relativePath) {
  const values = new Map();
  for (const line of read(relativePath).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  return values;
}

function value(env, key) {
  return env.get(key) ?? "";
}

const staging = parseEnv("infra/env/staging.example.env");
const production = parseEnv("infra/env/production.example.env");

const separationKeys = [
  "APP_PUBLIC_URL",
  "API_PUBLIC_URL",
  "DATABASE_URL",
  "S3_BUCKET",
  "TRIBE_WORKER_ENDPOINT_URL",
  "TRIBE_OUTPUT_BUCKET",
  "TRIBE_CALLBACK_URL",
  "CORS_ALLOWED_ORIGINS",
  "ALLOWED_HOSTS",
];

const checks = [
  ["compose_staging_uses_pushed_images", has("infra/docker-compose.staging.yml", /image: ghcr\.io\/\$\{GHCR_IMAGE_NAMESPACE/, /\$\{IMAGE_TAG:\?IMAGE_TAG required\}/) && !read("infra/docker-compose.staging.yml").includes("build:")],
  ["compose_production_uses_pushed_images", has("infra/docker-compose.production.yml", /image: ghcr\.io\/\$\{GHCR_IMAGE_NAMESPACE/, /\$\{IMAGE_TAG:\?IMAGE_TAG required\}/) && !read("infra/docker-compose.production.yml").includes("build:")],
  ["compose_uses_caddy_https_hosts", has("infra/caddy/Caddyfile", /\{\$APP_HOST\}/, /\{\$API_HOST\}/, /CADDY_ACME_EMAIL/) && has("infra/docker-compose.production.yml", /APP_HOST: \$\{APP_HOST/, /API_HOST: \$\{API_HOST/) && has("infra/docker-compose.staging.yml", /APP_HOST: \$\{APP_HOST/, /API_HOST: \$\{API_HOST/)],
  ["frontend_image_is_build_arg_configured", has("frontend/Dockerfile", /ARG VITE_API_PUBLIC_URL/, /ARG VITE_SUPABASE_URL/, /ARG VITE_SENTRY_DSN/, /ENV VITE_API_PUBLIC_URL/)],
  ["envs_have_deploy_metadata", ["GHCR_IMAGE_NAMESPACE", "IMAGE_TAG", "APP_HOST", "API_HOST", "CADDY_ACME_EMAIL"].every((key) => staging.has(key) && production.has(key))],
  ["envs_are_separated", separationKeys.every((key) => value(staging, key) !== value(production, key))],
  ["envs_disable_mock_worker", value(staging, "ALLOW_MOCK_WORKER_IN_PRODUCTION_GATE") === "false" && value(production, "ALLOW_MOCK_WORKER_IN_PRODUCTION_GATE") === "false"],
  ["envs_use_db_and_s3", value(staging, "PERSISTENCE_MODE") === "db" && value(production, "PERSISTENCE_MODE") === "db" && value(staging, "STORAGE_MODE") === "s3" && value(production, "STORAGE_MODE") === "s3"],
  ["env_examples_not_gitignored", has(".gitignore", /!\.env\.staging\.example/, /!\.env\.production\.example/)],
  ["deploy_scripts_exist", has("scripts/deploy-remote-compose.sh", /docker compose/, /ready\/dependencies/, /ln -sfn/) && has("scripts/rollback-remote-compose.sh", /ROLLBACK_TO/, /ready\/dependencies/, /ln -sfn/)],
  ["github_deploy_workflows_exist", existsSync(path.join(root, ".github/workflows/deploy-staging.yml")) && existsSync(path.join(root, ".github/workflows/deploy-production.yml")) && existsSync(path.join(root, ".github/workflows/rollback.yml"))],
  ["docs_sprint31_exists", has("docs/sprint-31-staging-production.md", /staging/, /produccion/, /rollback/, /secretos separados/)],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  separated: Object.fromEntries(separationKeys.map((key) => [key, { staging: value(staging, key), production: value(production, key), different: value(staging, key) !== value(production, key) }])),
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
