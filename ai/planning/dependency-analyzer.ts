import { PlanDependency, PlanTask } from "./types.js";

export class DependencyAnalyzer {
  analyze(tasks: PlanTask[], availableModuleIds: Set<string>): PlanDependency[] {
    return tasks.map((task) => {
      const depsSatisfied = task.dependsOn.every((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask ? availableModuleIds.has(depTask.moduleId) : true;
      });
      const moduleAvailable = availableModuleIds.has(task.moduleId);

      return {
        taskId: task.id,
        dependsOn: task.dependsOn,
        satisfied: depsSatisfied && moduleAvailable,
      };
    });
  }

  allSatisfied(dependencies: PlanDependency[]): boolean {
    return dependencies.every((d) => d.satisfied);
  }
}
