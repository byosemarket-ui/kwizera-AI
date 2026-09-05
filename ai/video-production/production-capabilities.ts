/**
 * Server-side production capability detection (Node only).
 */
import { ffmpegAvailable } from "./ffmpeg-renderer.js";
import {
  cinematicProviderConfigured,
  MODE_COPY,
  type ProductionModeCapability,
} from "./production-mode-types.js";
import { getCompositionDiagnostics } from "./scene-composition.js";
import { getEndCardDiagnostics } from "./end-card.js";

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
        ? ["Uses still-image motion", "STEP 9–11 framing, composition, end card", "Does not generate new camera views"]
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

/** STEP 9 — lightweight smart-camera diagnostics (no secrets / no absolute paths). */
export function getSmartCameraDiagnostics(input?: {
  sceneCount?: number;
  plansWithFallback?: number;
  formatsSupported?: string[];
}) {
  return {
    smartCameraAvailable: true,
    version: "step9-smart-camera-v1",
    supportedFormats: input?.formatsSupported ?? ["9:16", "16:9", "1:1", "4:5"],
    sceneCameraPlanStatus: typeof input?.sceneCount === "number" ? `${input.sceneCount} planned` : "idle",
    fallbackUsage: typeof input?.plansWithFallback === "number" ? input.plansWithFallback : 0,
    rendererCompatibility: "ffmpeg-still-zoompan",
    notes: [
      "STEP 8 decides motion intent; STEP 9 decides safe subject-aware crop/zoom for the selected format.",
      "Uses STEP 6 framing bounds when available; otherwise deterministic full-product fallback.",
    ],
  };
}

/** STEP 10 — composition diagnostics (handoff to typography + timeline). */
export function getSceneCompositionDiagnostics(input?: {
  sceneCount?: number;
  invalidCount?: number;
}) {
  return getCompositionDiagnostics(input);
}

/** STEP 11 — ENGINE 1 end card + final validation diagnostics. */
export function getEngine1FinalDiagnostics(input?: {
  endCardRendered?: boolean;
  endCardDurationMs?: number;
}) {
  return {
    engine1FinalAvailable: true,
    version: "step11-engine1-final-v1",
    selectedEngine: "AI_PRODUCT_MOTION",
    endCard: getEndCardDiagnostics({
      rendered: input?.endCardRendered,
      durationMs: input?.endCardDurationMs,
    }),
    outputValidation: {
      probeRequired: true,
      diskVerifyRequired: true,
      falseReadyPrevention: true,
      endCardRequiredForStandard: true,
    },
    notes: [
      "STEP 11 finalizes ENGINE 1 via the existing FFmpeg pipeline with a professional end card.",
      "Video Ready is only set after probe + output validation + registration + disk verification.",
      "ENGINE 2 and ENGINE 3 remain future work.",
    ],
  };
}

/** STEP 12 — workspace integration diagnostics (progress, READY gate, player handoff). */
export function getWorkspaceIntegrationDiagnostics() {
  return {
    workspaceIntegrationAvailable: true,
    version: "step12-workspace-final-v1",
    progressModel: "job-stage-backed",
    readyGate: "metadata+reachable+validated",
    duplicateRenderProtection: "RENDER_IN_PROGRESS-409",
    playerHandoff: "cache-busted-output-url",
    rangeServing: true,
    concurrency: "single-flight-global",
    notes: [
      "STEP 12 integrates STEP 6–11 into the STEP 4 Final Review workspace.",
      "Progress reaches 100% only after output validation and reachable player URL.",
      "ENGINE 2 and ENGINE 3 remain future work.",
    ],
  };
}
