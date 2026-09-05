/**
 * OllamaCreativeAdvisor — structured recommendations for KWIZERA decisions.
 * Never executes FFmpeg / filesystem / shell. Falls back deterministically.
 */
import { getOllamaAdapter, type OllamaHealthReport } from "../ai-provider/ollama-adapter.js";
import {
  buildAiCacheKey,
  getCachedAiResult,
  setCachedAiResult,
} from "../ai-provider/ai-response-cache.js";
import {
  formatKnowledgeForPrompt,
  getVideoKnowledgePackMeta,
  retrieveVideoKnowledge,
} from "../video-knowledge-engine/video-knowledge-pack.js";
import {
  mapTransitionToSupported,
  selectApplicableSkills,
  VIDEO_SKILLS_VERSION,
  type ApplicableSkillResult,
} from "../video-skills/video-skills.js";

export const CREATIVE_ADVISOR_VERSION = "ollama-creative-advisor-v1";
const ADVISOR_PROMPT_VERSION = "advisor-prompt-v1";

export type AdvisorConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ProductCreativeAnalysis {
  productType: string;
  targetAudience: string;
  visualStyle: string;
  recommendedPacing: string;
  recommendedMotion: string;
  recommendedSceneStructure: string[];
  recommendedTransitions: Array<"cut" | "fade">;
  imageSequenceHint: string[];
  confidence: number;
  confidenceBand: AdvisorConfidence;
  knowledgeVersion: string;
  skillsVersion: string;
  appliedSkillIds: string[];
  source: "ollama" | "deterministic-fallback";
  model: string | null;
  latencyMs: number;
  limitations: string[];
}

export interface AdvisorContext {
  projectId: string;
  productName: string;
  category?: string;
  description?: string;
  audience?: string;
  platform?: string;
  durationSeconds?: number;
  cta?: string;
  tone?: string;
  brandName?: string;
  marketingObjective?: string;
  bpm?: number | null;
  energy?: string | null;
  creativeMode?: string | null;
  assetSummaries: Array<{ assetId: string; fileName: string; viewRole?: string }>;
}

/** Normalize API / UI payloads into AdvisorContext (project-isolated). */
export function normalizeAdvisorContext(input: {
  projectId: string;
  productName?: string;
  productCategory?: string;
  category?: string;
  brandName?: string;
  targetAudience?: string;
  audience?: string;
  marketingObjective?: string;
  description?: string;
  platform?: string;
  durationSeconds?: number;
  cta?: string;
  tone?: string;
  creativeMode?: string | null;
  bpm?: number | null;
  energy?: string | null;
  imageRoles?: string[];
  assetSummaries?: Array<{ assetId: string; fileName?: string; viewRole?: string }>;
}): AdvisorContext {
  const roles = Array.isArray(input.imageRoles) ? input.imageRoles.map(String) : [];
  const assets = Array.isArray(input.assetSummaries) && input.assetSummaries.length
    ? input.assetSummaries.map((a, i) => ({
      assetId: String(a.assetId),
      fileName: String(a.fileName ?? `asset-${i + 1}`),
      viewRole: a.viewRole ? String(a.viewRole) : roles[i],
    }))
    : roles.map((role, i) => ({
      assetId: `role-${i + 1}`,
      fileName: `image-${i + 1}`,
      viewRole: role,
    }));

  return {
    projectId: String(input.projectId).trim(),
    productName: String(input.productName ?? "Product").slice(0, 120),
    category: input.productCategory ?? input.category,
    description: input.description ?? input.marketingObjective,
    audience: input.targetAudience ?? input.audience,
    platform: input.platform,
    durationSeconds: input.durationSeconds,
    cta: input.cta,
    tone: input.tone ?? input.creativeMode ?? undefined,
    brandName: input.brandName,
    marketingObjective: input.marketingObjective,
    bpm: input.bpm ?? null,
    energy: input.energy ?? null,
    creativeMode: input.creativeMode ?? null,
    assetSummaries: assets,
  };
}

