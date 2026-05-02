#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const apiUrl = process.env.API_SMOKE_URL ?? "http://localhost:8000";
const readinessToken = process.env.READINESS_TOKEN ?? "";
const requireRemoteWorker = process.env.REQUIRE_REMOTE_WORKER === "true";

async function fetchJson(label, url) {
  const headers = readinessToken ? { "X-Readiness-Token": readinessToken } : {};
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`${label} no responde: ${error.message}`);
  }
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(`${label} fallo con ${response.status}: ${JSON.stringify(json)}`);
  }
  return { label, url, status: response.status, ms: Date.now() - started, json };
}

try {
  const health = await fetchJson("api.health", `${apiUrl}/health`);
  const ready = await fetchJson("api.ready", `${apiUrl}/ready`);
  const dependencies = await fetchJson(
    "api.dependencies",
    `${apiUrl}/ready/dependencies?strict=true&require_remote_worker=${requireRemoteWorker ? "true" : "false"}`,
  );

  const dependencyBody = dependencies.json;
  const checks = dependencyBody?.checks ?? [];
  const required = ["database", "storage", "worker"];
  const missing = required.filter((name) => !checks.some((check) => check.name === name && check.ok === true));

  const result = {
    ok: dependencyBody?.ok === true && missing.length === 0,
    apiUrl,
    requireRemoteWorker,
    health: health.json,
    ready: ready.json,
    dependencies: dependencyBody,
    missing,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    apiUrl,
    requireRemoteWorker,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
