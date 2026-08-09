import type {
  EvolutionCandidateInput,
  EvolutionDomainId,
  KnowledgeChangeKind,
  KnowledgeComparisonClass,
  KnowledgeComparisonResult,
  KnowledgeImpactAnalysis,
  MonitoredKnowledgeSnapshot,
} from "./types.js";

export const EVOLUTION_DOMAINS: Array<{ id: EvolutionDomainId; label: string; keywords: string[] }> = [
  { id: "video-production", label: "Video Production", keywords: ["video", "production", "filming", "shoot"] },
  { id: "product-photography", label: "Product Photography", keywords: ["product", "photography", "photo", "studio"] },
  { id: "camera", label: "Camera", keywords: ["camera", "lens", "sensor", "exposure", "aperture"] },
  { id: "camera-movement", label: "Camera Movement", keywords: ["movement", "pan", "tilt", "dolly", "tracking"] },
  { id: "lighting", label: "Lighting", keywords: ["lighting", "light", "softbox", "key", "fill", "rim"] },
  { id: "composition", label: "Composition", keywords: ["composition", "framing", "thirds", "layout"] },
  { id: "storytelling", label: "Storytelling", keywords: ["story", "storytelling", "narrative", "hook", "script"] },
  { id: "marketing", label: "Marketing", keywords: ["marketing", "campaign", "audience", "cta", "offer"] },
  { id: "branding", label: "Branding", keywords: ["brand", "branding", "identity", "logo"] },
  { id: "customer-psychology", label: "Customer Psychology", keywords: ["customer", "psychology", "behavior", "attention"] },
  { id: "sales-psychology", label: "Sales Psychology", keywords: ["sales", "conversion", "persuasion", "offer"] },
  { id: "video-editing", label: "Video Editing", keywords: ["editing", "edit", "timeline", "cut", "montage"] },
  { id: "motion-graphics", label: "Motion Graphics", keywords: ["motion", "graphics", "titles", "kinetic"] },
  { id: "animation", label: "Animation", keywords: ["animation", "animate", "keyframes", "easing"] },
  { id: "rendering", label: "Rendering", keywords: ["render", "rendering", "codec", "export", "encode"] },
  { id: "social-media", label: "Social Media", keywords: ["social", "tiktok", "instagram", "reels", "shorts", "youtube"] },
  { id: "ai-video-production", label: "AI Video Production", keywords: ["ai", "generation", "synthetic", "model"] },
];

export function listEvolutionDomains(): EvolutionDomainId[] {
  return EVOLUTION_DOMAINS.map((domain) => domain.id);
}

export function classifyEvolutionDomain(input: EvolutionCandidateInput): EvolutionDomainId {
  if (input.domainId && EVOLUTION_DOMAINS.some((domain) => domain.id === input.domainId)) {
    return input.domainId as EvolutionDomainId;
  }
  const text = `${input.title} ${input.content} ${input.domainId ?? ""}`.toLowerCase();
  let best: EvolutionDomainId = "video-production";
  let bestHits = -1;
  for (const domain of EVOLUTION_DOMAINS) {
    const hits = domain.keywords.filter((keyword) => text.includes(keyword)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = domain.id;
    }
  }
  return best;
}

export function detectChangeKind(input: EvolutionCandidateInput): KnowledgeChangeKind {
  if (input.changeKindHint) return input.changeKindHint;
  const lower = `${input.title}\n${input.content}`.toLowerCase();
  if (/\bapi\b|endpoint|sdk/.test(lower)) return "updated-api";
  if (/standard|specification|iso\b|guideline/.test(lower)) return "updated-standard";
  if (/documentation|manual|docs\b/.test(lower)) return "updated-documentation";
  if (/workflow|pipeline|step\s*\d+/.test(lower)) return "updated-workflow";
  if (/best practice|practice:/.test(lower)) return "updated-best-practice";
  if (/trend|viral|algorithm/.test(lower)) return "new-marketing-trend";
  if (/technology|gpu|codec|neural|diffusion/.test(lower)) return "new-production-technology";
  if (/technique|method/.test(lower)) return "new-technique";
  return "general-update";
}

export function fingerprintContent(title: string, content: string): string {
  const normalized = `${title}|${content}`.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `evo-${hash.toString(16)}-${normalized.length}`;
}

