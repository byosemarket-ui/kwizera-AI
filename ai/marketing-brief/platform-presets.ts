import type { AspectRatio, CampaignObjectiveCode, PlatformProductionPreset } from "./types.js";

const PRESETS: Record<string, PlatformProductionPreset> = {
  tiktok: {
    platform: "TikTok",
    suggestedAspectRatio: "9:16",
    suggestedDuration: "15s",
    suggestedContentFormat: "SHORT_PRODUCT_VIDEO",
    pacing: "short-form",
    hookStyle: "fast-initial-hook",
    ctaGuidance: "Close with a short, native on-screen action.",
  },
  instagram: {
    platform: "Instagram",
    suggestedAspectRatio: "9:16",
    suggestedDuration: "30s",
    suggestedContentFormat: "SHORT_PRODUCT_VIDEO",
    pacing: "social-first",
    hookStyle: "strong-visual-opening",
    ctaGuidance: "Lead with the product, then a single clear CTA.",
  },
  facebook: {
    platform: "Facebook",
    suggestedAspectRatio: "1:1",
    suggestedDuration: "30s",
    suggestedContentFormat: "PRODUCT_SHOWCASE",
    pacing: "message-led",
    hookStyle: "clear-product-message",
    ctaGuidance: "State the product benefit early and end with a suitable CTA.",
  },
  youtube: {
    platform: "YouTube",
    suggestedAspectRatio: "16:9",
    suggestedDuration: "60s",
    suggestedContentFormat: "PRODUCT_INTRODUCTION",
    pacing: "flexible",
    hookStyle: "narrative-open",
    ctaGuidance: "Build value, then a memorable closing action.",
  },
};

export const ASPECT_RATIO_PRESETS: AspectRatio[] = ["9:16", "1:1", "16:9"];

export function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function platformProductionPreset(platform: string): PlatformProductionPreset | null {
  const key = normalizePlatformKey(platform);
  if (key.includes("tiktok")) return PRESETS.tiktok;
  if (key.includes("instagram") || key.includes("reels")) return PRESETS.instagram;
  if (key.includes("facebook")) return PRESETS.facebook;
  if (key.includes("youtube")) return PRESETS.youtube;
  return null;
}

export function presetsForPlatforms(platforms: string[]): PlatformProductionPreset[] {
  const seen = new Set<string>();
  const out: PlatformProductionPreset[] = [];
  for (const platform of platforms) {
    const preset = platformProductionPreset(platform);
    if (!preset || seen.has(preset.platform)) continue;
    seen.add(preset.platform);
    out.push(preset);
  }
  return out;
}

/** Suggest a default output from selected platforms. Never treats platform as the format itself. */
export function suggestedOutputFromPlatforms(platforms: string[]): {
  aspectRatio: AspectRatio;
  duration: string;
  contentFormat: string;
  pacing: string;
  hookStyle: string;
} {
  const presets = presetsForPlatforms(platforms);
  if (!presets.length) {
    return {
      aspectRatio: "9:16",
      duration: "30s",
      contentFormat: "SHORT_PRODUCT_VIDEO",
      pacing: "balanced",
      hookStyle: "product-first",
    };
  }
  const vertical = presets.some((item) => item.suggestedAspectRatio === "9:16");
  const primary = presets[0];
  return {
    aspectRatio: vertical ? "9:16" : primary.suggestedAspectRatio,
    duration: primary.suggestedDuration,
    contentFormat: primary.suggestedContentFormat,
    pacing: primary.pacing,
    hookStyle: primary.hookStyle,
  };
}

export function objectiveCodeFromLabel(label: string): CampaignObjectiveCode {
  const value = label.trim().toLowerCase();
  if (/product\s*awareness|awareness(?!\s*brand)/i.test(value) && !/brand/.test(value)) return "PRODUCT_AWARENESS";
  if (/brand/.test(value) && /awareness/.test(value)) return "BRAND_AWARENESS";
  if (/launch|new arrival/.test(value)) return "PRODUCT_LAUNCH";
  if (/sale|buy|order|traffic|lead/.test(value)) return "SALES";
  if (/promo/.test(value)) return "PROMOTION";
  if (/engage/.test(value)) return "ENGAGEMENT";
  if (!value) return "PRODUCT_AWARENESS";
  return "OTHER";
}

export function durationLabel(preset: string, customSeconds: number | null | undefined): string {
  if (preset === "short") return "15s";
  if (preset === "medium") return "30s";
  if (preset === "long") return "60s";
  if (preset === "custom" && customSeconds && customSeconds > 0) return `${customSeconds}s`;
  return "";
}
