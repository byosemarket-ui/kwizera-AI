/** Product Intake & Image Import — Phase 2 Step 1 */

export type IntakeQueueStatus =
  | "pending"
  | "importing"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type ValidationStatus =
  | "pending"
  | "valid"
  | "warning"
  | "invalid"
  | "duplicate";

export type ProcessingStatus =
  | "queued"
  | "reading"
  | "validating"
  | "uploading"
  | "saved"
  | "failed"
  | "cancelled";

export interface IntakeWarning {
  code: "low-resolution" | "large-file" | "duplicate" | "missing-metadata" | "other";
  message: string;
}

export interface IntakeAssetMeta {
  assetId: string;
  projectId: string;
  originalFilename: string;
  fileType: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  importDate: string;
  sourceReference: string;
  validationStatus: ValidationStatus;
  duplicateStatus: "none" | "possible" | "confirmed";
  duplicateOf?: string;
  duplicateOfName?: string;
  processingStatus: ProcessingStatus;
  checksum: string;
  thumbnailUrl?: string;
  remoteUrl?: string;
  warnings: IntakeWarning[];
  error?: string;
  /** Object URL for local preview before/after upload — revoked on remove */
  localPreviewUrl?: string;
  keepDespiteDuplicate?: boolean;
}

export interface IntakeQueueItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  status: IntakeQueueStatus;
  progress: number;
  error?: string;
  assetId?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface IntakeProgress {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  currentFile: string | null;
  percent: number;
  bytesPerSecond: number;
  remaining: number;
  statusLabel: string;
  running: boolean;
  paused: boolean;
}

export interface IntakeSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  assets: IntakeAssetMeta[];
  queue: IntakeQueueItem[];
  progress: IntakeProgress;
  canContinue: boolean;
  continueBlockedReason: string | null;
  handoffReady: boolean;
  recommendation: string;
  updatedAt: string;
}

export interface IntakeHandoffPayload {
  version: 1;
  step: "step-2-image-organization";
  projectId: string;
  projectName: string;
  assets: IntakeAssetMeta[];
  preparedAt: string;
}

export const INTAKE_META_KEY = "kwizera.product-intake.meta.v1";
export const INTAKE_HANDOFF_KEY = "kwizera.product-intake.handoff.v1";
export const LOW_RES_MIN = 400;
export const LARGE_FILE_WARN_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
