/**
 * Product Intelligence API client for PMV Step 2.
 * Requests analysis through existing server routes — no provider credentials.
 */

import type { ProductIntelligenceProfile } from "../../ai/product-intelligence/types";

export interface AnalyzeProductIntelligenceResult {
  ok: boolean;
  profile: ProductIntelligenceProfile | null;
  analysisState: string | null;
  error: string | null;
  unavailable: boolean;
}

function customerSafeError(raw: string): string {
  const text = raw.trim() || "Product analysis failed.";
  if (/api.?key|credential|token|secret|ollama|provider|model.?id/i.test(text)) {
    return "Product analysis is unavailable right now. Try again later or contact support.";
  }
  return text;
}

export async function fetchProductIntelligenceProfile(
  projectId: string,
): Promise<ProductIntelligenceProfile | null> {
  const res = await fetch(`/api/product-intelligence/projects/${encodeURIComponent(projectId)}`);
  if (!res.ok) return null;
  const body = await res.json() as { profile?: ProductIntelligenceProfile | null };
  return body.profile ?? null;
}

export async function analyzeProductIntelligence(
  projectId: string,
): Promise<AnalyzeProductIntelligenceResult> {
  try {
    const res = await fetch(`/api/product-intelligence/projects/${encodeURIComponent(projectId)}/analyze`, {
      method: "POST",
    });
    const body = await res.json() as {
      profile?: ProductIntelligenceProfile;
      analysisState?: string;
      error?: string;
    };
    if (!res.ok) {
      const message = customerSafeError(body.error ?? `Analysis failed (${res.status})`);
      const unavailable = /unavailable|not configured|not found|not initialized/i.test(message);
      return { ok: false, profile: null, analysisState: null, error: message, unavailable };
    }
    const profile = body.profile ?? null;
    if (!profile) {
      return {
        ok: false,
        profile: null,
        analysisState: body.analysisState ?? null,
        error: "No product intelligence profile was returned.",
        unavailable: false,
      };
    }
    return {
      ok: true,
      profile,
      analysisState: body.analysisState ?? profile.analysisState ?? "ready",
      error: null,
      unavailable: profile.aiInferenceStatus === "IMAGE_ANALYSIS_UNAVAILABLE"
        || profile.aiInferenceStatus === "not-configured",
    };
  } catch {
    return {
      ok: false,
      profile: null,
      analysisState: null,
      error: "Could not reach Product Intelligence. Check your connection and try again.",
      unavailable: true,
    };
  }
}
