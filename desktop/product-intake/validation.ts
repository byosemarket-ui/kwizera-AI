import { classifyFormat, formatRejectionMessage, resolveMimeType } from "./formats";
import { fingerprintFile, readImageDimensions } from "./hash";
import type { IntakeAssetMeta, IntakeWarning, ValidationStatus } from "./types";
import { LARGE_FILE_WARN_BYTES, LOW_RES_MIN, MAX_FILE_BYTES } from "./types";

export interface ClientValidationResult {
  ok: boolean;
  critical: boolean;
  status: ValidationStatus;
  mimeType: string;
  width: number | null;
  height: number | null;
  checksum: string;
  warnings: IntakeWarning[];
  error?: string;
  localPreviewUrl?: string;
}

export async function validateLocalFile(
  file: File,
  existing: IntakeAssetMeta[],
): Promise<ClientValidationResult> {
  const warnings: IntakeWarning[] = [];
  const mimeType = resolveMimeType(file);
  const format = classifyFormat(file);

  if (format !== "supported") {
    return {
      ok: false,
      critical: true,
      status: "invalid",
      mimeType,
      width: null,
      height: null,
      checksum: "",
      warnings,
      error: formatRejectionMessage(file),
    };
  }

  if (!file.size) {
    return {
      ok: false,
      critical: true,
      status: "invalid",
      mimeType,
      width: null,
      height: null,
      checksum: "",
      warnings,
      error: `${file.name}: empty or invalid image file`,
    };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      critical: true,
      status: "invalid",
      mimeType,
      width: null,
      height: null,
      checksum: "",
      warnings,
      error: `${file.name}: file exceeds 25 MB limit`,
    };
  }

  if (file.size >= LARGE_FILE_WARN_BYTES) {
    warnings.push({
      code: "large-file",
      message: `${file.name} is large (${(file.size / 1024 / 1024).toFixed(1)} MB). Import will continue.`,
    });
  }

  let checksum = "";
  try {
    checksum = await fingerprintFile(file);
  } catch {
    return {
      ok: false,
      critical: true,
      status: "invalid",
      mimeType,
      width: null,
      height: null,
      checksum: "",
      warnings,
      error: `${file.name}: file is not readable`,
    };
  }

  const dimensions = await readImageDimensions(file);
  if (!dimensions) {
    return {
      ok: false,
      critical: true,
      status: "invalid",
      mimeType,
      width: null,
      height: null,
      checksum,
      warnings,
      error: `${file.name}: corrupted or unreadable image data`,
    };
  }

  if (dimensions.width < LOW_RES_MIN || dimensions.height < LOW_RES_MIN) {
    warnings.push({
      code: "low-resolution",
      message: `${file.name} is low resolution (${dimensions.width}×${dimensions.height}). Consider a higher-quality source.`,
    });
  }

  const duplicate = existing.find((asset) =>
    asset.checksum === checksum
    || (asset.originalFilename.toLowerCase() === file.name.toLowerCase()
      && asset.fileSize === file.size
      && asset.width === dimensions.width
      && asset.height === dimensions.height),
  );

  let status: ValidationStatus = warnings.length ? "warning" : "valid";
  if (duplicate) {
    status = "duplicate";
    warnings.push({
      code: "duplicate",
      message: `Possible duplicate of ${duplicate.originalFilename}`,
    });
  }

  const localPreviewUrl = URL.createObjectURL(file);

  return {
    ok: true,
    critical: false,
    status,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    checksum,
    warnings,
    localPreviewUrl,
  };
}

export function findDuplicateMatch(asset: IntakeAssetMeta, others: IntakeAssetMeta[]): IntakeAssetMeta | null {
  return others.find((other) =>
    other.assetId !== asset.assetId
    && (other.checksum === asset.checksum
      || (other.originalFilename.toLowerCase() === asset.originalFilename.toLowerCase()
        && other.fileSize === asset.fileSize)),
  ) ?? null;
}
