import type { RankedSourceCandidate, ResearchPlan, ResearchPreview } from "./types.js";

const STORAGE_HEURISTIC_BYTES: Record<string, number> = {
  "official-documentation": 400_000,
  "official-api-documentation": 300_000,
  "technical-manual": 1_500_000,
  "technical-standard": 600_000,
  "white-paper": 900_000,
  "user-manual": 800_000,
  book: 4_000_000,
  "research-paper": 700_000,
  "open-educational-resource": 500_000,
  "approved-website": 250_000,
  "company-document": 200_000,
  pdf: 2_000_000,
  word: 500_000,
  markdown: 50_000,
  json: 50_000,
  html: 150_000,
  "local-documentation": 100_000,
  "local-project-file": 100_000,
  "user-document": 200_000,
  "knowledge-foundation": 100_000,
};

const DEFAULT_STORAGE_ESTIMATE_BYTES = 300_000;

/** Builds the pre-download Research Preview and explains AI Me's source decisions to the user. */
export class ResearchExplainer {
  buildPreview(plan: ResearchPlan, candidates: RankedSourceCandidate[]): ResearchPreview {
    const accepted = candidates.filter((candidate) => candidate.accepted !== false);
    const estimatedDownloads = Math.min(accepted.length, plan.estimatedSourceCount);
    const selected = accepted.slice(0, estimatedDownloads);
    const estimatedKnowledgeCoveragePercent = selected.length
      ? Math.round(selected.reduce((total, candidate) => total + candidate.compositeScore, 0) / selected.length)
      : 0;
    const estimatedStorageBytes = selected.reduce(
      (total, candidate) => total + (STORAGE_HEURISTIC_BYTES[candidate.type] ?? DEFAULT_STORAGE_ESTIMATE_BYTES),
      0
    );
    const trustedSourceCategories = [...new Set(selected.map((candidate) => candidate.type))];

    return {
      planId: plan.id,
      topic: plan.topic,
      trustedSourceCategories,
      estimatedDownloads,
      estimatedKnowledgeCoveragePercent,
      estimatedStorageBytes,
      candidates: selected,
      generatedAt: new Date().toISOString(),
    };
  }

  explainSelection(candidate: RankedSourceCandidate): string {
    return (
      `"${candidate.name}" was selected (composite score ${candidate.compositeScore}): ` +
      `trust ${candidate.trustScore}, quality ${candidate.qualityScore}, authority ${candidate.authorityScore}, ` +
      `freshness ${candidate.freshnessScore}, relevance ${candidate.relevanceScore}, completeness ${candidate.completenessScore}.`
    );
  }

  explainRejection(name: string, reason: string): string {
    return `"${name}" was not selected: ${reason}`;
  }

  recommendAdditionalTopics(selectedDomainLabels: string[]): string[] {
    const catalog = [
      "Video Production",
      "Product Photography",
      "Camera",
      "Camera Movement",
      "Lighting",
      "Composition",
      "Storytelling",
      "Marketing",
      "Branding",
      "Customer Psychology",
      "Sales Psychology",
      "Video Editing",
      "Motion Graphics",
      "Animation",
      "Rendering",
      "Social Media",
      "AI Video Production",
      "Product Marketing",
    ];
    const selected = new Set(selectedDomainLabels.map((label) => label.toLowerCase()));
    return catalog.filter((label) => !selected.has(label.toLowerCase())).slice(0, 6);
  }

  explainDownloadRecommendation(candidate: RankedSourceCandidate): string {
    return (
      `Downloading "${candidate.name}" is recommended: it is a trusted, approved source with a composite quality ` +
      `score of ${candidate.compositeScore}, expected to materially increase coverage of this research topic.`
    );
  }

  expectedKnowledgeGain(candidates: RankedSourceCandidate[]): string {
    if (candidates.length === 0) return "No approved sources are currently available for this topic.";
    const average = Math.round(
      candidates.reduce((total, candidate) => total + candidate.compositeScore, 0) / candidates.length
    );
    return `Acquiring these ${candidates.length} source(s) is expected to raise topic coverage to approximately ${average}%.`;
  }
}
