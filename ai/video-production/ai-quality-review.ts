/**
 * Step 7 — Post-render quality review (deterministic + optional Ollama assist).
 * Technical validation must pass before this runs. Suggestions do not block READY.
 */
import {
  fetchOllamaTags,
  ollamaBaseUrl,
  ollamaGenerateJson,
  ollamaTimeoutMs,
  parseJsonObject,
  preferredReasoningModelId,
  selectPreferredReasoningModel,
} from "../ai-provider/ollama-client.js";
import type { CreativePlan } from "../creative-planning/creative-planning-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { QualityReviewResult } from "../ai-director/ai-director-types.js";
import type { ProbedVideo } from "./ffmpeg-renderer.js";
import type { VideoProject } from "./types.js";
import { buildCreativeQualityReport } from "./creative-quality-report.js";

export function runDeterministicQualityReview(input: {
  video: VideoProject;
  plan: CreativePlan | null;
  project: CreativeProject;
  probed: ProbedVideo;
  technicalChecks: Record<string, boolean>;
}): QualityReviewResult {
  const suggestions: string[] = [];
  const checks: Record<string, boolean> = { ...input.technicalChecks };
  const scenes = input.plan?.scenes ?? input.video.timeline.map((clip) => ({
    purpose: clip.purpose,
    assetId: clip.assetId,
    order: clip.order,
  }));
  const sceneList = scenes ?? [];

  checks.productShownEarly = sceneList.length > 0 && Boolean(sceneList[0]?.assetId);
  if (!checks.productShownEarly) suggestions.push("Open with a clear product hero shot.");

  checks.hasCtaScene = sceneList.some((s) => /cta|call/i.test(s.purpose))
    || Boolean(input.plan?.callToAction?.trim());
  if (!checks.hasCtaScene) suggestions.push("Consider ending with a call to action.");

  const hasPrice = input.plan?.commercial?.pricing.currentPrice != null
    || sceneList.some((s) => /price|offer|promo/i.test(s.purpose));
  checks.priceIncludedWhenAvailable = !input.plan?.commercial?.pricing.currentPrice || hasPrice;
  if (!checks.priceIncludedWhenAvailable) {
    suggestions.push("Price is available but no price/offer scene was planned.");
  }

  const plannedMs = input.plan?.timelineDurationMs
    ?? input.video.timeline.reduce((sum, clip) => sum + clip.durationMs, 0);
  checks.durationAligned = plannedMs > 0
    ? Math.abs(input.probed.durationMs - plannedMs) <= Math.max(2500, plannedMs * 0.2)
    : input.probed.durationMs > 500;
  if (!checks.durationAligned) {
    suggestions.push("Rendered duration differs from the planned timeline.");
  }

  checks.sceneCountReasonable = sceneList.length >= 1 && sceneList.length <= 12;
  if (sceneList.length > 8) suggestions.push("Many scenes — pacing may feel rushed on short formats.");

  const passCount = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length || 1;
  const score = Math.round((passCount / total) * 100);

  return {
    score,
    suggestions: suggestions.slice(0, 6),
    checks,
    source: "deterministic",
    reviewedAt: new Date().toISOString(),
    blocking: false,
  };
}

export async function runOptionalAiQualityReview(input: {
  deterministic: QualityReviewResult;
  plan: CreativePlan | null;
  video: VideoProject;
}): Promise<QualityReviewResult | null> {
  const tags = await fetchOllamaTags({ baseUrl: ollamaBaseUrl() });
  if (!tags.ok) return null;
  const model = selectPreferredReasoningModel(tags.models, preferredReasoningModelId());
  if (!model) return null;

  const prompt = [
    "You are a video production quality reviewer. Return JSON only.",
    "Do not invent product facts. Score 0-100. Suggestions only — do not block delivery.",
    JSON.stringify({
      score: 82,
      suggestions: ["string"],
      checks: { productClear: true, ctaPresent: true, pacingOk: true },
    }),
    "Review context:",
    JSON.stringify({
      sceneCount: input.plan?.scenes.length ?? input.video.timeline.length,
      planSource: input.plan?.planSource,
      productionMode: input.plan?.productionMode ?? input.video.productionMode,
      deterministicScore: input.deterministic.score,
      deterministicSuggestions: input.deterministic.suggestions,
    }),
  ].join("\n");

  const generated = await ollamaGenerateJson({
    model,
    prompt,
    timeoutMs: Math.min(ollamaTimeoutMs(), 45_000),
  });
  if (!generated.ok) return null;

  const parsed = parseJsonObject(generated.text);
  if (!parsed) return null;

  const score = typeof parsed.score === "number"
    ? Math.max(0, Math.min(100, Math.round(parsed.score)))
    : input.deterministic.score;
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s): s is string => typeof s === "string").slice(0, 6)
    : input.deterministic.suggestions;
  const checks = typeof parsed.checks === "object" && parsed.checks && !Array.isArray(parsed.checks)
    ? { ...input.deterministic.checks, ...(parsed.checks as Record<string, boolean>) }
    : input.deterministic.checks;

  return {
    score,
    suggestions: suggestions.length ? suggestions : input.deterministic.suggestions,
    checks,
    source: "ai",
    reviewedAt: new Date().toISOString(),
    blocking: false,
  };
}

export async function runFullQualityReview(input: {
  video: VideoProject;
  plan: CreativePlan | null;
  project: CreativeProject;
  probed: ProbedVideo;
  technicalChecks: Record<string, boolean>;
}): Promise<QualityReviewResult> {
  const deterministic = runDeterministicQualityReview(input);
  const planningQuality = buildCreativeQualityReport({
    scenePurposes: (input.plan?.scenes ?? input.video.timeline).map((s) =>
      "purpose" in s ? String(s.purpose) : "FEATURE"),
    durationsSec: input.video.timeline.map((c) => c.durationMs / 1000),
    transitions: input.video.timeline.map((c) => String(c.transitionOut ?? "cut")),
    hasCta: Boolean(input.plan?.callToAction?.trim())
      || input.video.timeline.some((c) => /cta|offer/i.test(c.purpose)),
    hasEndCard: true,
  });
  try {
    const { recordProductionLearning } = await import("../creative-planning/production-learning-loop.js");
    const { getVideoKnowledgePackMeta } = await import("../video-knowledge-engine/video-knowledge-pack.js");
    const { VIDEO_SKILLS_VERSION } = await import("../video-skills/video-skills.js");
    recordProductionLearning({
      projectId: input.project.id,
      createdAt: new Date().toISOString(),
      creativeMode: input.plan?.creativeDirectionSummary ?? input.plan?.creativeTone ?? null,
      sceneDurationsMs: input.video.timeline.map((c) => c.durationMs),
      transitions: input.video.timeline.map((c) => String(c.transitionOut ?? "cut")),
      motions: input.video.timeline.map((c) => String(c.motion ?? "")),
      audioTimingSummary: input.video.audioPlan ? `audioPlan=${JSON.stringify(input.video.audioPlan).slice(0, 120)}` : null,
      qualityScore: Math.min(deterministic.score, planningQuality.score),
      userApproved: null,
      advisorSource: null,
      knowledgeVersion: getVideoKnowledgePackMeta().version,
      skillsVersion: VIDEO_SKILLS_VERSION,
    });
  } catch {
    /* learning loop is best-effort */
  }
  const ai = await runOptionalAiQualityReview({
    deterministic,
    plan: input.plan,
    video: input.video,
  }).catch(() => null);
  return ai ?? deterministic;
}
