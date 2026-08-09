import { randomUUID } from "node:crypto";
import type { ProfessionalDecisionResult } from "../decision/professional-decision-types.js";
import type {
  ProfessionalPlanDependency,
  ProfessionalPlanFramework,
  ProfessionalPlanMemoryRecord,
  ProfessionalPlanModification,
  ProfessionalPlanTask,
  ProfessionalPlanningRequest,
  ProfessionalPlanningResult,
} from "./professional-planning-types.js";
import type { ProfessionalPlanMemoryStore } from "./professional-plan-memory.js";

const DOMAIN_WORKFLOW: Array<{ domain: string; match: string[]; steps: string[]; minutes: number }> = [
  { domain: "video-production-knowledge", match: ["video-production", "production"], steps: ["Define production brief", "Lock creative approach", "Prepare shoot plan"], minutes: 25 },
  { domain: "storytelling-knowledge", match: ["story", "scene"], steps: ["Define narrative arc", "Sequence scenes", "Map emotional beats"], minutes: 20 },
  { domain: "camera-knowledge", match: ["camera"], steps: ["Select camera settings", "Plan shot list"], minutes: 15 },
  { domain: "camera-movement-knowledge", match: ["camera-movement", "movement"], steps: ["Choose camera movements"], minutes: 10 },
  { domain: "lighting-knowledge", match: ["lighting", "light"], steps: ["Design lighting setup", "Validate exposure continuity"], minutes: 18 },
  { domain: "composition-knowledge", match: ["composition"], steps: ["Lock framing and composition rules"], minutes: 12 },
  { domain: "animation-knowledge", match: ["animation"], steps: ["Define animation style", "Build motion keyframes"], minutes: 22 },
  { domain: "motion-graphics", match: ["motion-graphics", "motion"], steps: ["Plan motion graphics overlays"], minutes: 16 },
  { domain: "rendering-knowledge", match: ["render", "export"], steps: ["Configure render settings", "Configure export presets"], minutes: 14 },
  { domain: "video-editing-knowledge", match: ["edit", "editing"], steps: ["Outline edit timeline", "Plan cut strategy"], minutes: 20 },
  { domain: "marketing-knowledge", match: ["marketing"], steps: ["Align marketing message", "Define CTA placement"], minutes: 15 },
  { domain: "branding-knowledge", match: ["brand"], steps: ["Apply brand voice and identity rules"], minutes: 12 },
  { domain: "customer-psychology", match: ["customer-psychology", "customer"], steps: ["Map audience attention triggers"], minutes: 10 },
  { domain: "sales-psychology", match: ["sales"], steps: ["Integrate persuasion cues without hype"], minutes: 10 },
  { domain: "social-media-knowledge", match: ["social"], steps: ["Select platform format", "Plan posting/engagement approach"], minutes: 14 },
  { domain: "industry-standards-knowledge", match: ["industry", "quality", "standard"], steps: ["Apply quality checklist", "Run final professional review"], minutes: 12 },
];

