import { createHash, randomUUID } from "node:crypto";
import type { ProfessionalDecisionResult } from "../decision/professional-decision-types.js";
import type { ProfessionalWorkflowResult } from "../workflow/professional-workflow-types.js";
import type { ProfessionalRecommendationMemoryStore } from "./professional-recommendation-memory.js";
import type {
  ProfessionalRecommendationAlternative,
  ProfessionalRecommendationFramework,
  ProfessionalRecommendationMemoryRecord,
  ProfessionalRecommendationRequest,
  ProfessionalRecommendationResult,
} from "./professional-recommendation-types.js";

export function recommendationFingerprint(
  objective: string,
  domains: string[],
  recommendedSolution: string
): string {
  const raw = `${normalize(objective)}|${domains.map(normalize).sort().join(",")}|${normalize(recommendedSolution)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export function buildProfessionalRecommendation(input: {
  request: ProfessionalRecommendationRequest;
  workflow: ProfessionalWorkflowResult;
  decision: ProfessionalDecisionResult | null;
  similarRecommendations: ProfessionalRecommendationMemoryRecord[];
  exactMatch: ProfessionalRecommendationMemoryRecord | null;
  priorWorkflowIds: string[];
}): Omit<ProfessionalRecommendationResult, "durationMs"> {
  const domains = unique([
    ...input.workflow.explanation.domainsUsed,
    ...(input.decision?.explanation.domainsUsed ?? []),
    ...(input.request.requiredDomains ?? []),
  ]);

  if (input.exactMatch && input.request.reuseSimilarRecommendations !== false) {
    return reviveRecommendationFromMemory(input.exactMatch, input.workflow, input.decision, input.similarRecommendations);
  }

  const alternatives = buildAlternatives(input.decision, input.workflow, input.priorWorkflowIds);
  const best = alternatives[0];
  const recommendedSolution =
    best?.summary ??
    input.decision?.framework.finalRecommendation ??
    `Follow professional workflow "${input.workflow.definition.workflowName}" grounded in verified knowledge.`;

  const fingerprint = recommendationFingerprint(
    input.workflow.definition.goal || input.request.objective || input.request.request,
    domains,
    recommendedSolution
  );

  const advantages = unique([
    ...(best?.advantages ?? []),
    ...(input.decision?.framework.advantages.slice(0, 4) ?? []),
    `Workflow ${input.workflow.definition.workflowName} provides ${input.workflow.definition.allTasks.length} sequenced professional tasks`,
  ]);
  const disadvantages = unique([
    ...(best?.disadvantages ?? []),
    ...(input.decision?.framework.disadvantages.slice(0, 3) ?? []),
  ]);
  const risks = unique([
    ...(best?.risks ?? []),
    ...(input.decision?.framework.risks.slice(0, 3) ?? []),
    ...input.workflow.definition.recoverySteps.slice(0, 2).map((step) => `Recovery needed if: ${step}`),
  ]);
  const bestPractices = unique([
    ...(input.decision?.framework.bestPractices.slice(0, 5) ?? []),
    "Validate against industry standards before final delivery",
    "Reuse grounded workflows instead of inventing unsupported steps",
  ]);
  const expectedResults = unique([
    ...input.workflow.definition.expectedResults.slice(0, 5),
    ...(input.decision?.explanation.expectedOutcome ? [input.decision.explanation.expectedOutcome] : []),
  ]);
  const professionalStandards = unique([
    ...(input.decision?.framework.professionalStandards.slice(0, 5) ?? []),
    ...(input.decision?.explanation.professionalStandardsApplied.slice(0, 5) ?? []),
    "Knowledge Foundation grounding required for every recommendation",
  ]);

  const confidenceScore = clamp(
    Math.round(
      (input.workflow.confidenceScore * 0.45 +
        (input.decision?.confidenceScore ?? input.workflow.confidenceScore) * 0.45 +
        (input.similarRecommendations.length ? 4 : 0) +
        (domains.length > 1 ? 2 : 0))
    ),
    0,
    100
  );

  const objective = input.request.objective?.trim() || input.workflow.definition.goal || input.request.request;
  const recommendationId = randomUUID();

  const framework: ProfessionalRecommendationFramework = {
    objective,
    recommendedSolution,
    alternativeSolutions: alternatives,
    advantages,
    disadvantages,
    risks,
    bestPractices,
    expectedResults,
    professionalStandards,
    confidenceScore,
  };

  const workflowsConsidered = unique([
    input.workflow.workflowId,
    ...input.priorWorkflowIds,
    ...alternatives.map((item) => item.relatedWorkflowId).filter(Boolean) as string[],
  ]);
  const decisionsInfluenced = unique(
    [
      input.workflow.relatedDecisionId,
      input.decision?.decisionId,
      ...(input.decision?.memoryRecord.priorDecisionIds ?? []),
    ].filter(Boolean) as string[]
  );

  const explanation = {
    whySelected: `Selected because it is grounded in Knowledge Foundation evidence via professional workflow ${input.workflow.workflowId}${
      input.decision ? ` and decision ${input.decision.decisionId}` : ""
    }: ${input.workflow.explanation.whySelected}`,
    knowledgePacksUsed: unique([
      ...input.workflow.explanation.knowledgePacksUsed,
      ...(input.decision?.explanation.knowledgePacksUsed ?? []),
    ]),
    knowledgeIdsUsed: unique([
      ...input.workflow.explanation.knowledgeIdsUsed,
      ...(input.decision?.explanation.knowledgeIdsUsed ?? []),
    ]),
    workflowsConsidered,
    decisionsInfluenced,
    professionalStandardsApplied: professionalStandards,
    expectedBenefits: expectedResults.slice(0, 4),
    domainsUsed: domains,
    rankingReason: alternatives
      .map((alt) => `Rank ${alt.rank}: ${alt.title} — ${alt.whyRanked}`)
      .join(" "),
    confidenceScore,
  };

  const memoryRecord: ProfessionalRecommendationMemoryRecord = {
    recommendationId,
    context: {
      request: input.request.request,
      objective,
      constraints: input.request.constraints ?? [],
      availableResources: input.request.availableResources ?? input.workflow.definition.requiredResources,
      missingInformation: [],
    },
    knowledgeUsed: uniqueById([
      ...input.workflow.memoryRecord.knowledgeUsed,
      ...(input.decision?.memoryRecord.knowledgeUsed ?? []),
    ]),
    relatedWorkflowId: input.workflow.workflowId,
    relatedDecisionId: input.workflow.relatedDecisionId ?? input.decision?.decisionId ?? null,
    relatedPlanId: input.workflow.relatedPlanId,
    recommendedSolution,
    alternativeTitles: alternatives.map((item) => item.title),
    confidenceScore,
    userFeedback: input.request.userFeedback ?? null,
    timestamp: new Date().toISOString(),
    relatedKnowledgePacks: explanation.knowledgePacksUsed,
    domainsUsed: domains,
    priorRecommendationIds: input.similarRecommendations.map((item) => item.recommendationId),
    grounded: true,
    fingerprint,
  };

  return {
    recommendationId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: false,
    objective,
    framework,
    explanation,
    confidenceScore,
    confidenceExplanation: `Recommendation confidence ${confidenceScore}/100 from workflow ${input.workflow.confidenceScore}/100${
      input.decision ? ` and decision ${input.decision.confidenceScore}/100` : ""
    }.`,
    memoryRecord,
    relatedWorkflowId: input.workflow.workflowId,
    relatedDecisionId: memoryRecord.relatedDecisionId,
    relatedPlanId: input.workflow.relatedPlanId,
    multiDomain: domains.length > 1 || input.workflow.multiDomain,
    missingInformation: input.decision?.missingInformation ?? [],
  };
}

export function applyRecommendationFeedback(
  current: ProfessionalRecommendationResult,
  feedback: string,
  memory: ProfessionalRecommendationMemoryStore
): ProfessionalRecommendationResult {
  const memoryRecord: ProfessionalRecommendationMemoryRecord = {
    ...current.memoryRecord,
    userFeedback: feedback.trim(),
    timestamp: new Date().toISOString(),
  };
  memory.update(memoryRecord);
  return {
    ...current,
    memoryRecord,
    confidenceExplanation: `${current.confidenceExplanation} User feedback recorded.`,
  };
}

function buildAlternatives(
  decision: ProfessionalDecisionResult | null,
  workflow: ProfessionalWorkflowResult,
  priorWorkflowIds: string[]
): ProfessionalRecommendationAlternative[] {
  const options = (decision?.framework.availableOptions ?? [])
    .slice()
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const selected = options.find((option) => option.selected) ?? options[0];
  const second = options.filter((option) => option.optionId !== selected?.optionId)[0];
  const third = options.filter((option) => option.optionId !== selected?.optionId && option.optionId !== second?.optionId)[0];

  const alternatives: ProfessionalRecommendationAlternative[] = [];

  alternatives.push({
    rank: 1,
    title: selected?.title ?? workflow.definition.workflowName,
    summary:
      selected?.guidance ??
      `Execute professional workflow "${workflow.definition.workflowName}" with ${workflow.definition.allTasks.length} tasks.`,
    advantages: selected?.advantages?.length
      ? selected.advantages
      : [`Grounded workflow confidence ${workflow.confidenceScore}/100`, ...workflow.definition.expectedResults.slice(0, 2)],
    disadvantages: selected?.disadvantages?.length
      ? selected.disadvantages
      : ["Requires complete professional context before execution"],
    risks: selected?.risks?.length ? selected.risks : workflow.definition.recoverySteps.slice(0, 2),
    confidenceScore: selected?.confidenceScore ?? workflow.confidenceScore,
    whyRanked: "Best match to verified Knowledge Foundation evidence, decision recommendation, and reusable workflow structure.",
    relatedDecisionOptionId: selected?.optionId,
    relatedWorkflowId: workflow.workflowId,
  });

  if (second || priorWorkflowIds[0]) {
    alternatives.push({
      rank: 2,
      title: second?.title ?? `Alternate workflow path (${priorWorkflowIds[0] ?? "similar"})`,
      summary:
        second?.guidance ??
        "Reuse a similar prior professional workflow with adjusted domain emphasis.",
      advantages: second?.advantages ?? ["Faster reuse of prior professional sequencing"],
      disadvantages: second?.disadvantages ?? ["May fit the current objective less precisely"],
      risks: second?.risks ?? ["Domain mismatch if prior context differs"],
      confidenceScore: second?.confidenceScore ?? Math.max(40, workflow.confidenceScore - 8),
      whyRanked: "Strong alternative with slightly lower evidence fit or narrower domain coverage.",
      relatedDecisionOptionId: second?.optionId,
      relatedWorkflowId: priorWorkflowIds[0],
    });
  }

  if (third || workflow.definition.parallelGroups.length) {
    alternatives.push({
      rank: 3,
      title: third?.title ?? "Conservative sequential professional path",
      summary:
        third?.guidance ??
        "Run the same professional workflow sequentially with stricter validation checkpoints and reduced parallelism.",
      advantages: third?.advantages ?? ["Lower coordination risk", "Clearer validation checkpoints"],
      disadvantages: third?.disadvantages ?? ["Longer estimated duration", "Less concurrency"],
      risks: third?.risks ?? ["May under-utilize available parallel capacity"],
      confidenceScore: third?.confidenceScore ?? Math.max(35, workflow.confidenceScore - 15),
      whyRanked: "Viable fallback when risk tolerance is low or parallel coordination is constrained.",
      relatedDecisionOptionId: third?.optionId,
      relatedWorkflowId: workflow.workflowId,
    });
  }

  return alternatives.slice(0, 3) as ProfessionalRecommendationAlternative[];
}

function reviveRecommendationFromMemory(
  match: ProfessionalRecommendationMemoryRecord,
  workflow: ProfessionalWorkflowResult,
  decision: ProfessionalDecisionResult | null,
  similar: ProfessionalRecommendationMemoryRecord[]
): Omit<ProfessionalRecommendationResult, "durationMs"> {
  const alternatives: ProfessionalRecommendationAlternative[] = match.alternativeTitles.map((title, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    title,
    summary: index === 0 ? match.recommendedSolution : `Alternative: ${title}`,
    advantages: [],
    disadvantages: [],
    risks: [],
    confidenceScore: Math.max(30, match.confidenceScore - index * 8),
    whyRanked: index === 0 ? "Reused best prior recommendation." : `Preserved rank ${index + 1} alternative from prior recommendation.`,
    relatedWorkflowId: match.relatedWorkflowId ?? undefined,
  }));

  if (!alternatives.length) {
    alternatives.push({
      rank: 1,
      title: "Reused professional recommendation",
      summary: match.recommendedSolution,
      advantages: [],
      disadvantages: [],
      risks: [],
      confidenceScore: match.confidenceScore,
      whyRanked: "Exact fingerprint match avoids duplicate recommendations.",
      relatedWorkflowId: match.relatedWorkflowId ?? undefined,
    });
  }

  return {
    recommendationId: match.recommendationId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: true,
    objective: match.context.objective,
    framework: {
      objective: match.context.objective,
      recommendedSolution: match.recommendedSolution,
      alternativeSolutions: alternatives.slice(0, 3),
      advantages: ["Reused grounded recommendation instead of inventing a duplicate"],
      disadvantages: [],
      risks: [],
      bestPractices: ["Prefer reuse when fingerprints match"],
      expectedResults: workflow.definition.expectedResults.slice(0, 4),
      professionalStandards: decision?.framework.professionalStandards.slice(0, 4) ?? [
        "Knowledge Foundation grounding required for every recommendation",
      ],
      confidenceScore: match.confidenceScore,
    },
    explanation: {
      whySelected: `Reused existing professional recommendation ${match.recommendationId} for equivalent objective and solution fingerprint.`,
      knowledgePacksUsed: match.relatedKnowledgePacks,
      knowledgeIdsUsed: match.knowledgeUsed.map((item) => item.knowledgeId),
      workflowsConsidered: unique([match.relatedWorkflowId, workflow.workflowId].filter(Boolean) as string[]),
      decisionsInfluenced: unique([match.relatedDecisionId, decision?.decisionId].filter(Boolean) as string[]),
      professionalStandardsApplied: decision?.explanation.professionalStandardsApplied ?? [],
      expectedBenefits: workflow.definition.expectedResults.slice(0, 3),
      domainsUsed: match.domainsUsed,
      rankingReason: "Exact fingerprint reuse preserves prior ranking.",
      confidenceScore: match.confidenceScore,
    },
    confidenceScore: match.confidenceScore,
    confidenceExplanation: `Reused recommendation confidence ${match.confidenceScore}/100.`,
    memoryRecord: {
      ...match,
      relatedWorkflowId: workflow.workflowId,
      relatedDecisionId: workflow.relatedDecisionId ?? decision?.decisionId ?? match.relatedDecisionId,
      relatedPlanId: workflow.relatedPlanId ?? match.relatedPlanId,
      priorRecommendationIds: unique([...match.priorRecommendationIds, ...similar.map((item) => item.recommendationId)]),
      timestamp: new Date().toISOString(),
    },
    relatedWorkflowId: workflow.workflowId,
    relatedDecisionId: workflow.relatedDecisionId ?? decision?.decisionId ?? match.relatedDecisionId,
    relatedPlanId: workflow.relatedPlanId ?? match.relatedPlanId,
    multiDomain: match.domainsUsed.length > 1,
    missingInformation: [],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueById<T extends { knowledgeId: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value.knowledgeId)) continue;
    seen.add(value.knowledgeId);
    out.push(value);
  }
  return out;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
