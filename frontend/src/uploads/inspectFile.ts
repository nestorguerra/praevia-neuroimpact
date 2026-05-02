import { detectAssetKind, getExtension, maxSizeByKind } from "./acceptedFormats";
import type { AssetHealth, AssetKind, AssetSlot, UploadAsset } from "./types";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function bytesToLabel(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function secondsToLabel(value?: number) {
  if (!value || !Number.isFinite(value)) return "No disponible";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function sha256(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function loadMediaMetadata(file: File, kind: Exclude<AssetKind, "text">): Promise<{ duration?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = kind === "video" ? document.createElement("video") : document.createElement("audio");
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const metadata = {
        duration: element.duration,
        width: kind === "video" ? (element as HTMLVideoElement).videoWidth : undefined,
        height: kind === "video" ? (element as HTMLVideoElement).videoHeight : undefined,
      };
      URL.revokeObjectURL(url);
      resolve(metadata);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    element.src = url;
  });
}

function detectTextLanguage(text: string) {
  const sample = text.toLowerCase();
  const spanishHits = [" que ", " de ", " la ", " el ", " para ", " una ", " con "].filter((word) => sample.includes(word)).length;
  const englishHits = [" the ", " and ", " for ", " with ", " this ", " that "].filter((word) => sample.includes(word)).length;
  if (spanishHits >= englishHits && spanishHits > 0) return "Espanol probable";
  if (englishHits > spanishHits) return "Ingles probable";
  return "No concluyente";
}

async function inspectText(file: File, extension: string): Promise<Pick<AssetHealth, "durationLabel" | "resolutionLabel" | "fpsLabel" | "audioLabel" | "textLabel" | "languageLabel" | "credits" | "issues"> & { textSample: string; hasSrtTimecodes: boolean }> {
  const text = await file.text();
  const hasSrtTimecodes = /\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(text);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const issues: string[] = [];

  if (wordCount < 20) {
    issues.push("Texto muy corto: el analisis puede tener baja confianza.");
  }

  return {
    durationLabel: extension === ".srt" && hasSrtTimecodes ? "Detectada por SRT" : "No aplica",
    resolutionLabel: "No aplica",
    fpsLabel: "No aplica",
    audioLabel: "No aplica",
    textLabel: extension === ".srt" ? "Subtitulos SRT detectados" : `${wordCount} palabras aprox.`,
    languageLabel: detectTextLanguage(` ${text.slice(0, 20000)} `),
    credits: Math.max(1, Math.ceil(wordCount / 1200)),
    issues,
    textSample: text.slice(0, 24000),
    hasSrtTimecodes,
  };
}

export async function inspectFile(file: File, slot: AssetSlot, organizationId: string, experimentId: string): Promise<UploadAsset> {
  const extension = getExtension(file.name);
  const kind = detectAssetKind(file.name, file.type);
  const hash = await sha256(file);
  const issues: string[] = [];

  if (!kind) {
    return {
      id: createId("asset"),
      organizationId,
      experimentId,
      slot,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      hash,
      progress: 100,
      status: "error",
      createdAt: new Date().toISOString(),
      health: {
        kind: "text",
        extension,
        sizeLabel: bytesToLabel(file.size),
        durationLabel: "No disponible",
        resolutionLabel: "No disponible",
        fpsLabel: "No disponible",
        audioLabel: "No disponible",
        textLabel: "Formato no soportado",
        languageLabel: "No disponible",
        credits: 0,
        issues: ["Formato no soportado. Usa video, audio o texto contemplado por el plan."],
      },
    };
  }

  if (file.size > maxSizeByKind[kind]) {
    issues.push(`Peso superior al limite inicial para ${kind}: ${bytesToLabel(maxSizeByKind[kind])}.`);
  }

  let healthDetails: Pick<AssetHealth, "durationLabel" | "resolutionLabel" | "fpsLabel" | "audioLabel" | "textLabel" | "languageLabel" | "credits" | "issues">;
  let textSample: string | undefined;
  let hasSrtTimecodes = false;
  let previewUrl: string | undefined;

  if (kind === "text") {
    const textDetails = await inspectText(file, extension);
    textSample = textDetails.textSample;
    hasSrtTimecodes = textDetails.hasSrtTimecodes;
    healthDetails = textDetails;
  } else {
    const metadata = await loadMediaMetadata(file, kind);
    previewUrl = URL.createObjectURL(file);
    const durationSeconds = metadata.duration;
    const credits = Math.max(1, Math.ceil((durationSeconds || 1) / 60));
    if (!durationSeconds) issues.push("No se pudo leer duracion en navegador. El worker hara ffprobe.");
    healthDetails = {
      durationLabel: secondsToLabel(durationSeconds),
      resolutionLabel: kind === "video" && metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : kind === "video" ? "Pendiente ffprobe" : "No aplica",
      fpsLabel: kind === "video" ? "Pendiente ffprobe" : "No aplica",
      audioLabel: kind === "audio" ? "Audio detectado" : "Pendiente ffprobe",
      textLabel: "No detectado",
      languageLabel: "Pendiente transcript",
      credits,
      issues: [],
    };
  }

  const allIssues = [...issues, ...healthDetails.issues];
  const status = allIssues.length > 0 ? "warning" : "validated";

  return {
    id: createId("asset"),
    organizationId,
    experimentId,
    slot,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    hash,
    previewUrl,
    progress: 100,
    status,
    textSample,
    hasSrtTimecodes,
    createdAt: new Date().toISOString(),
    health: {
      kind,
      extension,
      sizeLabel: bytesToLabel(file.size),
      ...healthDetails,
      issues: allIssues,
    },
  };
}
