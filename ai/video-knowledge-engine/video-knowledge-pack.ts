/**
 * Curated, versioned Video Knowledge Pack — reusable principles for KWIZERA decisions.
 * Deterministic system constraints always win over these recommendations.
 */

export const VIDEO_KNOWLEDGE_PACK_VERSION = "video-knowledge-pack-v1";

export type VideoKnowledgeCategory =
  | "storytelling"
  | "hook"
  | "reveal"
  | "sequencing"
  | "camera"
  | "motion"
  | "transition"
  | "pacing"
  | "audio"
  | "typography"
  | "cta"
  | "end_card"
  | "quality"
  | "ecommerce"
  | "social";

export interface VideoKnowledgeItem {
  id: string;
  category: VideoKnowledgeCategory;
  topic: string;
  rule: string;
  principle: string;
  conditions: string[];
  recommendation: string;
  /** Maps only to real Engine1 capabilities when set */
  supportedExecution?: {
    motionHint?: "PRODUCT_FOCUS" | "DETAIL_PUSH" | "SUBTLE_PUSH" | "HOLD";
    transitionHint?: "cut" | "fade";
    skillId?: string;
  };
  priority: "high" | "medium" | "low";
  confidence: number;
  sourceType: "curated";
  sourceReference: typeof VIDEO_KNOWLEDGE_PACK_VERSION;
  version: string;
}

