export type AssetKind = "video" | "audio" | "text";

export type AssetSlot = "A" | "B" | "C";

export type AssetValidationStatus = "uploading" | "validated" | "warning" | "error";

export type AssetHealth = {
  kind: AssetKind;
  extension: string;
  sizeLabel: string;
  durationLabel: string;
  resolutionLabel: string;
  fpsLabel: string;
  audioLabel: string;
  textLabel: string;
  languageLabel: string;
  credits: number;
  issues: string[];
};

export type UploadAsset = {
  id: string;
  organizationId: string;
  experimentId: string;
  slot: AssetSlot;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  storageBucket?: string;
  storageKey?: string;
  uploadSessionId?: string;
  previewUrl?: string;
  progress: number;
  status: AssetValidationStatus;
  health: AssetHealth;
  textSample?: string;
  hasSrtTimecodes?: boolean;
  createdAt: string;
};
