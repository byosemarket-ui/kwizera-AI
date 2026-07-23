import { ResourceEstimate, TimeEstimate, PlanTask, PlanningType } from "./types.js";
export declare class ResourceEstimator {
    estimate(type: PlanningType, tasks: PlanTask[], moduleIds: string[]): {
        resources: ResourceEstimate;
        time: TimeEstimate;
    };
}
//# sourceMappingURL=resource-estimator.d.ts.map