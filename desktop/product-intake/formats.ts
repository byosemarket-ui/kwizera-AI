/** Supported and future image formats for Product Intake */

export const SUPPORTED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "tif", "tiff", "bmp",
]);

export const FUTURE_EXTENSIONS = new Set(["svg", "heic", "heif"]);

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,image/jpeg,image/png,image/webp,image/tiff,image/bmp";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
};

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function resolveMimeType(file: File): string {
  if (file.type && file.type.startsWith("image/")) return file.type === "image/jpg" ? "image/jpeg" : file.type;
  return EXT_MIME[extensionOf(file.name)] ?? "";
}

export function classifyFormat(file: File): "supported" | "future" | "unsupported" {
  const ext = extensionOf(file.name);
  const mime = resolveMimeType(file);
  if (SUPPORTED_EXTENSIONS.has(ext) || ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp", "image/x-ms-bmp"].includes(mime)) {
    return "supported";
  }
  if (FUTURE_EXTENSIONS.has(ext) || mime === "image/svg+xml" || mime === "image/heic" || mime === "image/heif") {
    return "future";
  }
  return "unsupported";
}

export function formatRejectionMessage(file: File): string {
  const kind = classifyFormat(file);
  if (kind === "future") {
    return `${file.name}: ${extensionOf(file.name).toUpperCase()} is reserved for a future release and was not imported.`;
  }
  return `${file.name}: unsupported format. Supported: JPG, JPEG, PNG, WEBP, TIFF, BMP.`;
}
