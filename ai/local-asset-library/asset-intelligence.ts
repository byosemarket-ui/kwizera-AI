import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { AssetMetadata, LocalAssetType } from "./types.js";

const EXT_TYPE_MAP: Array<{ type: LocalAssetType; exts: string[] }> = [
  { type: "product-image", exts: [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"] },
  { type: "product-video", exts: [".mp4", ".mov", ".mkv", ".avi", ".webm"] },
  { type: "logo", exts: [".svg"] },
  { type: "music", exts: [".mp3", ".wav", ".flac", ".aac", ".m4a"] },
  { type: "sound-effect", exts: [".ogg"] },
  { type: "voice-file", exts: [".voice"] },
  { type: "font", exts: [".ttf", ".otf", ".woff", ".woff2"] },
  { type: "icon", exts: [".ico"] },
  { type: "lut", exts: [".cube", ".3dl"] },
  { type: "subtitle", exts: [".srt", ".vtt"] },
  { type: "template", exts: [".aep", ".prproj", ".mogrt"] },
  { type: "project-file", exts: [".kwizera", ".json"] },
  { type: "animation", exts: [".gif", ".lottie"] },
];

const COLOR_KEYWORDS: Array<{ color: string; words: string[] }> = [
  { color: "black", words: ["black", "noir", "dark"] },
  { color: "white", words: ["white", "ivory", "light"] },
  { color: "red", words: ["red", "crimson"] },
  { color: "blue", words: ["blue", "navy"] },
  { color: "green", words: ["green"] },
  { color: "gold", words: ["gold", "luxury"] },
];

const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: "shoes", words: ["shoe", "shoes", "sneaker", "boot"] },
  { category: "phone", words: ["phone", "mobile", "smartphone"] },
  { category: "fashion", words: ["fashion", "apparel", "clothing", "dress"] },
  { category: "electronics", words: ["electronics", "gadget", "device", "laptop"] },
  { category: "luxury", words: ["luxury", "premium", "gold"] },
  { category: "beverage", words: ["bottle", "drink", "beverage"] },
];

const SCENE_KEYWORDS = ["studio", "outdoor", "marketing", "product", "hero", "lifestyle"];

export function inferAssetType(filePath: string, hint?: LocalAssetType): LocalAssetType {
  if (hint) return hint;
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  if (base.includes("logo")) return "logo";
  if (base.includes("intro")) return "intro-video";
  if (base.includes("outro")) return "outro-video";
  if (base.includes("overlay")) return "overlay";
  if (base.includes("transition")) return "transition";
  if (base.includes("background") || base.includes("bg-")) return "background";
  if (base.includes("brand")) return "brand-kit";
  if (base.includes("voice") || base.includes("vo-")) return "voice-file";
  if (base.includes("sfx") || base.includes("sound")) return "sound-effect";
  const ext = path.extname(lower);
  for (const entry of EXT_TYPE_MAP) {
    if (entry.exts.includes(ext)) return entry.type;
  }
  return "other";
}

export function checksumFile(filePath: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  } catch {
    return crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 16);
  }
}

