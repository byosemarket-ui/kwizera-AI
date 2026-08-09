import type { IntegrationDomainId, KnowledgeCandidateInput, KnowledgeItemKind, KnowledgeValidationScores } from "./types.js";

export const VALIDATION_FLOORS = {
  sourceTrust: 55,
  authority: 50,
  technicalAccuracy: 55,
  professionalAccuracy: 55,
  relevance: 45,
  freshness: 40,
  completeness: 45,
  consistency: 50,
  composite: 58,
} as const;

export const INTEGRATION_DOMAINS: Array<{ id: IntegrationDomainId; label: string; keywords: string[] }> = [
  { id: "video-production", label: "Video Production", keywords: ["video", "production", "filming", "shoot"] },
  { id: "camera", label: "Camera", keywords: ["camera", "lens", "sensor", "exposure", "aperture"] },
  { id: "lighting", label: "Lighting", keywords: ["lighting", "light", "softbox", "key", "fill", "rim"] },
  { id: "composition", label: "Composition", keywords: ["composition", "framing", "thirds", "layout"] },
  { id: "storytelling", label: "Storytelling", keywords: ["story", "storytelling", "narrative", "hook", "script"] },
  { id: "marketing", label: "Marketing", keywords: ["marketing", "campaign", "audience", "cta", "offer"] },
  { id: "branding", label: "Branding", keywords: ["brand", "branding", "identity", "logo"] },
  { id: "customer-psychology", label: "Customer Psychology", keywords: ["customer", "psychology", "behavior", "attention"] },
  { id: "video-editing", label: "Video Editing", keywords: ["editing", "edit", "timeline", "cut", "montage"] },
  { id: "motion-graphics", label: "Motion Graphics", keywords: ["motion", "graphics", "titles", "kinetic"] },
  { id: "rendering", label: "Rendering", keywords: ["render", "rendering", "codec", "export", "encode"] },
  { id: "social-media", label: "Social Media", keywords: ["social", "tiktok", "instagram", "reels", "shorts", "youtube"] },
  { id: "product-photography", label: "Product Photography", keywords: ["product", "photography", "photo", "studio"] },
  { id: "ai-video-production", label: "AI Video Production", keywords: ["ai", "generation", "synthetic", "model"] },
];

const PROFESSIONAL_MARKERS = [
  "best practice",
  "must ",
  "never ",
  "always ",
  "recommend",
  "workflow",
  "step ",
  "definition",
  "standard",
  "technique",
];

const LOW_QUALITY_MARKERS = ["buy now", "click here", "sponsored", "limited offer", "crypto gambling"];

export function classifyDomain(input: KnowledgeCandidateInput): IntegrationDomainId {
  if (input.domainHint && INTEGRATION_DOMAINS.some((domain) => domain.id === input.domainHint)) {
    return input.domainHint as IntegrationDomainId;
  }
  const text = `${input.title} ${input.content} ${input.domainHint ?? ""}`.toLowerCase();
  let best: IntegrationDomainId = "video-production";
  let bestHits = -1;
  for (const domain of INTEGRATION_DOMAINS) {
    const hits = domain.keywords.filter((keyword) => text.includes(keyword)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = domain.id;
    }
  }
  return best;
}

export function classifyKind(input: KnowledgeCandidateInput): KnowledgeItemKind {
  if (input.kindHint) return input.kindHint;
  const lower = `${input.title}\n${input.content}`.toLowerCase();
  if (/^definition:|is defined as|means\b/.test(lower)) return "definition";
  if (/best practice|tip:/.test(lower)) return "best-practice";
  if (/\b(must|never|always|rule:)\b/.test(lower)) return "rule";
  if (/workflow|step\s*\d+|pipeline/.test(lower)) return "workflow";
  if (/example:|for example|e\.g\./.test(lower)) return "example";
  if (/recommend|recommendation|prefer/.test(lower)) return "recommendation";
  if (/concept:|principle:/.test(lower)) return "concept";
  if (input.content.length > 400) return "document";
  return "concept";
}

