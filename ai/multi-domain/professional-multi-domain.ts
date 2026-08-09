import { createHash, randomUUID } from "node:crypto";
import type { ProfessionalRecommendationResult } from "../recommendation/professional-recommendation-types.js";
import type {
  CrossDomainDimensionScore,
  DomainConflict,
  ProfessionalMultiDomainExplanation,
  ProfessionalMultiDomainFramework,
  ProfessionalMultiDomainMemoryRecord,
  ProfessionalMultiDomainRequest,
  ProfessionalMultiDomainResult,
} from "./professional-multi-domain-types.js";

const DOMAIN_ALIASES: Array<{ match: RegExp; domain: string }> = [
  { match: /video\s*production|advertisement|commercial/i, domain: "video-production-knowledge" },
  { match: /camera\s*movement|dolly|gimbal|pan\b|tilt\b/i, domain: "camera-movement-knowledge" },
  { match: /camera|aperture|iso|shutter|lens/i, domain: "camera-knowledge" },
  { match: /light|lighting|key\s*light|softbox/i, domain: "lighting-knowledge" },
  { match: /composition|framing|rule of thirds/i, domain: "composition-knowledge" },
  { match: /story|narrative|storytelling/i, domain: "storytelling-knowledge" },
  { match: /scene\s*design|scene\b/i, domain: "scene-design-knowledge" },
  { match: /animation/i, domain: "animation-knowledge" },
  { match: /motion\s*graphics|motion\b/i, domain: "motion-graphics-knowledge" },
  { match: /render|export|codec|bitrate/i, domain: "rendering-knowledge" },
  { match: /edit|cutting|color\s*grade/i, domain: "video-editing-knowledge" },
  { match: /marketing|funnel|cta/i, domain: "marketing-knowledge" },
  { match: /brand|branding/i, domain: "branding-knowledge" },
  { match: /customer\s*psychology|buyer\s*psychology/i, domain: "customer-psychology-knowledge" },
  { match: /sales\s*psychology|persuasion/i, domain: "sales-psychology-knowledge" },
  { match: /social\s*media|tiktok|instagram|youtube|reels/i, domain: "social-media-knowledge" },
  { match: /industry\s*standard/i, domain: "industry-standards-knowledge" },
  { match: /professional\s*standard/i, domain: "professional-standards-knowledge" },
  { match: /quality\s*rule|quality\s*assurance/i, domain: "quality-rules-knowledge" },
];

