import type { VideoAspectRatio } from "./types.js";

export type VideoPlatformId =
  | "tiktok"
  | "instagram_reels"
  | "instagram_feed"
  | "youtube_shorts"
  | "youtube"
  | "facebook_feed";

export interface VideoPlatformProfile {
  id: VideoPlatformId;
  label: string;
  aspectRatio: VideoAspectRatio;
  width: number;
  height: number;
  maxDurationMs: number;
}

export const VIDEO_PLATFORM_PROFILES: Record<VideoPlatformId, VideoPlatformProfile> = {
  tiktok: { id: "tiktok", label: "TikTok", aspectRatio: "9:16", width: 1080, height: 1920, maxDurationMs: 60_000 },
  instagram_reels: { id: "instagram_reels", label: "Instagram Reels", aspectRatio: "9:16", width: 1080, height: 1920, maxDurationMs: 90_000 },
  instagram_feed: { id: "instagram_feed", label: "Instagram Feed", aspectRatio: "1:1", width: 1080, height: 1080, maxDurationMs: 60_000 },
  youtube_shorts: { id: "youtube_shorts", label: "YouTube Shorts", aspectRatio: "9:16", width: 1080, height: 1920, maxDurationMs: 60_000 },
  youtube: { id: "youtube", label: "YouTube", aspectRatio: "16:9", width: 1920, height: 1080, maxDurationMs: 600_000 },
  facebook_feed: { id: "facebook_feed", label: "Facebook Feed", aspectRatio: "1:1", width: 1080, height: 1080, maxDurationMs: 120_000 },
};

export const VIDEO_PLATFORM_OPTIONS = Object.values(VIDEO_PLATFORM_PROFILES);

export function resolvePlatformId(value?: string): VideoPlatformId {
  const text = (value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (/tiktok/.test(text)) return "tiktok";
  if (/instagram.*reel|reels/.test(text)) return "instagram_reels";
  if (/instagram.*feed|instagram/.test(text)) return "instagram_feed";
  if (/youtube.*short|shorts/.test(text)) return "youtube_shorts";
  if (/youtube/.test(text)) return "youtube";
  if (/facebook/.test(text)) return "facebook_feed";
  if (/square|1:1/.test(text)) return "instagram_feed";
  if (/vertical|9:16|reel/.test(text)) return "tiktok";
  return "youtube";
}

export function profileForPlatform(value?: string): VideoPlatformProfile {
  return VIDEO_PLATFORM_PROFILES[resolvePlatformId(value)];
}
