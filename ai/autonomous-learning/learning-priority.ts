import type {
  AutonomousLearningCandidate,
  LearningDomainId,
  LearningPriorityFocus,
} from "./types.js";

export const LEARNING_DOMAINS: LearningDomainId[] = [
  "video-production",
  "product-photography",
  "camera",
  "camera-movement",
  "lighting",
  "composition",
  "storytelling",
  "marketing",
  "branding",
  "customer-psychology",
  "sales-psychology",
  "video-editing",
  "motion-graphics",
  "rendering",
  "social-media",
  "ai-video-production",
  "product-marketing",
];

const DOMAIN_SET = new Set<string>(LEARNING_DOMAINS);

const FOCUS_KEYWORDS: Record<LearningPriorityFocus, string[]> = {
  "production-quality": ["quality", "production", "professional", "standard"],
  "rendering-quality": ["render", "rendering", "export", "codec", "artifact"],
  "marketing-quality": ["marketing", "cta", "conversion", "campaign", "brand"],
  "product-presentation": ["product", "presentation", "reveal", "showcase", "hero"],
  "workflow-efficiency": ["workflow", "pipeline", "efficiency", "faster", "automation"],
  "ai-reasoning": ["reasoning", "decision", "recommend", "planning", "intelligence"],
};

const MODULE_BY_DOMAIN: Record<LearningDomainId, {
  modules: string[];
  workflows: string[];
  recommendations: string[];
  planning: string[];
}> = {
  "video-production": {
    modules: ["product-video-generation", "creative-review"],
    workflows: ["production-pipeline"],
    recommendations: ["video-style"],
    planning: ["scene-plan"],
  },
  "product-photography": {
    modules: ["product-image-generation"],
    workflows: ["asset-prep"],
    recommendations: ["product-shot"],
    planning: ["visual-plan"],
  },
  camera: {
    modules: ["product-video-generation"],
    workflows: ["camera-plan"],
    recommendations: ["camera-preset"],
    planning: ["shot-list"],
  },
  "camera-movement": {
    modules: ["product-video-generation"],
    workflows: ["camera-move"],
    recommendations: ["move-preset"],
    planning: ["motion-plan"],
  },
  lighting: {
    modules: ["product-image-generation"],
    workflows: ["lighting-setup"],
    recommendations: ["lighting-preset"],
    planning: ["light-plan"],
  },
  composition: {
    modules: ["product-image-generation"],
    workflows: ["framing"],
    recommendations: ["composition-rule"],
    planning: ["frame-plan"],
  },
  storytelling: {
    modules: ["product-storyboard"],
    workflows: ["script-flow"],
    recommendations: ["narrative-arc"],
    planning: ["storyboard"],
  },
  marketing: {
    modules: ["product-storyboard"],
    workflows: ["cta-placement"],
    recommendations: ["marketing-angle"],
    planning: ["campaign-plan"],
  },
  branding: {
    modules: ["product-rendering-export"],
    workflows: ["brand-overlay"],
    recommendations: ["logo-placement"],
    planning: ["brand-plan"],
  },
  "customer-psychology": {
    modules: ["product-intelligence"],
    workflows: ["audience-fit"],
    recommendations: ["audience-hook"],
    planning: ["audience-plan"],
  },
  "sales-psychology": {
    modules: ["product-intelligence"],
    workflows: ["offer-framing"],
    recommendations: ["sales-message"],
    planning: ["offer-plan"],
  },
  "video-editing": {
    modules: ["product-rendering-export"],
    workflows: ["timeline-edit"],
    recommendations: ["cut-pacing"],
    planning: ["edit-plan"],
  },
  "motion-graphics": {
    modules: ["product-video-generation"],
    workflows: ["motion-graphics"],
    recommendations: ["animation-preset"],
    planning: ["motion-plan"],
  },
  rendering: {
    modules: ["product-rendering-export"],
    workflows: ["final-render"],
    recommendations: ["render-preset"],
    planning: ["export-plan"],
  },
  "social-media": {
    modules: ["product-rendering-export"],
    workflows: ["platform-export"],
    recommendations: ["platform-format"],
    planning: ["distribution-plan"],
  },
  "ai-video-production": {
    modules: ["ai-model-orchestration"],
    workflows: ["model-orchestration"],
    recommendations: ["model-choice"],
    planning: ["generation-plan"],
  },
  "product-marketing": {
    modules: ["product-intelligence", "product-storyboard"],
    workflows: ["product-marketing"],
    recommendations: ["product-pitch"],
    planning: ["marketing-plan"],
  },
};

export function isAllowedLearningDomain(domainId: string): domainId is LearningDomainId {
  return DOMAIN_SET.has(domainId);
}

export function detectFocus(text: string): LearningPriorityFocus[] {
  const lower = text.toLowerCase();
  const hits: LearningPriorityFocus[] = [];
  for (const [focus, keywords] of Object.entries(FOCUS_KEYWORDS) as Array<[LearningPriorityFocus, string[]]>) {
    if (keywords.some((keyword) => lower.includes(keyword))) hits.push(focus);
  }
  return hits.length ? hits : ["production-quality"];
}

export function scoreCandidatePriority(candidate: AutonomousLearningCandidate): number {
  if (!isAllowedLearningDomain(String(candidate.domainId))) return 0;
  const text = `${candidate.title} ${candidate.content}`;
  const focus = candidate.focus?.length ? candidate.focus : detectFocus(text);
  let score = 40 + focus.length * 8;
  if (candidate.verified) score += 25;
  if (candidate.origin.includes("previous") || candidate.origin === "validated-online-knowledge") score += 10;
  if (/best practice|technique|workflow|standard/.test(text.toLowerCase())) score += 10;
  return Math.min(100, score);
}

export function buildImpact(domainId: LearningDomainId, candidateId: string, focus: LearningPriorityFocus[]) {
  const map = MODULE_BY_DOMAIN[domainId];
  return {
    candidateId,
    modulesImproved: map.modules,
    workflowsImproved: map.workflows,
    recommendationsImproved: map.recommendations,
    planningLogicImproved: map.planning,
    breakingChangeRisk: false as const,
    safeToImport: true,
    rationale: `Safe additive expansion for ${domainId} focusing on ${focus.join(", ")}; no breaking changes.`,
  };
}

export function isUnrelatedTopic(title: string, content: string, domainId: string): boolean {
  if (!isAllowedLearningDomain(domainId)) return true;
  const blob = `${title} ${content}`.toLowerCase();
  const unrelated = ["cryptocurrency", "sports betting", "celebrity gossip", "recipe cooking", "politics election"];
  return unrelated.some((term) => blob.includes(term));
}