export function scoreKnowledgeCandidate(
  input: KnowledgeCandidateInput,
  domainId: IntegrationDomainId,
  existingConsistencySamples: string[],
): KnowledgeValidationScores {
  const text = `${input.title}\n${input.content}`.trim();
  const lower = text.toLowerCase();
  const domain = INTEGRATION_DOMAINS.find((item) => item.id === domainId)!;
  const relevanceHits = domain.keywords.filter((keyword) => lower.includes(keyword)).length;
  const relevanceScore = Math.min(100, 35 + relevanceHits * 18 + (input.domainHint ? 10 : 0));

  const professionalHits = PROFESSIONAL_MARKERS.filter((marker) => lower.includes(marker)).length;
  const lowQualityHits = LOW_QUALITY_MARKERS.filter((marker) => lower.includes(marker)).length;

  const sourceTrustScore = clamp(input.sourceTrustScore ?? (lowQualityHits ? 30 : 80));
  const authorityScore = clamp(input.authorityScore ?? (input.sourceName ? 78 : 65));
  const technicalAccuracyScore = clamp(55 + professionalHits * 8 - lowQualityHits * 25 + Math.min(20, Math.floor(text.length / 80)));
  const professionalAccuracyScore = clamp(50 + professionalHits * 10 - lowQualityHits * 20);
  const freshnessScore = clamp(input.freshnessScore ?? 75);
  const completenessScore = clamp(
    (text.length > 80 ? 50 : 25)
      + (/\n/.test(text) ? 15 : 0)
      + (professionalHits > 0 ? 20 : 0)
      + (relevanceHits > 0 ? 10 : 0),
  );

  let consistencyScore = 70;
  if (existingConsistencySamples.length) {
    const overlap = existingConsistencySamples.filter((sample) => {
      const a = tokenize(sample);
      const b = tokenize(text);
      let shared = 0;
      for (const word of a) if (b.has(word)) shared += 1;
      return shared >= 3;
    }).length;
    consistencyScore = clamp(60 + Math.min(30, overlap * 5) - lowQualityHits * 15);
  } else {
    consistencyScore = clamp(65 - lowQualityHits * 20 + professionalHits * 5);
  }

  const compositeScore = Math.round(
    sourceTrustScore * 0.12
      + authorityScore * 0.12
      + technicalAccuracyScore * 0.14
      + professionalAccuracyScore * 0.14
      + relevanceScore * 0.16
      + freshnessScore * 0.08
      + completenessScore * 0.12
      + consistencyScore * 0.12,
  );

  return {
    sourceTrustScore,
    authorityScore,
    technicalAccuracyScore,
    professionalAccuracyScore,
    relevanceScore,
    freshnessScore,
    completenessScore,
    consistencyScore,
    compositeScore,
  };
}

export function evaluateAcceptance(scores: KnowledgeValidationScores): { accepted: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (scores.sourceTrustScore < VALIDATION_FLOORS.sourceTrust) reasons.push(`trust ${scores.sourceTrustScore} < ${VALIDATION_FLOORS.sourceTrust}`);
  if (scores.authorityScore < VALIDATION_FLOORS.authority) reasons.push(`authority ${scores.authorityScore} < ${VALIDATION_FLOORS.authority}`);
  if (scores.technicalAccuracyScore < VALIDATION_FLOORS.technicalAccuracy) reasons.push(`technicalAccuracy ${scores.technicalAccuracyScore} < ${VALIDATION_FLOORS.technicalAccuracy}`);
  if (scores.professionalAccuracyScore < VALIDATION_FLOORS.professionalAccuracy) reasons.push(`professionalAccuracy ${scores.professionalAccuracyScore} < ${VALIDATION_FLOORS.professionalAccuracy}`);
  if (scores.relevanceScore < VALIDATION_FLOORS.relevance) reasons.push(`relevance ${scores.relevanceScore} < ${VALIDATION_FLOORS.relevance}`);
  if (scores.freshnessScore < VALIDATION_FLOORS.freshness) reasons.push(`freshness ${scores.freshnessScore} < ${VALIDATION_FLOORS.freshness}`);
  if (scores.completenessScore < VALIDATION_FLOORS.completeness) reasons.push(`completeness ${scores.completenessScore} < ${VALIDATION_FLOORS.completeness}`);
  if (scores.consistencyScore < VALIDATION_FLOORS.consistency) reasons.push(`consistency ${scores.consistencyScore} < ${VALIDATION_FLOORS.consistency}`);
  if (scores.compositeScore < VALIDATION_FLOORS.composite) reasons.push(`composite ${scores.compositeScore} < ${VALIDATION_FLOORS.composite}`);
  return { accepted: reasons.length === 0, reasons };
}

export function extractKnowledgeSignals(content: string): Omit<import("./types.js").ExtractedKnowledgeBundle, "itemId"> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => line.length > 8);

  const concepts: string[] = [];
  const definitions: string[] = [];
  const bestPractices: string[] = [];
  const rules: string[] = [];
  const workflows: string[] = [];
  const examples: string[] = [];
  const recommendations: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (LOW_QUALITY_MARKERS.some((marker) => lower.includes(marker))) continue;
    if (/definition:|is defined as/.test(lower)) definitions.push(line);
    else if (/best practice|tip:/.test(lower)) bestPractices.push(line);
    else if (/\b(must|never|always|rule:)\b/.test(lower)) rules.push(line);
    else if (/workflow|step\s*\d+/.test(lower)) workflows.push(line);
    else if (/example:|for example/.test(lower)) examples.push(line);
    else if (/recommend|recommendation|prefer/.test(lower)) recommendations.push(line);
    else if (/concept:|principle:/.test(lower) || line.length > 40) concepts.push(line);
  }

  return {
    concepts: unique(concepts),
    definitions: unique(definitions),
    bestPractices: unique(bestPractices),
    rules: unique(rules),
    workflows: unique(workflows),
    examples: unique(examples),
    recommendations: unique(recommendations),
    metadata: { extractedLineCount: String(lines.length) },
  };
}

export function fingerprintKnowledge(kind: KnowledgeItemKind, title: string, content: string): string {
  const normalized = `${kind}|${title}|${content}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `kf-${hash.toString(16)}-${normalized.length}`;
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
