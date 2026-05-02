import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const files = {
  settings: "backend/app/settings.py",
  storage: "backend/app/services/storage.py",
  validation: "backend/app/services/asset_validation.py",
  uploadsDb: "backend/app/repositories/uploads_db.py",
  uploadsRoute: "backend/app/routes/uploads.py",
  frontendUpload: "frontend/src/uploads/apiAssetStore.ts",
  adminDb: "backend/app/repositories/admin_db.py",
  workerStorage: "worker/storage_client.py",
  workerPreprocess: "worker/preprocessing/service.py",
  migration: "backend/supabase/migrations/0015_secure_storage_manifest.sql",
  pyproject: "backend/pyproject.toml",
};

const source = Object.fromEntries(Object.entries(files).map(([key, relativePath]) => [key, existsSync(path.join(root, relativePath)) ? read(relativePath) : ""]));

const checks = [
  ["storage_service_exists", source.storage.includes("class StorageService") && source.storage.includes("create_presigned_upload_url")],
  ["boto3_dependency", source.pyproject.includes("boto3")],
  ["s3_settings", ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].every((key) => source.settings.includes(key))],
  ["format_validation", [".mp4", ".avi", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".txt", ".md", ".srt"].every((item) => source.validation.includes(item))],
  ["upload_intent_uses_presigned_url", source.uploadsDb.includes("storage_service.create_presigned_upload_url") && !source.uploadsDb.includes("/v1/storage/mock-upload")],
  ["upload_complete_verifies_head", source.uploadsDb.includes("storage_service.head_object") && source.uploadsDb.includes("storage_verified")],
  ["download_url_route", source.uploadsRoute.includes("/assets/{asset_id}/download-url") && source.uploadsDb.includes("create_presigned_download_url")],
  ["frontend_puts_binary_to_signed_url", source.frontendUpload.includes('method: "PUT"') && source.frontendUpload.includes("body: file")],
  ["secure_delete_deletes_storage", source.adminDb.includes("storage_service.delete_objects") && source.adminDb.includes("storage_keys_deleted")],
  ["storage_manifest_rls", source.migration.includes("create table public.storage_objects") && source.migration.includes("enable row level security") && source.migration.includes("create policy")],
  ["worker_can_download_from_storage", source.workerStorage.includes("download_s3_object") && source.workerPreprocess.includes("--s3-key")],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exit(1);
