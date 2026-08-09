/**
 * Professional knowledge extractor — reads DocumentUnderstandingResult (not original files).
 * Upgrades heuristic extraction used by acquisition; specialized domain lexicons for creative domains.
 */

import type { DocumentUnderstandingResult } from "./document-understanding-types.js";
import type {
  KnowledgeExtractionDraft,
  KnowledgePackSlug,
  KnowledgeSourceMetadata,
} from "./knowledge-extraction-types.js";

const DOMAIN_PACK_HINTS: Array<{ slug: KnowledgePackSlug; terms: string[] }> = [
  { slug: "product-photography", terms: ["product photography", "packshot", "product shot", "still life", "hero shot"] },
  { slug: "camera-movement", terms: ["camera movement", "dolly", "pan", "tilt", "tracking shot", "gimbal", "steadicam"] },
  { slug: "video-production", terms: ["video production", "production pipeline", "shoot day", "call sheet", "commercial"] },
  { slug: "customer-psychology", terms: ["customer psychology", "buyer psychology", "consumer behavior", "purchase intent"] },
  { slug: "sales-psychology", terms: ["sales psychology", "persuasion", "closing", "objection handling"] },
  { slug: "industry-standards", terms: ["industry standards", "professional standards", "quality assurance", "quality rules", "quality checklist"] },
  { slug: "color-theory", terms: ["color theory", "color harmony", "complementary", "hue", "saturation", "grading"] },
  { slug: "typography", terms: ["typography", "typeface", "font pairing", "kerning", "leading"] },
  { slug: "social-media", terms: ["social media", "instagram", "tiktok", "reels", "shorts", "feed"] },
  { slug: "motion", terms: ["motion graphics", "motion design", "kinetic", "lower third"] },
  { slug: "composition", terms: ["composition", "rule of thirds", "leading lines", "framing", "negative space"] },
  { slug: "branding", terms: ["branding", "brand identity", "brand voice", "brand guidelines"] },
  { slug: "camera", terms: ["camera", "aperture", "shutter", "iso", "exposure", "lens", "focal"] },
  { slug: "lighting", terms: ["lighting", "key light", "fill light", "softbox", "rim light", "gaffer"] },
  { slug: "storytelling", terms: ["story", "storytelling", "narrative", "hook", "arc", "plot"] },
  { slug: "animation", terms: ["animation", "keyframe", "easing", "rig", "tween"] },
  { slug: "rendering", terms: ["render", "rendering", "codec", "bitrate", "export", "ray tracing"] },
  { slug: "editing", terms: ["editing", "timeline", "cut", "montage", "nle", "rough cut"] },
  { slug: "marketing", terms: ["marketing", "campaign", "funnel", "cta", "conversion", "audience"] },
];

const DOMAIN_ID_TO_SLUG: Record<string, KnowledgePackSlug> = {
  "camera-knowledge": "camera",
  "lighting-knowledge": "lighting",
  "marketing-knowledge": "marketing",
  "storytelling-knowledge": "storytelling",
  "animation-knowledge": "animation",
  "rendering-knowledge": "rendering",
  "editing-knowledge": "editing",
  "product-photography-knowledge": "product-photography",
  "video-production-knowledge": "video-production",
  "social-media-knowledge": "social-media",
  "branding-knowledge": "branding",
  "composition-knowledge": "composition",
  "color-theory-knowledge": "color-theory",
  "typography-knowledge": "typography",
  "motion-graphics-knowledge": "motion",
  "camera-movement-knowledge": "camera-movement",
  "customer-psychology-knowledge": "customer-psychology",
  "sales-psychology-knowledge": "sales-psychology",
  "industry-standards-knowledge": "industry-standards",
};

/**
 * Extracts professional knowledge fields from an understood document.
 * Does not read or modify original collected files.
 */
