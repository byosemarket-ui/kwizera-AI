import { randomUUID } from "node:crypto";
import type { ResearchDomain, ResearchPlan, ResearchTask } from "./types.js";
import {
  listProfessionalResearchDomains,
  matchProfessionalResearchDomains,
} from "./professional-research-domains.js";

const AVERAGE_SOURCES_PER_DOMAIN = 3;

/**
 * Builds research plans constrained to professional creative-production domains.
 * Unrelated subjects are rejected so Online Research never wanders off-scope.
 */
export class ResearchPlanner {
  buildPlan(topic: string): ResearchPlan {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) throw new Error("Research topic must not be empty.");

    const matched = matchProfessionalResearchDomains(trimmedTopic);
    if (matched.length === 0) {
      const allowed = listProfessionalResearchDomains().map((domain) => domain.label).join(", ");
      throw new Error(
        `Online research is limited to professional creative production domains (${allowed}). ` +
          `Topic "${trimmedTopic}" is outside scope.`,
      );
    }

    const domains: ResearchDomain[] = matched.map((entry) => ({
      domain: entry.label,
      description: entry.description,
      priority: entry.priority,
      sourceTypes: entry.sourceTypes,
      professionalDomainId: entry.id,
      workspaceDomainId: entry.workspaceDomainId,
      discoveryKinds: entry.discoveryKinds,
    }));

    const tasks: ResearchTask[] = domains.map((domain) => ({
      id: randomUUID(),
      domain: domain.domain,
      description: `Discover and evaluate trusted ${domain.domain} sources: ${domain.description}`,
      sourceTypes: domain.sourceTypes,
      priority: domain.priority,
      status: "pending",
    }));

    return {
      id: randomUUID(),
      topic: trimmedTopic,
      createdAt: new Date().toISOString(),
      domains,
      tasks,
      estimatedSourceCount: Math.max(domains.length * AVERAGE_SOURCES_PER_DOMAIN, domains.length),
      constrainedToProfessionalDomains: true,
    };
  }
}
