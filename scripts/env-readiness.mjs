import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const envFiles = {
  local: "infra/env/local.example.env",
  staging: "infra/env/staging.example.env",
  production: "infra/env/production.example.env",
  "google-production": "infra/env/google-production.example.env",
};

const required = {
  local: [
    "APP_ENV",
    "APP_PUBLIC_URL",
    "API_PUBLIC_URL",
    "VITE_AUTH_MODE",
    "VITE_API_PUBLIC_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "STORAGE_MODE",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "TRIBE_MODEL_ID",
    "TRIBE_WORKER_MODE",
    "OPENAI_API_KEY",
    "JWT_SECRET",
  ],
  staging: [
    "APP_ENV",
    "APP_HOST",
    "API_HOST",
    "APP_PUBLIC_URL",
    "API_PUBLIC_URL",
    "GHCR_IMAGE_NAMESPACE",
    "IMAGE_TAG",
    "CADDY_ACME_EMAIL",
    "VITE_AUTH_MODE",
    "VITE_API_PUBLIC_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "DATABASE_URL",
    "REDIS_URL",
    "STORAGE_MODE",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "GPU_PROVIDER_API_KEY",
    "HF_TOKEN",
    "TRIBE_WORKER_ENDPOINT_URL",
    "OPENAI_API_KEY",
    "READINESS_TOKEN",
    "JWT_SECRET",
  ],
  production: [
    "APP_ENV",
    "APP_HOST",
    "API_HOST",
    "APP_PUBLIC_URL",
    "API_PUBLIC_URL",
    "GHCR_IMAGE_NAMESPACE",
    "IMAGE_TAG",
    "CADDY_ACME_EMAIL",
    "VITE_AUTH_MODE",
    "VITE_API_PUBLIC_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "DATABASE_URL",
    "REDIS_URL",
    "STORAGE_MODE",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "GPU_PROVIDER_API_KEY",
    "HF_TOKEN",
    "TRIBE_WORKER_ENDPOINT_URL",
    "OPENAI_API_KEY",
    "RESEND_API_KEY",
    "SENTRY_DSN",
    "READINESS_TOKEN",
    "JWT_SECRET",
  ],
  "google-production": [
    "APP_ENV",
    "APP_HOST",
    "API_HOST",
    "APP_PUBLIC_URL",
    "API_PUBLIC_URL",
    "VITE_API_PUBLIC_URL",
    "FRONTEND_DEPLOY_PROVIDER",
    "BACKEND_PROVIDER",
    "GCP_PROJECT_ID",
    "GCP_REGION",
    "GCP_ARTIFACT_REGISTRY",
    "GCP_BACKEND_SERVICE_NAME",
    "GCP_TRIBE_WORKER_SERVICE_NAME",
    "VITE_AUTH_MODE",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "DATABASE_URL",
    "QUEUE_PROVIDER",
    "GCP_TASKS_QUEUE",
    "GCP_TASKS_LOCATION",
    "GCP_TASKS_SERVICE_ACCOUNT",
    "STORAGE_PROVIDER",
    "STORAGE_MODE",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "GPU_PROVIDER",
    "TRIBE_WORKER_MODE",
    "TRIBE_WORKER_ENDPOINT_URL",
    "TRIBE_WORKER_IMAGE",
    "TRIBE_CALLBACK_URL",
    "TRIBE_CALLBACK_SECRET",
    "HF_TOKEN",
    "OPENAI_API_KEY",
    "READINESS_TOKEN",
    "JWT_SECRET",
  ],
};

function parseEnv(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    entries.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  return entries;
}

function isPlaceholder(value) {
  return !value || value.includes("example.com") || value.includes("change-me") || value === "local" || value === "localpassword";
}

function checkEnv(envName, relativeFile, strict) {
  const fullPath = path.join(root, relativeFile);
  if (!existsSync(fullPath)) {
    return { env: envName, file: relativeFile, ok: false, missingFile: true, missingKeys: [], placeholderKeys: [] };
  }
  const parsed = parseEnv(readFileSync(fullPath, "utf8"));
  const missingKeys = required[envName].filter((key) => !parsed.has(key));
  const placeholderKeys = required[envName].filter((key) => parsed.has(key) && isPlaceholder(parsed.get(key)));
  return {
    env: envName,
    file: relativeFile,
    ok: missingKeys.length === 0 && (!strict || placeholderKeys.length === 0),
    missingFile: false,
    missingKeys,
    placeholderKeys,
  };
}

const strict = process.argv.includes("--strict");
const checks = Object.entries(envFiles).map(([envName, file]) => checkEnv(envName, file, strict));
const ok = checks.every((check) => check.ok);

console.log(JSON.stringify({
  ok,
  strict,
  checks,
  note: strict
    ? "Strict mode fails on placeholder or empty values."
    : "Template mode checks required keys exist; real secrets remain pendiente de Nestor.",
}, null, 2));

if (!ok) process.exit(1);
