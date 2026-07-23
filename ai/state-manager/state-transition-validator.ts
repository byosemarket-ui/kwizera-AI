import { AiLifecycleState } from "../core/types.js";
import {
  ApplicationState,
  ProjectState,
  SessionStateManaged,
  SystemState,
  TaskStateManaged,
  WorkflowStateManaged,
} from "./types.js";

const APPLICATION_TRANSITIONS: Record<ApplicationState, ApplicationState[]> = {
  [ApplicationState.Starting]: [ApplicationState.Loading, ApplicationState.Stopped, ApplicationState.Recovering],
  [ApplicationState.Loading]: [ApplicationState.Ready, ApplicationState.Recovering, ApplicationState.Stopped],
  [ApplicationState.Ready]: [ApplicationState.Running, ApplicationState.Updating, ApplicationState.Stopping, ApplicationState.Recovering],
  [ApplicationState.Running]: [ApplicationState.Paused, ApplicationState.Updating, ApplicationState.Recovering, ApplicationState.Stopping],
  [ApplicationState.Paused]: [ApplicationState.Running, ApplicationState.Stopping, ApplicationState.Recovering],
  [ApplicationState.Updating]: [ApplicationState.Ready, ApplicationState.Running, ApplicationState.Stopping],
  [ApplicationState.Recovering]: [ApplicationState.Ready, ApplicationState.Running, ApplicationState.Stopped, ApplicationState.Loading],
  [ApplicationState.Stopping]: [ApplicationState.Stopped],
  [ApplicationState.Stopped]: [ApplicationState.Starting, ApplicationState.Loading],
};

const WORKFLOW_TRANSITIONS: Record<WorkflowStateManaged, WorkflowStateManaged[]> = {
  [WorkflowStateManaged.Created]: [WorkflowStateManaged.Running, WorkflowStateManaged.Waiting, WorkflowStateManaged.Failed],
  [WorkflowStateManaged.Running]: [WorkflowStateManaged.Waiting, WorkflowStateManaged.Paused, WorkflowStateManaged.Completed, WorkflowStateManaged.Failed, WorkflowStateManaged.Recovered],
  [WorkflowStateManaged.Waiting]: [WorkflowStateManaged.Running, WorkflowStateManaged.Failed, WorkflowStateManaged.Recovered],
  [WorkflowStateManaged.Paused]: [WorkflowStateManaged.Running, WorkflowStateManaged.Failed],
  [WorkflowStateManaged.Completed]: [],
  [WorkflowStateManaged.Failed]: [WorkflowStateManaged.Recovered, WorkflowStateManaged.Running],
  [WorkflowStateManaged.Recovered]: [WorkflowStateManaged.Running, WorkflowStateManaged.Completed],
};

const TASK_TRANSITIONS: Record<TaskStateManaged, TaskStateManaged[]> = {
  [TaskStateManaged.Queued]: [TaskStateManaged.Running, TaskStateManaged.Cancelled],
  [TaskStateManaged.Running]: [TaskStateManaged.Retrying, TaskStateManaged.Completed, TaskStateManaged.Failed, TaskStateManaged.Cancelled, TaskStateManaged.Recovered],
  [TaskStateManaged.Retrying]: [TaskStateManaged.Running, TaskStateManaged.Failed, TaskStateManaged.Recovered],
  [TaskStateManaged.Completed]: [],
  [TaskStateManaged.Cancelled]: [],
  [TaskStateManaged.Failed]: [TaskStateManaged.Recovered, TaskStateManaged.Queued],
  [TaskStateManaged.Recovered]: [TaskStateManaged.Running, TaskStateManaged.Completed],
};

const PROJECT_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  [ProjectState.New]: [ProjectState.Open],
  [ProjectState.Open]: [ProjectState.Modified, ProjectState.Saving, ProjectState.Archived],
  [ProjectState.Modified]: [ProjectState.Saving, ProjectState.Open, ProjectState.Exporting],
  [ProjectState.Saving]: [ProjectState.Saved, ProjectState.Modified],
  [ProjectState.Saved]: [ProjectState.Open, ProjectState.Modified, ProjectState.Exporting, ProjectState.Completed],
  [ProjectState.Exporting]: [ProjectState.Completed, ProjectState.Saved],
  [ProjectState.Completed]: [ProjectState.Archived],
  [ProjectState.Archived]: [],
};

// Fix PROJECT_TRANSITIONS - I made an error with Failed. Let me fix in the file.

const SESSION_TRANSITIONS: Record<SessionStateManaged, SessionStateManaged[]> = {
  [SessionStateManaged.Created]: [SessionStateManaged.Active, SessionStateManaged.Closed],
  [SessionStateManaged.Active]: [SessionStateManaged.Idle, SessionStateManaged.Paused, SessionStateManaged.Closed, SessionStateManaged.Expired],
  [SessionStateManaged.Idle]: [SessionStateManaged.Active, SessionStateManaged.Expired, SessionStateManaged.Closed],
  [SessionStateManaged.Paused]: [SessionStateManaged.Active, SessionStateManaged.Closed],
  [SessionStateManaged.Expired]: [SessionStateManaged.Closed],
  [SessionStateManaged.Closed]: [],
};

export class StateTransitionValidator {
  validateApplication(current: ApplicationState, next: ApplicationState): boolean {
    if (current === next) return true;
    return APPLICATION_TRANSITIONS[current]?.includes(next) ?? false;
  }

  validateWorkflow(current: WorkflowStateManaged, next: WorkflowStateManaged): boolean {
    if (current === next) return true;
    return WORKFLOW_TRANSITIONS[current]?.includes(next) ?? false;
  }

  validateTask(current: TaskStateManaged, next: TaskStateManaged): boolean {
    if (current === next) return true;
    return TASK_TRANSITIONS[current]?.includes(next) ?? false;
  }

  validateProject(current: ProjectState, next: ProjectState): boolean {
    if (current === next) return true;
    const allowed = PROJECT_TRANSITIONS[current];
    if (!allowed) return false;
    return allowed.includes(next) || (current === ProjectState.Saving && next === ProjectState.Saved);
  }

  validateSession(current: SessionStateManaged, next: SessionStateManaged): boolean {
    if (current === next) return true;
    return SESSION_TRANSITIONS[current]?.includes(next) ?? false;
  }

  validateSystem(current: SystemState, next: SystemState): boolean {
    if (current === next) return true;
    return true;
  }

  mapAiCoreToApplication(aiCore: AiLifecycleState): ApplicationState {
    switch (aiCore) {
      case AiLifecycleState.Initializing:
        return ApplicationState.Starting;
      case AiLifecycleState.Loading:
        return ApplicationState.Loading;
      case AiLifecycleState.Ready:
        return ApplicationState.Ready;
      case AiLifecycleState.Running:
        return ApplicationState.Running;
      case AiLifecycleState.Paused:
        return ApplicationState.Paused;
      case AiLifecycleState.Recovering:
        return ApplicationState.Recovering;
      case AiLifecycleState.Stopping:
        return ApplicationState.Stopping;
      case AiLifecycleState.Stopped:
        return ApplicationState.Stopped;
      case AiLifecycleState.Failed:
        return ApplicationState.Recovering;
      default:
        return ApplicationState.Stopped;
    }
  }
}
