import { randomUUID } from "node:crypto";
import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { ResearchDomain, ResearchDomainPriority, ResearchPlan, ResearchTask } from "./types.js";

interface DomainTemplateEntry {
  suffix: string;
  description: string;
  priority: ResearchDomainPriority;
  sourceTypes: KnowledgeAcquisitionSourceType[];
}

/** Generic, topic-agnostic decomposition applied to any professional subject AI Me is asked to learn. */
const DOMAIN_TEMPLATE: DomainTemplateEntry[] = [
  {
    suffix: "Fundamentals & Core Concepts",
    description: "Foundational terminology, principles, and mental models for the topic.",
    priority: "high",
    sourceTypes: ["official-documentation", "technical-manual", "book"],
  },
  {
    suffix: "Official Standards & Specifications",
    description: "Authoritative standards, specifications, and official API references.",
    priority: "high",
    sourceTypes: ["technical-standard", "official-api-documentation"],
  },
  {
    suffix: "Best Practices & Techniques",
    description: "Professional techniques, methodologies, and recommended practices.",
    priority: "medium",
    sourceTypes: ["research-paper", "white-paper", "user-manual"],
  },
  {
    suffix: "Tools & Software Workflows",
    description: "Practical tool usage, software workflows, and production pipelines.",
    priority: "medium",
    sourceTypes: ["official-documentation", "approved-website"],
  },
  {
    suffix: "Case Studies & Applied Examples",
    description: "Real-world examples, case studies, and applied reference material.",
    priority: "low",
    sourceTypes: ["research-paper", "approved-website"],
  },
];

const AVERAGE_SOURCES_PER_DOMAIN = 4;

/** Builds a topic-agnostic research plan: identifies knowledge domains and a research task list. */
export class ResearchPlanner {
  buildPlan(topic: string): ResearchPlan {
    const trimmedTopic = topic.trim();
    const domains: ResearchDomain[] = DOMAIN_TEMPLATE.map((entry) => ({
      domain: `${trimmedTopic} — ${entry.suffix}`,
      description: entry.description,
      priority: entry.priority,
      sourceTypes: entry.sourceTypes,
    }));

    const tasks: ResearchTask[] = domains.map((domain) => ({
      id: randomUUID(),
      domain: domain.domain,
      description: `Research and gather trusted sources covering: ${domain.description}`,
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
      estimatedSourceCount: domains.length * AVERAGE_SOURCES_PER_DOMAIN,
    };
  }
}