export function compareKnowledge(
  candidate: EvolutionCandidateInput,
  existing: MonitoredKnowledgeSnapshot[],
  domainId: EvolutionDomainId,
  changeKind: KnowledgeChangeKind,
): KnowledgeComparisonResult {
  const fingerprint = fingerprintContent(candidate.title, candidate.content);
  const byFingerprint = existing.find((item) => item.fingerprint === fingerprint && item.status === "active");
  if (byFingerprint) {
    return {
      comparisonId: `cmp-${byFingerprint.id}`,
      classification: "unchanged",
      existingId: byFingerprint.id,
      existingTitle: byFingerprint.title,
      existingVersion: byFingerprint.version,
      candidateTitle: candidate.title,
      domainId,
      changeKind,
      diffSummary: "Identical fingerprint — no evolution required.",
      recommendLatest: true,
      reason: "Candidate matches an existing active knowledge version.",
    };
  }

  if (candidate.deprecatesTitle) {
    const target = existing.find(
      (item) => item.title.toLowerCase() === candidate.deprecatesTitle!.toLowerCase() && item.domainId === domainId,
    );
    return {
      comparisonId: `cmp-dep-${candidate.deprecatesTitle}`,
      classification: "deprecated",
      existingId: target?.id,
      existingTitle: target?.title ?? candidate.deprecatesTitle,
      existingVersion: target?.version,
      candidateTitle: candidate.title,
      domainId,
      changeKind,
      diffSummary: `Deprecates "${candidate.deprecatesTitle}" in favor of "${candidate.title}".`,
      recommendLatest: true,
      reason: "Candidate explicitly deprecates prior knowledge.",
    };
  }

  const byTitle = existing.find(
    (item) => item.title.toLowerCase() === candidate.title.toLowerCase() && item.domainId === domainId && item.status === "active",
  );
  if (byTitle) {
    const obsoleteSignals = /obsolete|outdated|no longer|deprecated|replaced by/.test(candidate.content.toLowerCase());
    const classification: KnowledgeComparisonClass = obsoleteSignals ? "obsolete" : "updated";
    return {
      comparisonId: `cmp-upd-${byTitle.id}`,
      classification,
      existingId: byTitle.id,
      existingTitle: byTitle.title,
      existingVersion: byTitle.version,
      candidateTitle: candidate.title,
      domainId,
      changeKind,
      diffSummary: summarizeDiff(byTitle.content, candidate.content),
      recommendLatest: !obsoleteSignals,
      reason: obsoleteSignals
        ? "Candidate marks prior concept as obsolete."
        : "Same title with changed content — safe versioned update.",
    };
  }

  const replaces = candidate.replacesTitle
    ? existing.find((item) => item.title.toLowerCase() === candidate.replacesTitle!.toLowerCase() && item.domainId === domainId)
    : undefined;
  if (replaces) {
    return {
      comparisonId: `cmp-rep-${replaces.id}`,
      classification: "updated",
      existingId: replaces.id,
      existingTitle: replaces.title,
      existingVersion: replaces.version,
      candidateTitle: candidate.title,
      domainId,
      changeKind,
      diffSummary: `Replaces "${replaces.title}" with "${candidate.title}". ${summarizeDiff(replaces.content, candidate.content)}`,
      recommendLatest: true,
      reason: "Candidate replaces an existing active knowledge item.",
    };
  }

  return {
    comparisonId: `cmp-new-${fingerprint}`,
    classification: "new",
    candidateTitle: candidate.title,
    domainId,
    changeKind,
    diffSummary: "No matching active knowledge found — new concept.",
    recommendLatest: true,
    reason: "Candidate introduces new verified knowledge.",
  };
}

export function analyzeImpact(input: {
  itemId: string;
  title: string;
  content: string;
  domainId: EvolutionDomainId;
  changeKind: KnowledgeChangeKind;
}): KnowledgeImpactAnalysis {
  const text = `${input.title}\n${input.content}\n${input.domainId}\n${input.changeKind}`.toLowerCase();
  const affectsPlanning = /plan|scene|shot|schedule|workflow|pipeline/.test(text);
  const affectsReasoning = /rule|must|never|standard|decision|reasoning/.test(text);
  const affectsWorkflows = /workflow|pipeline|step\s*\d+|process/.test(text);
  const affectsRecommendations = /recommend|best practice|prefer|tip/.test(text);
  const affectsStoryboards = /storyboard|story|narrative|hook|script|scene/.test(text);
  const affectsVideoProduction = /video|production|camera|lighting|editing|motion|animation/.test(text);
  const affectsRendering = /render|codec|export|encode|delivery/.test(text);
  const flags = [
    affectsPlanning,
    affectsReasoning,
    affectsWorkflows,
    affectsRecommendations,
    affectsStoryboards,
    affectsVideoProduction,
    affectsRendering,
  ];
  const score = Math.min(100, 40 + flags.filter(Boolean).length * 8 + (input.changeKind === "updated-standard" ? 10 : 0));
  return {
    itemId: input.itemId,
    title: input.title,
    affectsAiMe: true,
    affectsPlanning,
    affectsReasoning,
    affectsWorkflows,
    affectsRecommendations,
    affectsStoryboards,
    affectsVideoProduction,
    affectsRendering,
    score,
    summary:
      `Update "${input.title}" impacts AI Me` +
      `${affectsPlanning ? ", planning" : ""}` +
      `${affectsReasoning ? ", reasoning" : ""}` +
      `${affectsWorkflows ? ", workflows" : ""}` +
      `${affectsRecommendations ? ", recommendations" : ""}` +
      `${affectsStoryboards ? ", storyboards" : ""}` +
      `${affectsVideoProduction ? ", video production" : ""}` +
      `${affectsRendering ? ", rendering" : ""}.`,
  };
}

function summarizeDiff(before: string, after: string): string {
  const beforeTokens = new Set(before.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const afterTokens = after.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const added = afterTokens.filter((word) => !beforeTokens.has(word)).slice(0, 8);
  const removed = [...beforeTokens].filter((word) => !after.toLowerCase().includes(word)).slice(0, 8);
  return `Added terms: ${added.join(", ") || "none"}. Removed terms: ${removed.join(", ") || "none"}.`;
}
