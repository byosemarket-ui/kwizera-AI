import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductStoryboardResult } from "../product-storyboard/types.js";
import type { ProductVideoGenerationResult } from "../product-video-generation/types.js";
import type {
  AspectMode,
  DeliveryPlatform,
  ExportFormat,
  PlatformExport,
  RenderResolutionPreset,
  RenderSettings,
} from "./types.js";

const PLATFORM_PRESETS: Record<DeliveryPlatform, { aspect: AspectMode; resolutionPreset: RenderResolutionPreset; format: ExportFormat; why: string }> = {
  tiktok: { aspect: "portrait", resolutionPreset: "1080p", format: "mp4", why: "TikTok prefers vertical 9:16 H.264 MP4." },
  "instagram-reels": { aspect: "portrait", resolutionPreset: "1080p", format: "mp4", why: "Reels prefers vertical 9:16 MP4." },
  "instagram-stories": { aspect: "portrait", resolutionPreset: "1080p", format: "mp4", why: "Stories prefers vertical 9:16 MP4." },
  facebook: { aspect: "landscape", resolutionPreset: "1080p", format: "mp4", why: "Facebook feed favors landscape 16:9 MP4." },
  "youtube-shorts": { aspect: "portrait", resolutionPreset: "1080p", format: "mp4", why: "YouTube Shorts prefers vertical 9:16 MP4." },
  youtube: { aspect: "landscape", resolutionPreset: "1080p", format: "mp4", why: "YouTube long-form favors landscape 16:9 MP4." },
  whatsapp: { aspect: "square", resolutionPreset: "1080p", format: "mp4", why: "WhatsApp status/share favors square-friendly MP4 package." },
};

export function dimensionsFor(aspect: AspectMode, preset: RenderResolutionPreset): { width: number; height: number } {
  const long = preset === "4k" ? 3840 : preset === "2k" ? 2560 : 1920;
  const short = preset === "4k" ? 2160 : preset === "2k" ? 1440 : 1080;
  if (aspect === "portrait") return { width: short, height: long };
  if (aspect === "square") return { width: short, height: short };
  return { width: long, height: short };
}

export function buildRenderSettings(platform: DeliveryPlatform, compression: RenderSettings["compression"] = "balanced"): RenderSettings {
  const preset = PLATFORM_PRESETS[platform];
  const { width, height } = dimensionsFor(preset.aspect, preset.resolutionPreset);
  const bitrateKbps = compression === "high" ? 12000 : compression === "small" ? 4000 : 8000;
  return {
    resolutionPreset: preset.resolutionPreset,
    width,
    height,
    aspect: preset.aspect,
    frameRate: 30,
    bitrateKbps,
    codec: "offline-package",
    compression,
    format: preset.format,
    platform,
  };
}

export function allPlatformExports(baseDir: string): PlatformExport[] {
  return (Object.keys(PLATFORM_PRESETS) as DeliveryPlatform[]).map((platform) => {
    const settings = buildRenderSettings(platform);
    const relativeDir = `${baseDir}/platforms/${platform}`.replace(/\\/g, "/");
    return {
      platform,
      settings,
      relativeDir,
      finalVideoRelativePath: `${relativeDir}/final.svg`,
      audioRelativePath: `${relativeDir}/mix.wav`,
      subtitlesRelativePath: `${relativeDir}/subtitles.vtt`,
      thumbnailRelativePath: `${relativeDir}/thumbnail.svg`,
      previewRelativePath: `${relativeDir}/preview.svg`,
      metadataRelativePath: `${relativeDir}/export-metadata.json`,
      encodedContainer: settings.format,
      offlinePackage: true,
      why: PLATFORM_PRESETS[platform].why,
    };
  });
}

