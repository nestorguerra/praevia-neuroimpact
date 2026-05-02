import { Coins, PlayCircle, ShieldCheck } from "lucide-react";
import { Badge, Button } from "../ui";
import type { UploadAsset } from "../../uploads/types";

type CreditEstimateProps = {
  assets: UploadAsset[];
  totalCredits: number;
  hasErrors: boolean;
  hasWarnings: boolean;
  actionLabel?: string;
  isPreparing?: boolean;
  onStart?: () => void;
};

export function CreditEstimate({ assets, totalCredits, hasErrors, hasWarnings, actionLabel = "Lanzar analisis", isPreparing = false, onStart }: CreditEstimateProps) {
  const canRun = assets.length > 0 && !hasErrors;

  return (
    <section className="credit-panel">
      <div>
        <span className="breadcrumbs">Estimacion previa</span>
        <h3>{totalCredits} creditos</h3>
        <p>{assets.length} asset{assets.length === 1 ? "" : "s"} asociado{assets.length === 1 ? "" : "s"} al experimento.</p>
      </div>
      <div className="credit-status">
        <Badge tone={hasErrors ? "coral" : hasWarnings ? "amber" : "lime"}>
          {hasErrors ? "Bloqueado" : hasWarnings ? "Revisar warnings" : "Listo"}
        </Badge>
        <span><Coins size={14} /> 1 credito por minuto o fraccion</span>
        <span><ShieldCheck size={14} /> Hash y metadata registrados</span>
      </div>
      <Button disabled={!canRun || isPreparing} icon={<PlayCircle size={16} />} onClick={onStart}>{isPreparing ? "Preparando" : actionLabel}</Button>
    </section>
  );
}
