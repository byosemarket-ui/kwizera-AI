/**
 * Searchable document indexes for understood learning resources.
 */

import type {
  DocumentDomainIndexEntry,
  DocumentKeywordIndexEntry,
  DocumentRelationshipIndexEntry,
  DocumentTechnicalIndexEntry,
  DocumentTopicIndexEntry,
  DocumentUnderstandingIndexes,
  DocumentUnderstandingResult,
} from "./document-understanding-types.js";

export class DocumentIndexer {
  build(results: DocumentUnderstandingResult[]): DocumentUnderstandingIndexes {
    const understood = results.filter((result) => result.status === "understood" || result.status === "partial");

    const topicMap = new Map<string, DocumentTopicIndexEntry>();
    const keywordMap = new Map<string, DocumentKeywordIndexEntry>();
    const domainMap = new Map<string, DocumentDomainIndexEntry>();
    const technicalMap = new Map<string, DocumentTechnicalIndexEntry>();

    for (const result of understood) {
      for (const topic of result.analysis.learningTopics) {
        const key = topic.toLowerCase();
        const entry = topicMap.get(key) ?? { topic, resourceIds: [], understandingIds: [] };
        if (!entry.resourceIds.includes(result.resourceId)) entry.resourceIds.push(result.resourceId);
        if (!entry.understandingIds.includes(result.understandingId)) entry.understandingIds.push(result.understandingId);
        topicMap.set(key, entry);
      }

      for (const keyword of result.analysis.keywords) {
        const key = keyword.toLowerCase();
        const entry = keywordMap.get(key) ?? { keyword, resourceIds: [], frequencies: {} };
        if (!entry.resourceIds.includes(result.resourceId)) entry.resourceIds.push(result.resourceId);
        entry.frequencies[result.resourceId] = (entry.frequencies[result.resourceId] ?? 0) + 1;
        keywordMap.set(key, entry);
      }

      const domainId = result.metadata.domainId ?? "general";
      const domainEntry = domainMap.get(domainId) ?? { domainId, resourceIds: [], understandingIds: [] };
      if (!domainEntry.resourceIds.includes(result.resourceId)) domainEntry.resourceIds.push(result.resourceId);
      if (!domainEntry.understandingIds.includes(result.understandingId)) domainEntry.understandingIds.push(result.understandingId);
      domainMap.set(domainId, domainEntry);

      for (const concept of result.analysis.domainConcepts) {
        for (const term of concept.terms) {
          const key = term.toLowerCase();
          const entry = technicalMap.get(key) ?? { term, resourceIds: [], categories: [] };
          if (!entry.resourceIds.includes(result.resourceId)) entry.resourceIds.push(result.resourceId);
          if (!entry.categories.includes(concept.category)) entry.categories.push(concept.category);
          technicalMap.set(key, entry);
        }
      }
    }

    const relationshipIndex = this.buildRelationships(understood);

    return {
      topicIndex: [...topicMap.values()].sort((a, b) => b.resourceIds.length - a.resourceIds.length),
      keywordIndex: [...keywordMap.values()].sort((a, b) => b.resourceIds.length - a.resourceIds.length),
      domainIndex: [...domainMap.values()].sort((a, b) => a.domainId.localeCompare(b.domainId)),
      technicalIndex: [...technicalMap.values()].sort((a, b) => a.term.localeCompare(b.term)),
      relationshipIndex,
      updatedAt: new Date().toISOString(),
    };
  }

  search(
    results: DocumentUnderstandingResult[],
    indexes: DocumentUnderstandingIndexes,
    query: string
  ): DocumentUnderstandingResult[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const ids = new Set<string>();

    for (const entry of indexes.topicIndex) {
      if (entry.topic.toLowerCase().includes(needle)) entry.resourceIds.forEach((id) => ids.add(id));
    }
    for (const entry of indexes.keywordIndex) {
      if (entry.keyword.toLowerCase().includes(needle)) entry.resourceIds.forEach((id) => ids.add(id));
    }
    for (const entry of indexes.technicalIndex) {
      if (entry.term.toLowerCase().includes(needle)) entry.resourceIds.forEach((id) => ids.add(id));
    }
    for (const result of results) {
      if (result.searchableText.toLowerCase().includes(needle) || result.structure.title.toLowerCase().includes(needle)) {
        ids.add(result.resourceId);
      }
    }

    return results.filter((result) => ids.has(result.resourceId));
  }

  private buildRelationships(results: DocumentUnderstandingResult[]): DocumentRelationshipIndexEntry[] {
    const relationships: DocumentRelationshipIndexEntry[] = [];
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i];
        const b = results[j];
        if (a.metadata.domainId && a.metadata.domainId === b.metadata.domainId) {
          relationships.push({
            fromResourceId: a.resourceId,
            toResourceId: b.resourceId,
            relation: "same-domain",
            strength: 0.9,
          });
        }
        const sharedTopics = a.analysis.learningTopics.filter((topic) =>
          b.analysis.learningTopics.some((other) => other.toLowerCase() === topic.toLowerCase())
        );
        if (sharedTopics.length) {
          relationships.push({
            fromResourceId: a.resourceId,
            toResourceId: b.resourceId,
            relation: "shared-topic",
            strength: Math.min(1, sharedTopics.length / 5),
          });
        }
        const sharedKeywords = a.analysis.keywords.filter((keyword) => b.analysis.keywords.includes(keyword)).slice(0, 5);
        if (sharedKeywords.length >= 2) {
          relationships.push({
            fromResourceId: a.resourceId,
            toResourceId: b.resourceId,
            relation: "shared-keyword",
            strength: Math.min(1, sharedKeywords.length / 8),
          });
        }
        const aConcepts = new Set(a.analysis.importantConcepts.map((item) => item.toLowerCase()));
        const sharedConcepts = b.analysis.importantConcepts.filter((item) => aConcepts.has(item.toLowerCase()));
        if (sharedConcepts.length >= 2) {
          relationships.push({
            fromResourceId: a.resourceId,
            toResourceId: b.resourceId,
            relation: "shared-concept",
            strength: Math.min(1, sharedConcepts.length / 6),
          });
        }
      }
    }
    return relationships.slice(0, 500);
  }
}
