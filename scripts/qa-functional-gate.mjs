#!/usr/bin/env node
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

const qaScript = "scripts/qa-functional-checklist.mjs";
const checklistIds = [
  "registro",
  "login",
  "recuperacion_password",
  "crear_organizacion",
  "crear_workspace",
  "crear_proyecto",
  "crear_experimento_individual",
  "crear_abc",
  "upload_video",
  "upload_audio",
  "upload_texto",
  "health_check",
  "preprocesamiento",
  "tribe_real",
  "scoring",
  "dashboard",
  "pdf",
  "comparativa",
  "admin_coste",
  "borrado_seguro",
  "share_link",
  "benchmark",
  "kpi_externo",
  "export_uso",
];

const checks = [
  ["qa_script_exists", existsSync(path.join(root, qaScript))],
  ["qa_script_covers_full_checklist", checklistIds.every((id) => has(qaScript, new RegExp(`"${id}"`)))],
  ["qa_script_has_real_mode", has(qaScript, /QA_REAL_MODE/, /ready\/dependencies\?strict=true&require_remote_worker=true/, /local_mock/)],
  ["qa_script_creates_realish_inputs", has(qaScript, /QA_VIDEO_PATH/, /QA_AUDIO_PATH/, /QA_TEXT_PATH/, /ffmpeg/, /wavSilenceBuffer/)],
  ["qa_script_exports_manifest", has(qaScript, /sprint32-functional-checklist\.json/, /productionReady/, /checklist/)],
  ["package_exposes_qa_commands", has("frontend/package.json", /qa:functional/, /qa:functional:gate/)],
  ["demo_gate_runs_static_qa_gate", has("scripts/demo-gate.mjs", /qa-functional-gate\.mjs/)],
  ["production_gate_runs_static_qa_gate", has("scripts/production-gate.mjs", /qa-functional-gate\.mjs/)],
  ["strict_ci_knows_qa_gate", has("scripts/cicd-strict-gate.mjs", /qa-functional-gate\.mjs/, /qa_functional_gate_exists/)],
  ["docs_sprint32_exists", has("docs/sprint-32-functional-qa.md", /Sprint 32/, /QA_REAL_MODE=true/, /tribe_real/, /sin tocar consola/)],
  ["readme_links_sprint32", has("README.md", /Sprint 32 .*QA funcional completa/, /qa:functional/)],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
