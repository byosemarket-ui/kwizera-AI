/**
 * Phase 17 — Hybrid knowledge index over records from AiKnowledgeStorageEngine.
 * Keyword relevance is BM25 over an in-memory inverted index. Semantic relevance is cosine similarity and is only
 * used when a real embedder is supplied; otherwise results report mode KEYWORD so nothing claims semantic search.
 */
import type { KnowledgeGuidance } from "../knowledge-validation-engine/knowledge-evidence.js";
import {
  FRESHNESS_WEIGHT,
  TRUST_WEIGHT,
  computeFreshness,
  domainWeightForTask,
  normalizeDomain,
  profileForTask,
  type KnowledgeFreshness,
  type KnowledgeSourceType,
  type KnowledgeTask,
  type SourceTrust,
} from "./knowledge-taxonomy.js";

export interface KnowledgeCitation {
  sourceId: string;
  title: string;
  url?: string | null;
  section?: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  publisher?: string | null;
  sourceVersion?: number;
}

export interface KnowledgeIndexDoc {
  id: string;
  sourceId: string;
  title: string;
  text: string;
  domain: string;
  topics: string[];
  sourceType: KnowledgeSourceType;
  trust: SourceTrust;
  validationStatus: "VALIDATED" | "NEEDS_REVIEW" | "REJECTED";
  /** null = global knowledge; otherwise visible only to this tenant. */
  tenantId: string | null;
  /** null = not project-bound; otherwise visible only inside this project. */
  projectId: string | null;
  observedAt: string | null;
  headingPath: string[];
  citation: KnowledgeCitation;
  guidance?: KnowledgeGuidance[];
  supersedes?: string[];
  active: boolean;
  legacy?: boolean;
}

