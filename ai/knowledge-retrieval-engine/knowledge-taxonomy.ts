/**
 * Phase 17 — Knowledge taxonomy, source trust, freshness and task retrieval profiles.
 * Domains are an open registry (built-ins + registerKnowledgeDomain) so new areas never need a schema change.
 */

export const KNOWLEDGE_BASE_SCHEMA = "kb-chunk-v1";

export const BUILT_IN_KNOWLEDGE_DOMAINS = [
  "VIDEO", "AUDIO", "MUSIC", "PHOTOGRAPHY", "IMAGE_PROCESSING", "GRAPHIC_DESIGN", "TYPOGRAPHY",
  "COPYWRITING", "MARKETING", "ADVERTISING", "SOCIAL_MEDIA", "PRODUCT_CREATIVE", "STORYTELLING",
  "MOTION_DESIGN", "COLOR", "UI_UX", "PROGRAMMING", "SOFTWARE_ENGINEERING", "AI_ML", "BUSINESS", "GENERAL",
] as const;

export type KnowledgeDomainId = string;

const customDomains = new Map<string, { label: string; freshnessDays?: number }>();

export function registerKnowledgeDomain(id: string, label: string, freshnessDays?: number): KnowledgeDomainId {
  const key = normalizeDomain(id);
  if (!(BUILT_IN_KNOWLEDGE_DOMAINS as readonly string[]).includes(key)) customDomains.set(key, { label, freshnessDays });
  return key;
}

export function listKnowledgeDomains(): Array<{ id: string; builtIn: boolean; label: string }> {
  return [
    ...BUILT_IN_KNOWLEDGE_DOMAINS.map((id) => ({ id, builtIn: true, label: id.replace(/_/g, " ").toLowerCase() })),
    ...[...customDomains.entries()].map(([id, value]) => ({ id, builtIn: false, label: value.label })),
  ];
}

export function normalizeDomain(value: string | undefined | null): KnowledgeDomainId {
  const key = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return key || "GENERAL";
}

export function isKnownDomain(value: string): boolean {
  const key = normalizeDomain(value);
  return (BUILT_IN_KNOWLEDGE_DOMAINS as readonly string[]).includes(key) || customDomains.has(key);
}

export type KnowledgeSourceType =
  | "USER_DOCUMENT"
  | "INTERNAL_DOCUMENT"
  | "OFFICIAL_DOCUMENTATION"
  | "PUBLIC_WEB"
  | "RESEARCH_REFERENCE"
  | "STRUCTURED_REFERENCE"
  | "SYSTEM_GENERATED_KNOWLEDGE";

export const KNOWLEDGE_SOURCE_TYPES: readonly KnowledgeSourceType[] = [
  "USER_DOCUMENT", "INTERNAL_DOCUMENT", "OFFICIAL_DOCUMENTATION", "PUBLIC_WEB",
  "RESEARCH_REFERENCE", "STRUCTURED_REFERENCE", "SYSTEM_GENERATED_KNOWLEDGE",
];

export type SourceTrust = "TRUSTED" | "VERIFIED" | "UNVERIFIED" | "LOW_CONFIDENCE" | "REJECTED";

/** Retrieval weighting only — not a truth score. */
export const TRUST_WEIGHT: Record<SourceTrust, number> = {
  TRUSTED: 1,
  VERIFIED: 0.9,
  UNVERIFIED: 0.6,
  LOW_CONFIDENCE: 0.35,
  REJECTED: 0,
};

export const TRUST_RANK: Record<SourceTrust, number> = {
  TRUSTED: 4, VERIFIED: 3, UNVERIFIED: 2, LOW_CONFIDENCE: 1, REJECTED: 0,
};

/**
 * Initial trust from the evidence the system actually has. Public web is never trusted automatically;
 * an admin approval is the only path from UNVERIFIED to VERIFIED/TRUSTED.
 */
