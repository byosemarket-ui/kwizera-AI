/**
 * Knowledge Domain Registry — hierarchical catalog with runtime expansion support.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CORE_KNOWLEDGE_DOMAINS,
  KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION,
} from "./domain-catalog.js";
import {
  KnowledgeDomainDefinition,
  KnowledgeDomainHierarchyNode,
  KnowledgeDomainOrigin,
  KnowledgeDomainPlanningError,
  KnowledgeDomainPriority,
  KnowledgeDomainRegistrationInput,
  KnowledgeDomainRelationship,
  KnowledgeDomainStatus,
} from "./types.js";

const DOMAIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class KnowledgeDomainRegistry {
  private domains = new Map<string, KnowledgeDomainDefinition>();
  private storagePath = "";
  private loaded = false;

  initialize(storageRoot: string): void {
    const dir = path.join(storageRoot, "knowledge", "domain-planning");
    fs.mkdirSync(dir, { recursive: true });
    this.storagePath = path.join(dir, "domain-registry.json");
    this.seedCoreCatalog();
    this.loadRuntimeExpansions();
    this.validateHierarchy();
    this.persist();
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getArchitectureVersion(): string {
    return KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION;
  }

  getAll(): KnowledgeDomainDefinition[] {
    return Array.from(this.domains.values()).map((domain) => structuredClone(domain));
  }

  get(domainId: string): KnowledgeDomainDefinition | undefined {
    const domain = this.domains.get(domainId);
    return domain ? structuredClone(domain) : undefined;
  }

  has(domainId: string): boolean {
    return this.domains.has(domainId);
  }

  getRoots(): KnowledgeDomainDefinition[] {
    return this.getAll().filter((domain) => domain.parentDomainId === null);
  }

  getChildren(domainId: string): KnowledgeDomainDefinition[] {
    const parent = this.domains.get(domainId);
    if (!parent) return [];
    return parent.childDomainIds
      .map((id) => this.domains.get(id))
      .filter((domain): domain is KnowledgeDomainDefinition => Boolean(domain))
      .map((domain) => structuredClone(domain));
  }

  buildHierarchy(): KnowledgeDomainHierarchyNode[] {
    return this.getRoots().map((root) => this.toHierarchyNode(root.domainId));
  }

  buildRelationships(): KnowledgeDomainRelationship[] {
    const relationships: KnowledgeDomainRelationship[] = [];
    for (const domain of this.domains.values()) {
      if (domain.parentDomainId) {
        relationships.push({
          fromDomainId: domain.parentDomainId,
          toDomainId: domain.domainId,
          relation: "parent-of",
          strength: 1,
        });
        relationships.push({
          fromDomainId: domain.domainId,
          toDomainId: domain.parentDomainId,
          relation: "child-of",
          strength: 1,
        });
      }
      if (domain.metadata.foundationCategoryId) {
        relationships.push({
          fromDomainId: domain.domainId,
          toDomainId: domain.metadata.foundationCategoryId,
          relation: "maps-to-foundation",
          strength: 0.9,
        });
      }
      for (const relatedId of domain.metadata.relatedDomainIds) {
        if (!this.domains.has(relatedId)) continue;
        relationships.push({
          fromDomainId: domain.domainId,
          toDomainId: relatedId,
          relation: "related-to",
          strength: 0.7,
        });
      }
    }
    return relationships;
  }

  /**
   * Register a future domain without modifying the core catalog.
   * Optionally links as a child of an existing expandable parent.
   */
  registerDomain(input: KnowledgeDomainRegistrationInput): KnowledgeDomainDefinition {
    const domainId = input.domainId.trim();
    if (!DOMAIN_ID_PATTERN.test(domainId)) {
      throw new KnowledgeDomainPlanningError(
        "Domain IDs must use lowercase letters, numbers, and hyphens.",
        "INVALID_DOMAIN_ID"
      );
    }
    if (this.domains.has(domainId)) {
      throw new KnowledgeDomainPlanningError(
        `Domain already exists: ${domainId}`,
        "DOMAIN_EXISTS"
      );
    }

    const parentDomainId = input.parentDomainId ?? null;
    if (parentDomainId) {
      const parent = this.domains.get(parentDomainId);
      if (!parent) {
        throw new KnowledgeDomainPlanningError(
          `Parent domain not found: ${parentDomainId}`,
          "PARENT_NOT_FOUND"
        );
      }
      if (!parent.futureExpansion.acceptsChildDomains) {
        throw new KnowledgeDomainPlanningError(
          `Parent domain does not accept children: ${parentDomainId}`,
          "PARENT_NOT_EXPANDABLE"
        );
      }
    }

    const now = new Date().toISOString();
    const domain: KnowledgeDomainDefinition = {
      domainId,
      name: input.name.trim(),
      description: input.description.trim(),
      parentDomainId,
      childDomainIds: [],
      tags: input.tags ?? [],
      priority: input.priority ?? KnowledgeDomainPriority.Medium,
      status: KnowledgeDomainStatus.Expanded,
      version: "1.0.0",
      origin: KnowledgeDomainOrigin.Runtime,
      metadata: {
        relatedEngineIds: input.relatedEngineIds ?? [],
        relatedDomainIds: input.relatedDomainIds ?? [],
        learningOrder: this.nextLearningOrder(),
        contentReady: false,
        architectureOnly: true,
        createdAt: now,
        updatedAt: now,
        notes: input.notes,
      },
      futureExpansion: {
        acceptsChildDomains: true,
        runtimeRegistrable: true,
        storageSubdirectory: input.storageSubdirectory ?? domainId,
        suggestedFoundationCategory: input.suggestedFoundationCategory ?? "custom-knowledge",
        expansionNotes: input.expansionNotes ?? [
          "Registered at runtime without modifying the core knowledge domain catalog.",
        ],
      },
    };

    this.domains.set(domainId, domain);
    if (parentDomainId) {
      const parent = this.domains.get(parentDomainId)!;
      if (!parent.childDomainIds.includes(domainId)) {
        parent.childDomainIds = [...parent.childDomainIds, domainId];
        parent.metadata.updatedAt = now;
      }
    }

    this.persist();
    return structuredClone(domain);
  }

  countByStatus(status: KnowledgeDomainStatus): number {
    return this.getAll().filter((domain) => domain.status === status).length;
  }

  countByOrigin(origin: KnowledgeDomainOrigin): number {
    return this.getAll().filter((domain) => domain.origin === origin).length;
  }

  markContentReady(domainId: string, ready = true): KnowledgeDomainDefinition | null {
    if (!this.loaded) {
      throw new KnowledgeDomainPlanningError("Domain registry is not loaded", "NOT_LOADED");
    }
    const domain = this.domains.get(domainId);
    if (!domain) return null;
    domain.metadata.contentReady = ready;
    domain.metadata.architectureOnly = !ready;
    domain.metadata.updatedAt = new Date().toISOString();
    this.persist();
    return structuredClone(domain);
  }

  private seedCoreCatalog(): void {
    this.domains.clear();
    for (const domain of CORE_KNOWLEDGE_DOMAINS) {
      this.domains.set(domain.domainId, structuredClone(domain));
    }
  }

  private loadRuntimeExpansions(): void {
    if (!fs.existsSync(this.storagePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.storagePath, "utf8")) as {
        expansions?: KnowledgeDomainDefinition[];
        contentReadyDomainIds?: string[];
      };
      for (const expansion of raw.expansions ?? []) {
        if (expansion.origin !== KnowledgeDomainOrigin.Runtime) continue;
        if (this.domains.has(expansion.domainId)) continue;
        this.domains.set(expansion.domainId, expansion);
        if (expansion.parentDomainId) {
          const parent = this.domains.get(expansion.parentDomainId);
          if (parent && !parent.childDomainIds.includes(expansion.domainId)) {
            parent.childDomainIds = [...parent.childDomainIds, expansion.domainId];
          }
        }
      }
      for (const domainId of raw.contentReadyDomainIds ?? []) {
        const domain = this.domains.get(domainId);
        if (!domain) continue;
        domain.metadata.contentReady = true;
        domain.metadata.architectureOnly = false;
      }
    } catch {
      // Corrupt expansion file — keep core catalog only
    }
  }

  private persist(): void {
    if (!this.storagePath) return;
    const expansions = this.getAll().filter((domain) => domain.origin === KnowledgeDomainOrigin.Runtime);
    const contentReadyDomainIds = this.getAll()
      .filter((domain) => domain.metadata.contentReady)
      .map((domain) => domain.domainId);
    const payload = {
      architectureVersion: KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION,
      lastUpdated: new Date().toISOString(),
      coreDomainCount: CORE_KNOWLEDGE_DOMAINS.length,
      expansions,
      contentReadyDomainIds,
    };
    fs.writeFileSync(this.storagePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  private validateHierarchy(): void {
    for (const domain of this.domains.values()) {
      if (domain.parentDomainId && !this.domains.has(domain.parentDomainId)) {
        throw new KnowledgeDomainPlanningError(
          `Broken parent link: ${domain.domainId} → ${domain.parentDomainId}`,
          "BROKEN_PARENT"
        );
      }
      for (const childId of domain.childDomainIds) {
        const child = this.domains.get(childId);
        if (!child) {
          throw new KnowledgeDomainPlanningError(
            `Missing child domain: ${childId} under ${domain.domainId}`,
            "MISSING_CHILD"
          );
        }
        if (child.parentDomainId !== domain.domainId) {
          throw new KnowledgeDomainPlanningError(
            `Child parent mismatch: ${childId}`,
            "CHILD_PARENT_MISMATCH"
          );
        }
      }
    }
  }

  private toHierarchyNode(domainId: string): KnowledgeDomainHierarchyNode {
    const domain = this.domains.get(domainId)!;
    return {
      domainId: domain.domainId,
      name: domain.name,
      status: domain.status,
      priority: domain.priority,
      children: domain.childDomainIds.map((id) => this.toHierarchyNode(id)),
    };
  }

  private nextLearningOrder(): number {
    let max = 0;
    for (const domain of this.domains.values()) {
      max = Math.max(max, domain.metadata.learningOrder);
    }
    return max + 10;
  }
}
