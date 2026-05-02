import type { UploadAsset } from "../uploads/types";
import type { AssetDerivative, PreprocessingJob, PreprocessingStep } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function baseKey(asset: UploadAsset) {
  return `derived/org/${asset.organizationId}/experiment/${asset.experimentId}/${asset.slot}-${asset.id}`;
}

function derivative(asset: UploadAsset, type: AssetDerivative["type"], label: string, mimeType: string, source: string, details: string[]): AssetDerivative {
  return {
    id: createId("derivative"),
    assetId: asset.id,
    type,
    label,
    storageKey: `${baseKey(asset)}/${label}`,
    mimeType,
    source,
    details,
  };
}

function createSteps(asset: UploadAsset): PreprocessingStep[] {
  return [
    {
      label: "ffprobe / metadata",
      status: "completed",
      message: `${asset.health.durationLabel}, ${asset.health.resolutionLabel}`,
    },
    {
      label: "normalizacion",
      status: "completed",
      message: asset.health.kind === "video" ? "Video preparado como MP4 H.264/AAC." : asset.health.kind === "audio" ? "Audio convertido a WAV 16 kHz mono." : "Texto limpiado y serializado.",
    },
    {
      label: "audio",
      status: asset.health.kind === "text" ? "skipped" : "completed",
      message: asset.health.kind === "video" ? "Audio extraido para transcript y modalidad auditiva." : asset.health.kind === "audio" ? "Audio normalizado para transcript." : "No aplica.",
    },
    {
      label: "transcript",
      status: "completed",
      message: asset.health.kind === "text" && asset.hasSrtTimecodes ? "SRT parseado con timecodes." : asset.health.kind === "text" ? "Texto convertido a segmentos." : "Transcript Whisper preparado para worker local.",
    },
    {
      label: "storage interno",
      status: "completed",
      message: "Derivados registrados con storage keys estables.",
    },
  ];
}

export function buildCompletedJob(asset: UploadAsset): PreprocessingJob {
  const derivatives: AssetDerivative[] = [
    derivative(asset, "metadata", "metadata.ffprobe.json", "application/json", "worker.cpu", [
      `Tipo: ${asset.health.kind}`,
      `Duracion: ${asset.health.durationLabel}`,
      `Resolucion: ${asset.health.resolutionLabel}`,
    ]),
  ];

  if (asset.health.kind === "video") {
    derivatives.push(
      derivative(asset, "normalized_media", "normalized_video.mp4", "video/mp4", "ffmpeg", ["MP4 H.264/AAC", "FPS objetivo: 24", "Stream visual para TRIBE"]),
      derivative(asset, "extracted_audio", "audio_16k_mono.wav", "audio/wav", "ffmpeg", ["16 kHz", "Mono", "PCM S16LE"]),
      derivative(asset, "transcript", "transcript.whisper.json", "application/json", "faster-whisper", ["Segmentos temporales", "Idioma detectado si Whisper esta activo", "Worker CPU local"]),
      derivative(asset, "silence_report", "silence_report.json", "application/json", "ffmpeg_silencedetect", ["Umbral -35 dB", "Ventanas >= 0.5s"]),
    );
  }

  if (asset.health.kind === "audio") {
    derivatives.push(
      derivative(asset, "normalized_media", "audio_16k_mono.wav", "audio/wav", "ffmpeg", ["16 kHz", "Mono", "PCM S16LE"]),
      derivative(asset, "transcript", "transcript.whisper.json", "application/json", "faster-whisper", ["Segmentos temporales", "Worker CPU local"]),
      derivative(asset, "silence_report", "silence_report.json", "application/json", "ffmpeg_silencedetect", ["Umbral -35 dB", "Ventanas >= 0.5s"]),
    );
  }

  if (asset.health.kind === "text") {
    derivatives.push(
      derivative(asset, asset.hasSrtTimecodes ? "transcript" : "normalized_text", asset.hasSrtTimecodes ? "transcript.srt.json" : "normalized_text.json", "application/json", asset.hasSrtTimecodes ? "srt_parser" : "text_parser", [
        asset.health.textLabel,
        asset.health.languageLabel,
      ]),
    );
  }

  return {
    id: createId("prejob"),
    organizationId: asset.organizationId,
    experimentId: asset.experimentId,
    assetId: asset.id,
    assetName: asset.fileName,
    assetKind: asset.health.kind,
    status: "completed",
    progress: 100,
    steps: createSteps(asset),
    derivatives,
    logs: [
      `asset accepted: ${asset.fileName}`,
      "metadata inspected",
      "normalization outputs registered",
      asset.health.kind === "video" ? "audio extracted from video" : asset.health.kind === "audio" ? "audio normalized" : "text parsed",
      "transcript derivative ready",
      "storage keys generated",
    ],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

export function buildRunningJob(asset: UploadAsset): PreprocessingJob {
  return {
    ...buildCompletedJob(asset),
    id: createId("prejob"),
    status: "running",
    progress: 46,
    steps: [
      { label: "ffprobe / metadata", status: "completed", message: "Metadatos leidos." },
      { label: "normalizacion", status: "running", message: "Generando derivados internos." },
      { label: "audio", status: "pending", message: "Pendiente." },
      { label: "transcript", status: "pending", message: "Pendiente." },
      { label: "storage interno", status: "pending", message: "Pendiente." },
    ],
    derivatives: [],
    logs: [`asset accepted: ${asset.fileName}`, "job started"],
    completedAt: undefined,
  };
}
