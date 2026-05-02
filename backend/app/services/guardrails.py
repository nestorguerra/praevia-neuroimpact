from __future__ import annotations

from dataclasses import dataclass
import re


PROHIBITED_CLAIMS: dict[str, str] = {
    r"\bmedimos emociones? reales?\b": "estimamos respuesta cerebral predicha",
    r"\bleemos la mente\b": "analizamos patrones comparativos de procesamiento",
    r"\blee la mente\b": "analiza patrones comparativos de procesamiento",
    r"\bgarantizamos? (compra|conversion|conversión|recuerdo|engagement)\b": "planteamos una hipotesis de mejora creativa",
    r"\bpredice (compra|conversion|conversión|conducta|emocion|emoción)\b": "estima patrones de respuesta probable",
    r"\bmanipulacion subconsciente\b": "optimizacion editorial responsable",
    r"\bmanipulación subconsciente\b": "optimizacion editorial responsable",
    r"\bneuromarketing que mide emociones\b": "pretest neurocognitivo in silico",
}


@dataclass(frozen=True)
class GuardrailResult:
    status: str
    text: str
    findings: list[dict[str, str]]


def review_claims(text: str) -> GuardrailResult:
    findings: list[dict[str, str]] = []
    rewritten = text
    for pattern, replacement in PROHIBITED_CLAIMS.items():
        matches = list(re.finditer(pattern, rewritten, flags=re.IGNORECASE))
        if not matches:
            continue
        findings.append({"pattern": pattern, "replacement": replacement, "count": str(len(matches))})
        rewritten = re.sub(pattern, replacement, rewritten, flags=re.IGNORECASE)

    if findings:
        return GuardrailResult(status="rewritten", text=rewritten, findings=findings)

    return GuardrailResult(status="passed", text=text, findings=[])