function confidenceBand(score: number): AdvisorConfidence {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

function deterministicAnalysis(ctx: AdvisorContext, skills: ApplicableSkillResult[]): ProductCreativeAnalysis {
  const assets = ctx.assetSummaries;
  const structure = ["HOOK", "REVEAL"];
  if (assets.length >= 2) structure.push("FEATURE");
  if (assets.length >= 3) structure.push("DETAIL");
  if (ctx.cta) structure.push("CTA");
  else structure.push("OFFER");

  const transitions = structure.map((_, i) =>
    i === structure.length - 1 ? "fade" as const : mapTransitionToSupported(ctx.tone),
  );

  const sequence = [...assets]
    .sort((a, b) => {
      const rank = (role?: string) => {
        const r = (role ?? "").toUpperCase();
        if (r === "FRONT" || r === "HERO") return 0;
        if (r === "DETAIL" || r === "CLOSE_UP") return 2;
        if (r === "PACKAGING") return 4;
        return 1;
      };
      return rank(a.viewRole) - rank(b.viewRole);
    })
    .map((a) => a.assetId);

  return {
    productType: ctx.category || "General product",
    targetAudience: ctx.audience || "General shoppers",
    visualStyle: ctx.tone || "Clean product-focused presentation",
    recommendedPacing: (ctx.durationSeconds ?? 15) <= 15 ? "tight-social" : "standard",
    recommendedMotion: "PRODUCT_FOCUS with detail push on FEATURE scenes",
    recommendedSceneStructure: structure,
    recommendedTransitions: transitions,
    imageSequenceHint: sequence,
    confidence: 0.72,
    confidenceBand: "MEDIUM",
    knowledgeVersion: getVideoKnowledgePackMeta().version,
    skillsVersion: VIDEO_SKILLS_VERSION,
    appliedSkillIds: skills.map((s) => s.skill.id),
    source: "deterministic-fallback",
    model: null,
    latencyMs: 0,
    limitations: [
      "Deterministic advisor used (Ollama unavailable, invalid, or low confidence).",
      "Text-only models do not visually see images — roles come from Image Intelligence metadata.",
    ],
  };
}

function validateAnalysis(
  raw: Record<string, unknown>,
  ctx: AdvisorContext,
  skills: ApplicableSkillResult[],
  model: string | null,
  latencyMs: number,
): ProductCreativeAnalysis | null {
  const allowedIds = new Set(ctx.assetSummaries.map((a) => a.assetId));
  const structure = Array.isArray(raw.recommendedSceneStructure)
    ? raw.recommendedSceneStructure.map(String).slice(0, 8)
    : null;
  if (!structure?.length) return null;

  const sequenceRaw = Array.isArray(raw.imageSequenceHint)
    ? raw.imageSequenceHint.map(String)
    : [];
  const sequence = sequenceRaw.filter((id) => allowedIds.has(id));
  // If AI hallucinated all IDs, reject for fallback.
  if (sequenceRaw.length && sequence.length === 0) return null;

  const transitions = (Array.isArray(raw.recommendedTransitions) ? raw.recommendedTransitions : [])
    .map((t) => mapTransitionToSupported(String(t)));
  while (transitions.length < structure.length) {
    transitions.push(transitions.length === structure.length - 1 ? "fade" : "cut");
  }

  const confidence = typeof raw.confidence === "number"
    ? Math.max(0, Math.min(1, raw.confidence))
    : 0.6;

  return {
    productType: String(raw.productType || ctx.category || "General product").slice(0, 80),
    targetAudience: String(raw.targetAudience || ctx.audience || "General shoppers").slice(0, 120),
    visualStyle: String(raw.visualStyle || "Product-focused").slice(0, 120),
    recommendedPacing: String(raw.recommendedPacing || "standard").slice(0, 60),
    recommendedMotion: String(raw.recommendedMotion || "PRODUCT_FOCUS").slice(0, 120),
    recommendedSceneStructure: structure,
    recommendedTransitions: transitions.slice(0, structure.length) as Array<"cut" | "fade">,
    imageSequenceHint: sequence.length ? sequence : ctx.assetSummaries.map((a) => a.assetId),
    confidence,
    confidenceBand: confidenceBand(confidence),
    knowledgeVersion: getVideoKnowledgePackMeta().version,
    skillsVersion: VIDEO_SKILLS_VERSION,
    appliedSkillIds: skills.map((s) => s.skill.id),
    source: "ollama",
    model,
    latencyMs,
    limitations: [
      "llama text models do not see pixels; image roles must come from Image Intelligence.",
      "Transitions clamped to cut/fade only.",
    ],
  };
}

export class OllamaCreativeAdvisor {
  readonly version = CREATIVE_ADVISOR_VERSION;

  async health(): Promise<OllamaHealthReport> {
    return getOllamaAdapter().health({ probeInference: true });
  }

  async analyzeProductForVideo(ctx: AdvisorContext): Promise<ProductCreativeAnalysis> {
    const skills = selectApplicableSkills({
      task: `${ctx.category ?? ""} ${ctx.platform ?? ""} product marketing video ${ctx.tone ?? ""}`,
      hasCta: Boolean(ctx.cta),
      imageCount: ctx.assetSummaries.length,
      tone: ctx.tone,
    });

    const knowledge = retrieveVideoKnowledge(
      `${ctx.category ?? ""} hook reveal sequencing transition cta ${ctx.platform ?? ""} ${ctx.energy ?? ""}`,
      5,
    );
    const knowledgeLines = formatKnowledgeForPrompt(knowledge, 5);

    if (!ctx.projectId) {
      return {
        ...deterministicAnalysis(ctx, skills),
        limitations: ["PROJECT_CONTEXT_MISSING — deterministic fallback."],
      };
    }

    // Role-only stubs are OK for advisor (text model cannot see pixels).
    const assetsForPrompt = ctx.assetSummaries.length
      ? ctx.assetSummaries.slice(0, 6)
      : [{ assetId: "pending-asset", fileName: "pending", viewRole: "HERO" }];

    const prompt = [
      "KWIZERA Creative Advisor. Return JSON only.",
      "Do not invent asset IDs. Do not invent transitions other than cut or fade.",
      "You cannot see images — use roles/metadata only.",
      `Schema:{"productType":"string","targetAudience":"string","visualStyle":"string","recommendedPacing":"string","recommendedMotion":"string","recommendedSceneStructure":["HOOK"],"recommendedTransitions":["cut"],"imageSequenceHint":["asset-id"],"confidence":0.0}`,
      "Knowledge:",
      ...knowledgeLines,
      "Skills:",
      ...skills.map((s) => `${s.skill.id}: ${s.skill.execution.motionHint ?? ""} ${s.skill.execution.transitionHint ?? ""}`),
      "Context:",
      JSON.stringify({
        projectId: ctx.projectId,
        productName: ctx.productName,
        brandName: ctx.brandName,
        category: ctx.category,
        description: (ctx.description ?? "").slice(0, 160),
        audience: ctx.audience,
        objective: (ctx.marketingObjective ?? "").slice(0, 120),
        platform: ctx.platform,
        durationSeconds: ctx.durationSeconds,
        cta: ctx.cta,
        tone: ctx.tone,
        bpm: ctx.bpm,
        energy: ctx.energy,
        creativeMode: ctx.creativeMode,
        assets: assetsForPrompt,
      }),
    ].join("\n");

    const cacheKey = buildAiCacheKey({
      task: "analyzeProductForVideo",
      model: getOllamaAdapter().getPreferredModel(),
      promptVersion: ADVISOR_PROMPT_VERSION,
      projectId: ctx.projectId,
      contextVersion: [
        ctx.productName,
        ctx.category ?? "",
        ctx.audience ?? "",
        String(ctx.assetSummaries.length),
        ctx.energy ?? "",
        ctx.creativeMode ?? "",
      ].join(":"),
      knowledgeVersion: getVideoKnowledgePackMeta().version,
    });
    const cached = getCachedAiResult<ProductCreativeAnalysis>(cacheKey);
    if (cached) {
      console.info("[OLLAMA_CREATIVE_ADVISOR]", { phase: "cache_hit", projectId: ctx.projectId });
      return cached;
    }

    const generated = await getOllamaAdapter().generateStructured({
      prompt,
      timeoutMs: Math.min(90_000, Number(process.env.KWIZERA_OLLAMA_ADVISOR_TIMEOUT_MS) || 60_000),
      options: { temperature: 0.15, num_ctx: 1536, num_predict: 280 },
    });

    if (!generated.ok || !generated.data) {
      console.info("[OLLAMA_CREATIVE_ADVISOR]", {
        phase: "fallback",
        projectId: ctx.projectId,
        code: generated.code,
        error: generated.error,
      });
      return deterministicAnalysis(ctx, skills);
    }

    const validated = validateAnalysis(
      generated.data,
      ctx,
      skills,
      generated.model,
      generated.latencyMs,
    );

    if (!validated || validated.confidenceBand === "LOW") {
      console.info("[OLLAMA_CREATIVE_ADVISOR]", {
        phase: "low_confidence_or_invalid",
        projectId: ctx.projectId,
        model: generated.model,
        latencyMs: generated.latencyMs,
      });
      return deterministicAnalysis(ctx, skills);
    }

    console.info("[OLLAMA_CREATIVE_ADVISOR]", {
      phase: "ok",
      projectId: ctx.projectId,
      model: generated.model,
      latencyMs: generated.latencyMs,
      confidence: validated.confidence,
      skills: validated.appliedSkillIds,
      knowledgeVersion: validated.knowledgeVersion,
    });
    setCachedAiResult(cacheKey, validated);
    return validated;
  }
}

export const ollamaCreativeAdvisor = new OllamaCreativeAdvisor();
