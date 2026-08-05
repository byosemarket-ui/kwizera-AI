/**
 * Knowledge Domain Planner — Step 1 architecture engine for KWIZERA AI STUDIO.
 *
 * Defines hierarchical knowledge domains for future learning.
 * Does not download or research knowledge content.
 */

import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { AiMeDomainAwarenessService } from "./ai-me-domain-awareness.js";
import { CORE_KNOWLEDGE_DOMAINS, KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION } from "./domain-catalog.js";
import { KnowledgeDomainRegistry } from "./domain-registry.js";
import {
  AiMeDomainAwareness,
  KnowledgeDomainDefinition,
  KnowledgeDomainHierarchyNode,
  KnowledgeDomainOrigin,
  KnowledgeDomainPlanningError,
  KnowledgeDomainPlanningReportData,
  KnowledgeDomainPlanningStatusReport,
  KnowledgeDomainRegistrationInput,
  KnowledgeDomainRelationship,
  KnowledgeDomainStatus,
} from "./types.js";

export class AiKnowledgeDomainPlanner {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly registry = new KnowledgeDomainRegistry();
  private awareness: AiMeDomainAwarenessService | null = null;

  initialize(foundation: AiKnowledgeFoundation | null, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.registry.initialize(storageRoot);
    this.awareness = new AiMeDomainAwarenessService(this.registry);
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    // Architecture-only startup — no content acquisition or research.
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  listDomains(): KnowledgeDomainDefinition[] {
    this.ensureStarted();
    return this.registry.getAll();
  }

  getDomain(domainId: string): KnowledgeDomainDefinition | undefined {
    this.ensureStarted();
    return this.registry.get(domainId);
  }

  getHierarchy(): KnowledgeDomainHierarchyNode[] {
    this.ensureStarted();
    return this.registry.buildHierarchy();
  }

  getRelationships(): KnowledgeDomainRelationship[] {
    this.ensureStarted();
    return this.registry.buildRelationships();
  }

  /**
   * Expand the architecture with a new domain without modifying the core catalog.
   */
  registerFutureDomain(input: KnowledgeDomainRegistrationInput): KnowledgeDomainDefinition {
    this.ensureStarted();
    return this.registry.registerDomain(input);
  }

  markDomainContentReady(domainId: string, ready = true): KnowledgeDomainDefinition | null {
    this.ensureStarted();
    return this.registry.markContentReady(domainId, ready);
  }

  /**
   * Optional bridge: install a foundation storage slot for a planned domain.
   * Still does not fill knowledge content.
   */
  installFoundationSlot(domainId: string): { knowledgeId: string; knowledgeName: string } {
    this.ensureStarted();
    if (!this.foundation) {
      throw new KnowledgeDomainPlanningError("Knowledge Foundation unavailable", "NO_FOUNDATION");
    }
    const domain = this.registry.get(domainId);
    if (!domain) {
      throw new KnowledgeDomainPlanningError(`Domain not found: ${domainId}`, "DOMAIN_NOT_FOUND");
    }
    if (domain.metadata.foundationCategoryId) {
      return {
        knowledgeId: domain.metadata.foundationCategoryId,
        knowledgeName: domain.name,
      };
    }
    const installed = this.foundation.installKnowledgeDomain({
      knowledgeId: domain.domainId,
      knowledgeName: domain.name,
      subdirectory: domain.futureExpansion.storageSubdirectory,
      dependencies: ["knowledge-engine"],
    });
    return {
      knowledgeId: installed.knowledgeId,
      knowledgeName: installed.knowledgeName,
    };
  }

  getAiMeAwareness(): AiMeDomainAwareness {
    this.ensureStarted();
    return this.awareness!.buildAwareness();
  }

  buildPlanningReport(): KnowledgeDomainPlanningReportData {
    this.ensureStarted();
    const domains = this.registry.getAll();
    const existingDomainsFound = domains
      .filter(
        (domain) =>
          domain.origin === KnowledgeDomainOrigin.Existing ||
          domain.origin === KnowledgeDomainOrigin.Upgraded ||
          Boolean(domain.metadata.foundationCategoryId)
      )
      .map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        foundationCategoryId: domain.metadata.foundationCategoryId,
        relatedEngineIds: domain.metadata.relatedEngineIds,
      }));

    const domainsUpgraded = domains
      .filter((domain) => domain.origin === KnowledgeDomainOrigin.Upgraded)
      .map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        upgradeSummary:
          domain.metadata.notes ??
          `Upgraded with hierarchy (${domain.childDomainIds.length} child domain(s)) and planning metadata.`,
      }));

    const newDomainsCreated = domains
      .filter((domain) => domain.origin === KnowledgeDomainOrigin.New)
      .map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        parentDomainId: domain.parentDomainId,
      }));

    const awareness = this.getAiMeAwareness();

    return {
      generatedAt: new Date().toISOString(),
      architectureVersion: KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION,
      existingDomainsFound,
      domainsUpgraded,
      newDomainsCreated,
      domainHierarchy: this.registry.buildHierarchy(),
      relationships: this.registry.buildRelationships(),
      futureExpansionCapability: {
        coreCatalogSize: CORE_KNOWLEDGE_DOMAINS.length,
        runtimeExpandable: true,
        acceptsUnlimitedChildren: true,
        installViaFoundation: true,
        notes: [
          "New domains register via registerFutureDomain() without editing the core catalog.",
          "Parents accept child domains through futureExpansion.acceptsChildDomains.",
          "Optional foundation storage slots install via installKnowledgeDomain / installFoundationSlot.",
          "This step does not download or research knowledge content.",
        ],
      },
      aiMeAwareness: awareness,
      totals: {
        totalDomains: domains.length,
        existing: existingDomainsFound.length,
        upgraded: domainsUpgraded.length,
        new: newDomainsCreated.length,
        plannedEmpty: domains.filter((domain) => !domain.metadata.contentReady).length,
      },
    };
  }

  buildStatusReport(): KnowledgeDomainPlanningStatusReport {
    this.ensureReady();
    return {
      initialized: this.initialized,
      startupComplete: this.startupComplete,
      architectureVersion: KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION,
      totalDomains: this.registry.getAll().length,
      plannedDomains: this.registry.countByStatus(KnowledgeDomainStatus.Planned),
      mappedDomains: this.registry.countByStatus(KnowledgeDomainStatus.Mapped),
      upgradedDomains: this.registry.countByStatus(KnowledgeDomainStatus.Upgraded),
      expandedDomains: this.registry.countByStatus(KnowledgeDomainStatus.Expanded),
      rootDomainCount: this.registry.getRoots().length,
      futureExpansionEnabled: true,
      timestamp: new Date().toISOString(),
    };
  }

  getRegistry(): KnowledgeDomainRegistry {
    return this.registry;
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new KnowledgeDomainPlanningError(
        "Knowledge Domain Planner is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new KnowledgeDomainPlanningError(
        "Knowledge Domain Planner startup is not complete",
        "NOT_STARTED"
      );
    }
  }
}
