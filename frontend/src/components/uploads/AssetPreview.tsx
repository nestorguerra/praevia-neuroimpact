import { AudioLines, FileText, Video } from "lucide-react";
import type { UploadAsset } from "../../uploads/types";

type AssetPreviewProps = {
  asset?: UploadAsset;
};

export function AssetPreview({ asset }: AssetPreviewProps) {
  if (!asset) {
    return (
      <section className="asset-preview empty">
        <FileText size={28} />
        <h3>Preview basica</h3>
        <p>Selecciona o sube un asset para ver preview de video, audio o texto.</p>
      </section>
    );
  }

  if (asset.health.kind === "video" && asset.previewUrl) {
    return (
      <section className="asset-preview">
        <video src={asset.previewUrl} controls />
      </section>
    );
  }

  if (asset.health.kind === "audio" && asset.previewUrl) {
    return (
      <section className="asset-preview audio">
        <audio src={asset.previewUrl} controls />
      </section>
    );
  }

  if (asset.health.kind === "video" || asset.health.kind === "audio") {
    const Icon = asset.health.kind === "video" ? Video : AudioLines;
    return (
      <section className="asset-preview text">
        <Icon size={28} />
        <h3>{asset.fileName}</h3>
        <p>Preview disponible durante la subida actual. El health check queda guardado.</p>
      </section>
    );
  }

  return (
    <section className="asset-preview text">
      <FileText size={28} />
      <h3>{asset.fileName}</h3>
      <p>{asset.health.textLabel}</p>
    </section>
  );
}
