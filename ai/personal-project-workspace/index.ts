export { AiPersonalProjectWorkspaceEngine } from "./personal-project-workspace-engine.js";
export {
  ensureProjectStructure,
  ensureWorkspaceStructure,
  writeUserSafeFile,
} from "./workspace-structure.js";
export type {
  AiMePersonalWorkspaceAwareness,
  CreateWorkspaceProjectInput,
  PersonalProjectWorkspaceResult,
  PersonalWorkspaceExplainResult,
  PersonalWorkspaceHealthReport,
  PersonalWorkspaceReportData,
  WorkspaceDashboard,
  WorkspaceProjectRecord,
  WorkspaceProjectType,
  WorkspaceSearchQuery,
} from "./types.js";
export {
  PERSONAL_PROJECT_WORKSPACE_VERSION,
  WORKSPACE_FOLDERS,
} from "./types.js";
