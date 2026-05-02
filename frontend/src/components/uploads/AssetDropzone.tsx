import { FileUp, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { acceptedFormatsLabel } from "../../uploads/acceptedFormats";
import { Badge, Button } from "../ui";

type AssetDropzoneProps = {
  disabled?: boolean;
  slotsRemaining: number;
  onFiles: (files: FileList | File[]) => void;
};

export function AssetDropzone({ disabled = false, slotsRemaining, onFiles }: AssetDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    onFiles(event.dataTransfer.files);
  }, [disabled, onFiles]);

  return (
    <section
      className={isDragging ? "asset-dropzone dragging" : "asset-dropzone"}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="dropzone-icon"><FileUp size={26} /></div>
      <div>
        <span className="breadcrumbs">Upload seguro / Slots A-B-C</span>
        <h2>Arrastra archivos o selecciona desde tu equipo.</h2>
        <p>El navegador calcula hash, metadatos y health check local. El backend real usara URLs firmadas para enviar directo a storage.</p>
        <div className="dropzone-badges">
          {acceptedFormatsLabel().map((label) => <Badge key={label} tone="muted">{label}</Badge>)}
        </div>
      </div>
      <div className="dropzone-action">
        <Badge tone={slotsRemaining > 0 ? "amber" : "coral"}>{slotsRemaining} slots libres</Badge>
        <Button disabled={disabled || slotsRemaining === 0} onClick={() => inputRef.current?.click()}>Seleccionar archivos</Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".mp4,.avi,.mov,.mkv,.webm,.mp3,.wav,.flac,.ogg,.m4a,.txt,.md,.srt,video/*,audio/*,text/*"
          onChange={(event) => {
            if (event.currentTarget.files) onFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </div>
      <div className="dropzone-security">
        <ShieldCheck size={15} />
        URLs firmadas, hash SHA-256 y limites por plan quedan reflejados en el contrato backend.
      </div>
    </section>
  );
}

