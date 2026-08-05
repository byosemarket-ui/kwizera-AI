/**
 * Analyzes Knowledge Packs for completeness, conflicts, duplicates, and professional readiness.
 */

import type { KnowledgeItem, KnowledgePack } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type {
  KnowledgePackQualityFindings,
  KnowledgePackQualityScores,
  KnowledgePackValidationChecks,
} from "./knowledge-pack-validation-types.js";

export class KnowledgePackQualityAnalyzer {
  analyze(pack: KnowledgePack): {
    scores: KnowledgePackQualityScores;
    checks: KnowledgePackValidationChecks;
    findings: KnowledgePackQualityFindings;
    issues: string[];
    warnings: string[];
  } {
    const findings = this.detectFindings(pack);
    const checks = this.runChecks(pack, findings);
    const scores = this.score(pack, checks, findings);
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!checks.completeness) issues.push("Pack fails completeness requirements.");
    if (!checks.workflowCompleteness) issues.push("Workflow coverage is incomplete.");
    if (!checks.decisionRules) issues.push("Decision rules are missing or weak.");
    if (!checks.examples) issues.push("Examples are missing.");
    if (!checks.bestPractices) issues.push("Best practices are missing.");
    if (!checks.logicalConsistency) issues.push("Logical consistency issues detected.");
    if (!checks.metadataCompleteness) issues.push("Pack metadata is incomplete.");
    if (findings.duplicates.length) warnings.push(...findings.duplicates.map((item) => `Duplicate: ${item}`));
    if (findings.conflicts.length) issues.push(...findings.conflicts.map((item) => `Conflict: ${item}`));
    if (findings.lowConfidence.length) warnings.push(...findings.lowConfidence);
    if (scores.qualityScore < 75) warnings.push(`Quality score ${scores.qualityScore} below certification floor.`);

