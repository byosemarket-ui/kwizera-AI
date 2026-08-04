import { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeSearchMode, KnowledgeSearchQuery } from "./types.js";

export class KnowledgeSearchQueryBuilder {
  filterCandidates(
    entries: KnowledgeStorageIndexEntry[],
    query: KnowledgeSearchQuery
  ): KnowledgeStorageIndexEntry[] {
    let candidates = [...entries];
    const mode = query.mode ?? KnowledgeSearchMode.Hybrid;

    if (query.knowledgeId) {
      return candidates.filter((e) => e.knowledgeId === query.knowledgeId);
    }

    if (query.knowledgeType) {
      candidates = candidates.filter((e) => e.knowledgeType === query.knowledgeType);
    }

    if (query.category) {
      const cat = query.category.toLowerCase();
      candidates = candidates.filter((e) => e.category.toLowerCase().includes(cat));
    }

    if (query.topic) {
      const topic = query.topic.toLowerCase();
      candidates = candidates.filter((e) => e.topic.toLowerCase().includes(topic));
    }

    if (query.source) {
      const source = query.source.toLowerCase();
      candidates = candidates.filter((e) => e.source.toLowerCase().includes(source));
    }

    if (query.tags?.length) {
      candidates = candidates.filter((e) =>
        query.tags!.every((tag) => e.searchableText.includes(tag.toLowerCase()))
      );
    }

    if (query.keywords?.length) {
      candidates = candidates.filter((e) =>
        query.keywords!.some((kw) => e.searchableText.includes(kw.toLowerCase()))
      );
    }

    if (query.text) {
      const text = query.text.toLowerCase();
      if (mode === KnowledgeSearchMode.Exact) {
        candidates = candidates.filter(
          (e) => e.title.toLowerCase() === text || e.knowledgeId === text
        );
      } else if (mode === KnowledgeSearchMode.Semantic) {
        candidates = candidates
          .map((e) => ({ entry: e, score: this.computeSemanticScore(text, e.searchableText) }))
          .filter((s) => s.score >= 0.1)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.entry);
      } else if (mode === KnowledgeSearchMode.Hybrid) {
        candidates = candidates
          .map((e) => ({ entry: e, score: this.computeSemanticScore(text, e.searchableText) }))
          .filter((s) => s.entry.searchableText.includes(text) || s.score >= 0.08)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.entry);
      } else if (mode === KnowledgeSearchMode.Keyword) {
        const tokens = this.tokenize(text);
        candidates = candidates.filter((e) => {
          const entryTokens = this.tokenize(e.searchableText);
          return tokens.some((t) => entryTokens.includes(t));
        });
      } else {
        candidates = candidates.filter((e) => e.searchableText.includes(text));
      }
    }

    if (query.context) {
      candidates = this.applyContextFilter(candidates, query.context, mode);
    }

    if (query.relatedTo) {
      if (mode === KnowledgeSearchMode.Relationship) {
        candidates = candidates.filter((e) => e.knowledgeId !== query.relatedTo);
      }
    }

    if (mode === KnowledgeSearchMode.Priority) {
      candidates.sort((a, b) => this.importanceWeight(b.importance) - this.importanceWeight(a.importance));
    }

    if (mode === KnowledgeSearchMode.Recommendation) {
      candidates.sort(
        (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      );
    }

    this.applyTypeFilter(candidates, query);

    return candidates;
  }

  computeSemanticScore(query: string, searchableText: string): number {
    const queryTokens = this.normalizeSemanticTokens(query);
    const entryTokens = this.normalizeSemanticTokens(searchableText);
    if (queryTokens.length === 0 || entryTokens.length === 0) return 0;

    const intersection = queryTokens.filter((t) => entryTokens.includes(t));
    const union = new Set([...queryTokens, ...entryTokens]);
    return intersection.length / union.size;
  }

  private applyContextFilter(
    candidates: KnowledgeStorageIndexEntry[],
    context: NonNullable<KnowledgeSearchQuery["context"]>,
    mode: KnowledgeSearchMode
  ): KnowledgeStorageIndexEntry[] {
    if (mode !== KnowledgeSearchMode.Context && mode !== KnowledgeSearchMode.Hybrid) {
      return candidates;
    }

    const contextText = [context.objective, context.taskType, context.domain, context.projectId, context.workflowId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!contextText) return candidates;

    return candidates
      .map((e) => ({ entry: e, score: this.computeSemanticScore(contextText, e.searchableText) }))
      .filter((s) => s.score >= 0.1)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entry);
  }

  private applyTypeFilter(candidates: KnowledgeStorageIndexEntry[], query: KnowledgeSearchQuery): void {
    const typeMap: Partial<Record<keyof KnowledgeSearchQuery, KnowledgeStorageType>> = {
      product: KnowledgeStorageType.Product,
      brand: KnowledgeStorageType.Brand,
      image: KnowledgeStorageType.Image,
      video: KnowledgeStorageType.Video,
      marketing: KnowledgeStorageType.Marketing,
      language: KnowledgeStorageType.Language,
      workflow: KnowledgeStorageType.Workflow,
      decision: KnowledgeStorageType.Decision,
      reasoning: KnowledgeStorageType.Reasoning,
    };

    for (const [field, type] of Object.entries(typeMap)) {
      const value = query[field as keyof KnowledgeSearchQuery];
      if (typeof value === "string" && value.length > 0) {
        const filtered = candidates.filter(
          (e) => e.knowledgeType === type && e.searchableText.includes(value.toLowerCase())
        );
        if (filtered.length > 0) {
          candidates.splice(0, candidates.length, ...filtered);
        }
      }
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
  }

  private normalizeSemanticTokens(text: string): string[] {
    const synonyms: Record<string, string> = {
      illumination: "lighting",
      light: "lighting",
      cinematography: "camera",
      filming: "video",
      movie: "video",
      postproduction: "editing",
      colour: "color",
      branding: "brand",
      advertising: "marketing",
      animation: "motion",
    };
    return [...new Set(this.tokenize(text).map((token) => synonyms[token] ?? token))];
  }

  private importanceWeight(importance: string): number {
    switch (importance) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }
}