const PACK: VideoKnowledgeItem[] = [
  {
    id: "vk-hook-01",
    category: "hook",
    topic: "opening_hook",
    rule: "Open with the clearest hero product view in the first 2–3 seconds.",
    principle: "Retention depends on immediate product recognition.",
    conditions: ["hero asset available", "short-form or social duration"],
    recommendation: "Use the highest-quality front/hero asset for HOOK purpose.",
    supportedExecution: { motionHint: "PRODUCT_FOCUS", transitionHint: "cut", skillId: "hero-product-reveal" },
    priority: "high",
    confidence: 0.92,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-reveal-01",
    category: "reveal",
    topic: "product_reveal",
    rule: "Use a controlled push-in for hero reveal when scene duration is at least 2.5s.",
    principle: "Reveal motion must remain product-safe and readable.",
    conditions: ["hero product", "high visual importance", "duration >= 2.5s"],
    recommendation: "Map reveal to PRODUCT_FOCUS / subtle push — never invent unsupported camera FX.",
    supportedExecution: { motionHint: "PRODUCT_FOCUS", skillId: "hero-product-reveal" },
    priority: "high",
    confidence: 0.9,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-seq-01",
    category: "sequencing",
    topic: "image_sequence",
    rule: "Sequence: hook → reveal → feature/detail → offer/CTA.",
    principle: "Information hierarchy beats random slideshow order.",
    conditions: ["2+ product images"],
    recommendation: "Order assets by role: FRONT/hero, DETAIL, OTHER angles, packaging last.",
    supportedExecution: { skillId: "product-feature-showcase" },
    priority: "high",
    confidence: 0.88,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-trans-01",
    category: "transition",
    topic: "supported_transitions",
    rule: "Only use cut or fade transitions in Engine1 production.",
    principle: "Unsupported transitions must not be fabricated.",
    conditions: ["any multi-scene plan"],
    recommendation: "Prefer cut for energetic pacing; fade for endings and calmer tones.",
    supportedExecution: { transitionHint: "cut" },
    priority: "high",
    confidence: 1,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-trans-02",
    category: "transition",
    topic: "transition_overuse",
    rule: "Do not change image on every beat.",
    principle: "Beat alignment is selective — readability and product clarity win.",
    conditions: ["audio beat plan present"],
    recommendation: "Align only hero reveal or major cuts to strong beats when duration allows.",
    priority: "high",
    confidence: 0.9,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-pace-01",
    category: "pacing",
    topic: "scene_duration",
    rule: "Keep scene durations within production minimums (typically >= 2s).",
    principle: "Ultra-short scenes harm comprehension on product videos.",
    conditions: ["any plan"],
    recommendation: "Reject sub-minimum AI duration suggestions; use deterministic clamps.",
    priority: "high",
    confidence: 1,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-cta-01",
    category: "cta",
    topic: "final_cta",
    rule: "Reserve the final beat for CTA/offer with readable dwell time.",
    principle: "CTA needs stable framing and minimum on-screen duration.",
    conditions: ["CTA or offer present"],
    recommendation: "Use CTA/OFFER purpose near end; prefer fade into end card.",
    supportedExecution: { transitionHint: "fade", skillId: "final-cta" },
    priority: "high",
    confidence: 0.91,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-end-01",
    category: "end_card",
    topic: "end_card",
    rule: "End with the existing brand end-card system — do not invent alternate enders.",
    principle: "Canonical end card preserves brand consistency.",
    conditions: ["AI_PRODUCT_MOTION / Engine1"],
    recommendation: "Defer end-card execution to existing VideoProductionManager end-card path.",
    supportedExecution: { skillId: "final-cta" },
    priority: "high",
    confidence: 1,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-audio-01",
    category: "audio",
    topic: "energy_pacing",
    rule: "Match motion intensity to audio energy without cutting every beat.",
    principle: "Energy rises allow stronger emphasis; drops prefer calmer holds.",
    conditions: ["audio timeline available"],
    recommendation: "Use existing motion/smart-camera engines; do not invent DSP in the LLM.",
    priority: "medium",
    confidence: 0.85,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-quality-01",
    category: "quality",
    topic: "product_visibility",
    rule: "Never select an asset that is missing, derived-only, or fails visibility gates.",
    principle: "Asset existence is authoritative — AI may only choose from allowed IDs.",
    conditions: ["any AI plan"],
    recommendation: "Validator must strip hallucinated assetIds.",
    priority: "high",
    confidence: 1,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-social-01",
    category: "social",
    topic: "short_form",
    rule: "For short social formats, prioritize hook + one feature + CTA.",
    principle: "Fewer scenes with clarity beat overcrowded timelines.",
    conditions: ["duration <= 20s", "tiktok/reels/shorts"],
    recommendation: "Cap scene count; keep text minimal and readable.",
    priority: "medium",
    confidence: 0.86,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
  {
    id: "vk-typo-01",
    category: "typography",
    topic: "readability",
    rule: "Do not override typography dwell times with aggressive motion.",
    principle: "Text readability is a hard constraint in Engine1.",
    conditions: ["on-screen text or CTA"],
    recommendation: "Prefer HOLD/SUBTLE_PUSH when text is active.",
    supportedExecution: { motionHint: "HOLD" },
    priority: "high",
    confidence: 0.93,
    sourceType: "curated",
    sourceReference: VIDEO_KNOWLEDGE_PACK_VERSION,
    version: VIDEO_KNOWLEDGE_PACK_VERSION,
  },
];

export const VIDEO_KNOWLEDGE_PACK: readonly VideoKnowledgeItem[] = PACK;

export function listVideoKnowledgePack(): VideoKnowledgeItem[] {
  return [...PACK];
}

export function getVideoKnowledgePackMeta(): { version: string; count: number } {
  return { version: VIDEO_KNOWLEDGE_PACK_VERSION, count: PACK.length };
}

/** Lightweight keyword retrieval — no LLM required. */
export function retrieveVideoKnowledge(task: string, limit = 6): VideoKnowledgeItem[] {
  const q = task.toLowerCase();
  const scored = PACK.map((item) => {
    const hay = [
      item.category,
      item.topic,
      item.rule,
      item.principle,
      item.recommendation,
      ...item.conditions,
    ].join(" ").toLowerCase();
    let score = 0;
    for (const token of q.split(/[^a-z0-9]+/).filter((t) => t.length > 2)) {
      if (hay.includes(token)) score += 1;
    }
    if (item.priority === "high") score += 0.25;
    score += item.confidence * 0.1;
    return { item, score };
  });
  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

/** Compact bullets safe to inject into tiny-model prompts. */
export function formatKnowledgeForPrompt(items: VideoKnowledgeItem[], max = 5): string[] {
  return items.slice(0, max).map((item) =>
    `[${item.category}] ${item.rule}${item.supportedExecution?.transitionHint
      ? ` (transition:${item.supportedExecution.transitionHint})`
      : ""}${item.supportedExecution?.motionHint
      ? ` (motion:${item.supportedExecution.motionHint})`
      : ""}`);
}