export function initialSourceTrust(input: {
  sourceType: KnowledgeSourceType;
  officialHost?: boolean;
  injectionFlags?: number;
}): { trust: SourceTrust; basis: string[] } {
  const basis: string[] = [];
  let trust: SourceTrust;
  switch (input.sourceType) {
    case "INTERNAL_DOCUMENT":
    case "SYSTEM_GENERATED_KNOWLEDGE":
      trust = "TRUSTED";
      basis.push("Authored inside KWIZERA AI STUDIO.");
      break;
    case "USER_DOCUMENT":
      trust = "VERIFIED";
      basis.push("Supplied directly by the document owner; visible only in its own scope.");
      break;
    case "OFFICIAL_DOCUMENTATION":
      trust = input.officialHost ? "VERIFIED" : "UNVERIFIED";
      basis.push(input.officialHost
        ? "Host is on the trusted official source list."
        : "Declared official but host is not on the trusted source list.");
      break;
    case "STRUCTURED_REFERENCE":
    case "RESEARCH_REFERENCE":
      trust = input.officialHost ? "VERIFIED" : "UNVERIFIED";
      basis.push(input.officialHost ? "Host is on the trusted source list." : "Reference not yet reviewed.");
      break;
    default:
      trust = "UNVERIFIED";
      basis.push("Public web content is untrusted until reviewed.");
  }
  if ((input.injectionFlags ?? 0) > 0) {
    trust = TRUST_RANK[trust] > TRUST_RANK.LOW_CONFIDENCE ? "LOW_CONFIDENCE" : trust;
    basis.push("Content contains instruction-like text; treated as low confidence.");
  }
  return { trust, basis };
}

export type KnowledgeFreshness = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

/** Days until knowledge in a domain starts AGING; STALE after twice that. */
const DOMAIN_FRESH_DAYS: Record<string, number> = {
  PROGRAMMING: 120,
  SOFTWARE_ENGINEERING: 180,
  AI_ML: 90,
  SOCIAL_MEDIA: 120,
  MARKETING: 365,
  ADVERTISING: 365,
  BUSINESS: 365,
  UI_UX: 540,
  VIDEO: 730,
  AUDIO: 1095,
  MUSIC: 1095,
  PHOTOGRAPHY: 1095,
  IMAGE_PROCESSING: 730,
  GRAPHIC_DESIGN: 1095,
  TYPOGRAPHY: 1460,
  COPYWRITING: 730,
  PRODUCT_CREATIVE: 730,
  STORYTELLING: 1825,
  MOTION_DESIGN: 1095,
  COLOR: 1825,
  GENERAL: 730,
};

export function freshDaysForDomain(domain: string): number {
  const key = normalizeDomain(domain);
  return DOMAIN_FRESH_DAYS[key] ?? customDomains.get(key)?.freshnessDays ?? DOMAIN_FRESH_DAYS.GENERAL;
}

export function computeFreshness(domain: string, observedAt: string | null | undefined, now = new Date()): KnowledgeFreshness {
  if (!observedAt) return "UNKNOWN";
  const at = Date.parse(observedAt);
  if (!Number.isFinite(at)) return "UNKNOWN";
  const ageDays = (now.getTime() - at) / 86_400_000;
  const fresh = freshDaysForDomain(domain);
  if (ageDays <= fresh) return "FRESH";
  if (ageDays <= fresh * 2) return "AGING";
  return "STALE";
}

export const FRESHNESS_WEIGHT: Record<KnowledgeFreshness, number> = {
  FRESH: 1, AGING: 0.9, STALE: 0.7, UNKNOWN: 0.85,
};

export type KnowledgeTask =
  | "PRODUCT_SLIDESHOW"
  | "CINEMATIC_VIDEO"
  | "AUDIO_PLAN"
  | "TYPOGRAPHY_PLAN"
  | "COPYWRITING"
  | "IMAGE_UNDERSTANDING"
  | "CODE_ASSIST"
  | "GENERAL";

export interface TaskRetrievalProfile {
  task: KnowledgeTask;
  /** Domain weights; domains not listed are excluded. */
  domains: Record<string, number>;
  /** Terms added to the query so retrieval stays on-topic for the task. */
  focusTerms: string[];
  /** Guidance keys (prefixes) this task may consume. */
  guidancePrefixes: string[];
  limit: number;
  contextBudgetChars: number;
}

