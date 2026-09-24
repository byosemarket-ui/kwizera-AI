/**
 * Shared Creative Director prompt + compact context for Admin-routed and local LLM providers.
 * Product identity lock constraints are included when available — never invent product facts.
 */
import type { AiCreativePlannerInput } from "./ai-creative-planner.js";
import { buildProjectIntelligenceContext } from "./project-intelligence-context.js";

export interface CreativeIdentityLockContext {
  status?: string;
  locked?: boolean;
  protectedAttributes?: string[];
  allowedCreativeChanges?: string[];
  heroAssetId?: string | null;
  productName?: string;
  category?: string;
  colors?: string[];
  materials?: string[];
  distinctiveDetails?: string[];
}

export async function buildCreativeDirectorContext(
  input: AiCreativePlannerInput,
): Promise<Record<string, unknown>> {
  const full = buildProjectIntelligenceContext(input);
  const task = [
    full.product.category,
    full.marketing.platform,
    full.style.creativeTone,
    "product marketing video hook reveal",
  ].filter(Boolean).join(" ");

  const {
    formatKnowledgeForPrompt,
    retrieveVideoKnowledge,
  } = await import("../video-knowledge-engine/video-knowledge-pack.js");
  const { selectApplicableSkills } = await import("../video-skills/video-skills.js");
  const knowledge = retrieveVideoKnowledge(task, 4);
  const skills = selectApplicableSkills({
    task,
    hasCta: Boolean(full.marketing.cta),
    imageCount: full.assets.length,
    tone: full.style.creativeTone,
  });

  let learnedPatterns: Array<{ patternId: string; statement: string; confidence: number }> = [];
  try {
    const { getIntelligenceLayer } = await import("../intelligence-layer/index.js");
    const layer = getIntelligenceLayer();
    if (layer.isReady()) {
      learnedPatterns = layer.getPatterns({ projectId: full.projectId, minConfidence: 0.55 })
        .filter((p) => p.promoted)
        .slice(0, 3)
        .map((p) => ({
          patternId: p.patternId,
          statement: p.statement.slice(0, 140),
          confidence: p.confidence,
        }));
    }
  } catch {
    /* optional */
  }

  const lock = input.productIdentityLock;

  return {
    projectId: full.projectId,
    product: {
      name: full.product.name,
      category: full.product.category,
      description: (full.product.description || "").slice(0, 160),
      price: full.product.price,
      originalPrice: full.product.originalPrice,
      currency: full.product.currency,
    },
    marketing: {
      goal: full.marketing.goal,
      audience: full.marketing.audience,
      platform: full.marketing.platform,
      durationSeconds: full.marketing.durationSeconds,
      language: full.marketing.language,
      cta: full.marketing.cta,
    },
    style: full.style,
    assetIds: full.constraints.mustUseOnlyAssetIds.slice(0, 6),
    assets: full.assets.slice(0, 6).map((a) => ({
      assetId: a.assetId,
      viewRole: a.viewRole,
      qualityScore: a.qualityScore,
    })),
    verifiedFacts: {
      allowedFacts: full.verifiedFacts.allowedFacts.slice(0, 10),
      unknownFacts: full.verifiedFacts.unknownFacts.slice(0, 6),
      priceAllowed: full.verifiedFacts.priceAllowed,
    },
    productIdentityLock: lock
      ? {
          locked: Boolean(lock.locked),
          status: lock.status ?? null,
          protectedAttributes: (lock.protectedAttributes ?? []).slice(0, 16),
          allowedCreativeChanges: (lock.allowedCreativeChanges ?? []).slice(0, 16),
          heroAssetId: lock.heroAssetId ?? null,
          productName: lock.productName ?? null,
          category: lock.category ?? null,
          colors: (lock.colors ?? []).slice(0, 6),
          materials: (lock.materials ?? []).slice(0, 6),
          distinctiveDetails: (lock.distinctiveDetails ?? []).slice(0, 8),
        }
      : { locked: false, note: "No product identity lock attached — do not invent protected product attributes." },
    videoKnowledge: formatKnowledgeForPrompt(knowledge, 4),
    videoSkills: skills.slice(0, 4).map((s) => ({
      id: s.skill.id,
      motion: s.skill.execution.motionHint ?? null,
      transition: s.skill.execution.transitionHint ?? null,
    })),
    learnedPatterns,
  };
}

