import { Badge } from "./Badge";

type ScoreCardProps = {
  label: string;
  value: number;
  delta?: string;
  confidence: string;
  benchmark: string;
  tone?: "amber" | "cyan" | "violet" | "lime" | "coral";
};

export function ScoreCard({
  label,
  value,
  delta,
  confidence,
  benchmark,
  tone = "amber",
}: ScoreCardProps) {
  return (
    <article className={`score-card score-${tone}`}>
      <div className="score-card-top">
        <span>{label}</span>
        <Badge tone="muted">{confidence}</Badge>
      </div>
      <div className="score-value">{value.toFixed(2)}</div>
      {delta ? <div className={delta.startsWith("-") ? "score-delta down" : "score-delta"}>{delta}</div> : null}
      <div className="score-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
      <div className="score-foot">
        <span>{benchmark}</span>
        <span>EVIDENCIA</span>
      </div>
    </article>
  );
}

