export type IntelligenceTab = "executive" | "analytics" | "reports" | "recommendations" | "timeline" | "resources";
export type IntelligenceWidgetId = "business" | "ai" | "projects" | "marketing" | "productivity" | "system" | "kpis" | "resources";
export type IntelligenceLayout = { tab: IntelligenceTab; hidden: IntelligenceWidgetId[]; compact: IntelligenceWidgetId[]; timeline: "daily" | "weekly" | "monthly"; reportCategory: ReportCategory | "all"; favorites: string[]; recent: string[] };
export type ReportCategory = "project" | "marketing" | "ai" | "productivity" | "performance" | "resource" | "export";
export type ReportRecord = { id: string; title: string; category: ReportCategory; status: "prepared" | "draft"; detail: string; updatedAt: string; favorite: boolean };
export type IntelligenceCore = { aiCore: boolean; workflowEngine: boolean; communicationBus: boolean; moduleManager: boolean; memoryFoundation: boolean; knowledgeFoundation: boolean; automationEngine?: boolean; taskScheduler?: boolean; productIntelligence?: boolean; activeProject: string };
export type IntelligenceProject = { id: string; name: string; modifiedAt: string; productImages: Array<{ sizeBytes: number }> };
export type IntelligenceWorkspace = { activeProject: IntelligenceProject | null; projects: IntelligenceProject[] };