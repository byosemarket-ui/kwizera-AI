/**
 * Professional Online Research domains — only these subjects may be researched.
 * Keeps Online Research Mode scoped to KWIZERA creative production knowledge.
 */

import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { ResearchDomainPriority } from "./types.js";

export type ResearchDiscoveryKind =
  | "official-documentation"
  | "technical-manual"
  | "user-guide"
  | "api-documentation"
  | "research-paper"
  | "white-paper"
  | "educational-article"
  | "best-practice-guide"
  | "public-dataset";

export interface ProfessionalResearchDomainDefinition {
  id: string;
  label: string;
  description: string;
  priority: ResearchDomainPriority;
  keywords: string[];
  sourceTypes: KnowledgeAcquisitionSourceType[];
  discoveryKinds: ResearchDiscoveryKind[];
  workspaceDomainId: string;
}

/** Fixed catalog — never research unrelated subjects. */
export const PROFESSIONAL_ONLINE_RESEARCH_DOMAINS: ProfessionalResearchDomainDefinition[] = [
  {
    id: "video-production",
    label: "Video Production",
    description: "Professional video production pipelines, roles, and delivery standards.",
    priority: "high",
    keywords: ["video", "production", "filming", "shoot", "cinema"],
    sourceTypes: ["official-documentation", "technical-manual", "user-manual", "open-educational-resource"],
    discoveryKinds: ["official-documentation", "technical-manual", "best-practice-guide", "educational-article"],
    workspaceDomainId: "video-production-knowledge",
  },
  {
    id: "product-photography",
    label: "Product Photography",
    description: "Product photography techniques that preserve real product identity.",
    priority: "high",
    keywords: ["product", "photography", "photo", "studio", "still"],
    sourceTypes: ["official-documentation", "technical-manual", "user-manual"],
    discoveryKinds: ["official-documentation", "technical-manual", "user-guide", "best-practice-guide"],
    workspaceDomainId: "product-knowledge",
  },
  {
    id: "camera",
    label: "Camera",
    description: "Camera systems, sensors, lenses, and exposure fundamentals.",
    priority: "high",
    keywords: ["camera", "lens", "sensor", "exposure", "aperture"],
    sourceTypes: ["technical-manual", "official-documentation", "user-manual"],
    discoveryKinds: ["technical-manual", "official-documentation", "user-guide", "api-documentation"],
    workspaceDomainId: "camera-knowledge",
  },
  {
    id: "camera-movement",
    label: "Camera Movement",
    description: "Camera moves, blocking, and cinematic motion language.",
    priority: "high",
    keywords: ["camera", "movement", "pan", "tilt", "dolly", "tracking"],
    sourceTypes: ["technical-manual", "user-manual", "research-paper"],
    discoveryKinds: ["technical-manual", "best-practice-guide", "educational-article"],
    workspaceDomainId: "camera-movement-knowledge",
  },
  {
    id: "lighting",
    label: "Lighting",
    description: "Lighting setups, ratios, and product-safe illumination.",
    priority: "high",
    keywords: ["lighting", "light", "illumination", "softbox", "key"],
    sourceTypes: ["technical-manual", "official-documentation", "user-manual"],
    discoveryKinds: ["technical-manual", "best-practice-guide", "educational-article"],
    workspaceDomainId: "lighting-knowledge",
  },
  {
    id: "composition",
    label: "Composition",
    description: "Framing, visual hierarchy, and composition rules for marketing media.",
    priority: "medium",
    keywords: ["composition", "framing", "thirds", "layout", "visual"],
    sourceTypes: ["user-manual", "research-paper", "white-paper"],
    discoveryKinds: ["best-practice-guide", "educational-article", "white-paper"],
    workspaceDomainId: "composition-knowledge",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    description: "Narrative structure, hooks, and product story arcs.",
    priority: "high",
    keywords: ["story", "storytelling", "narrative", "hook", "script"],
    sourceTypes: ["research-paper", "white-paper", "user-manual", "open-educational-resource"],
    discoveryKinds: ["educational-article", "best-practice-guide", "white-paper"],
    workspaceDomainId: "storytelling-knowledge",
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Product marketing strategy, campaigns, and creative messaging.",
    priority: "high",
    keywords: ["marketing", "campaign", "promotion", "audience", "offer"],
    sourceTypes: ["white-paper", "research-paper", "approved-website"],
    discoveryKinds: ["white-paper", "educational-article", "best-practice-guide"],
    workspaceDomainId: "marketing-knowledge",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Brand identity, consistency, and visual brand systems.",
    priority: "medium",
    keywords: ["brand", "branding", "identity", "logo", "guidelines"],
    sourceTypes: ["official-documentation", "white-paper", "user-manual"],
    discoveryKinds: ["official-documentation", "best-practice-guide", "white-paper"],
    workspaceDomainId: "branding-knowledge",
  },
  {
    id: "customer-psychology",
    label: "Customer Psychology",
    description: "Customer motivation, attention, and decision triggers.",
    priority: "medium",
    keywords: ["customer", "psychology", "behavior", "attention", "motivation"],
    sourceTypes: ["research-paper", "white-paper"],
    discoveryKinds: ["research-paper", "white-paper", "educational-article"],
    workspaceDomainId: "customer-psychology",
  },
  {
    id: "sales-psychology",
    label: "Sales Psychology",
    description: "Persuasion, offers, and conversion-oriented messaging.",
    priority: "medium",
    keywords: ["sales", "psychology", "conversion", "persuasion", "cta"],
    sourceTypes: ["research-paper", "white-paper", "approved-website"],
    discoveryKinds: ["research-paper", "white-paper", "best-practice-guide"],
    workspaceDomainId: "sales-psychology",
  },
  {
    id: "video-editing",
    label: "Video Editing",
    description: "Editing rhythm, continuity, and delivery timelines.",
    priority: "high",
    keywords: ["editing", "edit", "timeline", "cut", "montage"],
    sourceTypes: ["official-documentation", "technical-manual", "user-manual"],
    discoveryKinds: ["official-documentation", "user-guide", "best-practice-guide"],
    workspaceDomainId: "video-editing-knowledge",
  },
  {
    id: "motion-graphics",
    label: "Motion Graphics",
    description: "Motion design systems, titles, and graphic animation.",
    priority: "medium",
    keywords: ["motion", "graphics", "titles", "kinetic"],
    sourceTypes: ["official-documentation", "technical-manual", "user-manual"],
    discoveryKinds: ["official-documentation", "educational-article", "best-practice-guide"],
    workspaceDomainId: "motion-graphics-knowledge",
  },
  {
    id: "animation",
    label: "Animation",
    description: "Animation principles and product-safe motion.",
    priority: "medium",
    keywords: ["animation", "animate", "keyframes", "easing", "motion"],
    sourceTypes: ["technical-manual", "official-documentation", "research-paper"],
    discoveryKinds: ["technical-manual", "best-practice-guide", "educational-article"],
    workspaceDomainId: "animation-knowledge",
  },
  {
    id: "rendering",
    label: "Rendering",
    description: "Render settings, codecs, and export quality controls.",
    priority: "high",
    keywords: ["render", "rendering", "codec", "export", "encode"],
    sourceTypes: ["official-documentation", "technical-manual", "official-api-documentation"],
    discoveryKinds: ["official-documentation", "api-documentation", "technical-manual"],
    workspaceDomainId: "rendering-knowledge",
  },
  {
    id: "social-media",
    label: "Social Media",
    description: "Short-form platform formats, posting practices, and reach patterns.",
    priority: "high",
    keywords: ["social", "tiktok", "instagram", "reels", "shorts", "facebook", "youtube"],
    sourceTypes: ["official-documentation", "approved-website", "white-paper"],
    discoveryKinds: ["official-documentation", "best-practice-guide", "educational-article"],
    workspaceDomainId: "social-media-knowledge",
  },
  {
    id: "ai-video-production",
    label: "AI Video Production",
    description: "AI-assisted video production workflows that preserve product truth.",
    priority: "high",
    keywords: ["ai", "video", "generation", "machine", "synthetic"],
    sourceTypes: ["research-paper", "white-paper", "official-documentation"],
    discoveryKinds: ["research-paper", "white-paper", "official-documentation", "educational-article"],
    workspaceDomainId: "video-production-knowledge",
  },
  {
    id: "product-marketing",
    label: "Product Marketing",
    description: "Product-led marketing videos, feature storytelling, and purchase intent.",
    priority: "high",
    keywords: ["product", "marketing", "feature", "benefit", "commerce"],
    sourceTypes: ["white-paper", "research-paper", "approved-website"],
    discoveryKinds: ["best-practice-guide", "white-paper", "educational-article"],
    workspaceDomainId: "marketing-knowledge",
  },
];

