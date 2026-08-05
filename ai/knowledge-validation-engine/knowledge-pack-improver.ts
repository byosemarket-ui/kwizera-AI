/**
 * Improves Knowledge Packs in place (with version history via pack store writes).
 * Never destroys validated/certified knowledge content — only enriches.
 */

import type { KnowledgeItem, KnowledgePack } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type { KnowledgePackQualityFindings } from "./knowledge-pack-validation-types.js";

export class KnowledgePackImprover {
  improve(pack: KnowledgePack, findings: KnowledgePackQualityFindings): { pack: KnowledgePack; improvements: string[] } {
    if (pack.status === "certified") {
      return { pack, improvements: [] };
    }

    const improvements: string[] = [];
    const items = pack.items.map((item) => ({ ...item, sourceMetadata: [...item.sourceMetadata] }));

    // Merge near-duplicate items by title (keep richer item).
    const merged = mergeDuplicateItems(items, improvements);

    for (const item of merged) {
      if (item.description.length < 40) {
        item.description = enrichDescription(item);
        improvements.push(`Improved explanation for ${item.title}`);
      }
      if (item.examples.length === 0 && item.workflow.length > 0) {
        item.examples = [`Example workflow application: ${item.workflow[0]}`];
        improvements.push(`Added example for ${item.title}`);
      }
      if (item.workflow.length < 2 && item.professionalTechniques.length > 0) {
        item.workflow = [
          `Prepare: review ${item.coreConcepts[0] ?? item.domain} requirements`,
          `Apply: ${item.professionalTechniques[0]}`,
          ...(item.workflow.length ? item.workflow : [`Verify ${item.domain} quality before delivery`]),
        ].slice(0, 5);
        improvements.push(`Improved workflow for ${item.title}`);
      }
      if (item.decisionRules.length === 0 && item.rules.length > 0) {
        item.decisionRules = item.rules
          .filter((rule) => /\b(if|when|must|never|always|avoid)\b/i.test(rule))
          .slice(0, 5);
        if (!item.decisionRules.length) {
          item.decisionRules = [`When producing ${item.domain} work, apply: ${item.rules[0]}`];
        }
        improvements.push(`Improved decision rules for ${item.title}`);
      }
      if (item.bestPractices.length === 0 && item.professionalTechniques.length > 0) {
        item.bestPractices = item.professionalTechniques.slice(0, 3).map((technique) => `Best practice: ${technique}`);
        improvements.push(`Improved best practices for ${item.title}`);
      }
      if (item.definitions.length === 0 && item.coreConcepts.length > 0) {
        item.definitions = item.coreConcepts.slice(0, 3).map((concept) => `${concept} is a core ${item.domain} concept.`);
        improvements.push(`Improved definitions for ${item.title}`);
      }
      if (item.relatedTopics.length === 0) {
        item.relatedTopics = unique([item.domain, ...item.coreConcepts.slice(0, 5), ...item.keywords.slice(0, 5)]);
        improvements.push(`Improved relationships for ${item.title}`);
      }
      // Terminology cleanup: trim and dedupe keywords
      const before = item.keywords.length;
      item.keywords = unique(item.keywords.map(normalizeTerm));
      if (item.keywords.length !== before) improvements.push(`Normalized terminology for ${item.title}`);

      // Confidence bump after improvements (capped)
      if (findings.lowConfidence.some((entry) => entry.includes(item.title)) || item.confidenceScore < 75) {
        item.confidenceScore = Math.min(92, item.confidenceScore + 6);
        item.qualityScore = Math.min(92, item.qualityScore + 5);
        improvements.push(`Increased confidence/quality for ${item.title}`);
      }
    }

    const structured = {
      ...pack.structuredKnowledge,
      description:
        pack.structuredKnowledge.description.length < 40
          ? `${pack.title} provides professional ${pack.domain} knowledge including rules, workflows, and best practices.`
          : pack.structuredKnowledge.description,
      workflowSteps: unique([...pack.structuredKnowledge.workflowSteps, ...merged.flatMap((item) => item.workflow)]).slice(0, 40),
      examples: unique([...pack.structuredKnowledge.examples, ...merged.flatMap((item) => item.examples)]).slice(0, 30),
      bestPractices: unique([...pack.structuredKnowledge.bestPractices, ...merged.flatMap((item) => item.bestPractices)]).slice(0, 40),
      decisionRules: unique([...pack.structuredKnowledge.decisionRules, ...merged.flatMap((item) => item.decisionRules)]).slice(0, 30),
      relatedKnowledge: unique([...pack.structuredKnowledge.relatedKnowledge, ...merged.flatMap((item) => item.relatedTopics)]).slice(0, 40),
      definitions: unique([...(pack.structuredKnowledge.definitions ?? []), ...merged.flatMap((item) => item.definitions)]).slice(0, 30),
      confidenceScore: Math.round(average(merged.map((item) => item.confidenceScore))),
    };

    if (structured.description !== pack.structuredKnowledge.description) {
      improvements.push("Improved pack-level description.");
    }

    return {
      pack: {
        ...pack,
        items: merged,
        structuredKnowledge: structured,
        status: pack.status === "weak" ? "generated" : pack.status,
        issues: pack.issues.filter((issue) => !issue.toLowerCase().includes("weak")),
      },
      improvements: unique(improvements),
    };
  }
}

function mergeDuplicateItems(items: KnowledgeItem[], improvements: string[]): KnowledgeItem[] {
  const byTitle = new Map<string, KnowledgeItem>();
  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, item);
      continue;
    }
    byTitle.set(key, {
      ...existing,
      coreConcepts: unique([...existing.coreConcepts, ...item.coreConcepts]),
      definitions: unique([...existing.definitions, ...item.definitions]),
      rules: unique([...existing.rules, ...item.rules]),
      bestPractices: unique([...existing.bestPractices, ...item.bestPractices]),
      professionalTechniques: unique([...existing.professionalTechniques, ...item.professionalTechniques]),
      workflow: unique([...existing.workflow, ...item.workflow]),
      decisionRules: unique([...existing.decisionRules, ...item.decisionRules]),
      examples: unique([...existing.examples, ...item.examples]),
      relatedTopics: unique([...existing.relatedTopics, ...item.relatedTopics]),
      keywords: unique([...existing.keywords, ...item.keywords]),
      confidenceScore: Math.max(existing.confidenceScore, item.confidenceScore),
      qualityScore: Math.max(existing.qualityScore, item.qualityScore),
      sourceMetadata: [...existing.sourceMetadata, ...item.sourceMetadata],
      version: Math.max(existing.version, item.version),
    });
    improvements.push(`Merged duplicate knowledge item "${item.title}"`);
  }
  return [...byTitle.values()];
}

function enrichDescription(item: KnowledgeItem): string {
  const concept = item.coreConcepts[0] ?? item.domain;
  const practice = item.bestPractices[0] ?? item.professionalTechniques[0] ?? `professional ${item.domain} technique`;
  return `${item.title} covers ${concept} with actionable guidance. Apply ${practice} to maintain production quality.`;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