export function analyzeAssetFile(filePath: string, assetType: LocalAssetType): AssetMetadata {
  const ext = path.extname(filePath).toLowerCase() || ".bin";
  const base = path.basename(filePath, ext).toLowerCase();
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(filePath).size;
  } catch {
    fileSizeBytes = 0;
  }

  const isImage = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".gif", ".svg", ".ico"].includes(ext);
  const isVideo = [".mp4", ".mov", ".mkv", ".avi", ".webm"].includes(ext);
  const isAudio = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"].includes(ext);

  // Heuristic dimensions/duration from filename patterns e.g. name_1920x1080 or 30s
  let width: number | null = null;
  let height: number | null = null;
  const dimMatch = base.match(/(\d{3,5})\s*[xX]\s*(\d{3,5})/);
  if (dimMatch) {
    width = Number(dimMatch[1]);
    height = Number(dimMatch[2]);
  } else if (isImage) {
    width = 1920;
    height = 1080;
  } else if (isVideo) {
    width = 1920;
    height = 1080;
  }

  let durationMs: number | null = null;
  const durMatch = base.match(/(\d+)\s*s(?:ec)?/);
  if (durMatch) durationMs = Number(durMatch[1]) * 1000;
  else if (isVideo) durationMs = 15_000;
  else if (isAudio) durationMs = 30_000;

  const dominantColors: string[] = [];
  for (const entry of COLOR_KEYWORDS) {
    if (entry.words.some((w) => base.includes(w))) dominantColors.push(entry.color);
  }
  if (!dominantColors.length && (isImage || isVideo)) dominantColors.push("neutral");

  let productCategory: string | null = null;
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.words.some((w) => base.includes(w))) {
      productCategory = entry.category;
      break;
    }
  }

  let brand: string | null = null;
  const brandMatch = base.match(/(?:brand|logo)[-_]?([a-z0-9]+)/i);
  if (brandMatch) brand = brandMatch[1]!;

  const resolution = width && height ? `${width}x${height}` : null;

  return {
    fileType: assetType,
    extension: ext,
    resolution,
    durationMs,
    width,
    height,
    dominantColors,
    language: base.includes("fr") ? "fr" : base.includes("rw") ? "rw" : "en",
    productCategory,
    brand,
    fileSizeBytes,
    checksum: checksumFile(filePath),
  };
}

export function generateAutoTags(input: {
  assetName: string;
  assetType: LocalAssetType;
  metadata: AssetMetadata;
  productName?: string | null;
  category?: string | null;
  brand?: string | null;
}): string[] {
  const tags = new Set<string>();
  tags.add(input.assetType);
  const blob = `${input.assetName} ${input.productName ?? ""} ${input.category ?? ""} ${input.brand ?? ""}`.toLowerCase();

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.words.some((w) => blob.includes(w)) || input.metadata.productCategory === entry.category) {
      tags.add(entry.category);
      if (entry.category === "shoes" || entry.category === "fashion") tags.add("fashion");
      if (entry.category === "phone") tags.add("electronics");
    }
  }
  for (const entry of COLOR_KEYWORDS) {
    if (input.metadata.dominantColors.includes(entry.color) || entry.words.some((w) => blob.includes(w))) {
      tags.add(entry.color);
    }
  }
  for (const scene of SCENE_KEYWORDS) {
    if (blob.includes(scene)) tags.add(scene);
  }
  if (input.category) tags.add(input.category.toLowerCase());
  if (input.brand) tags.add(input.brand.toLowerCase());
  if (input.metadata.resolution) tags.add(input.metadata.resolution);
  if (/marketing|campaign|ad/.test(blob)) tags.add("marketing");
  if (/luxury|premium/.test(blob)) tags.add("luxury");
  if (/studio/.test(blob)) tags.add("studio");
  if (/outdoor/.test(blob)) tags.add("outdoor");

  return [...tags].slice(0, 24);
}

export function parseNaturalLanguageQuery(query: string): {
  colors: string[];
  categories: string[];
  keywords: string[];
  fileHints: string[];
} {
  const lower = query.toLowerCase();
  const colors: string[] = [];
  const categories: string[] = [];
  const keywords: string[] = [];
  const fileHints: string[] = [];

  for (const entry of COLOR_KEYWORDS) {
    if (entry.words.some((w) => lower.includes(w))) colors.push(entry.color);
  }
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.words.some((w) => lower.includes(w))) categories.push(entry.category);
  }
  if (lower.includes("photo") || lower.includes("image") || lower.includes("picture")) fileHints.push("image");
  if (lower.includes("video") || lower.includes("clip")) fileHints.push("video");
  if (lower.includes("music") || lower.includes("audio")) fileHints.push("audio");
  if (lower.includes("logo")) fileHints.push("logo");

  const stop = new Set(["find", "all", "the", "a", "an", "of", "for", "me", "with", "and", "photos", "photo", "images", "image", "videos", "video"]);
  for (const token of lower.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (!stop.has(token) && token.length > 2) keywords.push(token);
  }
  return { colors, categories, keywords, fileHints };
}
