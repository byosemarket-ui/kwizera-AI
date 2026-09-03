import { getVerifiedFonts, pickFallbackFont } from "./font-registry.js";
import { fetchOllamaTags } from "../ai-provider/ollama-client.js";
import type { PublicTypographyDiagnostics } from "./types.js";

export async function getTypographyDiagnostics(): Promise<PublicTypographyDiagnostics> {
  try {
    const fonts = await getVerifiedFonts();
    const fallback = pickFallbackFont(fonts);
    const tags = await fetchOllamaTags({ timeoutMs: 2500 });
    return {
      ready: Boolean(fallback),
      verifiedFontCount: fonts.length,
      fallbackFontAvailable: Boolean(fallback),
      fallbackFamily: fallback?.family ?? null,
      discoveryOk: fonts.length > 0,
      ollamaAssistAvailable: tags.ok,
      deterministicFallback: true,
      lastError: fallback ? null : "No verified fonts found",
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
      lastError: error instanceof Error ? error.message : "Typography diagnostics failed",
    };
  }
}
