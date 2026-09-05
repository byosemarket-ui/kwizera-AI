/**
 * Video Skills — reusable strategies that map ONLY to existing Engine1 capabilities.
 * Skills advise; VideoProductionManager / motion / end-card execute.
 */

import {
  retrieveVideoKnowledge,
  type VideoKnowledgeItem,
} from "../video-knowledge-engine/video-knowledge-pack.js";

export const VIDEO_SKILLS_VERSION = "video-skills-v1";

export type VideoSkillId =
  | "hero-product-reveal"
  | "product-feature-showcase"
  | "final-cta"
  | "supported-transition-map"
  | "image-sequence-hierarchy";

export interface VideoSkill {
  id: VideoSkillId;
  name: string;
  description: string;
  inputs: string[];
  /** Execution mapping — never invent unsupported FX */
  execution: {
    scenePurposes?: string[];
    motionHint?: "PRODUCT_FOCUS" | "DETAIL_PUSH" | "SUBTLE_PUSH" | "HOLD";
    transitionHint?: "cut" | "fade";
    usesEndCard?: boolean;
    usesExistingMotionEngine?: boolean;
    usesExistingSmartCamera?: boolean;
  };
  knowledgeTopics: string[];
}

export interface ApplicableSkillResult {
  skill: VideoSkill;
  reason: string;
  knowledgeIds: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

const SKILLS: VideoSkill[] = [
  {
    id: "hero-product-reveal",
    name: "Hero Product Reveal",
    description: "Open/reveal with controlled product-focus push using existing motion engine.",
    inputs: ["hero image", "scene duration", "energy"],
    execution: {
      scenePurposes: ["HOOK", "REVEAL"],
      motionHint: "PRODUCT_FOCUS",
      transitionHint: "cut",
      usesExistingMotionEngine: true,
      usesExistingSmartCamera: true,
    },
    knowledgeTopics: ["product_reveal", "opening_hook"],
  },
  {
    id: "product-feature-showcase",
    name: "Product Feature Showcase",
    description: "Show detail/feature assets with moderate motion and readable pacing.",
    inputs: ["feature image", "text", "audio energy"],
    execution: {
      scenePurposes: ["FEATURE", "DETAIL"],
      motionHint: "DETAIL_PUSH",
      transitionHint: "cut",
      usesExistingMotionEngine: true,
    },
    knowledgeTopics: ["image_sequence", "readability"],
  },
  {
    id: "final-cta",
    name: "Final CTA",
    description: "Close with CTA/offer scene and existing end-card system.",
    inputs: ["CTA", "brand", "audio ending"],
    execution: {
      scenePurposes: ["OFFER", "CTA"],
      motionHint: "HOLD",
      transitionHint: "fade",
      usesEndCard: true,
    },
    knowledgeTopics: ["final_cta", "end_card"],
  },
  {
    id: "supported-transition-map",
    name: "Supported Transition Map",
    description: "Map conceptual transitions only to cut/fade (Engine1).",
    inputs: ["tone", "scene index"],
    execution: {
      transitionHint: "cut",
    },
    knowledgeTopics: ["supported_transitions", "transition_overuse"],
  },
  {
    id: "image-sequence-hierarchy",
    name: "Image Sequence Hierarchy",
    description: "Order assets hook → reveal → feature → CTA without a second slideshow engine.",
    inputs: ["product images", "view roles"],
    execution: {
      scenePurposes: ["HOOK", "REVEAL", "FEATURE", "CTA"],
    },
    knowledgeTopics: ["image_sequence", "short_form"],
  },
];

export function listVideoSkills(): VideoSkill[] {
  return [...SKILLS];
}

export function getVideoSkill(id: VideoSkillId): VideoSkill | null {
  return SKILLS.find((s) => s.id === id) ?? null;
}

/** Map unsupported AI transition language onto Engine1 presets only. */
export function mapTransitionToSupported(raw: string | undefined | null): "cut" | "fade" {
  const text = String(raw ?? "").toLowerCase();
  if (/fade|dissolve|end|cta|outro|calm|soft/.test(text)) return "fade";
  return "cut";
}

export function selectApplicableSkills(context: {
  task?: string;
  hasCta?: boolean;
  imageCount?: number;
  tone?: string;
}): ApplicableSkillResult[] {
  const task = context.task
    ?? [
      "product marketing video",
      context.hasCta ? "cta" : "",
      (context.imageCount ?? 0) > 1 ? "sequencing" : "reveal",
      context.tone ?? "",
    ].filter(Boolean).join(" ");

  const knowledge = retrieveVideoKnowledge(task, 8);
  const byTopic = new Map<string, VideoKnowledgeItem>();
  for (const item of knowledge) byTopic.set(item.topic, item);

  const results: ApplicableSkillResult[] = [];
  for (const skill of SKILLS) {
    const matched = skill.knowledgeTopics
      .map((topic) => byTopic.get(topic))
      .filter(Boolean) as VideoKnowledgeItem[];
    if (!matched.length && skill.id !== "supported-transition-map") continue;
    if (skill.id === "final-cta" && context.hasCta === false) continue;
    if (skill.id === "image-sequence-hierarchy" && (context.imageCount ?? 0) < 2) continue;

    const conf = matched.length
      ? (matched[0]!.confidence >= 0.9 ? "HIGH" : matched[0]!.confidence >= 0.75 ? "MEDIUM" : "LOW")
      : "MEDIUM";

    results.push({
      skill,
      reason: matched.length
        ? `Matched knowledge: ${matched.map((m) => m.topic).join(", ")}`
        : "Default Engine1 transition safety skill.",
      knowledgeIds: matched.map((m) => m.id),
      confidence: conf,
    });
  }

  // Always include transition safety.
  if (!results.some((r) => r.skill.id === "supported-transition-map")) {
    const skill = getVideoSkill("supported-transition-map")!;
    results.push({
      skill,
      reason: "Engine1 supports cut/fade only.",
      knowledgeIds: ["vk-trans-01"],
      confidence: "HIGH",
    });
  }

  return results;
}
