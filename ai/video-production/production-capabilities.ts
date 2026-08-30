/**
 * Server-side production capability detection (Node only).
 */
import { ffmpegAvailable } from "./ffmpeg-renderer.js";
import {
  cinematicProviderConfigured,
  MODE_COPY,
  type ProductionModeCapability,
} from "./production-mode-types.js";

export type { CreativeToneId, ProductionModeCapability, ProductionModeId } from "./production-mode-types.js";
export { recommendCreativeTone, recommendProductionMode } from "./production-mode-types.js";

export async function getProductionCapabilities(opts?: {
  uniqueViewCount?: number;
}): Promise<ProductionModeCapability[]> {
  const ffmpeg = await ffmpegAvailable();
  const cinematic = cinematicProviderConfigured();
  const views = opts?.uniqueViewCount ?? 0;
  const recommendMotion = ffmpeg && views >= 2;

  const modes: ProductionModeCapability[] = [
    {
      mode: "AI_PRODUCT_MOTION",
      ...MODE_COPY.AI_PRODUCT_MOTION,
      available: ffmpeg,
      provider: ffmpeg ? "ffmpeg" : "none",
      reason: ffmpeg
        ? "Uses still-image motion via FFmpeg zoompan, pan, and scale."
        : "FFmpeg is not available on this host.",
      limitations: ffmpeg
        ? ["Uses still-image motion", "Does not generate new camera views"]
        : ["Requires FFmpeg"],
      recommended: recommendMotion,
    },
    {
      mode: "CINEMATIC_3D",
      ...MODE_COPY.CINEMATIC_3D,
      available: cinematic,
      provider: cinematic ? (process.env.KWIZERA_IMAGE_TO_VIDEO_PROVIDER ?? "configured") : "none",
      reason: cinematic
        ? "Image-to-video provider is configured."
        : "Unavailable — no configured 3D or image-to-video provider.",
      limitations: cinematic
        ? ["Provider-dependent quality and duration limits"]
        : ["No GPU model installed", "No image-to-video provider configured"],
    },
    {
      mode: "CLASSIC_SHOWCASE",
      ...MODE_COPY.CLASSIC_SHOWCASE,
      available: ffmpeg,
      provider: ffmpeg ? "ffmpeg" : "none",
      reason: ffmpeg
        ? "Uses FFmpeg still-to-video with conservative motion and transitions."
        : "FFmpeg is not available on this host.",
      limitations: ffmpeg
        ? ["Conservative motion", "Original photographs remain visually primary"]
        : ["Requires FFmpeg"],
      recommended: ffmpeg && !recommendMotion,
    },
  ];

  if (modes.filter((m) => m.recommended).length !== 1) {
    const pick = modes.find((m) => m.mode === "AI_PRODUCT_MOTION" && m.available)
      ?? modes.find((m) => m.available);
    for (const m of modes) m.recommended = m.mode === pick?.mode;
  }

  return modes;
}
