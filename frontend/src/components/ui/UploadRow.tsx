import { CheckCircle2, FileVideo2, Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "./Badge";

type UploadRowProps = {
  name: string;
  meta: string;
  status: "validated" | "uploading" | "warning";
  progress?: number;
};

const statusIcon = {
  validated: CheckCircle2,
  uploading: Loader2,
  warning: TriangleAlert,
};

export function UploadRow({ name, meta, status, progress = 100 }: UploadRowProps) {
  const Icon = statusIcon[status];
  return (
    <div className="upload-row">
      <span className="upload-icon"><FileVideo2 size={18} /></span>
      <div className="upload-main">
        <strong>{name}</strong>
        <span>{meta}</span>
        <span className="upload-progress"><span style={{ width: `${progress}%` }} /></span>
      </div>
      <Badge tone={status === "warning" ? "coral" : status === "uploading" ? "amber" : "lime"}>
        <Icon size={12} />
        {status === "validated" ? "Validado" : status === "uploading" ? "Subiendo" : "Revisar"}
      </Badge>
    </div>
  );
}

