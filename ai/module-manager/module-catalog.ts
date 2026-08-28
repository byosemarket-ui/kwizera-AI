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

function runtimeModule(
  moduleId: string,
  moduleName: string,
  features: string[],
  dependencies: string[] = ["ai-core"]
): FrameworkModuleDefinition {
  return {
    moduleId,
    moduleName,
    slotId: moduleId,
    dependencies,
    capabilities: { features, interfaces: [`${moduleId}-api`] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  };
}

/**
 * Persistent studio runtimes (Image / Video / Product / Marketing intelligence).
 * Separate from foundation engine slots so registration does not overwrite
 * image-generation-engine, image-engine, or product-engine.
 */
const KWIZERA_RUNTIME_MODULE_CATALOG: FrameworkModuleDefinition[] = [
  runtimeModule("image-generation-runtime", "Image Generation Runtime", ["image-generation"]),
  runtimeModule("video-audio-generation-runtime", "Video & Audio Generation Runtime", ["video-generation", "audio-generation"]),
  runtimeModule("generation-optimization-runtime", "Generation Optimization Runtime", ["generation-optimization"]),
  runtimeModule("image-intelligence-runtime", "Image Intelligence Runtime", ["image-analysis"]),
  runtimeModule("product-intelligence-runtime", "Product Intelligence Runtime", ["product-analysis"]),
  runtimeModule("product-asset-preparation-runtime", "Product Asset Preparation Runtime", ["product-asset-preparation"]),
  runtimeModule("product-scene-planning-runtime", "Product Scene Planning Runtime", ["product-scene-planning"]),
  runtimeModule("product-storyboard-runtime", "Product Storyboard Runtime", ["product-storyboard"]),
  runtimeModule("product-prompt-orchestration-runtime", "Product Prompt Orchestration Runtime", ["product-prompt-orchestration"]),
  runtimeModule("product-image-generation-runtime", "Product Image Generation Runtime", ["product-image-generation"]),
  runtimeModule("product-video-generation-runtime", "Product Video Generation Runtime", ["product-video-generation"]),
  runtimeModule("product-audio-generation-runtime", "Product Audio Generation Runtime", ["product-audio-generation"]),
  runtimeModule("product-rendering-export-runtime", "Product Rendering Export Runtime", ["product-rendering-export"]),
  runtimeModule("creative-generation-certification", "Creative Generation Certification", ["creative-generation-certification"]),
  runtimeModule("marketing-intelligence-runtime", "Marketing Intelligence Runtime", ["marketing"]),
  runtimeModule("decision-intelligence-runtime", "Decision Intelligence Runtime", ["decision-intelligence"]),
  runtimeModule("learning-intelligence-runtime", "Learning Intelligence Runtime", ["learning-intelligence"]),
];

/** Framework catalog — foundation slots plus persistent studio runtimes. */
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
    moduleId: "recommendation-engine",
    moduleName: "Recommendation Engine",
    slotId: "recommendation-engine",
    dependencies: ["ai-core", "workflow-engine", "planning-engine", "decision-engine"],
    capabilities: { features: ["recommendations"], interfaces: ["recommendation-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "multi-domain-engine",
    moduleName: "Multi-Domain Reasoning Engine",
    slotId: "multi-domain-engine",
    dependencies: ["ai-core", "recommendation-engine", "workflow-engine", "decision-engine"],
    capabilities: { features: ["multi-domain-reasoning"], interfaces: ["multi-domain-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "self-review-engine",
    moduleName: "Self-Review & Professional Evaluation Engine",
    slotId: "self-review-engine",
    dependencies: ["ai-core", "multi-domain-engine", "recommendation-engine", "workflow-engine"],
    capabilities: { features: ["self-review", "professional-evaluation"], interfaces: ["self-review-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  {
    moduleId: "professional-reasoning-certification",
    moduleName: "Professional Reasoning & Decision Certification",
    slotId: "professional-reasoning-certification",
    dependencies: ["ai-core", "self-review-engine", "multi-domain-engine", "recommendation-engine"],
    capabilities: { features: ["professional-reasoning-certification"], interfaces: ["reasoning-certification-api"] },
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
    moduleId: "conversation-engine",
    moduleName: "AI Me Conversation & Understanding Engine",
    slotId: "conversation-engine",
    dependencies: ["ai-core", "memory-engine", "knowledge-engine"],
    capabilities: { features: ["conversation", "understanding"], interfaces: ["conversation-api"] },
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
  {
    moduleId: "ai-model-management",
    moduleName: "KWIZERA AI Model Management",
    slotId: "ai-model-management",
    dependencies: ["ai-core"],
    capabilities: { features: ["model-management"], interfaces: ["model-management-api"] },
    owner: "KWIZERA AI",
    compatibility: ">=0.1.0",
  },
  ...KWIZERA_RUNTIME_MODULE_CATALOG,
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
