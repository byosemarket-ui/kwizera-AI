/**
 * Content analysis — difficulty classification and domain concept detection.
 */

import type {
  DocumentContentAnalysis,
  DomainConceptCategory,
  KnowledgeDifficultyLevel,
} from "./document-understanding-types.js";

const DOMAIN_LEXICON: Record<DomainConceptCategory, string[]> = {
  camera: ["camera", "lens", "aperture", "shutter", "iso", "exposure", "focal", "sensor", "white balance", "depth of field"],
  lighting: ["lighting", "key light", "fill light", "rim light", "softbox", "diffusion", "contrast ratio", "illumination", "gaffer"],
  marketing: ["marketing", "campaign", "funnel", "cta", "audience", "conversion", "branding", "positioning", "seo", "retention"],
  rendering: ["render", "rendering", "codec", "bitrate", "export", "resolution", "frame rate", "gpu", "ray tracing"],
  animation: ["animation", "keyframe", "easing", "motion", "rig", "tween", "timing", "spacing", "squash"],
  storytelling: ["story", "storytelling", "narrative", "hook", "conflict", "arc", "scene", "plot", "protagonist", "reveal"],
  editing: ["editing", "cut", "timeline", "transition", "pacing", "montage", "rough cut", "fine cut", "nle"],
  "product-photography": ["product photography", "product shot", "packshot", "still life", "hero shot", "reflectivity", "catalog"],
  general: [],
};

const BEGINNER = ["introduction", "basics", "beginner", "getting started", "overview", "fundamentals", "what is", "simple"];
const INTERMEDIATE = ["workflow", "technique", "practice", "setup", "improve", "optimize", "intermediate"];
const ADVANCED = ["advanced", "complex", "pipeline", "architecture", "performance", "edge case", "troubleshoot"];
const PROFESSIONAL = ["professional", "production", "studio", "broadcast", "cinema", "enterprise", "standard", "compliance", "best practice"];

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "are", "was", "were", "have", "has", "will", "can", "into", "using", "used", "also", "than", "then", "when", "what", "which", "their", "they", "them", "about", "over", "under", "after", "before", "between",
]);

export class DocumentContentAnalyzer {
  analyze(text: string, sectionTitles: string[]): DocumentContentAnalysis {
    const lower = text.toLowerCase();
    const beginnerSignals = matchSignals(lower, BEGINNER);
    const intermediateSignals = matchSignals(lower, INTERMEDIATE);
    const advancedSignals = matchSignals(lower, ADVANCED);
    const professionalSignals = matchSignals(lower, PROFESSIONAL);
    const difficultyLevel = classifyDifficulty(
      beginnerSignals.length,
      intermediateSignals.length,
      advancedSignals.length,
      professionalSignals.length
    );

    const domainConcepts = (Object.keys(DOMAIN_LEXICON) as DomainConceptCategory[])
      .filter((category) => category !== "general")
      .map((category) => ({
        category,
        terms: DOMAIN_LEXICON[category].filter((term) => lower.includes(term)),
      }))
      .filter((entry) => entry.terms.length > 0);

    const keywords = rankKeywords(text).slice(0, 40);
    const importantConcepts = unique([
      ...sectionTitles.slice(0, 12),
      ...domainConcepts.flatMap((entry) => entry.terms).slice(0, 20),
      ...keywords.slice(0, 15),
    ]).slice(0, 40);

    const technicalTerminology = unique([
      ...domainConcepts.flatMap((entry) => entry.terms),
      ...keywords.filter((keyword) => /[a-z]+(?:-[a-z]+)+/.test(keyword) || keyword.length > 8),
    ]).slice(0, 50);

    const learningTopics = unique([
      ...sectionTitles.filter((title) => title.length > 3).slice(0, 20),
      ...domainConcepts.map((entry) => `${entry.category} concepts`),
      ...importantConcepts.slice(0, 10),
    ]).slice(0, 30);

    return {
      difficultyLevel,
      beginnerSignals,
      intermediateSignals,
      advancedSignals,
      professionalSignals,
      domainConcepts,
      technicalTerminology,
      keywords,
      importantConcepts,
      learningTopics,
    };
  }
}

function classifyDifficulty(
  beginner: number,
  intermediate: number,
  advanced: number,
  professional: number
): KnowledgeDifficultyLevel {
  const scores: Array<{ level: KnowledgeDifficultyLevel; score: number }> = [
    { level: "professional", score: professional * 3 + advanced },
    { level: "advanced", score: advanced * 3 + professional },
    { level: "intermediate", score: intermediate * 3 + advanced },
    { level: "beginner", score: beginner * 3 + intermediate },
  ];
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return "intermediate";
  return scores[0].level;
}

function matchSignals(text: string, signals: string[]): string[] {
  return signals.filter((signal) => text.includes(signal));
}

function rankKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z][a-z0-9\-]{2,}/g) ?? []) {
    if (STOP.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
