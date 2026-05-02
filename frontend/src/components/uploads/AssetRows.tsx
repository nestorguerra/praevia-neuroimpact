import { AudioLines, FileText, Trash2, TriangleAlert, Video } from "lucide-react";
import { Badge, Button } from "../ui";
import type { UploadAsset } from "../../uploads/types";

type AssetRowsProps = {
  assets: UploadAsset[];
  onRemove: (assetId: string) => void;
};

const kindIcon = {
  video: Video,
  audio: AudioLines,
  text: FileText,
};

const statusTone = {
  uploading: "amber",
  validated: "lime",
  warning: "coral",
  error: "coral",
} as const;

const statusLabel = {
  uploading: "Subiendo",
  validated: "Validado",
  warning: "Revisar",
  error: "Error",
} as const;

export function AssetRows({ assets, onRemove }: AssetRowsProps) {
  if (assets.length === 0) {
    return (
      <section className="asset-empty">
        <h3>Todavia no hay assets.</h3>
        <p>Sube hasta tres versiones para una comparativa A/B/C o una pieza para analisis individual.</p>
      </section>
    );
  }

  return (
    <section className="asset-row-list">
      {assets.map((asset) => {
        const Icon = kindIcon[asset.health.kind];
        return (
          <article className="asset-row-card" key={asset.id}>
            <div className="asset-slot">Version {asset.slot}</div>
            <div className="asset-kind"><Icon size={18} /></div>
            <div className="asset-row-main">
              <strong>{asset.fileName}</strong>
              <span>{asset.health.sizeLabel} · {asset.health.extension || "sin extension"} · hash {asset.hash.slice(0, 10)}</span>
              <span className="upload-progress"><span style={{ width: `${asset.progress}%` }} /></span>
            </div>
            <Badge tone={statusTone[asset.status]}>{statusLabel[asset.status]}</Badge>
            <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => onRemove(asset.id)}>Quitar</Button>
          </article>
        );
      })}
    </section>
  );
}

type HealthCheckProps = {
  asset: UploadAsset;
};

export function AssetHealthCheck({ asset }: HealthCheckProps) {
  const rows = [
    ["Tipo", asset.health.kind],
    ["Peso", asset.health.sizeLabel],
    ["Duracion", asset.health.durationLabel],
    ["Resolucion", asset.health.resolutionLabel],
    ["FPS", asset.health.fpsLabel],
    ["Audio", asset.health.audioLabel],
    ["Texto", asset.health.textLabel],
    ["Idioma", asset.health.languageLabel],
    ["Creditos", String(asset.health.credits)],
  ];

  return (
    <article className="asset-health-card">
      <div className="health-head">
        <span>Version {asset.slot}</span>
        <Badge tone={asset.status === "validated" ? "lime" : asset.status === "warning" ? "coral" : "muted"}>{statusLabel[asset.status]}</Badge>
      </div>
      <h3>{asset.fileName}</h3>
      <div className="health-grid">
        {rows.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      {asset.health.issues.length > 0 ? (
        <div className="health-issues">
          {asset.health.issues.map((issue) => (
            <p key={issue}><TriangleAlert size={14} />{issue}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