export function primaryPlatform(project: CreativeProject): DeliveryPlatform {
  const platform = (project.platform || "").toLowerCase();
  if (platform.includes("tiktok")) return "tiktok";
  if (platform.includes("reel")) return "instagram-reels";
  if (platform.includes("stor")) return "instagram-stories";
  if (platform.includes("facebook") || platform.includes("meta")) return "facebook";
  if (platform.includes("short")) return "youtube-shorts";
  if (platform.includes("youtube")) return "youtube";
  if (platform.includes("whatsapp")) return "whatsapp";
  return "instagram-reels";
}

/** Compose final marketing SVG: embeds assembled scene video SVG content + brand overlays. */
export function composeFinalMarketingSvg(options: {
  assembledSvg: string;
  product: ProductIntelligenceProfile;
  project: CreativeProject;
  storyboard: ProductStoryboardResult;
  settings: RenderSettings;
}): string {
  const w = options.settings.width;
  const h = options.settings.height;
  const brand = options.product.brand || options.project.brandInformation?.name || options.product.productName;
  const price = options.product.price != null
    ? `${options.product.currency || options.project.productInformation?.currency || "USD"} ${options.product.price}`
    : options.project.productInformation?.price != null
      ? `${options.project.productInformation.currency || "USD"} ${options.project.productInformation.price}`
      : "";
  const cta = options.project.campaignInformation?.callToAction || options.storyboard.marketingScript.callToAction || "Shop now";
  const features = (options.product.features || options.project.productInformation?.features || []).slice(0, 3).join(" · ");
  const promo = options.storyboard.marketingScript.promotionalMessage || options.project.campaignInformation?.objective || "";
  // Scale assembled 1280x720 content into target frame.
  const scale = Math.min(w / 1280, h / 720);
  const ox = (w - 1280 * scale) / 2;
  const oy = (h - 720 * scale) / 2;
  const inner = options.assembledSvg
    .replace(/^<\?xml[^>]*>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0b1018"/>
  <g transform="translate(${ox},${oy}) scale(${scale})">${inner}</g>
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.12)}" fill="#000000" fill-opacity="0.35"/>
  <text x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.07)}" fill="#f7e7ce" font-family="Georgia, serif" font-size="${Math.round(w * 0.035)}" font-weight="700">${xml(brand)}</text>
  <text x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.11)}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${Math.round(w * 0.02)}">${xml(options.product.productName)}</text>
  ${price ? `<text x="${Math.round(w * 0.72)}" y="${Math.round(h * 0.08)}" fill="#f0d9a8" font-family="Arial, sans-serif" font-size="${Math.round(w * 0.022)}" font-weight="700">${xml(price)}</text>` : ""}
  ${features ? `<text x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.88)}" fill="#d6dde8" font-family="Arial, sans-serif" font-size="${Math.round(w * 0.018)}">${xml(features)}</text>` : ""}
  ${promo ? `<text x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.92)}" fill="#c5ceda" font-family="Arial, sans-serif" font-size="${Math.round(w * 0.016)}">${xml(promo.slice(0, 90))}</text>` : ""}
  <rect x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.94)}" width="${Math.round(w * 0.28)}" height="${Math.round(h * 0.045)}" rx="8" fill="#e6a74a"/>
  <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.972)}" fill="#1a1208" font-family="Arial, sans-serif" font-size="${Math.round(w * 0.018)}" font-weight="700">${xml(cta)}</text>
</svg>
`;
}

export function composeThumbnailSvg(options: {
  productName: string;
  brand: string;
  settings: RenderSettings;
  cta: string;
}): string {
  const w = Math.min(1280, options.settings.width);
  const h = Math.min(720, options.settings.height);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a2230"/>
      <stop offset="100%" stop-color="#2a2030"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="${w * 0.08}" y="${h * 0.42}" fill="#f7e7ce" font-family="Georgia, serif" font-size="${w * 0.06}" font-weight="700">${xml(options.brand)}</text>
  <text x="${w * 0.08}" y="${h * 0.55}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${w * 0.035}">${xml(options.productName)}</text>
  <text x="${w * 0.08}" y="${h * 0.7}" fill="#e6a74a" font-family="Arial, sans-serif" font-size="${w * 0.03}" font-weight="700">${xml(options.cta)}</text>
</svg>
`;
}

