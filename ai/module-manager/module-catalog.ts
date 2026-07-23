import { ModuleCapabilities, ModuleRegistryRecord, ManagedModuleState, ModuleHealthStatus } from "./types.js";

export interface FrameworkModuleDefinition {
  moduleId: string;
  moduleName: string;
  slotId?: string;
  dependencies: string[];
  capabilities: ModuleCapabilities;
  owner: string;
  compatibility: string;
}

/** Framework catalog — management only, implementations deferred */
export const FRAMEWORK_MODULE_CATALOG: FrameworkModuleDefinition[] = [
  {
    moduleId: "ai-core",
    moduleName: "AI Core",
    dependencies: [],
    capabilities: { features: ["lifecycle", "runtime"], interfaces: ["core-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "decision-engine",
    moduleName: "Decision Engine",
    slotId: "decision-engine",
    dependencies: ["ai-core", "reasoning-engine"],
    capabilities: { features: ["decisions"], interfaces: ["decision-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "reasoning-engine",
    moduleName: "Reasoning Engine",
    slotId: "reasoning-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["reasoning"], interfaces: ["reasoning-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "planning-engine",
    moduleName: "Planning Engine",
    slotId: "planning-engine",
    dependencies: ["ai-core", "decision-engine"],
    capabilities: { features: ["planning"], interfaces: ["planning-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "workflow-engine",
    moduleName: "Workflow Engine",
    slotId: "workflow-engine",
    dependencies: ["ai-core", "task-manager", "planning-engine"],
    capabilities: { features: ["workflow"], interfaces: ["workflow-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "task-manager",
    moduleName: "Task Manager",
    slotId: "task-manager",
    dependencies: ["ai-core"],
    capabilities: { features: ["tasks"], interfaces: ["task-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "memory-engine",
    moduleName: "Memory Engine",
    slotId: "memory-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["memory"], interfaces: ["memory-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "knowledge-engine",
    moduleName: "Knowledge Engine",
    slotId: "knowledge-engine",
    dependencies: ["ai-core", "memory-engine"],
    capabilities: { features: ["knowledge"], interfaces: ["knowledge-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "learning-engine",
    moduleName: "Learning Engine",
    slotId: "learning-engine",
    dependencies: ["ai-core", "memory-engine"],
    capabilities: { features: ["learning"], interfaces: ["learning-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "product-intelligence",
    moduleName: "Product Intelligence",
    slotId: "product-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["product-analysis"], interfaces: ["product-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "image-intelligence",
    moduleName: "Image Intelligence",
    slotId: "image-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["image-analysis"], interfaces: ["image-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "video-intelligence",
    moduleName: "Video Intelligence",
    slotId: "video-engine",
    dependencies: ["ai-core", "image-engine"],
    capabilities: { features: ["video-analysis"], interfaces: ["video-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "video-generation",
    moduleName: "Video Generation",
    slotId: "video-generation-engine",
    dependencies: ["ai-core", "video-engine"],
    capabilities: { features: ["video-generation"], interfaces: ["video-generation-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "image-generation",
    moduleName: "Image Generation",
    slotId: "image-generation-engine",
    dependencies: ["ai-core", "video-generation-engine", "image-engine"],
    capabilities: { features: ["image-generation"], interfaces: ["image-generation-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "audio-generation",
    moduleName: "Audio Generation",
    slotId: "audio-generation-engine",
    dependencies: ["ai-core", "image-generation-engine", "video-generation-engine"],
    capabilities: { features: ["audio-generation"], interfaces: ["audio-generation-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "marketing-intelligence",
    moduleName: "Marketing Intelligence",
    slotId: "marketing-engine",
    dependencies: ["ai-core", "product-intelligence"],
    capabilities: { features: ["marketing"], interfaces: ["marketing-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "translation-engine",
    moduleName: "Translation Engine",
    slotId: "translation-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["translation"], interfaces: ["translation-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "search-engine",
    moduleName: "Search Engine",
    slotId: "search-engine",
    dependencies: ["ai-core", "knowledge-engine"],
    capabilities: { features: ["search"], interfaces: ["search-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "export-engine",
    moduleName: "Export Engine",
    slotId: "export-engine",
    dependencies: ["ai-core", "workflow-engine"],
    capabilities: { features: ["export"], interfaces: ["export-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "recovery-engine",
    moduleName: "Recovery Engine",
    slotId: "recovery-engine",
    dependencies: ["ai-core"],
    capabilities: { features: ["recovery"], interfaces: ["recovery-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "health-monitor",
    moduleName: "Health Monitor",
    slotId: "health-monitor",
    dependencies: ["ai-core"],
    capabilities: { features: ["health"], interfaces: ["health-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
];

export function getCatalogEntry(moduleId: string): FrameworkModuleDefinition | undefined {
  return FRAMEWORK_MODULE_CATALOG.find((m) => m.moduleId === moduleId || m.slotId === moduleId);
}

export function createFrameworkRecord(def: FrameworkModuleDefinition): ModuleRegistryRecord {
  return {
    moduleId: def.moduleId,
    moduleName: def.moduleName,
    version: "0.0.0",
    status: ManagedModuleState.Registered,
    dependencies: def.dependencies,
    capabilities: def.capabilities,
    owner: def.owner,
    registrationDate: new Date().toISOString(),
    healthStatus: ModuleHealthStatus.Unknown,
    lastActivity: new Date().toISOString(),
    compatibility: def.compatibility,
    enabled: false,
    slotId: def.slotId,
  };
}
