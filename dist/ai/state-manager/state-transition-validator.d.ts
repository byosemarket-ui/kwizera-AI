import { AiLifecycleState } from "../core/types.js";
import { ApplicationState, ProjectState, SessionStateManaged, SystemState, TaskStateManaged, WorkflowStateManaged } from "./types.js";
export declare class StateTransitionValidator {
    validateApplication(current: ApplicationState, next: ApplicationState): boolean;
    validateWorkflow(current: WorkflowStateManaged, next: WorkflowStateManaged): boolean;
    validateTask(current: TaskStateManaged, next: TaskStateManaged): boolean;
    validateProject(current: ProjectState, next: ProjectState): boolean;
    validateSession(current: SessionStateManaged, next: SessionStateManaged): boolean;
    validateSystem(current: SystemState, next: SystemState): boolean;
    mapAiCoreToApplication(aiCore: AiLifecycleState): ApplicationState;
}
//# sourceMappingURL=state-transition-validator.d.ts.map