export function composePreviewSvg(finalSvg: string): string {
  // Preview is the same composition marker for offline package; duration metadata lives in manifest.
  return finalSvg.replace("<svg ", '<svg data-preview="true" ');
}

export function buildExportMetadata(options: {
  productName: string;
  settings: RenderSettings;
  durationSeconds: number;
  videoGenerationId: string;
  audioGenerationId: string;
  version: number;
}): Record<string, string | number | boolean> {
  return {
    productName: options.productName,
    platform: options.settings.platform,
    format: options.settings.format,
    width: options.settings.width,
    height: options.settings.height,
    frameRate: options.settings.frameRate,
    bitrateKbps: options.settings.bitrateKbps,
    codec: options.settings.codec,
    compression: options.settings.compression,
    durationSeconds: options.durationSeconds,
    videoGenerationId: options.videoGenerationId,
    audioGenerationId: options.audioGenerationId,
    version: options.version,
    offlinePackage: true,
    originalsUnmodified: true,
  };
}

export function buildProjectManifest(options: {
  projectId: string;
  renderId: string;
  version: number;
  settings: RenderSettings;
  platforms: DeliveryPlatform[];
  artifactPaths: Record<string, string>;
  qualityScore: number;
  createdAt: string;
}): Record<string, unknown> {
  return {
    schema: "kwizera-product-delivery-manifest-v1",
    projectId: options.projectId,
    renderId: options.renderId,
    version: options.version,
    settings: options.settings,
    platforms: options.platforms,
    artifacts: options.artifactPaths,
    qualityScore: options.qualityScore,
    createdAt: options.createdAt,
    rerenderSupported: true,
    certificationDeferred: true,
  };
}

export function buildRenderReport(options: {
  renderId: string;
  quality: Record<string, number | string[]>;
  platforms: PlatformExport[];
  repairs: string[];
  encoderAttempted: boolean;
  encoderSucceeded: boolean;
}): Record<string, unknown> {
  return {
    renderId: options.renderId,
    quality: options.quality,
    platforms: options.platforms.map((item) => ({
      platform: item.platform,
      width: item.settings.width,
      height: item.settings.height,
      format: item.settings.format,
      why: item.why,
    })),
    repairs: options.repairs,
    encoderAttempted: options.encoderAttempted,
    encoderSucceeded: options.encoderSucceeded,
    note: options.encoderSucceeded
      ? "Binary container encoded with LocalVideoEncoder."
      : "Offline delivery package written (SVG + WAV + VTT + metadata). FFmpeg encode optional.",
  };
}

export function compareExportPresets(platforms: PlatformExport[]): Array<{ platform: DeliveryPlatform; why: string; width: number; height: number }> {
  return platforms.map((item) => ({
    platform: item.platform,
    why: item.why,
    width: item.settings.width,
    height: item.settings.height,
  }));
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function hasPrice(product: ProductIntelligenceProfile, project: CreativeProject): boolean {
  return product.price != null || project.productInformation?.price != null;
}

export function verifyPackageIntegrity(files: Record<string, Buffer | string>): string[] {
  const issues: string[] = [];
  for (const [name, value] of Object.entries(files)) {
    const size = typeof value === "string" ? Buffer.byteLength(value) : value.length;
    if (size < 32) issues.push(`Artifact ${name} is too small or empty.`);
  }
  if (typeof files.final === "string" && !files.final.includes("svg")) issues.push("Final video composition is not a valid SVG package.");
  if (Buffer.isBuffer(files.audio) && files.audio.subarray(0, 4).toString("ascii") !== "RIFF") issues.push("Mix audio is not a valid WAV.");
  if (typeof files.subs === "string" && !files.subs.startsWith("WEBVTT")) issues.push("Subtitles are not valid WebVTT.");
  return issues;
}

export { type ProductVideoGenerationResult };
