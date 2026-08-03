export type PlatformTab = "dashboard" | "plugins" | "extensions" | "modules" | "integrations" | "services" | "developer" | "configuration";
export type PlatformStatus = "active" | "available" | "disabled" | "development" | "standby";
export type PluginCategory = "AI" | "Creative" | "Business" | "Developer" | "System";

export type PlatformItem = { id: string; name: string; category: PluginCategory; version: string; status: PlatformStatus; detail: string; permissions: string[]; updatedAt: string };
export type Integration = { id: string; name: string; kind: "Local API" | "Internal API" | "REST API" | "GraphQL API" | "AI Provider" | "External Connector"; status: PlatformStatus; detail: string };
export type LocalService = { id: string; name: string; kind: "AI model" | "Database" | "Rendering" | "File service" | "Background service"; status: PlatformStatus; detail: string };
export type ModuleRecord = { id: string; name: string; domain: string; status: PlatformStatus; detail: string };
export type PlatformCore = { aiCore: boolean; workflowEngine: boolean; communicationBus: boolean; moduleManager: boolean; memoryFoundation: boolean; knowledgeFoundation: boolean; automationEngine?: boolean; taskScheduler?: boolean; productIntelligence?: boolean; activeProject: string };
export type PlatformLayout = { tab: PlatformTab; query: string; pluginCategory: PluginCategory | "all"; extensionFilter: PlatformStatus | "all"; selectedId: string | null; compact: boolean; configurations: Record<string, boolean>; logs: string[] };