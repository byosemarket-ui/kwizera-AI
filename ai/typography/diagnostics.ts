import { getVerifiedFonts, pickFallbackFont } from "./font-registry.js";
import { fetchOllamaTags } from "../ai-provider/ollama-client.js";
import { ffmpegAvailable } from "../video-production/ffmpeg-renderer.js";
import type { PublicTypographyDiagnostics } from "./types.js";

export async function getTypographyDiagnostics(): Promise<PublicTypographyDiagnostics> {
  try {
    const fonts = await getVerifiedFonts();
    const fallback = pickFallbackFont(fonts);
    const [tags, ffmpeg] = await Promise.all([
      fetchOllamaTags({ timeoutMs: 2500 }),
      ffmpegAvailable(),
    ]);
    return {
      ready: Boolean(fallback) && ffmpeg,
      verifiedFontCount: fonts.length,
      fallbackFontAvailable: Boolean(fallback),
      fallbackFamily: fallback?.family ?? null,
      discoveryOk: fonts.length > 0,
      ollamaAssistAvailable: tags.ok,
      deterministicFallback: true,
      textMeasurementReady: true,
      placementValidationReady: true,
      rendererFontResolutionReady: Boolean(fallback),
      hierarchyEngineReady: true,
      adaptiveSizingReady: true,
      emphasisEngineReady: true,
      contrastEngineReady: true,
      regionAnalysisReady: true,
      lastError: fallback
        ? (ffmpeg ? null : "FFmpeg unavailable")
        : "No verified fonts found",
    };
  } catch (error) {
    return {
      ready: false,
      verifiedFontCount: 0,
      fallbackFontAvailable: false,
      fallbackFamily: null,
      discoveryOk: false,
      ollamaAssistAvailable: false,
      deterministicFallback: true,
      textMeasurementReady: true,
      placementValidationReady: true,
      rendererFontResolutionReady: false,
      hierarchyEngineReady: true,
      adaptiveSizingReady: true,
      emphasisEngineReady: true,
      contrastEngineReady: true,
      regionAnalysisReady: true,
      lastError: error instanceof Error ? error.message : "Typography diagnostics failed",
    };
  }
}