export class ProfessionalKnowledgeExtractor {
  extract(document: DocumentUnderstandingResult): KnowledgeExtractionDraft {
    const text = document.searchableText || document.summary;
    const lines = splitUnits(text);
    const packSlug = resolvePackSlug(document);
    const domain = packSlug === "general" ? document.metadata.domainId ?? "general" : packSlug;
    const issues: string[] = [];

    let rules = pick(lines, ["must", "never", "always", "rule", "require"]);
    let professionalTechniques = pick(lines, ["technique", "use ", "adjust", "compose", "setup", "lighting", "edit", "shoot"]);
    let bestPractices = pick(lines, ["best practice", "recommend", "ensure", "should", "prefer"]);
    let commonMistakes = pick(lines, ["mistake", "avoid", "do not", "don't", "never use"]);
    let workflow = pick(lines, ["step", "workflow", "process", "first", "then", "next", "finally"]);
    let examples = pick(lines, ["example", "for example", "such as", "e.g."]);
    let definitions = pick(lines, [" is ", " means ", "defined as", "refers to", "definition"]);
    let troubleshooting = pick(lines, ["troubleshoot", "fix", "if it fails", "problem", "error", "when it"]);
    let recommendations = pick(lines, ["recommend", "suggest", "advise", "consider"]);
    let professionalStandards = pick(lines, ["standard", "compliance", "broadcast", "cinema", "professional", "guideline"]);
    let decisionRules = unique([
      ...rules.filter((rule) => /\b(if|when|must|never|always|avoid)\b/i.test(rule)),
      ...pick(lines, ["if ", "when ", "choose", "decide", "prefer"]),
    ]).slice(0, 10);

    const coreConcepts = unique([
      ...document.analysis.importantConcepts,
      ...document.analysis.learningTopics,
      ...document.structure.chapters,
      ...document.analysis.domainConcepts.flatMap((entry) => entry.terms),
    ]).slice(0, 40);

    const keywords = unique([...document.analysis.keywords, ...document.analysis.technicalTerminology]).slice(0, 40);
    const relatedTopics = unique([
      ...document.analysis.learningTopics,
      ...document.structure.headings.map((heading) => heading.text),
      ...document.analysis.domainConcepts.map((entry) => entry.category),
    ]).slice(0, 30);

    // Specialized domain enrichment from lexicons present in text.
    const specialized = extractSpecializedSignals(text, packSlug);
    coreConcepts.push(...specialized.concepts);
    professionalTechniques.push(...specialized.techniques);
    bestPractices.push(...specialized.practices);

    let improved = false;
    const weak =
      rules.length + professionalTechniques.length + bestPractices.length + workflow.length + examples.length < 4;
    if (weak) {
      improved = true;
      issues.push("Weak extraction detected; enriched from sections and concepts.");
      const sectionFallback = document.structure.sections
        .map((section) => `${section.title}: ${section.contentPreview}`.trim())
        .filter((line) => line.length >= 16)
        .slice(0, 8);
      if (!rules.length) rules = sectionFallback.slice(0, 3).map((line) => `Apply guidance: ${line}`);
      if (!professionalTechniques.length) professionalTechniques = sectionFallback.slice(0, 4);
      if (!bestPractices.length) bestPractices = coreConcepts.slice(0, 4).map((concept) => `Practice ${concept} consistently in production.`);
      if (!workflow.length) {
        workflow = document.structure.chapters.slice(0, 5).map((chapter, index) => `Step ${index + 1}: ${chapter}`);
      }
      if (!examples.length && document.structure.tables[0]) {
        examples = [`Table example: ${document.structure.tables[0].preview}`];
      }
      if (!definitions.length) {
        definitions = coreConcepts.slice(0, 3).map((concept) => `${concept} is a core professional concept in ${domain}.`);
      }
      if (!recommendations.length) {
        recommendations = bestPractices.slice(0, 3);
      }
      if (!professionalStandards.length) {
        professionalStandards = [`Follow professional ${domain} standards for consistent quality.`];
      }
      if (!decisionRules.length) {
        decisionRules = rules.filter((rule) => /\b(if|when|must|never|always)\b/i.test(rule)).slice(0, 5);
      }
    }

    const coverage =
      unique(rules).length * 8 +
      unique(professionalTechniques).length * 6 +
      unique(workflow).length * 8 +
      unique(bestPractices).length * 5 +
      unique(examples).length * 4 +
      unique(coreConcepts).length;
    const reliability = reliabilityForFormat(document.metadata.format);
    const confidenceScore = Math.max(40, Math.min(98, Math.round(reliability * 0.55 + Math.min(100, coverage) * 0.45)));
    const qualityScore = Math.max(
      35,
      Math.min(
        98,
        Math.round(
          confidenceScore * 0.7 +
            (document.status === "understood" ? 15 : document.status === "partial" ? 5 : 0) +
            (issues.length ? -8 : 5)
        )
      )
    );

    const sourceMetadata: KnowledgeSourceMetadata[] = [
      {
        name: document.metadata.sourceTitle ?? document.structure.title,
        type: document.metadata.format,
        reference: document.metadata.filePath,
        reliability,
        resourceId: document.resourceId,
        understandingId: document.understandingId,
        checksumSha256: document.metadata.checksumSha256,
      },
    ];

    return {
      packSlug,
      domain,
      title: document.structure.title || document.metadata.fileName,
      category: `${packSlug}-professional-knowledge`,
      description: document.summary || `Professional knowledge extracted from ${document.structure.title}.`,
      coreConcepts: unique(coreConcepts).slice(0, 40),
      definitions: unique(definitions).slice(0, 12),
      rules: unique(rules).slice(0, 12),
      bestPractices: unique(bestPractices).slice(0, 12),
      professionalTechniques: unique(professionalTechniques).slice(0, 12),
      workflow: unique(workflow).slice(0, 12),
      decisionRules: unique(decisionRules).slice(0, 12),
      commonMistakes: unique(commonMistakes).slice(0, 10),
      troubleshooting: unique(troubleshooting).slice(0, 10),
      recommendations: unique(recommendations).slice(0, 10),
      examples: unique(examples).slice(0, 10),
      professionalStandards: unique(professionalStandards).slice(0, 10),
      relatedTopics: unique(relatedTopics).slice(0, 30),
      keywords: unique(keywords).slice(0, 40),
      confidenceScore,
      qualityScore,
      sourceMetadata,
      issues,
      improved,
    };
  }
}

