/**
 * PMV destination (platform + format) and duration rules.
 * Pure — shared by the Studio UI and the server-side PMV workflow so both resolve the same
 * render profile (video-production/platform-profiles) and the same scene-time budget.
 */
import {
  VIDEO_PLATFORM_PROFILES,
  resolvePlatformId,
  type VideoPlatformId,
  type VideoPlatformProfile,
} from "../video-production/platform-profiles.js";
import { END_CARD_DURATION_MS, I2V_MIN_CLIP_SECONDS } from "../video-production/duration-limits.js";
import type { PmvGenerationMode, PmvVideoMode } from "./modes.js";

export type PmvPlatform = "tiktok" | "instagram" | "facebook" | "youtube";
export type PmvFormat = "9:16" | "1:1" | "4:5" | "16:9";

export interface PmvFormatOption {
  aspectRatio: PmvFormat;
  profileId: VideoPlatformId;
  label: string;
}

export interface PmvPlatformOption {
  id: PmvPlatform;
  label: string;
  formats: PmvFormatOption[];
}

/** First format is the platform default. Every entry maps to an existing render profile. */
export const PMV_PLATFORMS: PmvPlatformOption[] = [
  { id: "tiktok", label: "TikTok", formats: [{ aspectRatio: "9:16", profileId: "tiktok", label: "Vertical 9:16" }] },
  {
    id: "instagram",
    label: "Instagram",
    formats: [
      { aspectRatio: "9:16", profileId: "instagram_reels", label: "Reels 9:16" },
      { aspectRatio: "4:5", profileId: "instagram_portrait", label: "Feed portrait 4:5" },
      { aspectRatio: "1:1", profileId: "instagram_feed", label: "Feed square 1:1" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    formats: [
      { aspectRatio: "1:1", profileId: "facebook_feed", label: "Feed square 1:1" },
      { aspectRatio: "9:16", profileId: "facebook_reels", label: "Reels 9:16" },
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    formats: [
      { aspectRatio: "16:9", profileId: "youtube", label: "Landscape 16:9" },
      { aspectRatio: "9:16", profileId: "youtube_shorts", label: "Shorts 9:16" },
    ],
  },
];

export function isPmvPlatform(value: unknown): value is PmvPlatform {
  return value === "tiktok" || value === "instagram" || value === "facebook" || value === "youtube";
}

/** Platform for projects saved before an explicit choice existed (same profiles those projects rendered with). */
export function legacyPlatformFor(projectPlatform: string | null | undefined, aspectRatio: string | null | undefined): PmvPlatform {
  const text = (projectPlatform ?? "").toLowerCase();
  if (text) {
    const id = resolvePlatformId(text);
    if (id.startsWith("instagram")) return "instagram";
    if (id.startsWith("facebook")) return "facebook";
    if (id.startsWith("youtube")) return "youtube";
    if (id === "tiktok") return "tiktok";
  }
  if (aspectRatio === "1:1" || aspectRatio === "4:5") return "instagram";
  if (aspectRatio === "16:9") return "youtube";
  return "tiktok";
}

export interface PmvDestination {
  platform: PmvPlatform;
  platformLabel: string;
  format: PmvFormatOption;
  profile: VideoPlatformProfile;
  /** true when the requested format is not offered for the platform and the platform default is used. */
  formatAdjusted: boolean;
}

export function resolvePmvDestination(
  platform: PmvPlatform | null | undefined,
  aspectRatio: string | null | undefined,
  projectPlatform?: string | null,
): PmvDestination {
  const id = isPmvPlatform(platform) ? platform : legacyPlatformFor(projectPlatform, aspectRatio);
  const option = PMV_PLATFORMS.find((p) => p.id === id)!;
  const match = option.formats.find((f) => f.aspectRatio === aspectRatio);
  const format = match ?? option.formats[0]!;
  return {
    platform: id,
    platformLabel: option.label,
    format,
    profile: VIDEO_PLATFORM_PROFILES[format.profileId],
    formatAdjusted: !match,
  };
}

/* —— Duration —— */

export const PMV_DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

/** The planner ignores scene targets below this, so it is the smallest usable scene budget. */
const MIN_SCENE_BUDGET_SECONDS = 4;

/** Canonical video modes and the legacy values stored before them. */
type DurationMode = PmvGenerationMode | PmvVideoMode;

function endCardSeconds(mode: DurationMode): number {
  return mode === "EXACT_PRODUCT" || mode === "PRODUCT_SLIDESHOW" ? END_CARD_DURATION_MS / 1000 : 0;
}

/**
 * Seconds of product scenes to plan so the finished video matches the requested total:
 * slideshow renders append the end card after the scenes.
 */
export function sceneBudgetSeconds(totalSeconds: number, mode: DurationMode): number {
  const budget = totalSeconds - endCardSeconds(mode);
  return budget >= MIN_SCENE_BUDGET_SECONDS ? budget : totalSeconds;
}

export function minDurationSeconds(mode: DurationMode): number {
  if (mode === "CINEMATIC" || mode === "CINEMATIC_AI") return Math.max(MIN_SCENE_BUDGET_SECONDS, 3 * I2V_MIN_CLIP_SECONDS);
  return MIN_SCENE_BUDGET_SECONDS + endCardSeconds(mode);
}

export function maxDurationSeconds(destination: PmvDestination): number {
  return Math.floor(destination.profile.maxDurationMs / 1000);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function durationFromParts(minutes: string | number, seconds: string | number): { total: number | null; error: string | null } {
  const m = typeof minutes === "number" ? minutes : minutes.trim() === "" ? 0 : Number(minutes);
  const s = typeof seconds === "number" ? seconds : seconds.trim() === "" ? 0 : Number(seconds);
  if (!Number.isInteger(m) || m < 0) return { total: null, error: "Minutes must be a whole number of 0 or more." };
  if (!Number.isInteger(s) || s < 0 || s > 59) return { total: null, error: "Seconds must be a whole number from 0 to 59." };
  const total = m * 60 + s;
  if (total <= 0) return { total: null, error: "The video must be longer than 0 seconds." };
  return { total, error: null };
}

/** Customer-safe duration problem for the chosen destination and style, or null when valid. */
export function validateDuration(totalSeconds: number, destination: PmvDestination, mode: DurationMode): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "Please choose how long the video should be.";
  const min = minDurationSeconds(mode);
  if (totalSeconds < min) return `Videos must be at least ${formatDuration(min)} long.`;
  const max = maxDurationSeconds(destination);
  if (totalSeconds > max) {
    return `${destination.platformLabel} ${destination.format.label} videos can be up to ${formatDuration(max)}. Choose a shorter duration or another format.`;
  }
  return null;
}
