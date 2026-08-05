/**
 * AI Me Domain Awareness — exposes available/missing domains, relationships, and learning priorities.
 */

import type { KnowledgeDomainRegistry } from "./domain-registry.js";
import {
  AiMeDomainAwareness,
  KnowledgeDomainOrigin,
  KnowledgeDomainPriority,
  KnowledgeDomainStatus,
} from "./types.js";

const PRIORITY_RANK: Record<KnowledgeDomainPriority, number> = {
  [KnowledgeDomainPriority.Critical]: 0,
  [KnowledgeDomainPriority.High]: 1,
  [KnowledgeDomainPriority.Medium]: 2,
  [KnowledgeDomainPriority.Low]: 3,
};

/**
 * Domains are "available" as architecture slots once planned.
 * Domains are "missing" when architecture exists but professional content is not ready.
 */
export class AiMeDomainAwarenessService {
  constructor(private readonly registry: KnowledgeDomainRegistry) {}

  buildAwareness(): AiMeDomainAwareness {
    const domains = this.registry.getAll();
    const available = domains.filter(
      (domain) =>
        domain.status === KnowledgeDomainStatus.Mapped ||
        domain.status === KnowledgeDomainStatus.Upgraded ||
        domain.status === KnowledgeDomainStatus.Planned ||
        domain.status === KnowledgeDomainStatus.Expanded
    );

    const missing = domains.filter((domain) => domain.metadata.contentReady === false);

    const futureLearningPriorities = [...missing]
      .sort((a, b) => {
        const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.metadata.learningOrder - b.metadata.learningOrder;
      })
      .map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        priority: domain.priority,
        learningOrder: domain.metadata.learningOrder,
        rationale: buildLearningRationale(domain.origin, domain.status, domain.parentDomainId),
      }));

    const availableDomainIds = available.map((domain) => domain.domainId);
    const missingDomainIds = missing.map((domain) => domain.domainId);

    return {
      availableDomainIds,
      availableDomains: available.map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        status: domain.status,
        priority: domain.priority,
      })),
      missingDomainIds,
      missingDomains: missing.map((domain) => ({
        domainId: domain.domainId,
        name: domain.name,
        reason: "Architecture defined; professional knowledge content not seeded yet.",
        learningPriority: domain.priority,
      })),
      relationships: this.registry.buildRelationships(),
      futureLearningPriorities,
      summary: buildSummary(availableDomainIds.length, missingDomainIds.length, futureLearningPriorities),
    };
  }
}

function buildLearningRationale(
  origin: KnowledgeDomainOrigin,
  status: KnowledgeDomainStatus,
  parentDomainId: string | null
): string {
  if (origin === KnowledgeDomainOrigin.Upgraded || status === KnowledgeDomainStatus.Upgraded) {
    return "Existing foundation domain upgraded — prioritize filling hierarchical child gaps after core content.";
  }
  if (parentDomainId) {
    return `Child of ${parentDomainId} — learn after parent domain foundations are filled.`;
  }
  return "Root domain — high leverage for studio-wide creative and marketing intelligence.";
}

function buildSummary(
  availableCount: number,
  missingCount: number,
  priorities: AiMeDomainAwareness["futureLearningPriorities"]
): string {
  const top = priorities
    .slice(0, 5)
    .map((item) => item.name)
    .join(", ");
  return (
    `AI Me knowledge architecture: ${availableCount} domain slot(s) available, ` +
    `${missingCount} domain(s) awaiting professional knowledge content. ` +
    `Next learning priorities: ${top || "none"}.`
  );
}