export function buildProfessionalPlanFromDecision(input: {
  request: ProfessionalPlanningRequest;
  decision: ProfessionalDecisionResult;
  similarPlans: ProfessionalPlanMemoryRecord[];
  reusedFromPlanId: string | null;
}): Omit<ProfessionalPlanningResult, "durationMs"> {
  const planId = randomUUID();
  const goal = input.request.objective?.trim() || input.decision.objective || input.request.request.trim();
  const domains = unique([
    ...(input.request.requiredDomains ?? []),
    ...input.decision.explanation.domainsUsed,
    ...input.decision.memoryRecord.domainsUsed,
  ]);

  const tasks = buildTasks(goal, domains, input.decision);
  const dependencies = buildDependencies(tasks);
  const parallelTasks = groupParallel(tasks);
  const stepOrder = [...tasks].sort((a, b) => a.order - b.order).map((task) => task.taskId);
  const estimatedExecutionMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const complexity = estimateComplexity(tasks.length, domains.length, input.decision.missingInformation.length);

  const requirements = unique([
    ...input.decision.framework.bestPractices.slice(0, 4),
    ...input.decision.constraints.map((item) => `Respect constraint: ${item}`),
    `Deliver: ${input.decision.framework.finalRecommendation}`,
  ]);

  const assumptions = unique([
    input.decision.availableResources.length
      ? `Available resources: ${input.decision.availableResources.join(", ")}`
      : "Core creative context will be refined as missing information is supplied.",
    "Execution will remain offline-first and Knowledge Foundation grounded.",
    input.decision.multiDomain ? "Multiple professional domains must stay consistent." : "Primary domain guidance drives the workflow.",
  ]);

  const requiredKnowledge = unique([
    ...input.decision.explanation.knowledgeIdsUsed,
    ...input.decision.explanation.knowledgePacksUsed,
    ...domains,
  ]);

  const framework: ProfessionalPlanFramework = {
    goal,
    requirements,
    assumptions,
    requiredKnowledge,
    requiredResources: unique([
      ...input.decision.availableResources,
      ...(input.request.availableResources ?? []),
      "knowledge-foundation",
      "professional-decision-intelligence",
    ]),
    professionalWorkflow: unique([
      input.decision.framework.finalRecommendation,
      ...tasks.filter((task) => task.kind === "main").map((task) => task.title),
    ]),
    taskBreakdown: tasks,
    stepOrder,
    dependencies,
    parallelTasks,
    expectedResults: unique([
      input.decision.explanation.expectedOutcome,
      ...tasks.filter((task) => task.kind === "validation").map((task) => task.expectedResult),
      "Approved professional execution plan ready for later workflow handoff (Workflow Intelligence not started).",
    ]),
    risks: unique([...input.decision.framework.risks, ...tasks.filter((t) => t.domain.includes("editing")).map(() => "Video editing knowledge pack is limited.")]),
    recommendations: unique([
      ...input.decision.framework.bestPractices.slice(0, 5),
      ...input.decision.missingInformation.map((item) => `Resolve missing ${item.field} before execution.`),
    ]),
    complexity,
    estimatedExecutionMinutes,
  };

  const reusedBoost = input.reusedFromPlanId || input.similarPlans.length ? 3 : 0;
  const confidenceScore = clamp(Math.round(input.decision.confidenceScore + reusedBoost - input.decision.missingInformation.filter((i) => i.severity === "important").length * 4), 0, 100);

  const explanation = {
    whySelected: `Plan selected from professional decision ${input.decision.decisionId}: ${input.decision.explanation.whySelected}`,
    knowledgePacksUsed: input.decision.explanation.knowledgePacksUsed,
    knowledgeIdsUsed: input.decision.explanation.knowledgeIdsUsed,
    taskOrderReason:
      "Tasks follow professional workflow order: brief and story first, capture/lighting next, finishing/render, then marketing/social packaging, ending with industry-standards validation. Parallel groups share no hard dependencies.",
    expectedOutcome: input.decision.explanation.expectedOutcome,
    confidenceScore,
    domainsUsed: domains,
  };

  const memoryRecord: ProfessionalPlanMemoryRecord = {
    planId,
    goal,
    reasoningSummary: explanation.whySelected.slice(0, 500),
    knowledgeUsed: input.decision.memoryRecord.knowledgeUsed,
    tasks: tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      order: task.order,
      dependsOn: task.dependsOn,
    })),
    dependencies,
    confidenceScore,
    timestamp: new Date().toISOString(),
    relatedDecisionId: input.decision.decisionId,
    domainsUsed: domains,
    relatedKnowledgePacks: input.decision.explanation.knowledgePacksUsed,
    priorPlanIds: input.similarPlans.map((plan) => plan.planId),
    grounded: true,
  };

  return {
    planId,
    available: true,
    grounded: true,
    unsupported: false,
    goal,
    constraints: unique([...input.decision.constraints, ...(input.request.constraints ?? [])]),
    missingInformation: input.decision.missingInformation,
    framework,
    explanation,
    confidenceScore,
    confidenceExplanation: `${input.decision.confidenceExplanation} Planning confidence ${confidenceScore}/100 with ${tasks.length} task(s) across ${domains.length} domain(s).`,
    memoryRecord,
    relatedDecisionId: input.decision.decisionId,
    reusedFromPlanId: input.reusedFromPlanId,
    multiDomain: domains.length > 1 || input.decision.multiDomain,
  };
}