export function multiDomainFingerprint(objective: string, domains: string[], recommendation: string): string {
  const raw = `${normalize(objective)}|${domains.map(normalize).sort().join(",")}|${normalize(recommendation)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export function detectRelevantDomains(text: string, required: string[] = []): string[] {
  const found = new Set(required.map((domain) => domain.toLowerCase()));
  for (const entry of DOMAIN_ALIASES) {
    if (entry.match.test(text)) found.add(entry.domain);
  }
  if (found.size === 0) {
    found.add("video-production-knowledge");
    found.add("industry-standards-knowledge");
  }
  // Never stay single-domain when the request implies a professional production.
  if (found.size === 1 && /product|advert|campaign|video|professional/i.test(text)) {
    found.add("industry-standards-knowledge");
    found.add("marketing-knowledge");
  }
  return [...found];
}

export function buildProfessionalMultiDomainReasoning(input: {
  request: ProfessionalMultiDomainRequest;
  recommendation: ProfessionalRecommendationResult;
  similarReasoning: ProfessionalMultiDomainMemoryRecord[];
  exactMatch: ProfessionalMultiDomainMemoryRecord | null;
}): Omit<ProfessionalMultiDomainResult, "durationMs"> {
  const objective =
    input.request.objective?.trim() ||
    input.recommendation.objective ||
    input.request.request;
  const detected = detectRelevantDomains(
    `${input.request.request} ${objective}`,
    input.request.requiredDomains ?? []
  );
  const domains = unique([
    ...detected,
    ...input.recommendation.explanation.domainsUsed,
    ...(input.request.requiredDomains ?? []),
  ]);

  if (input.exactMatch && input.request.reuseSimilarReasoning !== false) {
    return reviveFromMemory(input.exactMatch, input.recommendation, domains, input.similarReasoning);
  }

  const conflicts = detectAndResolveConflicts(input.recommendation, domains);
  const crossDomainAnalysis = scoreCrossDomainDimensions(input.recommendation, domains);
  const decisionRulesApplied = [
    "Prefer Knowledge Foundation grounded evidence over single-domain heuristics",
    "Require multi-domain participation when multiple domains are relevant",
    "Resolve conflicts by balancing technical quality, marketing impact, and standards compliance",
    "Reuse prior multi-domain reasoning when fingerprints match",
    ...conflicts.map((conflict) => `Conflict rule: prefer ${conflict.selectedSide === "hybrid" ? "hybrid synthesis" : `domain ${conflict.selectedSide === "A" ? conflict.domainA : conflict.domainB}`}`),
  ];

  const combinedRecommendation = synthesizeRecommendation(input.recommendation, conflicts, crossDomainAnalysis);
  const confidenceScore = clamp(
    Math.round(
      input.recommendation.confidenceScore * 0.7 +
        Math.min(domains.length, 6) * 3 +
        (conflicts.length ? 2 : 0) +
        (input.similarReasoning.length ? 3 : 0) -
        conflicts.filter((conflict) => conflict.severity === "high").length * 4
    ),
    0,
    100
  );

  const reasoningId = randomUUID();
  const knowledgePacksUsed = unique([
    ...input.recommendation.explanation.knowledgePacksUsed,
    ...domains.map((domain) => `${domain}-pack`),
  ]);
  const workflowsReferenced = unique([
    ...input.recommendation.explanation.workflowsConsidered,
    ...(input.recommendation.relatedWorkflowId ? [input.recommendation.relatedWorkflowId] : []),
  ]);
  const decisionPath = [
    "Detect relevant Knowledge Domains",
    "Search Knowledge Packs via professional recommendation chain",
    "Combine multi-domain evidence",
    ...(conflicts.length ? ["Detect domain conflicts", "Resolve conflicts with explainable selection"] : ["No hard domain conflicts detected"]),
    "Score cross-domain dimensions",
    "Select combined professional solution",
  ];

  const framework: ProfessionalMultiDomainFramework = {
    objective,
    domainsParticipating: domains,
    knowledgePacksUsed,
    combinedRecommendation,
    crossDomainAnalysis,
    conflicts,
    decisionRulesApplied,
    workflowsReferenced,
    confidenceScore,
  };

  const explanation: ProfessionalMultiDomainExplanation = {
    whySelected: `Selected after multi-domain synthesis across ${domains.length} domain(s) grounded in recommendation ${input.recommendation.recommendationId}: ${input.recommendation.explanation.whySelected}`,
    domainsParticipating: domains,
    knowledgePacksUsed,
    knowledgeIdsUsed: input.recommendation.explanation.knowledgeIdsUsed,
    workflowsReferenced,
    decisionRulesApplied,
    conflictsResolved: conflicts.map(
      (conflict) => `${conflict.domainA} vs ${conflict.domainB}: ${conflict.whySelected}`
    ),
    expectedBenefits: unique([
      ...input.recommendation.explanation.expectedBenefits,
      "Balanced technical, creative, and marketing outcomes",
      "Conflict-aware professional solution instead of single-domain bias",
    ]),
    confidenceScore,
  };

  const fingerprint = multiDomainFingerprint(objective, domains, combinedRecommendation);
  const memoryRecord: ProfessionalMultiDomainMemoryRecord = {
    reasoningId,
    domainsUsed: domains,
    knowledgeUsed: input.recommendation.memoryRecord.knowledgeUsed,
    decisionPath,
    recommendation: combinedRecommendation,
    relatedRecommendationId: input.recommendation.recommendationId,
    relatedWorkflowId: input.recommendation.relatedWorkflowId,
    relatedDecisionId: input.recommendation.relatedDecisionId,
    conflictCount: conflicts.length,
    confidenceScore,
    timestamp: new Date().toISOString(),
    relatedKnowledgePacks: knowledgePacksUsed,
    priorReasoningIds: input.similarReasoning.map((item) => item.reasoningId),
    grounded: true,
    fingerprint,
  };

  return {
    reasoningId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: false,
    objective,
    framework,
    explanation,
    confidenceScore,
    confidenceExplanation: `Multi-domain confidence ${confidenceScore}/100 from recommendation ${input.recommendation.confidenceScore}/100 across ${domains.length} domain(s) with ${conflicts.length} conflict(s) resolved.`,
    memoryRecord,
    relatedRecommendationId: input.recommendation.recommendationId,
    relatedWorkflowId: input.recommendation.relatedWorkflowId,
    relatedDecisionId: input.recommendation.relatedDecisionId,
    multiDomain: domains.length > 1,
    missingInformation: input.recommendation.missingInformation,
  };
}

function detectAndResolveConflicts(
  recommendation: ProfessionalRecommendationResult,
  domains: string[]
): DomainConflict[] {
  const alts = recommendation.framework.alternativeSolutions;
  const conflicts: DomainConflict[] = [];
  if (alts.length < 2) {
    if (domains.length >= 2) {
      // Soft conflict: domain priority tension even without alternate ranks.
      const technical = domains.find((domain) => /camera|lighting|render|edit|composition/i.test(domain));
      const marketing = domains.find((domain) => /marketing|brand|social|psychology/i.test(domain));
      if (technical && marketing) {
        conflicts.push({
          conflictId: randomUUID(),
          domainA: technical,
          domainB: marketing,
          positionA: "Maximize technical craft fidelity and production control",
          positionB: "Maximize audience attention, CTA clarity, and platform fit",
          severity: "medium",
          resolution: "Hybrid: keep technical baselines while prioritizing platform-native marketing hooks",
          selectedSide: "hybrid",
          whySelected:
            "Professional ads need both craft quality and marketing impact; hybrid preserves standards without ignoring platform suitability.",
        });
      }
    }
    return conflicts;
  }

  const best = alts[0];
  const second = alts[1];
  const domainA = inferDomainFromText(best.title + " " + best.summary, domains[0] ?? "video-production-knowledge");
  const domainB = inferDomainFromText(second.title + " " + second.summary, domains[1] ?? domains[0] ?? "marketing-knowledge");

  if (normalize(best.summary) !== normalize(second.summary)) {
    const preferBest =
      best.confidenceScore >= second.confidenceScore &&
      !/risk|unsafe|unsupported/i.test(best.summary);
    conflicts.push({
      conflictId: randomUUID(),
      domainA,
      domainB,
      positionA: best.summary,
      positionB: second.summary,
      severity: Math.abs(best.confidenceScore - second.confidenceScore) < 8 ? "high" : "medium",
      resolution: preferBest
        ? `Adopt rank-1 guidance from ${domainA} while retaining safeguards from ${domainB}`
        : `Blend rank-1 and rank-2 guidance to protect both ${domainA} and ${domainB} outcomes`,
      selectedSide: preferBest ? "A" : "hybrid",
      whySelected: preferBest
        ? `Rank-1 option has higher grounded confidence (${best.confidenceScore} vs ${second.confidenceScore}) and better multi-domain fit.`
        : `Confidence gap is small; hybrid avoids discarding valuable guidance from ${domainB}.`,
    });
  }

  if (alts[2]) {
    const third = alts[2];
    const domainC = inferDomainFromText(third.title + " " + third.summary, "industry-standards-knowledge");
    conflicts.push({
      conflictId: randomUUID(),
      domainA: domainA,
      domainB: domainC,
      positionA: best.summary,
      positionB: third.summary,
      severity: "low",
      resolution: "Keep rank-1 as primary path; use third alternative as conservative sequential fallback",
      selectedSide: "A",
      whySelected: "Third alternative is a valid fallback but usually slower and less platform-optimized.",
    });
  }

  return conflicts;
}

function scoreCrossDomainDimensions(
  recommendation: ProfessionalRecommendationResult,
  domains: string[]
): CrossDomainDimensionScore[] {
  const base = recommendation.confidenceScore;
  const has = (pattern: RegExp) => domains.some((domain) => pattern.test(domain));
  return [
    {
      dimension: "technicalQuality",
      score: clamp(base + (has(/camera|lighting|render|edit|composition/) ? 4 : -6), 0, 100),
      notes: "Technical craft from camera/lighting/rendering/editing domains",
      domains: domains.filter((domain) => /camera|lighting|render|edit|composition|production/.test(domain)),
    },
    {
      dimension: "creativeQuality",
      score: clamp(base + (has(/story|scene|animation|motion|composition/) ? 4 : -4), 0, 100),
      notes: "Creative storytelling, scene, and motion quality",
      domains: domains.filter((domain) => /story|scene|animation|motion|composition/.test(domain)),
    },
    {
      dimension: "marketingImpact",
      score: clamp(base + (has(/marketing|sales|social/) ? 5 : -8), 0, 100),
      notes: "Audience conversion and campaign impact",
      domains: domains.filter((domain) => /marketing|sales|social/.test(domain)),
    },
    {
      dimension: "customerExperience",
      score: clamp(base + (has(/psychology|customer|social|story/) ? 4 : -5), 0, 100),
      notes: "Viewer/customer experience and psychology fit",
      domains: domains.filter((domain) => /psychology|customer|social|story/.test(domain)),
    },
    {
      dimension: "brandConsistency",
      score: clamp(base + (has(/brand|marketing|standard/) ? 4 : -5), 0, 100),
      notes: "Brand identity and standards alignment",
      domains: domains.filter((domain) => /brand|marketing|standard/.test(domain)),
    },
    {
      dimension: "productionCost",
      score: clamp(78 - recommendation.framework.alternativeSolutions.length * 2, 40, 95),
      notes: "Estimated production complexity/cost pressure",
      domains: domains.filter((domain) => /production|render|edit/.test(domain)),
    },
    {
      dimension: "workflowEfficiency",
      score: clamp(base + (recommendation.relatedWorkflowId ? 3 : -3), 0, 100),
      notes: "Reusable professional workflow efficiency",
      domains: domains,
    },
    {
      dimension: "platformSuitability",
      score: clamp(base + (has(/social|marketing|render/) ? 5 : -6), 0, 100),
      notes: "Platform-native packaging and delivery fit",
      domains: domains.filter((domain) => /social|marketing|render/.test(domain)),
    },
  ];
}

function synthesizeRecommendation(
  recommendation: ProfessionalRecommendationResult,
  conflicts: DomainConflict[],
  analysis: CrossDomainDimensionScore[]
): string {
  const primary = recommendation.framework.recommendedSolution;
  const hybrid = conflicts.find((conflict) => conflict.selectedSide === "hybrid");
  const topDimensions = [...analysis].sort((a, b) => b.score - a.score).slice(0, 3);
  const dimensionNote = topDimensions.map((item) => item.dimension).join(", ");
  if (hybrid) {
    return `${primary} Multi-domain synthesis: ${hybrid.resolution}. Priority dimensions: ${dimensionNote}.`;
  }
  if (conflicts[0]) {
    return `${primary} Conflict-aware selection: ${conflicts[0].resolution}. Priority dimensions: ${dimensionNote}.`;
  }
  return `${primary} Multi-domain alignment confirmed across ${analysis.length} dimensions (priority: ${dimensionNote}).`;
}

function reviveFromMemory(
  match: ProfessionalMultiDomainMemoryRecord,
  recommendation: ProfessionalRecommendationResult,
  domains: string[],
  similar: ProfessionalMultiDomainMemoryRecord[]
): Omit<ProfessionalMultiDomainResult, "durationMs"> {
  return {
    reasoningId: match.reasoningId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: true,
    objective: recommendation.objective,
    framework: {
      objective: recommendation.objective,
      domainsParticipating: unique([...match.domainsUsed, ...domains]),
      knowledgePacksUsed: match.relatedKnowledgePacks,
      combinedRecommendation: match.recommendation,
      crossDomainAnalysis: scoreCrossDomainDimensions(recommendation, unique([...match.domainsUsed, ...domains])),
      conflicts: [],
      decisionRulesApplied: match.decisionPath,
      workflowsReferenced: unique(
        [match.relatedWorkflowId, recommendation.relatedWorkflowId].filter(Boolean) as string[]
      ),
      confidenceScore: match.confidenceScore,
    },
    explanation: {
      whySelected: `Reused multi-domain reasoning ${match.reasoningId} for equivalent objective/domain fingerprint.`,
      domainsParticipating: match.domainsUsed,
      knowledgePacksUsed: match.relatedKnowledgePacks,
      knowledgeIdsUsed: match.knowledgeUsed.map((item) => item.knowledgeId),
      workflowsReferenced: unique(
        [match.relatedWorkflowId, recommendation.relatedWorkflowId].filter(Boolean) as string[]
      ),
      decisionRulesApplied: match.decisionPath,
      conflictsResolved: [`Prior reasoning resolved ${match.conflictCount} conflict(s)`],
      expectedBenefits: recommendation.explanation.expectedBenefits,
      confidenceScore: match.confidenceScore,
    },
    confidenceScore: match.confidenceScore,
    confidenceExplanation: `Reused multi-domain confidence ${match.confidenceScore}/100.`,
    memoryRecord: {
      ...match,
      relatedRecommendationId: recommendation.recommendationId,
      relatedWorkflowId: recommendation.relatedWorkflowId ?? match.relatedWorkflowId,
      relatedDecisionId: recommendation.relatedDecisionId ?? match.relatedDecisionId,
      priorReasoningIds: unique([...match.priorReasoningIds, ...similar.map((item) => item.reasoningId)]),
      timestamp: new Date().toISOString(),
    },
    relatedRecommendationId: recommendation.recommendationId,
    relatedWorkflowId: recommendation.relatedWorkflowId ?? match.relatedWorkflowId,
    relatedDecisionId: recommendation.relatedDecisionId ?? match.relatedDecisionId,
    multiDomain: match.domainsUsed.length > 1,
    missingInformation: [],
  };
}

function inferDomainFromText(text: string, fallback: string): string {
  for (const entry of DOMAIN_ALIASES) {
    if (entry.match.test(text)) return entry.domain;
  }
  return fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
