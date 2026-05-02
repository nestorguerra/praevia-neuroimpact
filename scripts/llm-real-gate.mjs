import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, ...patterns) {
  if (!existsSync(path.join(root, relativePath))) return false;
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
}

function runRouterCheck() {
  const bundledPython = "/Users/nestorguerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const python = existsSync(bundledPython) ? bundledPython : "python3";
  const script = `
import json
import os
from uuid import uuid4

os.environ.pop("OPENAI_API_KEY", None)

from app.schemas.scoring import NeuroScoringCreate, build_mock_scoring
from app.services.guardrails import review_claims
from app.services.llm_router import LLMRouter

scoring = build_mock_scoring(
    NeuroScoringCreate(
        organization_id=uuid4(),
        experiment_id=uuid4(),
        asset_id=uuid4(),
        analysis_run_id=uuid4(),
        asset_name="Spot Sprint 25.mp4",
        n_timesteps=24,
        asset_kind="video",
    )
)

router = LLMRouter()
local_report = router.interpret_scoring(scoring, "creative")
assert local_report.usage.provider == "local", local_report.usage
assert local_report.metadata["sent_payload_policy"] == "structured_metrics_only"
assert len(local_report.sections) >= 4

guard = review_claims("medimos emociones reales y leemos la mente")
assert guard.status == "rewritten"
assert "respuesta cerebral predicha" in guard.text

calls = []
def fake_responses_create(**kwargs):
    calls.append(kwargs)
    assert kwargs["schema"]["additionalProperties"] is False
    assert kwargs["schema_name"] in {"neuroimpact_interpretation", "neuroimpact_report"}
    payload = kwargs["payload"]
    assert "scoring_context" in payload
    context = payload["scoring_context"]
    assert context["privacy_rule"].startswith("No raw files")
    assert "editorial_scores" in context
    assert "timecourse_events" in context
    if kwargs["schema_name"] == "neuroimpact_interpretation":
        output = {
            "decision_label": "Avanzar con ajustes",
            "top_metric": "Visual Salience",
            "weak_metric": "Social Cueing",
            "narrative_hypothesis": "La pieza tiene buena traccion visual y necesita reforzar senales humanas.",
            "risk_notes": ["No usar como prediccion de compra."],
        }
        return {"id": "resp_interpretation", "output_text": json.dumps(output), "usage": {"input_tokens": 200, "output_tokens": 80}}
    output = {
        "title": "Informe creativo Sprint 25",
        "decision": "Usar la pieza como base, reforzando el tramo inicial y el cierre con una accion editorial concreta.",
        "tldr": "El analisis ofrece una lectura comparativa suficiente para decidir una iteracion creativa antes de producir.",
        "sections": [
            {"section_key": "executive_summary", "title": "Resumen ejecutivo", "body": "La pieza mantiene una respuesta cerebral predicha util para tomar una decision editorial con benchmark y confianza."},
            {"section_key": "timeline", "title": "Timeline accionable", "body": "El tramo fuerte debe protegerse y el valle inicial necesita un refuerzo visual o sonoro claro."},
            {"section_key": "recommendations", "title": "Recomendaciones priorizadas", "body": "Aplicar primero los cambios con timecode y validar de nuevo con el mismo benchmark."},
            {"section_key": "methodology", "title": "Metodologia y limites", "body": "El sistema trabaja con metricas estructuradas y no envia archivos brutos al LLM."}
        ],
        "recommendations": [
            {"timecode": "00:00-00:02", "layer": "visual", "action": "Adelantar el plano humano principal para aumentar claridad inicial.", "confidence": "media", "impact": "alto"}
        ],
    }
    return {"id": "resp_report", "output_text": json.dumps(output), "usage": {"input_tokens": 420, "output_tokens": 260}}

os.environ["OPENAI_API_KEY"] = "test-key"
router._responses_create = fake_responses_create
real_report = router.interpret_scoring(scoring, "creative")
assert real_report.usage.provider == "openai"
assert real_report.usage.input_tokens == 620
assert real_report.usage.output_tokens == 340
assert real_report.metadata["llm_response_ids"] == ["resp_interpretation", "resp_report"]
assert real_report.metadata["sent_payload_policy"] == "structured_metrics_only"
assert any(section["section_key"] == "recommendations" for section in real_report.sections)
assert calls[1]["reasoning_effort"] == "high"

print(json.dumps({"local_provider": local_report.usage.provider, "real_provider": real_report.usage.provider, "calls": len(calls)}))
`;
  const result = spawnSync(python, ["-c", script], {
    cwd: root,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      PYTHONPATH: path.join(root, "backend"),
    },
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim().slice(0, 1000),
    stderr: result.stderr.trim().slice(0, 1000),
  };
}

const routerCheck = runRouterCheck();

const checks = [
  ["router_uses_openai_responses_api", has("backend/app/services/llm_router.py", /\/responses/, /OPENAI_API_KEY/, /httpx\.Client/, /response\.raise_for_status/)],
  ["router_uses_structured_outputs", has("backend/app/services/llm_router.py", /"type": "json_schema"/, /"strict": True/, /_report_schema/, /LLMReportOutput/)],
  ["router_guardrails_pre_post", has("backend/app/services/llm_router.py", /_sanitize_claims/, /llm_guardrail_preflight/, /llm_guardrail_postflight/, /review_claims/)],
  ["router_tracks_tokens_cost_response_ids", has("backend/app/services/llm_router.py", /input_tokens/, /output_tokens/, /llm_response_ids/, /llm_input_eur_per_1k/, /llm_output_eur_per_1k/)],
  ["router_sends_structured_metrics_only", has("backend/app/services/llm_router.py", /privacy_rule/, /No raw files/, /structured_metrics_only/)],
  ["settings_expose_openai_runtime", has("backend/app/settings.py", /openai_base_url/, /openai_timeout_seconds/, /llm_json_max_retries/, /llm_prompt_version/, /llm_input_eur_per_1k/)],
  ["ready_reports_openai_status", has("backend/app/main.py", /openai_api_key_configured/, /llm_interpreter_model/, /llm_writer_model/, /llm_prompt_version/)],
  ["report_payload_keeps_llm_trace", has("backend/app/schemas/reports.py", /llm_trace/, /interpretation\.metadata/)],
  ["reporting_db_registers_usage_event", has("backend/app/repositories/reporting_db.py", /report_generation/, /usage_events/, /input_tokens/, /output_tokens/, /estimated_cost_eur/, /llm_trace/)],
  ["env_examples_include_sprint25_vars", has(".env.example", /OPENAI_BASE_URL/, /OPENAI_TIMEOUT_SECONDS/, /LLM_JSON_MAX_RETRIES/, /LLM_INPUT_EUR_PER_1K/, /LLM_OUTPUT_EUR_PER_1K/)],
  ["runtime_settings_preview_exports_llm_vars", has("frontend/src/settings/localRuntimeSettings.ts", /OPENAI_BASE_URL/, /LLM_JSON_MAX_RETRIES/, /LLM_INPUT_EUR_PER_1K/, /LLM_OUTPUT_EUR_PER_1K/)],
  ["router_runtime_check", routerCheck.ok],
];

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  environment: { routerCheck },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
