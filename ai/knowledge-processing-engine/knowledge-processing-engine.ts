import type { KnowledgeAcquisitionPreview } from "../knowledge-acquisition-engine/types.js";
import type { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { KnowledgeExtractionDraft, KnowledgeItem } from "./knowledge-extraction-types.js";

export interface StructuredKnowledge {
  title: string;
  category: string;
  domain: string;
  description: string;
  sections: Array<{ title: string; kind: "rules" | "techniques" | "workflow" | "examples" | "guidance"; items: string[] }>;
  concepts: string[];
  entities: string[];
  terminology: string[];
  rules: string[];
  bestPractices: string[];
  professionalTechniques: string[];
  examples: string[];
  commonMistakes: string[];
  qualityRules: string[];
  decisionRules: string[];
  workflowSteps: string[];
  prerequisites: string[];
  dependencies: string[];
  relatedKnowledge: string[];
  definitions?: string[];
  troubleshooting?: string[];
  recommendations?: string[];
  professionalStandards?: string[];
  difficultyLevel: "foundation" | "intermediate" | "advanced";
  confidenceScore: number;
  sourceMetadata: Array<{ name: string; type: string; reference?: string; reliability: number }>;
}

/** Converts approved research into normalized, graph-ready knowledge fields. */
export class AiKnowledgeProcessingEngine {
  process(preview: KnowledgeAcquisitionPreview, knowledgeType: KnowledgeStorageType): StructuredKnowledge {
    const rules = unique(preview.rules);
    const techniques = unique(preview.techniques);
    const bestPractices = unique(preview.bestPractices);
    const workflows = unique(preview.workflows);
    const combined = [preview.topic, ...rules, ...techniques, ...bestPractices, ...workflows, ...preview.examples].join(" ");
    const concepts = unique(tokens(combined)).slice(0, 30);
    const decisionRules = rules.filter((rule) => /\b(if|when|must|never|always|avoid)\b/i.test(rule));
    const qualityRules = unique([...rules.filter((rule) => /\b(quality|sharp|consistent|accurate|safe|clean)\b/i.test(rule)), ...bestPractices]);
    const prerequisites = workflows.filter((step) => /\b(first|before|prepare|set up)\b/i.test(step));
    const dependencies = concepts.filter((concept) => /\b(light|lighting|camera|render|video|story|marketing|brand|motion|animation|edit|voice|music)\b/i.test(concept));
    const sections = [
      section("Rules", "rules", rules),
      section("Professional Techniques", "techniques", techniques),
      section("Workflow", "workflow", workflows),
      section("Examples", "examples", unique(preview.examples)),
      section("Guidance", "guidance", unique([...bestPractices, ...preview.commonMistakes])),
    ].filter((value): value is NonNullable<typeof value> => Boolean(value));

    return {
      title: `${preview.topic} Knowledge Foundation`,
      category: "acquired-knowledge",
      domain: domainFor(knowledgeType),
      description: `Structured professional knowledge about ${preview.topic}.`,
      sections,
      concepts,
      entities: unique([preview.topic, ...dependencies]),
      terminology: concepts,
      rules,
      bestPractices,
      professionalTechniques: techniques,
      examples: unique(preview.examples),
      commonMistakes: unique(preview.commonMistakes),
      qualityRules,
      decisionRules,
      workflowSteps: workflows,
      prerequisites,
      dependencies,
      relatedKnowledge: preview.duplicateKnowledgeIds,
      difficultyLevel: preview.confidenceScore >= 85 ? "advanced" : preview.confidenceScore >= 72 ? "intermediate" : "foundation",
      confidenceScore: preview.confidenceScore,
      sourceMetadata: preview.sources.map((source) => ({ ...source })),
    };
  }

  /** Normalize a Step 5 extraction draft into StructuredKnowledge without going through acquisition preview. */
  processExtractionDraft(draft: KnowledgeExtractionDraft): StructuredKnowledge {
    const rules = unique(draft.rules);
    const techniques = unique(draft.professionalTechniques);
    const bestPractices = unique(draft.bestPractices);
    const workflows = unique(draft.workflow);
    const sections = [
      section("Rules", "rules", rules),
      section("Professional Techniques", "techniques", techniques),
      section("Workflow", "workflow", workflows),
      section("Examples", "examples", unique(draft.examples)),
      section("Guidance", "guidance", unique([...bestPractices, ...draft.commonMistakes, ...draft.recommendations])),
    ].filter((value): value is NonNullable<typeof value> => Boolean(value));

    return {
      title: `${draft.title} Knowledge Pack`,
      category: draft.category,
      domain: draft.domain,
      description: draft.description,
      sections,
      concepts: unique(draft.coreConcepts).slice(0, 40),
      entities: unique([draft.title, draft.domain, ...draft.coreConcepts.slice(0, 10)]),
      terminology: unique([...draft.keywords, ...draft.coreConcepts]).slice(0, 40),
      rules,
      bestPractices,
      professionalTechniques: techniques,
      examples: unique(draft.examples),
      commonMistakes: unique(draft.commonMistakes),
      qualityRules: unique([...rules.filter((rule) => /\b(quality|sharp|consistent|accurate|safe|clean)\b/i.test(rule)), ...bestPractices]),
      decisionRules: unique(draft.decisionRules),
      workflowSteps: workflows,
      prerequisites: workflows.filter((step) => /\b(first|before|prepare|set up)\b/i.test(step)),
      dependencies: draft.coreConcepts.filter((concept) =>
        /\b(light|lighting|camera|render|video|story|marketing|brand|motion|animation|edit|voice|music)\b/i.test(concept)
      ),
      relatedKnowledge: unique(draft.relatedTopics),
      definitions: unique(draft.definitions),
      troubleshooting: unique(draft.troubleshooting),
      recommendations: unique(draft.recommendations),
      professionalStandards: unique(draft.professionalStandards),
      difficultyLevel: draft.confidenceScore >= 85 ? "advanced" : draft.confidenceScore >= 72 ? "intermediate" : "foundation",
      confidenceScore: draft.confidenceScore,
      sourceMetadata: draft.sourceMetadata.map((source) => ({
        name: source.name,
        type: source.type,
        reference: source.reference,
        reliability: source.reliability,
      })),
    };
  }

  /** Convert StructuredKnowledge + draft into the canonical KnowledgeItem shape. */
  toKnowledgeItem(draft: KnowledgeExtractionDraft, structured: StructuredKnowledge, knowledgeId: string, version = 1): KnowledgeItem {
    return {
      knowledgeId,
      title: draft.title,
      domain: draft.domain,
      category: draft.category,
      description: draft.description,
      coreConcepts: unique(draft.coreConcepts),
      definitions: unique(draft.definitions),
      rules: unique(structured.rules),
      bestPractices: unique(structured.bestPractices),
      professionalTechniques: unique(structured.professionalTechniques),
      workflow: unique(structured.workflowSteps),
      decisionRules: unique(structured.decisionRules),
      commonMistakes: unique(structured.commonMistakes),
      troubleshooting: unique(draft.troubleshooting),
      recommendations: unique(draft.recommendations),
      examples: unique(structured.examples),
      professionalStandards: unique(draft.professionalStandards),
      relatedTopics: unique(draft.relatedTopics),
      keywords: unique(draft.keywords),
      confidenceScore: draft.confidenceScore,
      qualityScore: draft.qualityScore,
      sourceMetadata: draft.sourceMetadata,
      version,
    };
  }
}

function section(title: string, kind: StructuredKnowledge["sections"][number]["kind"], items: string[]) {
  return items.length ? { title, kind, items } : null;
}

function domainFor(type: KnowledgeStorageType): string {
  return type.replace(/-knowledge$/, "");
}

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
