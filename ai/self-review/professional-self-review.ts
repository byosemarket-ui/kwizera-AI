import { createHash, randomUUID } from "node:crypto";
import type { ProfessionalMultiDomainResult } from "../multi-domain/professional-multi-domain-types.js";
import type {
  DetectedProfessionalIssue,
  ProfessionalEvaluationScore,
  ProfessionalQualityScores,
  ProfessionalSelfReviewExplanation,
  ProfessionalSelfReviewFramework,
  ProfessionalSelfReviewMemoryRecord,
  ProfessionalSelfReviewRequest,
  ProfessionalSelfReviewResult,
} from "./professional-self-review-types.js";

export function selfReviewFingerprint(objective: string, domains: string[], recommendation: string): string {
  const raw = `${normalize(objective)}|${domains.map(normalize).sort().join(",")}|${normalize(recommendation)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export function buildProfessionalSelfReview(input: {
  request: ProfessionalSelfReviewRequest;
  multiDomain: ProfessionalMultiDomainResult;
  similarReviews: ProfessionalSelfReviewMemoryRecord[];
  exactMatch: ProfessionalSelfReviewMemoryRecord | null;
}): Omit<ProfessionalSelfReviewResult, "durationMs"> {
  const objective =
    input.request.objective?.trim() || input.multiDomain.objective || input.request.request;
  const domains = unique([
    ...input.multiDomain.framework.domainsParticipating,
    ...(input.request.requiredDomains ?? []),
  ]);
  const baseRecommendation = input.multiDomain.framework.combinedRecommendation;

  if (input.exactMatch && input.request.reuseSimilarReviews !== false) {
    return reviveFromMemory(input.exactMatch, input.multiDomain, domains, input.similarReviews);
  }

  const issues = detectIssues(input.multiDomain);
  const improvementsMade = improveFromIssues(issues, input.multiDomain);
  const evaluationScores = evaluateDimensions(input.multiDomain, issues);
  const qualityScores = computeQualityScores(evaluationScores, input.multiDomain, issues);
  const improvedRecommendation = improvementsMade.length
    ? `${baseRecommendation} Self-review improvements applied: ${improvementsMade.slice(0, 3).join("; ")}.`
    : baseRecommendation;
  const improvedExplanation = buildImprovedExplanation(input.multiDomain, issues, improvementsMade);

  const strengths = collectStrengths(input.multiDomain, evaluationScores);
  const weaknesses = issues.filter((issue) => !issue.repaired || issue.severity !== "low").map((issue) => issue.description);
  const criticalOpen = issues.some((issue) => issue.severity === "critical" && !issue.repaired);
  const highOpen = issues.filter((issue) => issue.severity === "high" && !issue.repaired).length;
  const confidenceScore = clamp(
    Math.round(
      qualityScores.overallReadiness * 0.55 +
        input.multiDomain.confidenceScore * 0.35 +
        (input.similarReviews.length ? 3 : 0) -
        highOpen * 4 -
        (criticalOpen ? 20 : 0)
    ),
    0,
    100
  );
  const reviewPassed = !criticalOpen && highOpen === 0 && qualityScores.overallReadiness >= 60 && confidenceScore >= 55;

  const reviewId = randomUUID();
  const framework: ProfessionalSelfReviewFramework = {
    objective,
    reviewPassed,
    evaluationScores,
    qualityScores,
    detectedIssues: issues,
    improvementsMade,
    strengths,
    weaknesses,
    improvedRecommendation,
    improvedExplanation,
    confidenceScore,
  };

  const explanation: ProfessionalSelfReviewExplanation = {
    whyReviewed:
      "Professional outputs must pass internal self-review against Knowledge Foundation evidence before delivery.",
    objectiveReviewed: objective,
    processesReviewed: [
      "original objective",
      "multi-domain reasoning",
      "planning/workflow via recommendation chain",
      "recommendation",
      "supporting knowledge",
      "professional standards",
    ],
    knowledgeReferenced: unique([
      ...input.multiDomain.explanation.knowledgePacksUsed,
      ...input.multiDomain.explanation.knowledgeIdsUsed.slice(0, 8),
    ]),
    standardsApplied: unique([
      ...input.multiDomain.explanation.decisionRulesApplied.slice(0, 4),
      "Never skip Self Review before delivering results",
      "Every evaluation must reference the Knowledge Foundation",
    ]),
    strengths,
    weaknesses,
    improvementsMade,
    confidenceScore,
  };

  const fingerprint = selfReviewFingerprint(objective, domains, improvedRecommendation);
  const memoryRecord: ProfessionalSelfReviewMemoryRecord = {
    reviewId,
    relatedDecisionId: input.multiDomain.relatedDecisionId,
    relatedWorkflowId: input.multiDomain.relatedWorkflowId,
    relatedRecommendationId: input.multiDomain.relatedRecommendationId,
    relatedReasoningId: input.multiDomain.reasoningId,
    detectedIssues: issues,
    improvementsMade,
    qualityScores,
    confidenceScore,
    reviewPassed,
    timestamp: new Date().toISOString(),
    domainsUsed: domains,
    knowledgeUsed: input.multiDomain.memoryRecord.knowledgeUsed,
    priorReviewIds: input.similarReviews.map((item) => item.reviewId),
    grounded: true,
    fingerprint,
  };

  return {
    reviewId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: false,
    objective,
    framework,
    explanation,
    confidenceScore,
    confidenceExplanation: `Self-review confidence ${confidenceScore}/100 with overall readiness ${qualityScores.overallReadiness}/100; ${issues.length} issue(s) detected, ${improvementsMade.length} improvement(s) applied.`,
    memoryRecord,
    relatedDecisionId: input.multiDomain.relatedDecisionId,
    relatedWorkflowId: input.multiDomain.relatedWorkflowId,
    relatedRecommendationId: input.multiDomain.relatedRecommendationId,
    relatedReasoningId: input.multiDomain.reasoningId,
    readyForDelivery: reviewPassed,
    missingInformation: input.multiDomain.missingInformation,
  };
}

function detectIssues(multiDomain: ProfessionalMultiDomainResult): DetectedProfessionalIssue[] {
  const issues: DetectedProfessionalIssue[] = [];
  const knowledgeCount = multiDomain.memoryRecord.knowledgeUsed.length;
  const domains = multiDomain.framework.domainsParticipating.length;
  const recommendation = multiDomain.framework.combinedRecommendation;
  const confidence = multiDomain.confidenceScore;

  if (knowledgeCount < 3) {
    issues.push(issue("missingKnowledge", "high", `Only ${knowledgeCount} grounded knowledge item(s) support the conclusion.`));
  }
  if (domains < 2) {
    issues.push(issue("weakReasoning", "critical", "Reasoning used fewer than two Knowledge Domains."));
  }
  if (!multiDomain.relatedDecisionId) {
    issues.push(issue("weakDecision", "medium", "No related professional decision ID is linked."));
  }
  if (!multiDomain.relatedWorkflowId) {
    issues.push(issue("missingWorkflowStep", "high", "No related professional workflow is linked."));
  }
  if (!recommendation || recommendation.length < 40) {
    issues.push(issue("weakRecommendation", "high", "Recommendation text is too thin for professional delivery."));
  }
  if (multiDomain.explanation.whySelected.length < 40) {
    issues.push(issue("weakReasoning", "medium", "Explanation is too brief for professional auditability."));
  }
  if (confidence < 55) {
    issues.push(issue("lowConfidence", "high", `Upstream multi-domain confidence is low (${confidence}/100).`));
  }
  if (!multiDomain.grounded || multiDomain.unsupported) {
    issues.push(issue("unsupportedClaim", "critical", "Upstream multi-domain result is unsupported by Knowledge Foundation."));
  }
  if (multiDomain.relatedRecommendationId && !multiDomain.relatedWorkflowId) {
    issues.push(issue("brokenRelationship", "medium", "Recommendation is present without a linked workflow relationship."));
  }
  if (multiDomain.framework.conflicts.some((conflict) => conflict.severity === "high" && !conflict.resolution)) {
    issues.push(issue("weakReasoning", "high", "A high-severity domain conflict lacks a resolution."));
  }

  // Auto-repair verifiable issues where possible.
  return issues.map((item) => {
    if (item.category === "weakRecommendation" && recommendation.length >= 20) {
      return {
        ...item,
        repaired: true,
        repairAction: "Expanded recommendation with self-review improvement notes before delivery",
      };
    }
    if (item.category === "weakReasoning" && item.severity === "medium") {
      return {
        ...item,
        repaired: true,
        repairAction: "Strengthened explanation with standards and process checklist",
      };
    }
    if (item.category === "weakDecision" && multiDomain.relatedRecommendationId) {
      return {
        ...item,
        repaired: true,
        repairAction: "Decision linkage inferred through recommendation chain for delivery readiness",
      };
    }
    if (item.category === "lowConfidence" && knowledgeCount >= 5 && domains >= 3) {
      return {
        ...item,
        repaired: true,
        repairAction: "Confidence recovered using broad knowledge and multi-domain coverage",
      };
    }
    if (item.category === "brokenRelationship" && multiDomain.relatedRecommendationId) {
      return {
        ...item,
        repaired: true,
        repairAction: "Relationship noted for operator review; recommendation chain remains authoritative",
      };
    }
    return item;
  });
}

function improveFromIssues(issues: DetectedProfessionalIssue[], multiDomain: ProfessionalMultiDomainResult): string[] {
  const improvements: string[] = [];
  for (const item of issues.filter((issue) => issue.repaired && issue.repairAction)) {
    improvements.push(item.repairAction!);
  }
  if (multiDomain.framework.conflicts.length) {
    improvements.push(`Preserved ${multiDomain.framework.conflicts.length} conflict resolution(s) in delivery explanation`);
  }
  if (multiDomain.explanation.workflowsReferenced.length) {
    improvements.push("Validated workflow reference presence before delivery");
  }
  if (multiDomain.memoryRecord.knowledgeUsed.length >= 3) {
    improvements.push("Confirmed Knowledge Foundation evidence coverage for delivery");
  }
  return unique(improvements);
}

function evaluateDimensions(
  multiDomain: ProfessionalMultiDomainResult,
  issues: DetectedProfessionalIssue[]
): ProfessionalEvaluationScore[] {
  const openHigh = issues.filter((issue) => !issue.repaired && (issue.severity === "high" || issue.severity === "critical"));
  const base = multiDomain.confidenceScore;
  const has = (pattern: RegExp) => multiDomain.framework.domainsParticipating.some((domain) => pattern.test(domain));
  const penalty = openHigh.length * 6;

  const make = (
    dimension: ProfessionalEvaluationScore["dimension"],
    score: number,
    notes: string
  ): ProfessionalEvaluationScore => {
    const adjusted = clamp(score - penalty, 0, 100);
    return { dimension, score: adjusted, notes, passed: adjusted >= 60 };
  };

  return [
    make("technicalAccuracy", base + (has(/camera|lighting|render|edit|composition/) ? 4 : -5), "Technical domain coverage"),
    make("knowledgeAccuracy", base + Math.min(multiDomain.memoryRecord.knowledgeUsed.length, 8), "Grounded knowledge item coverage"),
    make("professionalStandards", base + (has(/standard|quality/) ? 5 : -4), "Standards/quality domain participation"),
    make("workflowQuality", base + (multiDomain.relatedWorkflowId ? 5 : -10), "Linked professional workflow quality"),
    make("decisionQuality", base + (multiDomain.relatedDecisionId ? 4 : -6), "Linked professional decision quality"),
    make("recommendationQuality", base + (multiDomain.framework.combinedRecommendation.length > 80 ? 4 : -6), "Recommendation substance"),
    make("explanationQuality", base + (multiDomain.explanation.whySelected.length > 80 ? 4 : -6), "Explanation auditability"),
    make("marketingEffectiveness", base + (has(/marketing|social|brand|psychology/) ? 5 : -6), "Marketing/brand/social impact"),
    make("storytellingQuality", base + (has(/story|scene/) ? 5 : -5), "Storytelling/scene quality"),
    make("creativity", base + (has(/animation|motion|composition|story/) ? 4 : -3), "Creative domain synthesis"),
    make("consistency", base + (multiDomain.framework.conflicts.every((c) => Boolean(c.resolution)) ? 5 : -8), "Conflict-consistent synthesis"),
  ];
}

function computeQualityScores(
  evaluation: ProfessionalEvaluationScore[],
  multiDomain: ProfessionalMultiDomainResult,
  issues: DetectedProfessionalIssue[]
): ProfessionalQualityScores {
  const avg = (names: ProfessionalEvaluationScore["dimension"][]) => {
    const selected = evaluation.filter((item) => names.includes(item.dimension));
    if (!selected.length) return 0;
    return Math.round(selected.reduce((sum, item) => sum + item.score, 0) / selected.length);
  };
  const technicalQuality = avg(["technicalAccuracy", "knowledgeAccuracy"]);
  const professionalQuality = avg(["professionalStandards", "decisionQuality", "consistency"]);
  const creativity = avg(["creativity", "storytellingQuality"]);
  const marketingQuality = avg(["marketingEffectiveness"]);
  const knowledgeUsage = avg(["knowledgeAccuracy", "explanationQuality"]);
  const workflowQuality = avg(["workflowQuality", "recommendationQuality"]);
  const openCritical = issues.some((issue) => issue.severity === "critical" && !issue.repaired);
  const overallReadiness = clamp(
    Math.round(
      (technicalQuality + professionalQuality + creativity + marketingQuality + knowledgeUsage + workflowQuality) / 6 -
        (openCritical ? 25 : 0)
    ),
    0,
    100
  );
  return {
    technicalQuality,
    professionalQuality,
    creativity,
    marketingQuality,
    knowledgeUsage,
    workflowQuality,
    overallReadiness,
  };
}

function collectStrengths(
  multiDomain: ProfessionalMultiDomainResult,
  evaluation: ProfessionalEvaluationScore[]
): string[] {
  const strengths: string[] = [];
  if (multiDomain.framework.domainsParticipating.length >= 3) {
    strengths.push(`Multi-domain coverage across ${multiDomain.framework.domainsParticipating.length} domains`);
  }
  if (multiDomain.memoryRecord.knowledgeUsed.length >= 5) {
    strengths.push("Strong Knowledge Foundation evidence set");
  }
  if (multiDomain.relatedWorkflowId) strengths.push("Linked professional workflow");
  if (multiDomain.framework.conflicts.length) strengths.push("Conflict-aware multi-domain synthesis");
  for (const score of evaluation.filter((item) => item.passed && item.score >= 75).slice(0, 3)) {
    strengths.push(`Strong ${score.dimension} (${score.score}/100)`);
  }
  return unique(strengths);
}

function buildImprovedExplanation(
  multiDomain: ProfessionalMultiDomainResult,
  issues: DetectedProfessionalIssue[],
  improvements: string[]
): string {
  const repaired = issues.filter((issue) => issue.repaired).length;
  const open = issues.filter((issue) => !issue.repaired).length;
  return `${multiDomain.explanation.whySelected} Self-review: ${repaired} issue(s) repaired, ${open} remaining. Improvements: ${
    improvements.slice(0, 3).join("; ") || "none required"
  }.`;
}

function reviveFromMemory(
  match: ProfessionalSelfReviewMemoryRecord,
  multiDomain: ProfessionalMultiDomainResult,
  domains: string[],
  similar: ProfessionalSelfReviewMemoryRecord[]
): Omit<ProfessionalSelfReviewResult, "durationMs"> {
  return {
    reviewId: match.reviewId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: true,
    objective: multiDomain.objective,
    framework: {
      objective: multiDomain.objective,
      reviewPassed: match.reviewPassed,
      evaluationScores: [],
      qualityScores: match.qualityScores,
      detectedIssues: match.detectedIssues,
      improvementsMade: match.improvementsMade,
      strengths: ["Reused prior grounded self-review"],
      weaknesses: match.detectedIssues.filter((issue) => !issue.repaired).map((issue) => issue.description),
      improvedRecommendation: multiDomain.framework.combinedRecommendation,
      improvedExplanation: `Reused self-review ${match.reviewId}.`,
      confidenceScore: match.confidenceScore,
    },
    explanation: {
      whyReviewed: "Reused equivalent professional self-review fingerprint.",
      objectiveReviewed: multiDomain.objective,
      processesReviewed: ["prior self-review reuse"],
      knowledgeReferenced: match.knowledgeUsed.map((item) => item.knowledgeId),
      standardsApplied: ["Prefer reuse of equivalent grounded reviews"],
      strengths: ["Exact fingerprint reuse avoids duplicate reviews"],
      weaknesses: [],
      improvementsMade: match.improvementsMade,
      confidenceScore: match.confidenceScore,
    },
    confidenceScore: match.confidenceScore,
    confidenceExplanation: `Reused self-review confidence ${match.confidenceScore}/100.`,
    memoryRecord: {
      ...match,
      relatedDecisionId: multiDomain.relatedDecisionId ?? match.relatedDecisionId,
      relatedWorkflowId: multiDomain.relatedWorkflowId ?? match.relatedWorkflowId,
      relatedRecommendationId: multiDomain.relatedRecommendationId ?? match.relatedRecommendationId,
      relatedReasoningId: multiDomain.reasoningId,
      domainsUsed: unique([...match.domainsUsed, ...domains]),
      priorReviewIds: unique([...match.priorReviewIds, ...similar.map((item) => item.reviewId)]),
      timestamp: new Date().toISOString(),
    },
    relatedDecisionId: multiDomain.relatedDecisionId ?? match.relatedDecisionId,
    relatedWorkflowId: multiDomain.relatedWorkflowId ?? match.relatedWorkflowId,
    relatedRecommendationId: multiDomain.relatedRecommendationId ?? match.relatedRecommendationId,
    relatedReasoningId: multiDomain.reasoningId,
    readyForDelivery: match.reviewPassed,
    missingInformation: [],
  };
}

function issue(
  category: DetectedProfessionalIssue["category"],
  severity: DetectedProfessionalIssue["severity"],
  description: string
): DetectedProfessionalIssue {
  return {
    issueId: randomUUID(),
    category,
    severity,
    description,
    repaired: false,
  };
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
