#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const commands = [
  ["npm", ["run", "build"], { cwd: "frontend" }],
  ["node", ["scripts/smoke.mjs"], {}],
  ["node", ["scripts/production-dependencies-gate.mjs"], {}],
  ["node", ["scripts/pdf-regression.mjs"], {}],
  ["node", ["scripts/pdf-server-gate.mjs"], {}],
  ["node", ["scripts/visual-regression.mjs"], {}],
  ["node", ["scripts/legal-commercial-gate.mjs"], {}],
  ["node", ["scripts/commercial-gate.mjs"], {}],
  ["node", ["scripts/workflow-gate.mjs"], {}],
  ["node", ["scripts/benchmark-gate.mjs"], {}],
  ["node", ["scripts/enterprise-gate.mjs"], {}],
  ["node", ["scripts/admin-costs-gate.mjs"], {}],
  ["node", ["scripts/observability-security-gate.mjs"], {}],
  ["node", ["scripts/storage-gate.mjs"], {}],
  ["node", ["scripts/preprocessing-gate.mjs"], {}],
  ["node", ["scripts/tribe-gpu-gate.mjs"], {}],
  ["node", ["scripts/tribe-real-worker-gate.mjs"], {}],
  ["node", ["scripts/scoring-real-gate.mjs"], {}],
  ["node", ["scripts/comparison-real-gate.mjs"], {}],
  ["node", ["scripts/llm-real-gate.mjs"], {}],
  ["node", ["scripts/backend-api-gate.mjs"], {}],
  ["node", ["scripts/qa-functional-gate.mjs"], {}],
  ["node", ["scripts/cicd-strict-gate.mjs"], {}],
  ["node", ["scripts/deploy-env-gate.mjs"], {}],
  ["node", ["scripts/e2e-production-mvp.mjs"], {}],
  ["node", ["scripts/check-ruflo-mcp.js"], {}],
];

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

for (const [command, args, options] of commands) {
  console.log(`\n[production-gate] ${command} ${args.join(" ")}`);
  await run(command, args, options);
}

console.log("\n[production-gate] OK");