export function listProfessionalResearchDomains(): ProfessionalResearchDomainDefinition[] {
  return PROFESSIONAL_ONLINE_RESEARCH_DOMAINS.map((domain) => structuredClone(domain));
}

export function isTopicWithinProfessionalResearchScope(topic: string): boolean {
  return matchProfessionalResearchDomains(topic).length > 0;
}

export function matchProfessionalResearchDomains(topic: string): ProfessionalResearchDomainDefinition[] {
  const words = new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
  if (words.size === 0) {
    return listProfessionalResearchDomains().filter((domain) => domain.priority === "high");
  }

  const generic = ["professional", "research", "knowledge", "studio", "kwizera", "online", "learning", "improve"];
  const meaningful = [...words].filter((word) => !generic.includes(word));
  if (meaningful.length === 0) {
    return listProfessionalResearchDomains().filter((domain) => domain.priority === "high");
  }

  const scored = listProfessionalResearchDomains()
    .map((domain) => {
      const hits = domain.keywords.filter((keyword) =>
        meaningful.some((word) => keyword.includes(word) || word.includes(keyword)),
      ).length;
      return { domain, hits };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits || priorityRank(a.domain.priority) - priorityRank(b.domain.priority));

  return scored.map((item) => item.domain);
}

function priorityRank(priority: ResearchDomainPriority): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}
