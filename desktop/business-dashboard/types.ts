export type DashboardWidgetId = "kpis" | "ai" | "activity" | "projects" | "health" | "notifications" | "actions";

export type DashboardLayout = { hidden: DashboardWidgetId[]; compact: DashboardWidgetId[] };

export type DashboardCoreStatus = {
  aiCore: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  moduleManager: boolean;
  memoryFoundation: boolean;
  knowledgeFoundation: boolean;
  automationEngine?: boolean;
  taskScheduler?: boolean;
  productIntelligence?: boolean;
  cameraSimulation?: boolean;
  activeProject: string;
};

export type DashboardProject = { id: string; name: string; modifiedAt: string; productImages: Array<{ sizeBytes: number }> };
export type DashboardWorkspace = { activeProject: DashboardProject | null; projects: DashboardProject[] };