/** Shared line heuristic — upgraded surface for acquisition-compatible extraction. */
export function extractKnowledgeLines(
  content: string,
  topic: string
): {
  rules: string[];
  techniques: string[];
  bestPractices: string[];
  commonMistakes: string[];
  workflows: string[];
  examples: string[];
  definitions: string[];
  troubleshooting: string[];
  recommendations: string[];
  professionalStandards: string[];
} {
  const lines = splitUnits(content);
  const fallback = lines.filter((line) => line.toLowerCase().includes(topic.toLowerCase())).slice(0, 3);
  return {
    rules: pick(lines, ["must", "never", "always", "rule"]).concat(fallback).slice(0, 8),
    techniques: pick(lines, ["technique", "use ", "adjust", "compose", "lighting", "edit"]),
    bestPractices: pick(lines, ["best practice", "recommend", "ensure", "should"]),
    commonMistakes: pick(lines, ["mistake", "avoid", "do not", "don't"]),
    workflows: pick(lines, ["step", "workflow", "process", "first", "then"]),
    examples: pick(lines, ["example", "for example", "such as"]),
    definitions: pick(lines, [" is ", " means ", "defined as", "refers to"]),
    troubleshooting: pick(lines, ["troubleshoot", "fix", "problem", "error"]),
    recommendations: pick(lines, ["recommend", "suggest", "advise"]),
    professionalStandards: pick(lines, ["standard", "compliance", "guideline", "broadcast"]),
  };
}

export function resolvePackSlug(document: DocumentUnderstandingResult): KnowledgePackSlug {
  const domainId = document.metadata.domainId?.toLowerCase() ?? "";
  if (domainId && DOMAIN_ID_TO_SLUG[domainId]) return DOMAIN_ID_TO_SLUG[domainId];
  for (const [key, slug] of Object.entries(DOMAIN_ID_TO_SLUG)) {
    if (domainId.includes(key.replace(/-knowledge$/, ""))) return slug;
  }
  const haystack = [
    document.structure.title,
    ...document.analysis.learningTopics,
    ...document.analysis.importantConcepts,
    ...document.analysis.domainConcepts.flatMap((entry) => [entry.category, ...entry.terms]),
    document.searchableText.slice(0, 2000),
  ]
    .join(" ")
    .toLowerCase();
  for (const hint of DOMAIN_PACK_HINTS) {
    if (hint.terms.some((term) => haystack.includes(term))) return hint.slug;
  }
  return "general";
}

function extractSpecializedSignals(text: string, slug: KnowledgePackSlug): { concepts: string[]; techniques: string[]; practices: string[] } {
  const lower = text.toLowerCase();
  const hint = DOMAIN_PACK_HINTS.find((entry) => entry.slug === slug);
  const concepts = (hint?.terms ?? []).filter((term) => lower.includes(term));
  const techniques = concepts.map((concept) => `Apply ${concept} with production intent.`);
  const practices = concepts.map((concept) => `Maintain consistent ${concept} quality across deliverables.`);
  return { concepts, techniques, practices };
}

function reliabilityForFormat(format: string): number {
  switch (format) {
    case "pdf":
    case "docx":
    case "technical-manual":
    case "api-documentation":
    case "research-paper":
      return 88;
    case "markdown":
    case "html":
    case "json":
    case "xml":
    case "csv":
    case "user-guide":
    case "company-documentation":
      return 80;
    default:
      return 70;
  }
}

function splitUnits(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => line.length >= 18);
}

function pick(lines: string[], terms: string[]): string[] {
  return unique(lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 10));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