export interface KnowledgeEmbedder {
  id: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface KnowledgeSearchRequest {
  query: string;
  task?: KnowledgeTask | string;
  tenantId?: string | null;
  projectId?: string | null;
  domains?: string[];
  sourceTypes?: KnowledgeSourceType[];
  minTrust?: SourceTrust;
  excludeStale?: boolean;
  limit?: number;
  includeNeedsReview?: boolean;
}

export interface KnowledgeSearchHit {
  doc: KnowledgeIndexDoc;
  score: number;
  keywordScore: number;
  semanticScore: number | null;
  domainWeight: number;
  freshness: KnowledgeFreshness;
}

export interface KnowledgeSearchResult {
  mode: "KEYWORD" | "HYBRID_SEMANTIC";
  hits: KnowledgeSearchHit[];
  /** Relevant guidance-bearing hits left out by the diversity cap or limit (guidance resolution only, no excerpts). */
  guidanceHits?: KnowledgeSearchHit[];
  consideredCount: number;
  durationMs: number;
  cached: boolean;
}

const STOP = new Set(("a an and are as at be by for from has have in is it its of on or that the this to was were will with "
  + "your you we our can should into than then them they their these those not but if when which while how what").split(" "));

export function tokenize(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function stem(token: string): string {
  if (token.length <= 4) return token;
  return token
    .replace(/(ational|tional)$/, "tion")
    .replace(/(ies)$/, "y")
    .replace(/(ings|ing|edly|ed|ly|es|s)$/, "")
    || token;
}

const TRUST_ORDER: SourceTrust[] = ["REJECTED", "LOW_CONFIDENCE", "UNVERIFIED", "VERIFIED", "TRUSTED"];

export function cosine(a: number[], b: number[]): number {
  let dot = 0; let na = 0; let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Scope isolation: global docs are visible to everyone; tenant/project docs only to their owner. */
export function isVisibleInScope(doc: Pick<KnowledgeIndexDoc, "tenantId" | "projectId">, scope: { tenantId?: string | null; projectId?: string | null }): boolean {
  if (doc.tenantId && doc.tenantId !== (scope.tenantId ?? null)) return false;
  if (doc.projectId && doc.projectId !== (scope.projectId ?? null)) return false;
  return true;
}

export class HybridKnowledgeIndex {
  private docs = new Map<string, KnowledgeIndexDoc>();
  private postings = new Map<string, Map<string, number>>();
  private lengths = new Map<string, number>();
  private totalLength = 0;
  private vectors = new Map<string, number[]>();
  private generation = 0;
  private cache = new Map<string, { generation: number; result: KnowledgeSearchResult }>();

  constructor(private embedder: KnowledgeEmbedder | null = null, private readonly now: () => Date = () => new Date()) {}

  setEmbedder(embedder: KnowledgeEmbedder | null): void {
    this.embedder = embedder;
    this.vectors.clear();
    this.bump();
  }

  get semanticAvailable(): boolean {
    return Boolean(this.embedder);
  }

  get size(): number {
    return this.docs.size;
  }

  get version(): number {
    return this.generation;
  }

  has(id: string): boolean {
    return this.docs.has(id);
  }

  get(id: string): KnowledgeIndexDoc | undefined {
    return this.docs.get(id);
  }

  all(): KnowledgeIndexDoc[] {
    return [...this.docs.values()];
  }

  upsert(doc: KnowledgeIndexDoc): void {
    this.remove(doc.id, false);
    const terms = tokenize(`${doc.title} ${doc.headingPath.join(" ")} ${doc.topics.join(" ")} ${doc.text}`);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [term, count] of tf) {
      let posting = this.postings.get(term);
      if (!posting) { posting = new Map(); this.postings.set(term, posting); }
      posting.set(doc.id, count);
    }
    this.docs.set(doc.id, { ...doc, domain: normalizeDomain(doc.domain) });
    this.lengths.set(doc.id, terms.length);
    this.totalLength += terms.length;
    this.bump();
  }

  remove(id: string, bump = true): void {
    if (!this.docs.has(id)) return;
    for (const posting of this.postings.values()) posting.delete(id);
    this.totalLength -= this.lengths.get(id) ?? 0;
    this.lengths.delete(id);
    this.docs.delete(id);
    this.vectors.delete(id);
    if (bump) this.bump();
  }

  clear(): void {
    this.docs.clear(); this.postings.clear(); this.lengths.clear(); this.vectors.clear();
    this.totalLength = 0;
    this.bump();
  }

  private bump(): void {
    this.generation += 1;
    this.cache.clear();
  }

  private bm25(queryTerms: string[], candidateIds: Set<string>): Map<string, number> {
    const k1 = 1.2; const b = 0.75;
    const n = Math.max(1, this.docs.size);
    const avg = this.totalLength / n || 1;
    const scores = new Map<string, number>();
    for (const term of new Set(queryTerms)) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      const idf = Math.log(1 + (n - posting.size + 0.5) / (posting.size + 0.5));
      for (const [id, tf] of posting) {
        if (!candidateIds.has(id)) continue;
        const len = this.lengths.get(id) ?? avg;
        const s = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / avg))));
        scores.set(id, (scores.get(id) ?? 0) + s);
      }
    }
    return scores;
  }

  private async ensureVectors(ids: string[]): Promise<void> {
    if (!this.embedder) return;
    const missing = ids.filter((id) => !this.vectors.has(id));
    for (let i = 0; i < missing.length; i += 32) {
      const batch = missing.slice(i, i + 32);
      const vectors = await this.embedder.embed(batch.map((id) => {
        const d = this.docs.get(id)!;
        return `${d.title}\n${d.text}`.slice(0, 4_000);
      }));
      batch.forEach((id, j) => { if (vectors[j]) this.vectors.set(id, vectors[j]); });
    }
  }

  async search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult> {
    const started = Date.now();
    const profile = profileForTask(request.task);
    const limit = Math.max(1, Math.min(request.limit ?? profile.limit, 25));
    const cacheKey = JSON.stringify({ ...request, limit, e: this.embedder?.id ?? null });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.generation === this.generation) {
      return { ...cached.result, cached: true, durationMs: Date.now() - started };
    }
    const minTrustRank = TRUST_ORDER.indexOf(request.minTrust ?? "LOW_CONFIDENCE");
    const domains = request.domains?.length ? new Set(request.domains.map(normalizeDomain)) : null;
    const sourceTypes = request.sourceTypes?.length ? new Set(request.sourceTypes) : null;
    const now = this.now();

    const candidates = new Set<string>();
    for (const doc of this.docs.values()) {
      if (!doc.active || doc.trust === "REJECTED" || doc.validationStatus === "REJECTED") continue;
      if (doc.validationStatus === "NEEDS_REVIEW" && !request.includeNeedsReview) continue;
      if (TRUST_ORDER.indexOf(doc.trust) < minTrustRank) continue;
      if (!isVisibleInScope(doc, request)) continue;
      if (domains && !domains.has(doc.domain)) continue;
      if (sourceTypes && !sourceTypes.has(doc.sourceType)) continue;
      if (domainWeightForTask(profile, doc.domain) <= 0) continue;
      if (request.excludeStale && computeFreshness(doc.domain, doc.observedAt, now) === "STALE") continue;
      candidates.add(doc.id);
    }

    const queryTerms = tokenize(`${request.query} ${profile.focusTerms.join(" ")}`);
    const primaryTerms = new Set(tokenize(request.query));
    const keyword = this.bm25(queryTerms, candidates);
    const primary = this.bm25([...primaryTerms], candidates);
    const maxKeyword = Math.max(0, ...keyword.values());

    let semantic: Map<string, number> | null = null;
    if (this.embedder && candidates.size) {
      try {
        await this.ensureVectors([...candidates]);
        const [q] = await this.embedder.embed([request.query]);
        semantic = new Map();
        for (const id of candidates) {
          const v = this.vectors.get(id);
          if (v && q) semantic.set(id, Math.max(0, cosine(q, v)));
        }
      } catch {
        semantic = null;
      }
    }

    const hits: KnowledgeSearchHit[] = [];
    for (const id of candidates) {
      const doc = this.docs.get(id)!;
      const kw = maxKeyword > 0 ? (keyword.get(id) ?? 0) / maxKeyword : 0;
      const sem = semantic ? semantic.get(id) ?? 0 : null;
      const hasPrimary = primaryTerms.size === 0 || (primary.get(id) ?? 0) > 0;
      if (!hasPrimary && (sem === null || sem < 0.35)) continue;
      const relevance = sem === null ? kw : 0.55 * kw + 0.45 * sem;
      if (relevance <= 0.02) continue;
      const domainWeight = domainWeightForTask(profile, doc.domain);
      const freshness = computeFreshness(doc.domain, doc.observedAt, now);
      const score = relevance * (0.5 + 0.5 * domainWeight) * TRUST_WEIGHT[doc.trust] * FRESHNESS_WEIGHT[freshness]
        * (doc.validationStatus === "VALIDATED" ? 1 : 0.6);
      hits.push({ doc, score, keywordScore: kw, semanticScore: sem, domainWeight, freshness });
    }
    hits.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

    const perSource = new Map<string, number>();
    const selected: KnowledgeSearchHit[] = [];
    for (const hit of hits) {
      const used = perSource.get(hit.doc.sourceId) ?? 0;
      if (used >= 2) continue;
      perSource.set(hit.doc.sourceId, used + 1);
      selected.push(hit);
      if (selected.length >= limit) break;
    }
    const chosen = new Set(selected.map((h) => h.doc.id));
    const guidanceHits = hits.filter((h) => !chosen.has(h.doc.id) && h.doc.guidance?.length).slice(0, 5);
    const result: KnowledgeSearchResult = {
      mode: semantic ? "HYBRID_SEMANTIC" : "KEYWORD",
      hits: selected,
      guidanceHits,
      consideredCount: candidates.size,
      durationMs: Date.now() - started,
      cached: false,
    };
    this.cache.set(cacheKey, { generation: this.generation, result });
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value as string);
    return result;
  }
}
