import {
  ApprovedDecisionInput,
  PlanTask,
  PlanTaskPriority,
  PlanningType,
} from "./types.js";
import { getRequiredModules } from "./decision-type-mapper.js";

const TASK_TEMPLATES: Partial<
  Record<PlanningType, Array<{ suffix: string; module: string; ms: number; priority: PlanTaskPriority }>>
> = {
  "product-analysis": [
    { suffix: "validate-inputs", module: "decision-engine", ms: 500, priority: PlanTaskPriority.Critical },
    { suffix: "analyze-product", module: "product-engine", ms: 3000, priority: PlanTaskPriority.High },
    { suffix: "generate-report", module: "product-engine", ms: 2000, priority: PlanTaskPriority.Normal },
  ],
  "marketing-campaign": [
    { suffix: "validate-brand", module: "decision-engine", ms: 500, priority: PlanTaskPriority.Critical },
    { suffix: "plan-campaign", module: "marketing-engine", ms: 4000, priority: PlanTaskPriority.High },
    { suffix: "prepare-assets", module: "marketing-engine", ms: 3000, priority: PlanTaskPriority.Normal },
  ],
  export: [
    { suffix: "validate-project", module: "decision-engine", ms: 500, priority: PlanTaskPriority.Critical },
    { suffix: "assemble-deliverables", module: "video-engine", ms: 5000, priority: PlanTaskPriority.High },
    { suffix: "finalize-export", module: "marketing-engine", ms: 2000, priority: PlanTaskPriority.Normal },
  ],
};

const DEFAULT_TASKS = [
  { suffix: "validate-plan", module: "decision-engine", ms: 500, priority: PlanTaskPriority.Critical },
  { suffix: "execute-workflow", module: "decision-engine", ms: 3000, priority: PlanTaskPriority.High },
  { suffix: "verify-output", module: "decision-engine", ms: 1000, priority: PlanTaskPriority.Normal },
];

export class TaskBreakdown {
  breakDown(input: ApprovedDecisionInput, moduleIds: string[]): PlanTask[] {
    const templates = TASK_TEMPLATES[input.planningType] ?? DEFAULT_TASKS;
    const tasks: PlanTask[] = [];

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const prevId = i > 0 ? `task-${templates[i - 1].suffix}` : undefined;
      tasks.push({
        id: `task-${t.suffix}`,
        name: t.suffix.replace(/-/g, " "),
        moduleId: moduleIds.includes(t.module) ? t.module : moduleIds[0] ?? t.module,
        dependsOn: prevId ? [prevId] : [],
        estimatedMs: t.ms,
        priority: t.priority,
        description: `Planning task: ${t.suffix}`,
      });
    }

    return tasks;
  }

  getExecutionOrder(tasks: PlanTask[]): string[] {
    return tasks.map((t) => t.id);
  }
}
