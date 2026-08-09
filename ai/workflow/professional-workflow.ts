import { createHash, randomUUID } from "node:crypto";
import type { ProfessionalPlanningResult } from "../planning/professional-planning-types.js";
import type { ProfessionalWorkflowMemoryStore } from "./professional-workflow-memory.js";
import type {
  ProfessionalWorkflowDefinition,
  ProfessionalWorkflowDependency,
  ProfessionalWorkflowExecutionEvent,
  ProfessionalWorkflowExecutionResult,
  ProfessionalWorkflowMemoryRecord,
  ProfessionalWorkflowModification,
  ProfessionalWorkflowRequest,
  ProfessionalWorkflowResult,
  ProfessionalWorkflowTask,
} from "./professional-workflow-types.js";

const DOMAIN_MODULE_HINTS: Array<{ match: string; module: string }> = [
  { match: "camera", module: "video-knowledge-engine" },
  { match: "lighting", module: "video-knowledge-engine" },
  { match: "composition", module: "video-knowledge-engine" },
  { match: "story", module: "video-knowledge-engine" },
  { match: "animation", module: "video-knowledge-engine" },
  { match: "render", module: "video-knowledge-engine" },
  { match: "motion", module: "video-knowledge-engine" },
  { match: "edit", module: "creative-workspace" },
  { match: "marketing", module: "marketing-knowledge-engine" },
  { match: "brand", module: "marketing-knowledge-engine" },
  { match: "social", module: "marketing-knowledge-engine" },
  { match: "quality", module: "knowledge-validation-engine" },
  { match: "standard", module: "knowledge-validation-engine" },
  { match: "industry", module: "knowledge-validation-engine" },
  { match: "production", module: "video-knowledge-engine" },
];