export function buildCreativeDirectorSystemInstructions(): string {
  return [
    "You are the Creative Director for KWIZERA AI STUDIO Product Marketing Video.",
    "Reply with JSON only — no markdown fences, no essay.",
    "Use only supplied product facts. Do not invent prices, certifications, or product attributes.",
    "Respect productIdentityLock: never change protected attributes (shape, color, logo, material, texture, pattern, sole, laces, design).",
    "You MAY propose background, lighting, camera, motion, atmosphere, composition, typography, and scene order.",
    "Use only listed assetIds. Transitions: cut or fade only.",
    "Keep the real product recognizable and commercially coherent.",
  ].join(" ");
}

export function buildCreativeDirectorUserPrompt(context: Record<string, unknown>): string {
  const projectId = String(context.projectId ?? "");
  const assetIds = Array.isArray(context.assetIds) ? context.assetIds as string[] : [];
  const first = assetIds[0] ?? "asset-required";
  const second = assetIds[Math.min(1, Math.max(0, assetIds.length - 1))] ?? first;
  return [
    "Produce a structured creative plan JSON matching this schema:",
    `{"projectId":"${projectId}","creativeDirection":"product-first","primarySellingPoint":"clear benefit","textStrategy":{"headline":"name","price":"","cta":"Shop"},"scenes":[{"id":"scene-1","purpose":"HOOK","assetId":"${first}","duration":3,"camera":"slow push","motion":"subtle zoom","narration":"","transitionOut":"cut","backgroundStrategy":"keep product"},{"id":"scene-2","purpose":"REVEAL","assetId":"${second}","duration":3,"camera":"hold","motion":"hold","narration":"","transitionOut":"fade","backgroundStrategy":"keep product"}]}`,
    "Context:",
    JSON.stringify({
      projectId: context.projectId,
      product: context.product,
      marketing: context.marketing,
      style: context.style,
      assets: context.assets,
      verifiedFacts: context.verifiedFacts,
      productIdentityLock: context.productIdentityLock,
      learned: context.learnedPatterns,
    }),
  ].join("\n");
}

/** Extract a safe identity-lock summary from project workspace settings (if present). */
export function extractIdentityLockFromProject(
  workspaceSettings: Record<string, unknown> | undefined | null,
): CreativeIdentityLockContext | undefined {
  if (!workspaceSettings || typeof workspaceSettings !== "object") return undefined;
  const raw = workspaceSettings.productIdentityLock;
  if (!raw || typeof raw !== "object") return undefined;
  const lock = raw as Record<string, unknown>;
  const status = typeof lock.status === "string" ? lock.status : undefined;
  const locked = status === "LOCKED" || lock.locked === true;
  const protectedAttributes = Array.isArray(lock.protectedAttributes)
    ? lock.protectedAttributes.filter((item): item is string => typeof item === "string")
    : undefined;
  const allowedCreativeChanges = Array.isArray(lock.allowedCreativeChanges)
    ? lock.allowedCreativeChanges.filter((item): item is string => typeof item === "string")
    : undefined;

  const pickAttr = (key: string): string | undefined => {
    const attr = lock[key];
    if (attr && typeof attr === "object" && typeof (attr as { value?: unknown }).value === "string") {
      return String((attr as { value: string }).value).trim() || undefined;
    }
    return undefined;
  };

  const colors = Array.isArray(lock.colors)
    ? lock.colors
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && typeof (item as { value?: unknown }).value === "string") {
            return String((item as { value: string }).value);
          }
          return "";
        })
        .filter(Boolean)
    : undefined;

  return {
    status,
    locked,
    protectedAttributes,
    allowedCreativeChanges,
    heroAssetId: typeof lock.heroAssetId === "string" ? lock.heroAssetId : null,
    productName: pickAttr("productName") ?? (typeof lock.productName === "string" ? lock.productName : undefined),
    category: pickAttr("category") ?? (typeof lock.category === "string" ? lock.category : undefined),
    colors,
    materials: pickAttr("material") ? [pickAttr("material")!] : undefined,
    distinctiveDetails: pickAttr("distinctiveDetails")
      ? [pickAttr("distinctiveDetails")!]
      : undefined,
  };
}
