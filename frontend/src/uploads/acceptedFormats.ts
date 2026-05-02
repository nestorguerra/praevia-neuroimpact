import type { AssetKind } from "./types";

export const acceptedVideoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
export const acceptedAudioExtensions = [".mp3", ".wav", ".flac", ".ogg", ".m4a"];
export const acceptedTextExtensions = [".txt", ".md", ".srt"];

export const allAcceptedExtensions = [
  ...acceptedVideoExtensions,
  ...acceptedAudioExtensions,
  ...acceptedTextExtensions,
];

export const maxSizeByKind: Record<AssetKind, number> = {
  video: 500 * 1024 * 1024,
  audio: 150 * 1024 * 1024,
  text: 5 * 1024 * 1024,
};

export function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

export function detectAssetKind(fileName: string, mimeType: string): AssetKind | null {
  const extension = getExtension(fileName);
  if (acceptedVideoExtensions.includes(extension) || mimeType.startsWith("video/")) return "video";
  if (acceptedAudioExtensions.includes(extension) || mimeType.startsWith("audio/")) return "audio";
  if (acceptedTextExtensions.includes(extension) || mimeType.startsWith("text/")) return "text";
  return null;
}

export function acceptedFormatsLabel() {
  return [
    `Video: ${acceptedVideoExtensions.join(", ")}`,
    `Audio: ${acceptedAudioExtensions.join(", ")}`,
    `Texto: ${acceptedTextExtensions.join(", ")}`,
  ];
}

