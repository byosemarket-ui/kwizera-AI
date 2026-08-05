/**
 * KWIZERA AI STUDIO — Knowledge Domain Planning types (Knowledge Seeding Step 1)
 *
 * Architecture-only taxonomy. Domains define where professional knowledge will live;
 * they do not contain researched or downloaded content yet.
 */

import type { KnowledgeCategory } from "../knowledge-foundation/types.js";

export enum KnowledgeDomainStatus {
  /** Mapped to an existing foundation category / domain engine */
  Mapped = "mapped",
  /** Existing concept upgraded with hierarchy and planning metadata */
  Upgraded = "upgraded",
  /** New domain slot prepared for future knowledge filling */
  Planned = "planned",
  /** Registered at runtime via expansion API */
  Expanded = "expanded",
  /** Temporarily disabled */
  Disabled = "disabled",
}

export enum KnowledgeDomainPriority {
  Critical = "critical",
  High = "high",
  Medium = "medium",
  Low = "low",
}

export enum KnowledgeDomainOrigin {
  /** Already present as a foundation category or domain engine */
  Existing = "existing",
  /** Existing concept enriched in this planning step */
  Upgraded = "upgraded",
  /** Created in this planning step */
  New = "new",
  /** Added later without modifying the core catalog */
  Runtime = "runtime",
}

export interface KnowledgeDomainFutureExpansion {
  /** New child domains can be attached without changing core code */
  acceptsChildDomains: boolean;
  /** Domain can be registered at runtime via the planner API */
  runtimeRegistrable: boolean;
  /** Suggested subdirectory under knowledge storage when content arrives */
  storageSubdirectory: string;
  /** Suggested foundation category when a dedicated slot is installed */
  suggestedFoundationCategory: KnowledgeCategory | "custom-knowledge";
  /** Notes for future seeding / learning steps */
  expansionNotes: string[];
}

export interface KnowledgeDomainMetadata {
  foundationCategoryId?: string;
  relatedEngineIds: string[];
  relatedDomainIds: string[];
  learningOrder: number;
  contentReady: boolean;
  architectureOnly: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface KnowledgeDomainDefinition {
  domainId: string;
  name: string;
  description: string;
  parentDomainId: string | null;
  childDomainIds: string[];
  tags: string[];
  priority: KnowledgeDomainPriority;
  status: KnowledgeDomainStatus;
  version: string;
  origin: KnowledgeDomainOrigin;
  metadata: KnowledgeDomainMetadata;
  futureExpansion: KnowledgeDomainFutureExpansion;
}

/** Payload for registering a domain without modifying the core catalog */
export interface KnowledgeDomainRegistrationInput {
  domainId: string;
  name: string;
  description: string;
  parentDomainId?: string | null;
  tags?: string[];
  priority?: KnowledgeDomainPriority;
  relatedEngineIds?: string[];
  relatedDomainIds?: string[];
  storageSubdirectory?: string;
  suggestedFoundationCategory?: KnowledgeCategory | "custom-knowledge";
  expansionNotes?: string[];
  notes?: string;
}

export interface KnowledgeDomainRelationship {
  fromDomainId: string;
  toDomainId: string;
  relation: "parent-of" | "child-of" | "related-to" | "maps-to-foundation";
  strength: number;
}

export interface KnowledgeDomainHierarchyNode {
  domainId: string;
  name: string;
  status: KnowledgeDomainStatus;
  priority: KnowledgeDomainPriority;
  children: KnowledgeDomainHierarchyNode[];
}

export interface AiMeDomainAwareness {
  availableDomainIds: string[];
  availableDomains: Array<{ domainId: string; name: string; status: KnowledgeDomainStatus; priority: KnowledgeDomainPriority }>;
  missingDomainIds: string[];
  missingDomains: Array<{ domainId: string; name: string; reason: string; learningPriority: KnowledgeDomainPriority }>;
  relationships: KnowledgeDomainRelationship[];
  futureLearningPriorities: Array<{ domainId: string; name: string; priority: KnowledgeDomainPriority; learningOrder: number; rationale: string }>;
  summary: string;
}

export interface KnowledgeDomainPlanningReportData {
  generatedAt: string;
  architectureVersion: string;
  existingDomainsFound: Array<{ domainId: string; name: string; foundationCategoryId?: string; relatedEngineIds: string[] }>;
  domainsUpgraded: Array<{ domainId: string; name: string; upgradeSummary: string }>;
  newDomainsCreated: Array<{ domainId: string; name: string; parentDomainId: string | null }>;
  domainHierarchy: KnowledgeDomainHierarchyNode[];
  relationships: KnowledgeDomainRelationship[];
  futureExpansionCapability: {
    coreCatalogSize: number;
    runtimeExpandable: boolean;
    acceptsUnlimitedChildren: boolean;
    installViaFoundation: boolean;
    notes: string[];
  };
  aiMeAwareness: AiMeDomainAwareness;
  totals: {
    totalDomains: number;
    existing: number;
    upgraded: number;
    new: number;
    plannedEmpty: number;
  };
}

export interface KnowledgeDomainPlanningStatusReport {
  initialized: boolean;
  startupComplete: boolean;
  architectureVersion: string;
  totalDomains: number;
  plannedDomains: number;
  mappedDomains: number;
  upgradedDomains: number;
  expandedDomains: number;
  rootDomainCount: number;
  futureExpansionEnabled: boolean;
  timestamp: string;
}

export class KnowledgeDomainPlanningError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeDomainPlanningError";
  }
}
