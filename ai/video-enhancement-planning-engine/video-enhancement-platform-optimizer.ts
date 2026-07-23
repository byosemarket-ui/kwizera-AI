import { VideoEnhancementPlatform, PlatformOptimizationRule } from "./types.js";
import { VideoAnalysisType, VideoOrientation } from "../video-analysis-engine/types.js";

const PLATFORM_RULES: Omit<PlatformOptimizationRule, "priority">[] = [
  {
    platform: VideoEnhancementPlatform.TikTok,
    resolutionTarget: "1080x1920",
    aspectRatio: "9:16",
    bitrateGuidance: "6-8 Mbps H.264",
    loudnessTarget: "-14 LUFS integrated",
    enhancementNotes: ["Fast hook in first 2s", "Bold captions", "High contrast grade"],
  },
  {
    platform: VideoEnhancementPlatform.Instagram,
    resolutionTarget: "1080x1920",
    aspectRatio: "9:16",
    bitrateGuidance: "5-7 Mbps",
    loudnessTarget: "-14 LUFS",
    enhancementNotes: ["Reels-safe center framing", "Vibrant color grade", "Music-forward mix"],
  },
  {
    platform: VideoEnhancementPlatform.Facebook,
    resolutionTarget: "1280x720",
    aspectRatio: "16:9 or 1:1",
    bitrateGuidance: "4-6 Mbps",
    loudnessTarget: "-16 LUFS",
    enhancementNotes: ["Silent-preview friendly captions", "Moderate sharpening"],
  },
  {
    platform: VideoEnhancementPlatform.YouTube,
    resolutionTarget: "1920x1080",
    aspectRatio: "16:9",
    bitrateGuidance: "12-16 Mbps",
    loudnessTarget: "-14 LUFS",
    enhancementNotes: ["Chapter-friendly pacing", "Broadcast-safe levels", "High clarity grade"],
  },
  {
    platform: VideoEnhancementPlatform.WhatsApp,
    resolutionTarget: "720x1280",
    aspectRatio: "9:16",
    bitrateGuidance: "2-4 Mbps",
    loudnessTarget: "-16 LUFS",
    enhancementNotes: ["Compressed-friendly grade", "Reduced fine detail noise"],
  },
  {
    platform: VideoEnhancementPlatform.Website,
    resolutionTarget: "1920x1080",
    aspectRatio: "16:9",
    bitrateGuidance: "8-12 Mbps adaptive",
    loudnessTarget: "-16 LUFS",
    enhancementNotes: ["Hero-loop optimization", "Clean minimal grade", "Fast start GOP"],
  },
  {
    platform: VideoEnhancementPlatform.Television,
    resolutionTarget: "1920x1080",
    aspectRatio: "16:9",
    bitrateGuidance: "15-25 Mbps",
    loudnessTarget: "-24 LKFS (broadcast)",
    enhancementNotes: ["Legal loudness compliance", "Safe color space Rec.709", "No interlace artifacts"],
  },
  {
    platform: VideoEnhancementPlatform.PrintPreview,
    resolutionTarget: "3840x2160",
    aspectRatio: "16:9",
    bitrateGuidance: "25+ Mbps ProRes/DNxHR",
    loudnessTarget: "N/A (silent preview)",
    enhancementNotes: ["Maximum sharpness", "Print-safe contrast", "4K frame enhancement"],
  },
];

export class VideoEnhancementPlatformOptimizer {
  buildPlatformRules(
    primaryPlatform: VideoEnhancementPlatform,
    videoType: VideoAnalysisType,
    orientation: VideoOrientation
  ): PlatformOptimizationRule[] {
    const rules = PLATFORM_RULES.map((rule) => ({
      ...rule,
      priority: this.priorityFor(rule.platform, primaryPlatform, videoType),
    }));

    if (orientation === VideoOrientation.Portrait) {
      for (const rule of rules) {
        if (rule.platform === VideoEnhancementPlatform.YouTube) {
          rule.enhancementNotes.push("Consider Shorts vertical variant");
        }
      }
    }

    return rules.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }

  private priorityFor(
    platform: VideoEnhancementPlatform,
    primary: VideoEnhancementPlatform,
    videoType: VideoAnalysisType
  ): "low" | "medium" | "high" {
    if (platform === primary) return "high";
    if (videoType === VideoAnalysisType.SocialMedia) {
      if (
        platform === VideoEnhancementPlatform.Instagram ||
        platform === VideoEnhancementPlatform.TikTok ||
        platform === VideoEnhancementPlatform.Facebook
      ) {
        return "medium";
      }
    }
    if (videoType === VideoAnalysisType.Tutorial && platform === VideoEnhancementPlatform.YouTube) {
      return "medium";
    }
    if (videoType === VideoAnalysisType.Commercial && platform === VideoEnhancementPlatform.Website) {
      return "medium";
    }
    return "low";
  }
}
