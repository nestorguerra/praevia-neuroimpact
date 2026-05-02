from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.schemas.scoring import NeuroScoringRead
from app.services.guardrails import review_claims
from app.services.observability import record_exception
from app.settings import settings


ReportAudience = Literal["executive", "creative", "technical"]


@dataclass(frozen=True)
class LLMUsage:
    provider: str
    draft_model: str
    final_model: str
    reviewer_model: str | None
    input_tokens: int
    output_tokens: int
    estimated_cost_eur: float


@dataclass(frozen=True)
class ReportInterpretation:
    title: str
    decision: str
    tldr: str
    sections: list[dict]
    guardrail_status: str
    guardrail_findings: list[dict[str, str]]
    usage: LLMUsage
    metadata: dict[str, Any] = field(default_factory=dict)


class LLMInterpretationOutput(BaseModel):
    decision_label: str = Field(min_length=2)
    top_metric: str = Field(min_length=2)
    weak_metric: str = Field(min_length=2)
    narrative_hypothesis: str = Field(min_length=12)
    risk_notes: list[str] = Field(default_factory=list, max_length=5)


class LLMSectionOutput(BaseModel):
    section_key: str = Field(min_length=2)
    title: str = Field(min_length=2)
    body: str = Field(min_length=20)


class LLMRecommendationOutput(BaseModel):
    timecode: str = Field(min_length=2)
    layer: str = Field(min_length=2)
    action: str = Field(min_length=12)
    confidence: str = Field(min_length=2)
    impact: str = Field(min_length=2)


class LLMReportOutput(BaseModel):
    title: str = Field(min_length=2)
    decision: str = Field(min_length=20)
    tldr: str = Field(min_length=20)
    sections: list[LLMSectionOutput] = Field(min_length=4)
    recommendations: list[LLMRecommendationOutput] = Field(min_length=1, max_length=5)


def _short_float(value: float | int | None) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    return round(float(value), 4)