export function workflowFingerprint(goal: string, domains: string[], taskTitles: string[]): string {
  const raw = `${normalize(goal)}|${domains.map(normalize).sort().join(",")}|${taskTitles.map(normalize).join(">")}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export function buildProfessionalWorkflowFromPlan(input: {
  request: ProfessionalWorkflowRequest;
  plan: ProfessionalPlanningResult;
  similarWorkflows: ProfessionalWorkflowMemoryRecord[];
  exactMatch: ProfessionalWorkflowMemoryRecord | null;
}): Omit<ProfessionalWorkflowResult, "durationMs"> {
  const domains = unique([...input.plan.explanation.domainsUsed, ...(input.request.requiredDomains ?? [])]);
  const tasks = mapPlanTasksToWorkflowTasks(input.plan);
  const fingerprint = workflowFingerprint(
    input.plan.goal,
    domains,
    tasks.map((task) => task.title)
  );

  if (input.exactMatch && input.request.reuseSimilarWorkflows !== false) {
    return reviveWorkflowFromMemory(input.exactMatch, input.plan, true, input.similarWorkflows);
  }

  const workflowId = randomUUID();
  const workflowName = buildWorkflowName(input.plan.goal, domains);
  const dependencies = tasks.flatMap((task) =>
    task.dependsOn.map((parent) => ({
      fromTaskId: parent,
      toTaskId: task.taskId,
      reason: `${task.title} depends on ${parent}`,
    }))
  );
  const parallelGroups = groupParallel(tasks);
  const definition: ProfessionalWorkflowDefinition = {
    workflowId,
    workflowName,
    goal: input.plan.goal,
    requiredKnowledge: unique([...input.plan.framework.requiredKnowledge, ...domains]),
    requiredModules: unique([
      "knowledge-foundation",
      "planning-engine",
      "decision-engine",
      ...tasks.map((task) => task.moduleHint),
    ]),
    requiredResources: unique([...input.plan.framework.requiredResources, ...(input.request.availableResources ?? [])]),
    mainTasks: tasks.filter((task) => task.kind === "main"),
    subTasks: tasks.filter((task) => task.kind === "sub" || task.kind === "parallel"),
    allTasks: tasks,
    dependencies,
    validationSteps: tasks.filter((task) => task.kind === "validation" || task.validationCheckpoint),
    expectedResults: unique([...input.plan.framework.expectedResults, ...tasks.map((task) => task.expectedResult)]),
    recoverySteps: unique([
      "Retry failed task once with the same professional guidance",
      "Fall back to sequential order if a parallel group fails",
      "Re-run final validation checkpoint before completion",
      ...input.plan.framework.risks.slice(0, 2).map((risk) => `Mitigate risk: ${risk}`),
    ]),
    parallelGroups,
    executionOrder: [...tasks].sort((a, b) => a.order - b.order).map((task) => task.taskId),
    estimatedExecutionMinutes: tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
  };

  const improvementsDetected = detectImprovements(input.similarWorkflows[0] ?? null, definition);
  const reuseBoost = input.similarWorkflows.length ? 2 : 0;
  const confidenceScore = clamp(Math.round(input.plan.confidenceScore + reuseBoost - input.plan.missingInformation.filter((item) => item.severity === "important").length * 3), 0, 100);

  const explanation = {
    whySelected: input.exactMatch
      ? `Reused existing professional workflow ${input.exactMatch.workflowId} for equivalent goal and task structure.`
      : `Workflow generated from professional plan ${input.plan.planId}: ${input.plan.explanation.whySelected}`,
    taskOrderReason: input.plan.explanation.taskOrderReason,
    knowledgePacksUsed: input.plan.explanation.knowledgePacksUsed,
    knowledgeIdsUsed: input.plan.explanation.knowledgeIdsUsed,
    dependenciesSummary:
      dependencies.length > 0
        ? `${dependencies.length} dependency link(s) preserve professional sequencing; ${parallelGroups.length} parallel group(s) enable safe concurrency.`
        : "No hard dependencies were required beyond sequential validation.",
    expectedOutcome: input.plan.explanation.expectedOutcome,
    confidenceScore,
    domainsUsed: domains,
    improvementsDetected,
  };

  const memoryRecord: ProfessionalWorkflowMemoryRecord = {
    workflowId,
    goal: definition.goal,
    knowledgeUsed: input.plan.memoryRecord.knowledgeUsed,
    taskStructure: tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      kind: task.kind,
      order: task.order,
      dependsOn: task.dependsOn,
    })),
    dependencies,
    executionHistory: [],
    performanceMetrics: {
      estimatedMinutes: definition.estimatedExecutionMinutes,
      actualMinutes: null,
      taskCount: tasks.length,
      parallelGroupCount: parallelGroups.length,
      successRate: null,
    },
    confidenceScore,
    timestamp: new Date().toISOString(),
    relatedPlanId: input.plan.planId,
    relatedDecisionId: input.plan.relatedDecisionId,
    domainsUsed: domains,
    relatedKnowledgePacks: input.plan.explanation.knowledgePacksUsed,
    priorWorkflowIds: input.similarWorkflows.map((item) => item.workflowId),
    grounded: true,
    fingerprint,
  };

  return {
    workflowId,
    available: true,
    grounded: true,
    unsupported: false,
    reused: false,
    definition,
    explanation,
    confidenceScore,
    confidenceExplanation: `${input.plan.confidenceExplanation} Workflow confidence ${confidenceScore}/100 with ${tasks.length} task(s).`,
    memoryRecord,
    relatedPlanId: input.plan.planId,
    relatedDecisionId: input.plan.relatedDecisionId,
    multiDomain: domains.length > 1 || input.plan.multiDomain,
  };
}

export function modifyProfessionalWorkflowResult(
  current: ProfessionalWorkflowResult,
  modification: ProfessionalWorkflowModification,
  memory: ProfessionalWorkflowMemoryStore
): ProfessionalWorkflowResult {
  let tasks = current.definition.allTasks.filter((task) => !(modification.removeTaskIds ?? []).includes(task.taskId));
  if (modification.reorderTaskIds?.length) {
    const byId = new Map(tasks.map((task) => [task.taskId, task]));
    const reordered: ProfessionalWorkflowTask[] = [];
    for (const id of modification.reorderTaskIds) {
      const task = byId.get(id);
      if (task) {
        reordered.push(task);
        byId.delete(id);
      }
    }
    tasks = [...reordered, ...byId.values()].map((task, index) => ({ ...task, order: index + 1 }));
  }

  const dependencies = rebuildDependencies(tasks);
  const definition: ProfessionalWorkflowDefinition = {
    ...current.definition,
    workflowId: randomUUID(),
    allTasks: tasks,
    mainTasks: tasks.filter((task) => task.kind === "main"),
    subTasks: tasks.filter((task) => task.kind === "sub" || task.kind === "parallel"),
    validationSteps: tasks.filter((task) => task.kind === "validation" || task.validationCheckpoint),
    dependencies,
    parallelGroups: groupParallel(tasks),
    executionOrder: tasks.map((task) => task.taskId),
    expectedResults: unique([...current.definition.expectedResults, ...(modification.addExpectedResults ?? [])]),
    recoverySteps: unique([...current.definition.recoverySteps, ...(modification.addRecoverySteps ?? [])]),
    estimatedExecutionMinutes: tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
  };

  const memoryRecord: ProfessionalWorkflowMemoryRecord = {
    ...current.memoryRecord,
    workflowId: definition.workflowId,
    taskStructure: tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      kind: task.kind,
      order: task.order,
      dependsOn: task.dependsOn,
    })),
    dependencies,
    confidenceScore: clamp(current.confidenceScore - 1, 0, 100),
    timestamp: new Date().toISOString(),
    priorWorkflowIds: unique([...current.memoryRecord.priorWorkflowIds, current.workflowId]),
    fingerprint: workflowFingerprint(
      definition.goal,
      current.explanation.domainsUsed,
      tasks.map((task) => task.title)
    ),
    performanceMetrics: {
      ...current.memoryRecord.performanceMetrics,
      estimatedMinutes: definition.estimatedExecutionMinutes,
      taskCount: tasks.length,
      parallelGroupCount: definition.parallelGroups.length,
    },
  };
  memory.append(memoryRecord);

  return {
    ...current,
    workflowId: definition.workflowId,
    reused: false,
    definition,
    confidenceScore: memoryRecord.confidenceScore,
    explanation: {
      ...current.explanation,
      whySelected: `Modified professional workflow derived from ${current.workflowId}. ${modification.notes ?? ""}`.trim(),
      confidenceScore: memoryRecord.confidenceScore,
      improvementsDetected: unique([
        ...current.explanation.improvementsDetected,
        modification.notes ?? "Workflow structure adjusted",
      ]),
    },
    memoryRecord,
    confidenceExplanation: `Modified workflow confidence ${memoryRecord.confidenceScore}/100.`,
    durationMs: 0,
  };
}

export function optimizeProfessionalWorkflowResult(
  current: ProfessionalWorkflowResult,
  memory: ProfessionalWorkflowMemoryStore
): ProfessionalWorkflowResult {
  const tasks = current.definition.allTasks.map((task) => {
    const canParallel =
      task.dependsOn.length <= 1 &&
      !task.validationCheckpoint &&
      task.kind !== "validation" &&
      !/brief|story|objective|clarify/i.test(task.title);
    return canParallel
      ? { ...task, kind: task.kind === "main" ? task.kind : ("parallel" as const), parallelGroup: task.parallelGroup ?? "optimized-finish" }
      : task;
  });
  const dependencies = rebuildDependencies(tasks);
  const parallelGroups = groupParallel(tasks);
  const estimatedExecutionMinutes = Math.max(
    8,
    Math.round(current.definition.estimatedExecutionMinutes * (parallelGroups.length ? 0.8 : 0.9))
  );

  const definition: ProfessionalWorkflowDefinition = {
    ...current.definition,
    workflowId: randomUUID(),
    allTasks: tasks,
    mainTasks: tasks.filter((task) => task.kind === "main"),
    subTasks: tasks.filter((task) => task.kind === "sub" || task.kind === "parallel"),
    validationSteps: tasks.filter((task) => task.kind === "validation" || task.validationCheckpoint),
    dependencies,
    parallelGroups,
    executionOrder: [...tasks].sort((a, b) => a.order - b.order).map((task) => task.taskId),
    estimatedExecutionMinutes,
    recoverySteps: unique([
      ...current.definition.recoverySteps,
      "On parallel-group failure, rerun the group sequentially",
    ]),
  };

  const memoryRecord: ProfessionalWorkflowMemoryRecord = {
    ...current.memoryRecord,
    workflowId: definition.workflowId,
    taskStructure: tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      kind: task.kind,
      order: task.order,
      dependsOn: task.dependsOn,
    })),
    dependencies,
    confidenceScore: clamp(current.confidenceScore + 2, 0, 100),
    timestamp: new Date().toISOString(),
    priorWorkflowIds: unique([...current.memoryRecord.priorWorkflowIds, current.workflowId]),
    fingerprint: workflowFingerprint(
      definition.goal,
      current.explanation.domainsUsed,
      tasks.map((task) => task.title)
    ),
    performanceMetrics: {
      ...current.memoryRecord.performanceMetrics,
      estimatedMinutes: estimatedExecutionMinutes,
      taskCount: tasks.length,
      parallelGroupCount: parallelGroups.length,
    },
  };
  memory.append(memoryRecord);

  return {
    ...current,
    workflowId: definition.workflowId,
    reused: false,
    definition,
    confidenceScore: memoryRecord.confidenceScore,
    explanation: {
      ...current.explanation,
      whySelected: `Optimized professional workflow from ${current.workflowId} for parallel efficiency and recovery readiness.`,
      taskOrderReason: "Independent finish tasks may run in parallel; validation remains a sequential checkpoint.",
      confidenceScore: memoryRecord.confidenceScore,
      improvementsDetected: unique([
        ...current.explanation.improvementsDetected,
        "Increased safe parallelization",
        "Reduced estimated execution time",
        "Strengthened recovery path for parallel failures",
      ]),
    },
    memoryRecord,
    confidenceExplanation: `Optimized workflow confidence ${memoryRecord.confidenceScore}/100.`,
    durationMs: 0,
  };
}

export function executeProfessionalWorkflowCoordination(
  current: ProfessionalWorkflowResult,
  memory: ProfessionalWorkflowMemoryStore
): ProfessionalWorkflowExecutionResult {
  const start = Date.now();
  const history: ProfessionalWorkflowExecutionEvent[] = [];
  let failures = 0;

  for (const taskId of current.definition.executionOrder) {
    const task = current.definition.allTasks.find((item) => item.taskId === taskId);
    if (!task) continue;
    const startedAt = new Date().toISOString();
    const failed = /unsupported editing|missing editing/i.test(task.title) && task.domain.includes("editing");
    if (failed) {
      failures += 1;
      history.push({
        taskId,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        note: "Task marked failed in coordination simulation; applying recovery step.",
      });
      history.push({
        taskId,
        status: "recovered",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        note: current.definition.recoverySteps[0] ?? "Retry sequentially",
      });
    } else {
      history.push({
        taskId,
        status: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        note: `Coordinated ${task.moduleHint} without media generation.`,
      });
    }
  }

  const actualMinutes = Math.max(1, Math.round((Date.now() - start) / 60000) || 1);
  const successRate = Math.round(((current.definition.allTasks.length - failures) / Math.max(1, current.definition.allTasks.length)) * 100);
  const performanceMetrics = {
    estimatedMinutes: current.definition.estimatedExecutionMinutes,
    actualMinutes,
    taskCount: current.definition.allTasks.length,
    parallelGroupCount: current.definition.parallelGroups.length,
    successRate,
  };

  const improvementsDetected = unique([
    ...current.explanation.improvementsDetected,
    failures > 0 ? "Recovery path exercised for failed task(s)" : "Clean coordination pass with no recovery needed",
    current.definition.parallelGroups.length ? "Parallel groups preserved during coordination" : "Sequential schedule remained optimal",
  ]);

  const updatedMemory: ProfessionalWorkflowMemoryRecord = {
    ...current.memoryRecord,
    executionHistory: history,
    performanceMetrics,
    timestamp: new Date().toISOString(),
  };
  memory.update(updatedMemory);

  return {
    workflowId: current.workflowId,
    status: failures > 0 ? "partial" : "completed",
    executionHistory: history,
    performanceMetrics,
    improvementsDetected,
    explanation: `Professional workflow ${current.workflowId} coordinated ${history.length} event(s) without generating media. Success rate ${successRate}%.`,
    durationMs: Date.now() - start,
  };
}

function reviveWorkflowFromMemory(
  match: ProfessionalWorkflowMemoryRecord,
  plan: ProfessionalPlanningResult,
  reused: boolean,
  similar: ProfessionalWorkflowMemoryRecord[]
): Omit<ProfessionalWorkflowResult, "durationMs"> {
  const tasks = mapPlanTasksToWorkflowTasks(plan).map((task, index) => {
    const prior = match.taskStructure[index];
    return prior ? { ...task, taskId: prior.taskId, title: prior.title, order: prior.order, dependsOn: prior.dependsOn } : task;
  });
  const definition: ProfessionalWorkflowDefinition = {
    workflowId: match.workflowId,
    workflowName: buildWorkflowName(match.goal, match.domainsUsed),
    goal: match.goal,
    requiredKnowledge: unique([...plan.framework.requiredKnowledge, ...match.domainsUsed]),
    requiredModules: unique(["knowledge-foundation", "planning-engine", "decision-engine", ...tasks.map((task) => task.moduleHint)]),
    requiredResources: plan.framework.requiredResources,
    mainTasks: tasks.filter((task) => task.kind === "main"),
    subTasks: tasks.filter((task) => task.kind === "sub" || task.kind === "parallel"),
    allTasks: tasks,
    dependencies: match.dependencies,
    validationSteps: tasks.filter((task) => task.kind === "validation" || task.validationCheckpoint),
    expectedResults: plan.framework.expectedResults,
    recoverySteps: [
      "Retry failed task once with the same professional guidance",
      "Fall back to sequential order if a parallel group fails",
      "Re-run final validation checkpoint before completion",
    ],
    parallelGroups: groupParallel(tasks),
    executionOrder: match.taskStructure.map((task) => task.taskId),
    estimatedExecutionMinutes: match.performanceMetrics.estimatedMinutes,
  };

  return {
    workflowId: match.workflowId,
    available: true,
    grounded: true,
    unsupported: false,
    reused,
    definition,
    explanation: {
      whySelected: `Reused existing professional workflow ${match.workflowId} instead of creating a duplicate.`,
      taskOrderReason: plan.explanation.taskOrderReason,
      knowledgePacksUsed: match.relatedKnowledgePacks,
      knowledgeIdsUsed: match.knowledgeUsed.map((item) => item.knowledgeId),
      dependenciesSummary: `${match.dependencies.length} preserved dependency link(s).`,
      expectedOutcome: plan.explanation.expectedOutcome,
      confidenceScore: match.confidenceScore,
      domainsUsed: match.domainsUsed,
      improvementsDetected: detectImprovements(similar[1] ?? null, definition),
    },
    confidenceScore: match.confidenceScore,
    confidenceExplanation: `Reused workflow confidence ${match.confidenceScore}/100.`,
    memoryRecord: {
      ...match,
      priorWorkflowIds: unique([...match.priorWorkflowIds, ...similar.map((item) => item.workflowId)]),
      relatedPlanId: plan.planId,
      relatedDecisionId: plan.relatedDecisionId,
      timestamp: new Date().toISOString(),
    },
    relatedPlanId: plan.planId,
    relatedDecisionId: plan.relatedDecisionId,
    multiDomain: match.domainsUsed.length > 1,
  };
}

function mapPlanTasksToWorkflowTasks(plan: ProfessionalPlanningResult): ProfessionalWorkflowTask[] {
  return plan.framework.taskBreakdown.map((task) => ({
    taskId: task.taskId,
    title: task.title,
    kind: task.kind === "validation" ? "validation" : task.kind,
    domain: task.domain,
    moduleHint: moduleHintForDomain(task.domain),
    description: task.description,
    order: task.order,
    dependsOn: task.dependsOn,
    parallelGroup: task.parallelGroup,
    estimatedMinutes: task.estimatedMinutes,
    expectedResult: task.expectedResult,
    validationCheckpoint: task.kind === "validation",
  }));
}

function moduleHintForDomain(domain: string): string {
  const lower = domain.toLowerCase();
  return DOMAIN_MODULE_HINTS.find((entry) => lower.includes(entry.match))?.module ?? "knowledge-foundation";
}

function buildWorkflowName(goal: string, domains: string[]): string {
  const domainLabel = domains[0]?.replace(/-knowledge$/i, "") ?? "professional";
  const shortGoal = goal.split(/\s+/).slice(0, 6).join(" ");
  return `${domainLabel}-workflow: ${shortGoal}`.slice(0, 96);
}

function detectImprovements(
  previous: ProfessionalWorkflowMemoryRecord | null,
  definition: ProfessionalWorkflowDefinition
): string[] {
  if (!previous) {
    return ["Initial professional workflow created from grounded plan"];
  }
  const improvements: string[] = [];
  if (definition.parallelGroups.length > previous.performanceMetrics.parallelGroupCount) {
    improvements.push("More parallel groups than prior similar workflow");
  }
  if (definition.estimatedExecutionMinutes < previous.performanceMetrics.estimatedMinutes) {
    improvements.push("Lower estimated duration than prior similar workflow");
  }
  if (definition.recoverySteps.length >= 3) {
    improvements.push("Recovery coverage meets professional baseline");
  }
  if (!improvements.length) improvements.push("Structure aligned with prior successful workflow");
  return improvements;
}

function rebuildDependencies(tasks: ProfessionalWorkflowTask[]): ProfessionalWorkflowDependency[] {
  return tasks.flatMap((task) =>
    task.dependsOn.map((parent) => ({
      fromTaskId: parent,
      toTaskId: task.taskId,
      reason: `${task.title} depends on ${parent}`,
    }))
  );
}

function groupParallel(tasks: ProfessionalWorkflowTask[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.kind !== "parallel" || !task.parallelGroup) continue;
    const list = groups.get(task.parallelGroup) ?? [];
    list.push(task.taskId);
    groups.set(task.parallelGroup, list);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
