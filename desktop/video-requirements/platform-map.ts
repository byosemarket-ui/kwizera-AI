import {
  VIDEO_PLATFORM_PROFILES,
  type VideoPlatformId,
} from "../../ai/video-production/platform-profiles.js";
import type { PlatformPreview } from "./types.js";

export const PLATFORM_OPTIONS: VideoPlatformId[] = [
  "tiktok",
  "instagram_reels",
  "instagram_feed",
  "facebook_feed",
  "youtube",
  "youtube_shorts",
];

export function platformPreview(id: VideoPlatformId): PlatformPreview {
  const profile = VIDEO_PLATFORM_PROFILES[id];
  const orientation = profile.aspectRatio === "9:16"
    ? "Vertical"
    : profile.aspectRatio === "1:1"
      ? "Square"
      : "Horizontal";
  return {
    id: profile.id,
    label: profile.label,
    orientation,
    aspectRatio: profile.aspectRatio,
    width: profile.width,
    height: profile.height,
    maxDurationSec: Math.round(profile.maxDurationMs / 1000),
  };
}

export function platformLabelForBrief(id: VideoPlatformId): string {
  return VIDEO_PLATFORM_PROFILES[id].label;
}

export function resolvePlatformId(value?: string): VideoPlatformId {
  const text = (value ?? "").toLowerCase();
  if (text.includes("tiktok")) return "tiktok";
  if (text.includes("reel")) return "instagram_reels";
  if (text.includes("instagram") && text.includes("feed")) return "instagram_feed";
  if (text.includes("instagram")) return "instagram_reels";
  if (text.includes("short")) return "youtube_shorts";
  if (text.includes("youtube")) return "youtube";
  if (text.includes("facebook")) return "facebook_feed";
  if (text === "instagram_feed") return "instagram_feed";
  if (text === "instagram_reels") return "instagram_reels";
  if (text === "youtube_shorts") return "youtube_shorts";
  if (text === "facebook_feed") return "facebook_feed";
  return "tiktok";
}

export function durationToSeconds(duration: string, customSeconds: number | null): number {
  if (duration === "15s") return 15;
  if (duration === "30s") return 30;
  if (duration === "45s") return 45;
  if (duration === "60s") return 60;
  if (duration === "custom" && customSeconds && customSeconds > 0) {
    return Math.min(120, Math.max(5, Math.round(customSeconds)));
  }
  return 30;
}

export function parseDurationFromBrief(value: string): { duration: import("./types.js").DurationOption; custom: number | null } {
  const match = /^(\d+)s$/.exec(value.trim());
  if (!match) return { duration: "30s", custom: null };
  const sec = Number.parseInt(match[1]!, 10);
  if (sec === 15) return { duration: "15s", custom: null };
  if (sec === 30) return { duration: "30s", custom: null };
  if (sec === 45) return { duration: "45s", custom: null };
  if (sec === 60) return { duration: "60s", custom: null };
  return { duration: "custom", custom: sec };
}
