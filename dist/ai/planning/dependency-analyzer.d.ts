import { PlanDependency, PlanTask } from "./types.js";
export declare class DependencyAnalyzer {
    analyze(tasks: PlanTask[], availableModuleIds: Set<string>): PlanDependency[];
    allSatisfied(dependencies: PlanDependency[]): boolean;
}
//# sourceMappingURL=dependency-analyzer.d.ts.map