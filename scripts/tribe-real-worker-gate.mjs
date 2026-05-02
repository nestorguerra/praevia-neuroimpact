#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

if (process.env.RUN_TRIBE_REAL_GATE !== "true") {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "Worker real opcional. Ejecuta con RUN_TRIBE_REAL_GATE=true y REQUIRE_REMOTE_WORKER=true.",
  }, null, 2));
  process.exit(0);
}

const child = spawn("node", ["scripts/production-dependencies-gate.mjs"], {
  cwd: rootDir,
  env: { ...process.env, REQUIRE_REMOTE_WORKER: "true" },
  stdio: "inherit",
});

child.on("close", (code) => process.exit(code ?? 1));