class LLMRouter:
    """Provider-neutral interpretation router.

    Sprint 25 connects the production contract to OpenAI Responses API when an
    API key exists. Without a key, the local deterministic path remains active
    so development, demos and gates keep working without external spend.
    """

    @property
    def prompt_version(self) -> str:
        return settings.llm_prompt_version

    @property
    def draft_model(self) -> str:
        return settings.llm_interpreter_model

    @property
    def final_model(self) -> str:
        return settings.llm_writer_model

    @property
    def reviewer_model(self) -> str | None:
        return os.getenv("LLM_REVIEW_MODEL") or None

    def interpret_scoring(self, scoring: NeuroScoringRead, audience: ReportAudience = "creative") -> ReportInterpretation:
        if os.getenv("OPENAI_API_KEY", ""):
            return self._openai_interpretation(scoring, audience)
        return self._local_report(scoring, audience)

    def _openai_interpretation(self, scoring: NeuroScoringRead, audience: ReportAudience) -> ReportInterpretation:
        context = self._scoring_context(scoring, audience)
        context, preflight_findings = self._sanitize_claims(context, "input")
        input_tokens = 0
        output_tokens = 0
        response_ids: list[str] = []
        json_retries = 0

        interpretation, first_usage, first_response_id, first_retries = self._call_with_schema(
            model=settings.llm_interpreter_model,
            schema_name="neuroimpact_interpretation",
            schema=self._interpretation_schema(),
            instructions=self._interpretation_instructions(audience),
            payload={"prompt_version": self.prompt_version, "scoring_context": context},
            validator=LLMInterpretationOutput,
            reasoning_effort=None,
        )
        input_tokens += first_usage["input_tokens"]
        output_tokens += first_usage["output_tokens"]
        json_retries += first_retries
        if first_response_id:
            response_ids.append(first_response_id)

        report, second_usage, second_response_id, second_retries = self._call_with_schema(
            model=settings.llm_writer_model,
            schema_name="neuroimpact_report",
            schema=self._report_schema(),
            instructions=self._report_instructions(audience),
            payload={
                "prompt_version": self.prompt_version,
                "scoring_context": context,
                "interpretation": interpretation.model_dump(),
            },
            validator=LLMReportOutput,
            reasoning_effort=settings.llm_writer_reasoning_effort,
        )
        input_tokens += second_usage["input_tokens"]
        output_tokens += second_usage["output_tokens"]
        json_retries += second_retries
        if second_response_id:
            response_ids.append(second_response_id)

        report_payload, post_findings = self._sanitize_claims(report.model_dump(), "output")
        report = LLMReportOutput.model_validate(report_payload)
        all_findings = [*preflight_findings, *post_findings]
        status = "rewritten" if all_findings else "passed"
        sections = self._sections_from_openai_report(report, scoring, interpretation)
        cost = self._estimated_cost(input_tokens=input_tokens, output_tokens=output_tokens)

        return ReportInterpretation(
            title=report.title,
            decision=report.decision,
            tldr=report.tldr,
            sections=sections,
            guardrail_status=status,
            guardrail_findings=all_findings,
            usage=LLMUsage(
                provider="openai",
                draft_model=settings.llm_interpreter_model,
                final_model=settings.llm_writer_model,
                reviewer_model=self.reviewer_model if audience == "technical" else None,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_eur=cost,
            ),
            metadata={
                "llm_response_ids": response_ids,
                "llm_json_retries": json_retries,
                "llm_prompt_version": self.prompt_version,
                "llm_guardrail_preflight": preflight_findings,
                "llm_guardrail_postflight": post_findings,
                "sent_payload_policy": "structured_metrics_only",
            },
        )

    def _call_with_schema(
        self,
        *,
        model: str,
        schema_name: str,
        schema: dict[str, Any],
        instructions: str,
        payload: dict[str, Any],
        validator: type[BaseModel],
        reasoning_effort: str | None,
    ) -> tuple[BaseModel, dict[str, int], str | None, int]:
        last_error: Exception | None = None
        for attempt in range(settings.llm_json_max_retries + 1):
            try:
                response = self._responses_create(
                    model=model,
                    schema_name=schema_name,
                    schema=schema,
                    instructions=instructions,
                    payload=payload,
                    reasoning_effort=reasoning_effort,
                )
                output_text = self._extract_output_text(response)
                parsed = json.loads(output_text)
                return (
                    validator.model_validate(parsed),
                    self._usage_from_response(response),
                    response.get("id"),
                    attempt,
                )
            except (json.JSONDecodeError, ValidationError, RuntimeError, httpx.HTTPError) as exc:
                last_error = exc
                record_exception(
                    exc,
                    source="llm",
                    metadata={"model": model, "schema_name": schema_name, "attempt": attempt},
                )
                if attempt >= settings.llm_json_max_retries:
                    break
        raise RuntimeError(f"OpenAI LLM response failed validation after retries: {last_error}") from last_error

    def _responses_create(
        self,
        *,
        model: str,
        schema_name: str,
        schema: dict[str, Any],
        instructions: str,
        payload: dict[str, Any],
        reasoning_effort: str | None,
    ) -> dict[str, Any]:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for real LLM mode.")
        body: dict[str, Any] = {
            "model": model,
            "instructions": instructions,
            "input": json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
            "store": False,
        }
        if reasoning_effort:
            body["reasoning"] = {"effort": reasoning_effort}
        with httpx.Client(timeout=settings.openai_timeout_seconds) as client:
            response = client.post(
                f"{settings.openai_base_url.rstrip('/')}/responses",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=body,
            )
            response.raise_for_status()
            return response.json()

    def _extract_output_text(self, response: dict[str, Any]) -> str:
        if isinstance(response.get("output_text"), str) and response["output_text"].strip():
            return response["output_text"]
        for item in response.get("output", []):
            if item.get("type") != "message":
                continue
            for content in item.get("content", []):
                if content.get("type") == "refusal":
                    raise RuntimeError(content.get("refusal") or "OpenAI refused the structured output request.")
                if content.get("type") in {"output_text", "text"} and isinstance(content.get("text"), str):
                    return content["text"]
        raise RuntimeError("OpenAI response did not contain output_text.")

    def _usage_from_response(self, response: dict[str, Any]) -> dict[str, int]:
        usage = response.get("usage") or {}
        return {
            "input_tokens": int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0),
            "output_tokens": int(usage.get("output_tokens") or usage.get("completion_tokens") or 0),
        }

    def _estimated_cost(self, *, input_tokens: int, output_tokens: int) -> float:
        input_cost = (input_tokens / 1000) * settings.llm_input_eur_per_1k
        output_cost = (output_tokens / 1000) * settings.llm_output_eur_per_1k
        return round(input_cost + output_cost, 6)

    def _scoring_context(self, scoring: NeuroScoringRead, audience: ReportAudience) -> dict[str, Any]:
        interesting_points = [
            point.model_dump()
            for point in scoring.timecourse_points
            if point.event_label in {"peak", "valley", "flat"}
        ][:12]
        if not interesting_points:
            interesting_points = [point.model_dump() for point in scoring.timecourse_points[:8]]
        return {
            "asset_name": scoring.asset_name,
            "audience": audience,
            "model_id": scoring.model_id,
            "scoring_version": scoring.scoring_version,
            "confidence_label": scoring.confidence_label,
            "benchmark_label": scoring.benchmark_label,
            "bold_delay_seconds": _short_float(scoring.bold_delay_seconds),
            "summary": scoring.summary,
            "editorial_scores": [score.model_dump() for score in scoring.editorial_scores],
            "network_scores": [score.model_dump() for score in scoring.network_scores],
            "region_scores": [score.model_dump() for score in sorted(scoring.region_scores, key=lambda item: item.score, reverse=True)[:8]],
            "peak_moments": [moment.model_dump() for moment in scoring.peak_moments[:8]],
            "timecourse_events": interesting_points,
            "privacy_rule": "No raw files, transcripts, audio, video or storage keys are sent to the LLM.",
        }

    def _sanitize_claims(self, value: Any, prefix: str) -> tuple[Any, list[dict[str, str]]]:
        findings: list[dict[str, str]] = []

        def walk(item: Any, path: str) -> Any:
            if isinstance(item, str):
                result = review_claims(item)
                if result.findings:
                    findings.extend([{**finding, "path": path, "phase": prefix} for finding in result.findings])
                return result.text
            if isinstance(item, list):
                return [walk(child, f"{path}[{index}]") for index, child in enumerate(item)]
            if isinstance(item, dict):
                return {key: walk(child, f"{path}.{key}") for key, child in item.items()}
            return item

        return walk(value, prefix), findings

    def _interpretation_instructions(self, audience: ReportAudience) -> str:
        return (
            "Eres un director cientifico-creativo de PraevIA NeuroImpact Analyzer. "
            "Lee solo metricas estructuradas, nunca inventes datos y nunca afirmes medicion real de emociones, compra, "
            "recuerdo, conducta individual o lectura mental. Produce una interpretacion breve para preparar el informe. "
            f"Audiencia: {audience}. Responde solo con JSON valido conforme al schema."
        )

    def _report_instructions(self, audience: ReportAudience) -> str:
        return (
            "Redacta en espanol claro, ejecutivo y accionable. El producto es un instrumento de pretest neurocognitivo "
            "in silico, no un oraculo. Toda recomendacion debe tener timecode o 'global', capa, accion editorial concreta, "
            "confianza e impacto estimado. Maximo cinco recomendaciones. No incluyas claims absolutistas. "
            f"Audiencia del informe: {audience}. Responde solo con JSON valido conforme al schema."
        )

    def _interpretation_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "required": ["decision_label", "top_metric", "weak_metric", "narrative_hypothesis", "risk_notes"],
            "properties": {
                "decision_label": {"type": "string"},
                "top_metric": {"type": "string"},
                "weak_metric": {"type": "string"},
                "narrative_hypothesis": {"type": "string"},
                "risk_notes": {"type": "array", "items": {"type": "string"}},
            },
        }

    def _report_schema(self) -> dict[str, Any]:
        recommendation_schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["timecode", "layer", "action", "confidence", "impact"],
            "properties": {
                "timecode": {"type": "string"},
                "layer": {"type": "string"},
                "action": {"type": "string"},
                "confidence": {"type": "string"},
                "impact": {"type": "string"},
            },
        }
        section_schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["section_key", "title", "body"],
            "properties": {
                "section_key": {
                    "type": "string",
                    "enum": ["executive_summary", "timeline", "recommendations", "methodology"],
                },
                "title": {"type": "string"},
                "body": {"type": "string"},
            },
        }
        return {
            "type": "object",
            "additionalProperties": False,
            "required": ["title", "decision", "tldr", "sections", "recommendations"],
            "properties": {
                "title": {"type": "string"},
                "decision": {"type": "string"},
                "tldr": {"type": "string"},
                "sections": {"type": "array", "items": section_schema},
                "recommendations": {"type": "array", "items": recommendation_schema},
            },
        }

    def _sections_from_openai_report(
        self,
        report: LLMReportOutput,
        scoring: NeuroScoringRead,
        interpretation: LLMInterpretationOutput,
    ) -> list[dict[str, Any]]:
        section_by_key = {section.section_key: section for section in report.sections}
        ordered_keys = ["executive_summary", "timeline", "recommendations", "methodology"]
        sections: list[dict[str, Any]] = []
        for key in ordered_keys:
            section = section_by_key.get(key)
            if section is None:
                continue
            payload: dict[str, Any] = {}
            if key == "executive_summary":
                payload = {
                    "nri": scoring.summary.get("nri"),
                    "interpretation": interpretation.model_dump(),
                    "top_score": max(scoring.editorial_scores, key=lambda item: item.score).model_dump(),
                    "weak_score": min(scoring.editorial_scores, key=lambda item: item.score).model_dump(),
                }
            elif key == "timeline":
                payload = {
                    "peak_moments": [moment.model_dump() for moment in scoring.peak_moments[:5]],
                    "bold_delay_seconds": scoring.bold_delay_seconds,
                }
            elif key == "recommendations":
                payload = {"recommendations": [item.model_dump() for item in report.recommendations[:5]]}
            elif key == "methodology":
                payload = {
                    "prompt_version": self.prompt_version,
                    "model_id": scoring.model_id,
                    "sent_payload_policy": "structured_metrics_only",
                }
            sections.append(
                {
                    "section_key": key,
                    "title": section.title,
                    "body": section.body,
                    "payload": payload,
                }
            )
        return sections

    def _local_report(self, scoring: NeuroScoringRead, audience: ReportAudience) -> ReportInterpretation:
        interpretation = self._local_interpretation(scoring, audience)
        combined_text = "\n".join(
            [
                interpretation["title"],
                interpretation["decision"],
                interpretation["tldr"],
                *[section["body"] for section in interpretation["sections"]],
            ]
        )
        guardrail = review_claims(combined_text)
        status = guardrail.status
        if guardrail.findings:
            interpretation["title"] = review_claims(interpretation["title"]).text
            interpretation["decision"] = review_claims(interpretation["decision"]).text
            interpretation["tldr"] = review_claims(interpretation["tldr"]).text
            for section in interpretation["sections"]:
                section["body"] = review_claims(section["body"]).text

        input_tokens = max(350, len(combined_text) // 4)
        output_tokens = max(700, sum(len(section["body"]) for section in interpretation["sections"]) // 4)
        usage = LLMUsage(
            provider="local",
            draft_model="local-interpreter-v0",
            final_model="local-writer-v0",
            reviewer_model=None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_eur=0.0,
        )
        return ReportInterpretation(
            title=interpretation["title"],
            decision=interpretation["decision"],
            tldr=interpretation["tldr"],
            sections=interpretation["sections"],
            guardrail_status=status,
            guardrail_findings=guardrail.findings,
            usage=usage,
            metadata={
                "llm_response_ids": [],
                "llm_json_retries": 0,
                "llm_prompt_version": self.prompt_version,
                "sent_payload_policy": "structured_metrics_only",
            },
        )

    def _local_interpretation(self, scoring: NeuroScoringRead, audience: ReportAudience) -> dict:
        top_score = max(scoring.editorial_scores, key=lambda item: item.score)
        weak_score = min(scoring.editorial_scores, key=lambda item: item.score)
        peak = next((moment for moment in scoring.peak_moments if moment.moment_type == "peak"), scoring.peak_moments[0])
        valley = next((moment for moment in scoring.peak_moments if moment.moment_type == "valley"), scoring.peak_moments[0])
        nri = scoring.summary.get("nri", 0)
        decision_label = "Avanzar con ajustes" if float(nri) >= 72 else "Revisar montaje" if float(nri) >= 55 else "No usar como master"
        decision = (
            f"{decision_label}: mantener la pieza como base de iteracion, reforzar {weak_score.metric_label} "
            f"y proteger el tramo de mayor respuesta {peak.start_seconds:.1f}-{peak.end_seconds:.1f}s."
        )
        recommendations = [
            {
                "timecode": f"{moment.start_seconds:.1f}-{moment.end_seconds:.1f}s",
                "layer": "timeline",
                "action": moment.action,
                "confidence": scoring.confidence_label,
                "impact": "alto" if moment.moment_type == "peak" else "medio",
            }
            for moment in scoring.peak_moments[:3]
        ]
        recommendations.extend(
            [
                {
                    "timecode": "global",
                    "layer": weak_score.metric_label,
                    "action": weak_score.action,
                    "confidence": scoring.confidence_label,
                    "impact": "alto" if weak_score.score < 55 else "medio",
                },
                {
                    "timecode": "global",
                    "layer": top_score.metric_label,
                    "action": "Usar el score fuerte como referencia para el re-montaje y no diluirlo con grafismos innecesarios.",
                    "confidence": scoring.confidence_label,
                    "impact": "medio",
                },
            ]
        )
        return {
            "title": f"Informe {audience} · {scoring.asset_name}",
            "decision": decision,
            "tldr": (
                f"NRI {nri} con confianza {scoring.confidence_label}. La mayor fortaleza es {top_score.metric_label} "
                f"({top_score.score}) y el punto a corregir es {weak_score.metric_label} ({weak_score.score})."
            ),
            "sections": [
                {
                    "section_key": "executive_summary",
                    "title": "Resumen ejecutivo",
                    "body": (
                        f"La pieza muestra un perfil util para decision editorial. El resultado debe leerse contra "
                        f"{scoring.benchmark_label}: score global {nri}, fortaleza en {top_score.metric_label} y debilidad "
                        f"en {weak_score.metric_label}."
                    ),
                    "payload": {"nri": nri, "top_score": top_score.model_dump(), "weak_score": weak_score.model_dump()},
                },
                {
                    "section_key": "timeline",
                    "title": "Timeline accionable",
                    "body": (
                        f"El pico principal aparece en {peak.start_seconds:.1f}-{peak.end_seconds:.1f}s. "
                        f"El valle principal aparece en {valley.start_seconds:.1f}-{valley.end_seconds:.1f}s. "
                        "Las recomendaciones deben anclarse a estos tramos, no a lectura anatomica aislada."
                    ),
                    "payload": {"peak": peak.model_dump(), "valley": valley.model_dump()},
                },
                {
                    "section_key": "recommendations",
                    "title": "Recomendaciones priorizadas",
                    "body": "Aplicar primero los cambios de timecode y despues revisar la metrica global mas debil.",
                    "payload": {"recommendations": recommendations[:5]},
                },
                {
                    "section_key": "methodology",
                    "title": "Metodologia y limites",
                    "body": (
                        "Este informe usa respuesta cerebral predicha, indicadores comparativos y evidencia por timecode. "
                        "No sustituye test con audiencia real, brand lift ni metricas de campana."
                    ),
                    "payload": {"prompt_version": self.prompt_version, "model_id": scoring.model_id},
                },
            ],
        }


llm_router = LLMRouter()
