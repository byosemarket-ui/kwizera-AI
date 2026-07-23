import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "./types.js";

export interface PreparedKnowledgeCategory {
  category: KnowledgeCategory;
  knowledgeId: string;
  knowledgeName: string;
  subdirectory: string;
  dependencies: string[];
  defaultSource: KnowledgeSource;
  accessPermissions: KnowledgeAccessPermission[];
}

/** Foundation slots for future knowledge modules — prepared, not implemented */
export const PREPARED_KNOWLEDGE_CATEGORIES: PreparedKnowledgeCategory[] = [
  {
    category: KnowledgeCategory.Product,
    knowledgeId: "product-knowledge",
    knowledgeName: "Product Knowledge",
    subdirectory: "products",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.Product,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Validate],
  },
  {
    category: KnowledgeCategory.Image,
    knowledgeId: "image-knowledge",
    knowledgeName: "Image Knowledge",
    subdirectory: "images",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.Video,
    knowledgeId: "video-knowledge",
    knowledgeName: "Video Knowledge",
    subdirectory: "videos",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.Video,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Validate],
  },
  {
    category: KnowledgeCategory.Marketing,
    knowledgeId: "marketing-knowledge",
    knowledgeName: "Marketing Knowledge",
    subdirectory: "marketing",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.MarketingCampaign,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.Brand,
    knowledgeId: "brand-knowledge",
    knowledgeName: "Brand Knowledge",
    subdirectory: "brand",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Update],
  },
  {
    category: KnowledgeCategory.Language,
    knowledgeId: "language-knowledge",
    knowledgeName: "Language Knowledge",
    subdirectory: "language",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.Creative,
    knowledgeId: "creative-knowledge",
    knowledgeName: "Creative Knowledge",
    subdirectory: "creative",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.Optimization,
    knowledgeId: "knowledge-optimization",
    knowledgeName: "Knowledge Optimization",
    subdirectory: "optimization",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [
      KnowledgeAccessPermission.Read,
      KnowledgeAccessPermission.Write,
      KnowledgeAccessPermission.Validate,
      KnowledgeAccessPermission.Admin,
    ],
  },
  {
    category: KnowledgeCategory.Validation,
    knowledgeId: "knowledge-validation",
    knowledgeName: "Knowledge Validation",
    subdirectory: "validation",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [
      KnowledgeAccessPermission.Read,
      KnowledgeAccessPermission.Write,
      KnowledgeAccessPermission.Validate,
      KnowledgeAccessPermission.Admin,
    ],
  },
  {
    category: KnowledgeCategory.HealthMonitoring,
    knowledgeId: "knowledge-health-monitor",
    knowledgeName: "Knowledge Health Monitor",
    subdirectory: "health",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [
      KnowledgeAccessPermission.Read,
      KnowledgeAccessPermission.Validate,
      KnowledgeAccessPermission.Admin,
    ],
  },
  {
    category: KnowledgeCategory.Technical,
    knowledgeId: "technical-knowledge",
    knowledgeName: "Technical Knowledge",
    subdirectory: "technical",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.System,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.Workflow,
    knowledgeId: "workflow-knowledge",
    knowledgeName: "Workflow Knowledge",
    subdirectory: "workflow",
    dependencies: ["knowledge-engine", "workflow-engine", "memory-engine"],
    defaultSource: KnowledgeSource.MemoryEngine,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Validate],
  },
  {
    category: KnowledgeCategory.Business,
    knowledgeId: "business-knowledge",
    knowledgeName: "Business Knowledge",
    subdirectory: "business",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
  {
    category: KnowledgeCategory.UserPreference,
    knowledgeId: "user-preference-knowledge",
    knowledgeName: "User Preference Knowledge",
    subdirectory: "user-preferences",
    dependencies: ["knowledge-engine", "memory-engine"],
    defaultSource: KnowledgeSource.UserPreference,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Update],
  },
  {
    category: KnowledgeCategory.Industry,
    knowledgeId: "industry-knowledge",
    knowledgeName: "Industry Knowledge",
    subdirectory: "industry",
    dependencies: ["knowledge-engine"],
    defaultSource: KnowledgeSource.KnowledgeModule,
    accessPermissions: [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write],
  },
];

export const SUPPORTED_KNOWLEDGE_SOURCES = [
  KnowledgeSource.MemoryEngine,
  KnowledgeSource.LearningEngine,
  KnowledgeSource.Project,
  KnowledgeSource.Product,
  KnowledgeSource.Video,
  KnowledgeSource.MarketingCampaign,
  KnowledgeSource.UserPreference,
  KnowledgeSource.ReasoningHistory,
  KnowledgeSource.DecisionHistory,
  KnowledgeSource.KnowledgeModule,
  KnowledgeSource.Manual,
  KnowledgeSource.System,
] as const;

export const DEFAULT_MODULE_STATUS = KnowledgeModuleStatus.Prepared;
