#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_SMOKE_URL ?? "http://localhost:5173";
const apiUrl = process.env.API_SMOKE_URL ?? "http://localhost:8000";
const allowMissingApi = process.env.ALLOW_MISSING_API === "true";

async function checkUrl(label, url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    const ms = Date.now() - started;
    if (!options.allowMissing && !response.ok) {
      throw new Error(`${label} returned ${response.status}`);
    }
    return { label, url, status: response.status, ms, ok: true };
  } catch (error) {
    if (options.allowMissing) {
      return { label, url, status: 0, ms: Date.now() - started, ok: true, warning: error.message };
    }
    throw error;
  }
}

const checks = [
  checkUrl("frontend.landing", `${baseUrl}/`),
  checkUrl("frontend.app", `${baseUrl}/app`),
  checkUrl("frontend.admin", `${baseUrl}/app/admin`),
  checkUrl("frontend.benchmarks", `${baseUrl}/app/benchmarks`),
  checkUrl("frontend.enterprise", `${baseUrl}/app/enterprise`),
  checkUrl("frontend.workflow", `${baseUrl}/app/workflow`),
  checkUrl("frontend.pilot_kit", `${baseUrl}/pilot-kit`),
  checkUrl("frontend.pilot_deck_client", `${baseUrl}/pilot-kit/deck-cliente.html`),
  checkUrl("frontend.design_hub", `${baseUrl}/design-hub/index.html`),
  checkUrl("api.health", `${apiUrl}/health`, { allowMissing: allowMissingApi }),
  checkUrl("api.ready", `${apiUrl}/ready`, { allowMissing: allowMissingApi }),
];

Promise.all(checks)
  .then((results) => {
    console.log(JSON.stringify({ ok: true, baseUrl, apiUrl, results }, null, 2));
  })
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, baseUrl, apiUrl, error: error.message }, null, 2));
    process.exit(1);
  });