export const TASK_PROFILES: Record<KnowledgeTask, TaskRetrievalProfile> = {
  PRODUCT_SLIDESHOW: {
    task: "PRODUCT_SLIDESHOW",
    domains: {
      PRODUCT_CREATIVE: 1, VIDEO: 0.95, PHOTOGRAPHY: 0.9, MOTION_DESIGN: 0.9, TYPOGRAPHY: 0.8,
      ADVERTISING: 0.85, SOCIAL_MEDIA: 0.8, GRAPHIC_DESIGN: 0.75, COLOR: 0.6, AUDIO: 0.55, MUSIC: 0.5,
      MARKETING: 0.7, STORYTELLING: 0.6,
    },
    focusTerms: ["product", "composition", "crop", "safe area", "aspect ratio", "scene", "motion", "transition", "cta"],
    guidancePrefixes: ["composition.", "slideshow.", "motion."],
    limit: 6,
    contextBudgetChars: 2_400,
  },
  CINEMATIC_VIDEO: {
    task: "CINEMATIC_VIDEO",
    domains: { VIDEO: 1, MOTION_DESIGN: 0.9, STORYTELLING: 0.85, PRODUCT_CREATIVE: 0.8, ADVERTISING: 0.7, COLOR: 0.6 },
    focusTerms: ["camera", "shot", "pacing", "cinematic", "movement", "rhythm"],
    guidancePrefixes: ["motion.", "composition."],
    limit: 6,
    contextBudgetChars: 2_400,
  },
  AUDIO_PLAN: {
    task: "AUDIO_PLAN",
    domains: { AUDIO: 1, MUSIC: 1, VIDEO: 0.45 },
    focusTerms: ["bpm", "beat", "loop", "crossfade", "fade", "mix", "loudness", "sync"],
    guidancePrefixes: ["audio."],
    limit: 5,
    contextBudgetChars: 1_800,
  },
  TYPOGRAPHY_PLAN: {
    task: "TYPOGRAPHY_PLAN",
    domains: { TYPOGRAPHY: 1, GRAPHIC_DESIGN: 0.85, UI_UX: 0.7, COLOR: 0.7, ADVERTISING: 0.6, COPYWRITING: 0.55, SOCIAL_MEDIA: 0.5 },
    focusTerms: ["typography", "readability", "contrast", "hierarchy", "text", "safe area", "legibility"],
    guidancePrefixes: ["typography."],
    limit: 5,
    contextBudgetChars: 1_800,
  },
  COPYWRITING: {
    task: "COPYWRITING",
    domains: { COPYWRITING: 1, ADVERTISING: 0.9, MARKETING: 0.9, SOCIAL_MEDIA: 0.75, PRODUCT_CREATIVE: 0.6, STORYTELLING: 0.6 },
    focusTerms: ["headline", "benefit", "cta", "offer", "copy"],
    guidancePrefixes: ["copy."],
    limit: 5,
    contextBudgetChars: 1_800,
  },
  IMAGE_UNDERSTANDING: {
    task: "IMAGE_UNDERSTANDING",
    domains: { PHOTOGRAPHY: 1, IMAGE_PROCESSING: 1, PRODUCT_CREATIVE: 0.7, COLOR: 0.6 },
    focusTerms: ["image", "subject", "background", "lighting", "crop"],
    guidancePrefixes: ["composition."],
    limit: 5,
    contextBudgetChars: 1_800,
  },
  CODE_ASSIST: {
    task: "CODE_ASSIST",
    domains: { PROGRAMMING: 1, SOFTWARE_ENGINEERING: 1, AI_ML: 0.6 },
    focusTerms: ["api", "typescript", "function", "module", "test", "security"],
    guidancePrefixes: ["code."],
    limit: 6,
    contextBudgetChars: 3_000,
  },
  GENERAL: {
    task: "GENERAL",
    domains: Object.fromEntries(BUILT_IN_KNOWLEDGE_DOMAINS.map((d) => [d, 0.8])),
    focusTerms: [],
    guidancePrefixes: [],
    limit: 6,
    contextBudgetChars: 2_000,
  },
};

export function profileForTask(task: string | undefined | null): TaskRetrievalProfile {
  const key = String(task ?? "").toUpperCase() as KnowledgeTask;
  return TASK_PROFILES[key] ?? TASK_PROFILES.GENERAL;
}

/** Custom domains participate in GENERAL retrieval without being hardcoded into profiles. */
export function domainWeightForTask(profile: TaskRetrievalProfile, domain: string): number {
  const key = normalizeDomain(domain);
  if (profile.domains[key] !== undefined) return profile.domains[key];
  if (profile.task === "GENERAL") return 0.8;
  return 0;
}