    return { scores, checks, findings, issues, warnings };
  }

  private runChecks(pack: KnowledgePack, findings: KnowledgePackQualityFindings): KnowledgePackValidationChecks {
    const item = aggregate(pack);
    const hasWorkflow = item.workflow.length >= 2 || pack.structuredKnowledge.workflowSteps.length >= 2;
    const hasDecisions = item.decisionRules.length >= 1 || pack.structuredKnowledge.decisionRules.length >= 1;
    const hasExamples = item.examples.length >= 1 || pack.structuredKnowledge.examples.length >= 1;
    const hasPractices = item.bestPractices.length >= 1 || pack.structuredKnowledge.bestPractices.length >= 1;
    const hasConcepts = item.coreConcepts.length >= 2;
    const hasRules = item.rules.length >= 1 || pack.structuredKnowledge.rules.length >= 1;
    const metadataOk = Boolean(pack.packId && pack.title && pack.domain && pack.contentFingerprint && pack.items.length);

    return {
      completeness: hasConcepts && hasRules && hasWorkflow && hasPractices && metadataOk,
      professionalAccuracy: hasPractices && (item.professionalStandards.length > 0 || item.professionalTechniques.length > 0),
      technicalAccuracy: item.keywords.length > 0 || pack.structuredKnowledge.terminology.length > 0,
      logicalConsistency: findings.conflicts.length === 0,
      knowledgeRelationships: item.relatedTopics.length > 0 || pack.structuredKnowledge.relatedKnowledge.length > 0,
      metadataCompleteness: metadataOk,
      workflowCompleteness: hasWorkflow,
      decisionRules: hasDecisions,
      examples: hasExamples,
      bestPractices: hasPractices,
    };
  }

  private detectFindings(pack: KnowledgePack): KnowledgePackQualityFindings {
    const item = aggregate(pack);
    const duplicates: string[] = [];
    const seen = new Map<string, string>();
    for (const entry of pack.items) {
      const key = `${entry.title.trim().toLowerCase()}|${entry.rules[0] ?? ""}`;
      if (seen.has(key)) duplicates.push(`Item "${entry.title}" duplicates ${seen.get(key)}`);
      else seen.set(key, entry.knowledgeId);
    }

    const conflicts: string[] = [];
    const rules = [...item.rules, ...pack.structuredKnowledge.rules];
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const left = rules[i];
        const right = rules[j];
        // Ignore single-rule "must never" phrasing; only flag opposing rule pairs.
        const leftPositive = /\b(always|must)\b/i.test(left) && !/\b(never|do not|don't)\b/i.test(left);
        const rightNegative = /\b(never|do not|don't)\b/i.test(right) && !/\b(always|must)\b/i.test(right);
        const rightPositive = /\b(always|must)\b/i.test(right) && !/\b(never|do not|don't)\b/i.test(right);
        const leftNegative = /\b(never|do not|don't)\b/i.test(left) && !/\b(always|must)\b/i.test(left);
        if (((leftPositive && rightNegative) || (rightPositive && leftNegative)) && sharedWords(left, right) >= 2) {
          conflicts.push(`"${left}" vs "${right}"`);
        }
      }
    }

    const missingConcepts: string[] = [];
    if (item.coreConcepts.length < 2) missingConcepts.push("Fewer than 2 core concepts");
    if (item.definitions.length === 0) missingConcepts.push("No definitions");

    const missingWorkflows: string[] = [];
    if (item.workflow.length < 2 && pack.structuredKnowledge.workflowSteps.length < 2) {
      missingWorkflows.push("Fewer than 2 workflow steps");
    }

    const weakExplanations: string[] = [];
    if ((pack.structuredKnowledge.description || "").length < 40) weakExplanations.push("Short pack description");
    for (const entry of pack.items) {
      if (entry.description.length < 24) weakExplanations.push(`Weak description: ${entry.title}`);
    }

    const lowConfidence: string[] = [];
    for (const entry of pack.items) {
      if (entry.confidenceScore < 70) lowConfidence.push(`Low confidence item: ${entry.title} (${entry.confidenceScore})`);
    }

    const inconsistentTerminology: string[] = [];
    const terms = [...item.keywords, ...pack.structuredKnowledge.terminology].map((term) => term.toLowerCase());
    const singularPlural = terms.filter((term) => terms.includes(`${term}s`) || (term.endsWith("s") && terms.includes(term.slice(0, -1))));
    if (singularPlural.length) inconsistentTerminology.push(`Possible term variants: ${unique(singularPlural).slice(0, 5).join(", ")}`);

    const invalidRelationships: string[] = [];
    for (const topic of item.relatedTopics) {
      if (topic.trim().length < 3) invalidRelationships.push(`Invalid related topic "${topic}"`);
    }

    return {
      duplicates,
      conflicts,
      missingConcepts,
      missingWorkflows,
      weakExplanations,
      lowConfidence,
      inconsistentTerminology,
      invalidRelationships,
    };
  }

  private score(
    pack: KnowledgePack,
    checks: KnowledgePackValidationChecks,
    findings: KnowledgePackQualityFindings
  ): KnowledgePackQualityScores {
    const item = aggregate(pack);
    const avgConfidence = average(pack.items.map((entry) => entry.confidenceScore));
    const avgQuality = average(pack.items.map((entry) => entry.qualityScore));

    let completeness = 40;
    if (checks.completeness) completeness += 20;
    if (checks.workflowCompleteness) completeness += 10;
    if (checks.decisionRules) completeness += 10;
    if (checks.examples) completeness += 10;
    if (checks.bestPractices) completeness += 10;
    completeness -= findings.missingConcepts.length * 5;
    completeness -= findings.missingWorkflows.length * 8;
    completeness = clamp(completeness);

    let consistency = 100;
    consistency -= findings.conflicts.length * 20;
    consistency -= findings.duplicates.length * 10;
    consistency -= findings.inconsistentTerminology.length * 5;
    consistency -= findings.invalidRelationships.length * 5;
    consistency = clamp(consistency);

    const professionalReadiness = clamp(
      Math.round(
        completeness * 0.35 +
          avgQuality * 0.2 +
          avgConfidence * 0.15 +
          consistency * 0.15 +
          (checks.professionalAccuracy ? 10 : 0) +
          (checks.technicalAccuracy ? 5 : 0) +
          (pack.originalDocumentsPreserved ? 5 : 0) -
          findings.weakExplanations.length * 3
      )
    );

    const qualityScore = clamp(
      Math.round(avgQuality * 0.35 + completeness * 0.25 + consistency * 0.2 + avgConfidence * 0.1 + professionalReadiness * 0.1)
    );

    return {
      qualityScore,
      confidenceScore: clamp(Math.round(avgConfidence || pack.structuredKnowledge.confidenceScore || 0)),
      completenessScore: completeness,
      professionalReadinessScore: professionalReadiness,
      consistencyScore: consistency,
    };
  }
}

function aggregate(pack: KnowledgePack): KnowledgeItem {
  const items = pack.items;
  return {
    knowledgeId: pack.packId,
    title: pack.title,
    domain: pack.domain,
    category: pack.structuredKnowledge.category,
    description: pack.structuredKnowledge.description,
    coreConcepts: unique(items.flatMap((item) => item.coreConcepts)),
    definitions: unique(items.flatMap((item) => item.definitions)),
    rules: unique(items.flatMap((item) => item.rules)),
    bestPractices: unique(items.flatMap((item) => item.bestPractices)),
    professionalTechniques: unique(items.flatMap((item) => item.professionalTechniques)),
    workflow: unique(items.flatMap((item) => item.workflow)),
    decisionRules: unique(items.flatMap((item) => item.decisionRules)),
    commonMistakes: unique(items.flatMap((item) => item.commonMistakes)),
    troubleshooting: unique(items.flatMap((item) => item.troubleshooting)),
    recommendations: unique(items.flatMap((item) => item.recommendations)),
    examples: unique(items.flatMap((item) => item.examples)),
    professionalStandards: unique(items.flatMap((item) => item.professionalStandards)),
    relatedTopics: unique(items.flatMap((item) => item.relatedTopics)),
    keywords: unique(items.flatMap((item) => item.keywords)),
    confidenceScore: average(items.map((item) => item.confidenceScore)),
    qualityScore: average(items.map((item) => item.qualityScore)),
    sourceMetadata: items.flatMap((item) => item.sourceMetadata),
    version: pack.version,
  };
}

function sharedWords(first: string, second: string): number {
  const a = new Set(first.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  return (second.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => a.has(word)).length;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