export function modifyProfessionalPlanResult(
  current: ProfessionalPlanningResult,
  modification: ProfessionalPlanModification,
  memory: ProfessionalPlanMemoryStore
): ProfessionalPlanningResult {
  const tasks = current.framework.taskBreakdown.filter((task) => !(modification.removeTaskIds ?? []).includes(task.taskId));
  let ordered = tasks;
  if (modification.reorderTaskIds?.length) {
    const byId = new Map(tasks.map((task) => [task.taskId, task]));
    const reordered: ProfessionalPlanTask[] = [];
    for (const id of modification.reorderTaskIds) {
      const task = byId.get(id);
      if (task) {
        reordered.push(task);
        byId.delete(id);
      }
    }
    ordered = [...reordered, ...byId.values()].map((task, index) => ({ ...task, order: index + 1 }));
  }

  const framework: ProfessionalPlanFramework = {
    ...current.framework,
    requirements: unique([...current.framework.requirements, ...(modification.addRequirements ?? [])]),
    recommendations: unique([...current.framework.recommendations, ...(modification.addRecommendations ?? []), modification.notes].filter(Boolean) as string[]),
    taskBreakdown: ordered,
    stepOrder: ordered.map((task) => task.taskId),
    dependencies: buildDependencies(ordered),
    parallelTasks: groupParallel(ordered),
    estimatedExecutionMinutes: ordered.reduce((sum, task) => sum + task.estimatedMinutes, 0),
  };

  const planId = randomUUID();
  const memoryRecord: ProfessionalPlanMemoryRecord = {
    ...current.memoryRecord,
    planId,
    goal: current.goal,
    reasoningSummary: `Modified from ${current.planId}. ${modification.notes ?? "Plan adjusted for new requirements."}`,
    tasks: ordered.map((task) => ({ taskId: task.taskId, title: task.title, order: task.order, dependsOn: task.dependsOn })),
    dependencies: framework.dependencies,
    confidenceScore: clamp(current.confidenceScore - 2, 0, 100),
    timestamp: new Date().toISOString(),
    priorPlanIds: unique([...current.memoryRecord.priorPlanIds, current.planId]),
  };
  memory.append(memoryRecord);

  return {
    ...current,
    planId,
    framework,
    confidenceScore: memoryRecord.confidenceScore,
    explanation: {
      ...current.explanation,
      whySelected: `Modified professional plan derived from ${current.planId}. ${modification.notes ?? ""}`.trim(),
      confidenceScore: memoryRecord.confidenceScore,
      taskOrderReason: modification.reorderTaskIds?.length
        ? "Task order updated from explicit modification request while preserving unresolved dependencies."
        : current.explanation.taskOrderReason,
    },
    memoryRecord,
    reusedFromPlanId: current.planId,
    confidenceExplanation: `Modified plan confidence ${memoryRecord.confidenceScore}/100.`,
    durationMs: 0,
  };
}

export function optimizeProfessionalPlanResult(
  current: ProfessionalPlanningResult,
  memory: ProfessionalPlanMemoryStore
): ProfessionalPlanningResult {
  const optimizedTasks = current.framework.taskBreakdown.map((task) => {
    if (task.kind === "parallel") return task;
    const canParallel =
      task.dependsOn.length === 0 &&
      !/validation|final|review|checklist/i.test(task.title) &&
      !/brief|story|narrative/i.test(task.title);
    return canParallel ? { ...task, kind: "parallel" as const, parallelGroup: "capture-finish" } : task;
  });

  const framework: ProfessionalPlanFramework = {
    ...current.framework,
    taskBreakdown: optimizedTasks,
    parallelTasks: groupParallel(optimizedTasks),
    dependencies: buildDependencies(optimizedTasks),
    recommendations: unique([
      ...current.framework.recommendations,
      "Optimized for safe parallelization of independent capture/finish tasks.",
      "Validation remains sequential after upstream work completes.",
    ]),
    estimatedExecutionMinutes: Math.max(
      8,
      Math.round(current.framework.estimatedExecutionMinutes * 0.85)
    ),
  };

  const planId = randomUUID();
  const memoryRecord: ProfessionalPlanMemoryRecord = {
    ...current.memoryRecord,
    planId,
    reasoningSummary: `Optimized from ${current.planId} for parallel efficiency while preserving validation gates.`,
    tasks: optimizedTasks.map((task) => ({ taskId: task.taskId, title: task.title, order: task.order, dependsOn: task.dependsOn })),
    dependencies: framework.dependencies,
    confidenceScore: clamp(current.confidenceScore + 2, 0, 100),
    timestamp: new Date().toISOString(),
    priorPlanIds: unique([...current.memoryRecord.priorPlanIds, current.planId]),
  };
  memory.append(memoryRecord);

  return {
    ...current,
    planId,
    framework,
    confidenceScore: memoryRecord.confidenceScore,
    explanation: {
      ...current.explanation,
      whySelected: `Optimized professional plan from ${current.planId} by increasing safe parallelism and preserving final validation.`,
      taskOrderReason: "Independent non-validation tasks may run in parallel groups; dependent and validation tasks stay sequential.",
      confidenceScore: memoryRecord.confidenceScore,
    },
    memoryRecord,
    reusedFromPlanId: current.planId,
    confidenceExplanation: `Optimized plan confidence ${memoryRecord.confidenceScore}/100.`,
    durationMs: 0,
  };
}

