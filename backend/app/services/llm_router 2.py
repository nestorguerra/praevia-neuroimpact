from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

from app.schemas.scoring import NeuroScoringRead
from app.services.guardrails import review_claims


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


class LLMRouter:
    """Provider-neutral interpretation router.

    Sprint 9 keeps the production contract without requiring API keys locally.
    When API keys are configured, adapters can replace `_local_interpretation`
    without changing routes, report schema or PDF renderer.
    """

    prompt_version = "report-master-v0.1"
    draft_model = os.getenv("LLM_WRITER_MODEL", "local-draft-v0")
    final_model = os.getenv("LLM_INTERPRETER_MODEL", os.getenv("LLM_REPORT_MODEL", "gpt-5.5-pro"))
    reviewer_model = os.getenv("LLM_REVIEW_MODEL", os.getenv("LLM_WRITER_MODEL", "gpt-5.5-thinking"))

    def interpret_scoring(self, scoring: NeuroScoringRead, audience: ReportAudience = "creative") -> ReportInterpretation:
        interpretation = self._local_interpretation(scoring, audience)
        combined_text = "\n".join([interpretation["title"], interpretation["decision"], interpretation["tldr"], *[section["body"] for section in interpretation["sections"]]])
        guardrail = review_claims(combined_text)
        status = guardrail.status
        if guardrail.findings:
            # Re-run simple replacement section by section so stored sections are safe too.
            interpretation["title"] = review_claims(interpretation["title"]).text
            interpretation["decision"] = review_claims(interpretation["decision"]).text
            interpretation["tldr"] = review_claims(interpretation["tldr"]).text
            for section in interpretation["sections"]:
                section["body"] = review_claims(section["body"]).text

        input_tokens = max(350, len(combined_text) // 4)
        output_tokens = max(700, sum(len(section["body"]) for section in interpretation["sections"]) // 4)
        usage = LLMUsage(
            provider="openai" if os.getenv("OPENAI_API_KEY", "") else "local",
            draft_model=self.draft_model,
            final_model=self.final_model,
            reviewer_model=self.reviewer_model if audience == "technical" else None,
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
