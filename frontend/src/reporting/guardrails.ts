const prohibitedClaims: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bmedimos emociones? reales?\b/gi, replacement: "estimamos respuesta cerebral predicha" },
  { pattern: /\bleemos la mente\b/gi, replacement: "analizamos patrones comparativos de procesamiento" },
  { pattern: /\blee la mente\b/gi, replacement: "analiza patrones comparativos de procesamiento" },
  { pattern: /\bgarantizamos? (compra|conversi[oó]n|recuerdo|engagement)\b/gi, replacement: "planteamos una hipotesis de mejora creativa" },
  { pattern: /\bpredice (compra|conversi[oó]n|conducta|emoci[oó]n)\b/gi, replacement: "estima patrones de respuesta probable" },
  { pattern: /\bmanipulaci[oó]n subconsciente\b/gi, replacement: "optimizacion editorial responsable" },
  { pattern: /\bneuromarketing que mide emociones\b/gi, replacement: "pretest neurocognitivo in silico" },
];

export function reviewReportClaims(text: string) {
  let safeText = text;
  const findings: Array<{ pattern: string; replacement: string; count: number }> = [];

  prohibitedClaims.forEach(({ pattern, replacement }) => {
    const matches = safeText.match(pattern);
    if (!matches?.length) return;
    findings.push({ pattern: pattern.source, replacement, count: matches.length });
    safeText = safeText.replace(pattern, replacement);
  });

  return {
    status: findings.length > 0 ? "rewritten" as const : "passed" as const,
    text: safeText,
    findings,
  };
}