function buildTasks(goal: string, domains: string[], decision: ProfessionalDecisionResult): ProfessionalPlanTask[] {
  const tasks: ProfessionalPlanTask[] = [];
  let order = 1;
  const matched = DOMAIN_WORKFLOW.filter((entry) =>
    domains.some((domain) => entry.match.some((token) => domain.toLowerCase().includes(token)))
  );
  const catalog = matched.length ? matched : DOMAIN_WORKFLOW.filter((entry) => entry.domain === "video-production-knowledge" || entry.domain === "industry-standards-knowledge");

  const firstMainId = `task-${order}`;
  tasks.push({
    taskId: firstMainId,
    title: "Clarify objective and professional decision",
    kind: "main",
    domain: "planning",
    description: `Anchor the plan on: ${decision.framework.finalRecommendation}`,
    order: order++,
    dependsOn: [],
    estimatedMinutes: 8,
    requiredKnowledge: decision.explanation.knowledgeIdsUsed.slice(0, 3),
    expectedResult: "Confirmed goal, constraints, and selected professional approach",
  });

  let previousMain = firstMainId;
  for (const entry of catalog) {
    const mainId = `task-${order}`;
    tasks.push({
      taskId: mainId,
      title: entry.steps[0] ?? entry.domain,
      kind: "main",
      domain: entry.domain,
      description: `${entry.steps[0]} for goal: ${goal}`,
      order: order++,
      dependsOn: [previousMain],
      estimatedMinutes: Math.max(6, Math.round(entry.minutes * 0.55)),
      requiredKnowledge: [entry.domain],
      expectedResult: entry.steps[0] ?? entry.domain,
    });
    previousMain = mainId;

    for (const step of entry.steps.slice(1)) {
      const subId = `task-${order}`;
      const parallelizable = /render|export|platform|posting|overlay|motion graphics/i.test(step);
      tasks.push({
        taskId: subId,
        title: step,
        kind: parallelizable ? "parallel" : "sub",
        domain: entry.domain,
        description: step,
        order: order++,
        dependsOn: [mainId],
        parallelGroup: parallelizable ? `${entry.domain}-finish` : undefined,
        estimatedMinutes: Math.max(5, Math.round(entry.minutes / Math.max(2, entry.steps.length))),
        requiredKnowledge: [entry.domain],
        expectedResult: step,
      });
    }
  }

  tasks.push({
    taskId: `task-${order}`,
    title: "Final professional validation",
    kind: "validation",
    domain: "industry-standards-knowledge",
    description: "Validate quality, standards, and readiness before any execution handoff.",
    order: order++,
    dependsOn: [previousMain],
    estimatedMinutes: 10,
    requiredKnowledge: ["industry-standards-knowledge"],
    expectedResult: "Plan validated against professional standards and known risks",
  });

  return tasks;
}

function buildDependencies(tasks: ProfessionalPlanTask[]): ProfessionalPlanDependency[] {
  const deps: ProfessionalPlanDependency[] = [];
  for (const task of tasks) {
    for (const parent of task.dependsOn) {
      deps.push({
        fromTaskId: parent,
        toTaskId: task.taskId,
        reason: `${task.title} requires completion of upstream task ${parent}`,
      });
    }
  }
  return deps;
}

function groupParallel(tasks: ProfessionalPlanTask[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.kind !== "parallel" || !task.parallelGroup) continue;
    const list = groups.get(task.parallelGroup) ?? [];
    list.push(task.taskId);
    groups.set(task.parallelGroup, list);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function estimateComplexity(taskCount: number, domainCount: number, missingCount: number): "low" | "medium" | "high" {
  const score = taskCount + domainCount * 2 + missingCount * 2;
  if (score >= 18) return "high";
  if (score >= 10) return "medium";
  return "low";
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
