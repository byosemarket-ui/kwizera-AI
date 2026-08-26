/**
 * Phase 7 Step 3 — Online Knowledge Acquisition + Offline Knowledge Engine
 *
 * Reuses:
 * - PersistentMemoryCenter (Step 2) for durable knowledge storage/search
 * - ConnectivityDetector + trusted source library + professional domains
 * - Safe text fetch only (no script/exec, no model training)
 *
 * Does NOT create a second Knowledge Base or replace Memory.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { URL } from "node:url";
import {
  ConnectivityDetector,
  dnsConnectivityProbe,
  isTopicWithinProfessionalResearchScope,
  matchProfessionalResearchDomains,
  type ConnectivityProbe,
} from "../../ai/knowledge-research-engine/index.js";
import { TRUSTED_SOURCE_LIBRARY } from "../../ai/knowledge-source-manager/trusted-knowledge-source-library.js";
import { KnowledgeVerificationStatus } from "../../ai/knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../../ai/knowledge-storage-engine/types.js";
import { resolveStoragePath, resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { persistentMemoryCenter } from "./persistent-memory-center.js";

export type NetworkState = "ONLINE" | "OFFLINE" | "CONNECTING" | "LIMITED" | "ERROR";
export type ResearchPhase = "IDLE" | "SEARCHING" | "ANALYZING" | "SAVING" | "READY" | "NETWORK_ERROR";
export type KnowledgeFreshness = "CURRENT" | "AGING" | "OUTDATED" | "REVIEW_REQUIRED" | "UNKNOWN";

export type KnowledgeDomain =
  | "MARKETING"
  | "ADVERTISING"
  | "VIDEO_PRODUCTION"
  | "IMAGE_PRODUCTION"
  | "AUDIO_PRODUCTION"
  | "SOCIAL_MEDIA"
  | "PRODUCT_MARKETING"
  | "CREATIVE_DIRECTION"
  | "PLATFORM_REQUIREMENTS"
  | "AI_WORKFLOWS"
  | "TECHNICAL_DOCUMENTATION"
  | "SOFTWARE_DOCUMENTATION"
  | "WORKFLOW_BEST_PRACTICES";

const DOMAIN_KEYWORDS: Record<KnowledgeDomain, string[]> = {
  MARKETING: ["marketing", "campaign", "brand"],
  ADVERTISING: ["advertising", "ad", "cta", "hook"],
  VIDEO_PRODUCTION: ["video", "production", "filming", "cinema"],
  IMAGE_PRODUCTION: ["image", "photo", "photography", "visual"],
  AUDIO_PRODUCTION: ["audio", "music", "sound", "voice"],
  SOCIAL_MEDIA: ["social", "instagram", "tiktok", "youtube", "facebook"],
  PRODUCT_MARKETING: ["product", "ecommerce", "commerce"],
  CREATIVE_DIRECTION: ["creative", "direction", "storyboard"],
  PLATFORM_REQUIREMENTS: ["platform", "specification", "format", "resolution"],
  AI_WORKFLOWS: ["workflow", "ai", "automation"],
  TECHNICAL_DOCUMENTATION: ["documentation", "api", "technical", "docs"],
  SOFTWARE_DOCUMENTATION: ["software", "sdk", "library"],
  WORKFLOW_BEST_PRACTICES: ["best practice", "guideline", "standard"],
};

const BLOCKED_HOST_FRAGMENTS = [
  "malware",
  "phishing",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.",
  "metadata.google",
];

const MAX_FETCH_BYTES = 512 * 1024;
const MAX_REQUESTS_PER_MINUTE = 12;
const FETCH_TIMEOUT_MS = 12_000;
const INJECTION_PATTERNS = [
  /ignore (all |your )?previous instructions/i,
  /ignore (your )?system (prompt|instructions)/i,
  /execute (this |the following )?command/i,
  /run\s+(powershell|cmd|bash|sh)\b/i,
  /<\/?script\b/i,
];

export interface NetworkStatus {
  state: NetworkState;
  internetAvailable: boolean;
  latencyMs: number | null;
  checkedAt: string;
  detail: string;
  mode: "ONLINE_KNOWLEDGE" | "OFFLINE_KNOWLEDGE";
}

export interface ResearchRequest {
  query: string;
  topic?: string;
  domain?: KnowledgeDomain;
  freshnessRequirement?: "any" | "current" | "recent";
  persist?: boolean;
  maxSources?: number;
}

export interface ExtractedKnowledgeCandidate {
  title: string;
  topic: string;
  domain: KnowledgeDomain;
  summary: string;
  keyFacts: string[];
  practicalUse: string;
  sourceName: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  confidence: number;
  verificationStatus: KnowledgeVerificationStatus;
  contentHash: string;
  freshness: KnowledgeFreshness;
  conflictWith?: string | null;
  rawExcerpt: string;
  injectionAttemptDetected: boolean;
}

export interface ResearchResult {
  ok: boolean;
  researchId: string;
  phase: ResearchPhase;
  network: NetworkStatus;
  query: string;
  topic: string;
  mode: "ONLINE_KNOWLEDGE" | "OFFLINE_KNOWLEDGE";
  candidates: ExtractedKnowledgeCandidate[];
  savedKnowledgeIds: string[];
  ignored: Array<{ reason: string; title?: string }>;
  localHits: number;
  message: string;
  error?: string;
}

export interface ResearchHistoryEntry {
  researchId: string;
  at: string;
  query: string;
  topic: string;
  mode: string;
  sourcesTried: number;
  saved: number;
  status: "ok" | "partial" | "failed" | "offline";
  message: string;
}

function httpGetText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, status: 0, body: "", error: "Invalid URL" });
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      resolve({ ok: false, status: 0, body: "", error: "Only http(s) allowed" });
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          "User-Agent": "KWIZERA-AI-STUDIO/0.1 (local-knowledge-research; +offline-first)",
          Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.1",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // Follow one redirect safely
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          void httpGetText(next, timeoutMs).then(resolve);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_FETCH_BYTES) {
            req.destroy();
            resolve({ ok: false, status, body: "", error: "Response exceeds size limit" });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({ ok: status >= 200 && status < 300, status, body });
        });
      },
    );
    req.on("error", (error) => resolve({ ok: false, status: 0, body: "", error: error.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: "", error: "timeout" });
    });
  });
}

function stripToText(htmlOrText: string): string {
  // Treat as DATA only — strip scripts/styles/tags; never evaluate
  let text = htmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 12_000);
}

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOST_FRAGMENTS.some((b) => h.includes(b))) return false;
  // Private IPs
  if (/^(\d+\.){3}\d+$/.test(h)) {
    if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("127.") || h.startsWith("0.")) return false;
  }
  return true;
}

function isAllowlistedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return TRUSTED_SOURCE_LIBRARY.some((entry) => {
    try {
      const u = new URL(entry.definition.location.value);
      return u.hostname === h || h.endsWith(`.${u.hostname}`) || u.hostname.endsWith(`.${h}`);
    } catch {
      return false;
    }
  });
}

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function inferDomain(query: string, topic?: string): KnowledgeDomain {
  const blob = `${query} ${topic ?? ""}`.toLowerCase();
  let best: KnowledgeDomain = "WORKFLOW_BEST_PRACTICES";
  let score = 0;
  for (const [domain, keys] of Object.entries(DOMAIN_KEYWORDS) as Array<[KnowledgeDomain, string[]]>) {
    const s = keys.reduce((n, k) => n + (blob.includes(k) ? 1 : 0), 0);
    if (s > score) {
      score = s;
      best = domain;
    }
  }
  return best;
}

function mapDomainToStorageType(domain: KnowledgeDomain): KnowledgeStorageType {
  switch (domain) {
    case "MARKETING":
    case "ADVERTISING":
    case "PRODUCT_MARKETING":
    case "SOCIAL_MEDIA":
      return KnowledgeStorageType.Marketing;
    case "VIDEO_PRODUCTION":
      return KnowledgeStorageType.Video;
    case "IMAGE_PRODUCTION":
      return KnowledgeStorageType.Image;
    case "AUDIO_PRODUCTION":
      return KnowledgeStorageType.Creative;
    case "TECHNICAL_DOCUMENTATION":
    case "SOFTWARE_DOCUMENTATION":
    case "PLATFORM_REQUIREMENTS":
      return KnowledgeStorageType.Technical;
    case "AI_WORKFLOWS":
    case "WORKFLOW_BEST_PRACTICES":
      return KnowledgeStorageType.Workflow;
    default:
      return KnowledgeStorageType.Creative;
  }
}

function extractFacts(text: string, query: string): { summary: string; keyFacts: string[]; practicalUse: string } {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 320);
  const qWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = sentences
    .map((s) => ({
      s,
      score: qWords.reduce((n, w) => n + (s.toLowerCase().includes(w) ? 1 : 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const keyFacts = (scored.length ? scored : sentences.map((s) => ({ s, score: 0 })))
    .slice(0, 5)
    .map((x) => x.s);
  const summary = keyFacts[0] ?? text.slice(0, 280);
  const practicalUse = keyFacts[1] ?? "Use as reference for local creative/production decisions when online specs are unavailable.";
  return { summary, keyFacts, practicalUse };
}

function msftProbe(): ConnectivityProbe {
  return async () => {
    const started = Date.now();
    const result = await httpGetText("https://www.msftconnecttest.com/connecttest.txt", 3000);
    if (result.ok || result.status > 0) {
      return { online: true, latencyMs: Date.now() - started };
    }
    // Fallback DNS
    const dns = await dnsConnectivityProbe();
    return dns;
  };
}

export class OnlineKnowledgeEngine {
  private ready = false;
  private storageRoot = "";
  private researchRoot = "";
  private phase: ResearchPhase = "IDLE";
  private network: NetworkStatus = {
    state: "OFFLINE",
    internetAvailable: false,
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    detail: "Not checked yet",
    mode: "OFFLINE_KNOWLEDGE",
  };
  private readonly connectivity = new ConnectivityDetector(msftProbe());
  private readonly history: ResearchHistoryEntry[] = [];
  private readonly requestTimes: number[] = [];
  private readonly refreshQueue: Array<{ knowledgeId: string; topic: string; queuedAt: string }> = [];
  private lastError: string | null = null;

  async boot(storageRootOverride?: string): Promise<void> {
    const target = resolveStorageRoot(storageRootOverride);
    if (this.ready && this.storageRoot === target) return;
    this.ready = false;
    this.storageRoot = target;
    this.researchRoot = path.join(resolveStoragePath(this.storageRoot, "knowledge"), "online-research");
    fs.mkdirSync(path.join(this.researchRoot, "cache"), { recursive: true });
    fs.mkdirSync(path.join(this.researchRoot, "history"), { recursive: true });
    this.history.length = 0;
    this.loadHistory();
    // Non-blocking network check
    void this.refreshNetwork();
    this.ready = true;
    this.phase = "READY";
    console.log(`[KWIZERA] Online Knowledge Engine ready (offline-first) at ${this.researchRoot}`);
  }

  isReady(): boolean {
    return this.ready;
  }

  getPhase(): ResearchPhase {
    return this.phase;
  }

  getNetwork(): NetworkStatus {
    return { ...this.network };
  }

  getStatus() {
    const health = persistentMemoryCenter.isReady() ? persistentMemoryCenter.health() : null;
    return {
      ready: this.ready,
      phase: this.phase,
      network: this.network,
      localKnowledge: {
        ready: Boolean(health?.ready),
        knowledgeCount: health?.knowledgeCount ?? 0,
        memoryCount: health?.memoryCount ?? 0,
      },
      historyCount: this.history.length,
      refreshQueueLength: this.refreshQueue.length,
      lastError: this.lastError,
      offlineCapable: true as const,
      modelTraining: false as const,
      note: "Acquires selected validated knowledge into the existing Knowledge Base. Does not retrain models.",
    };
  }

  async refreshNetwork(): Promise<NetworkStatus> {
    this.network = {
      ...this.network,
      state: "CONNECTING",
      detail: "Checking internet availability…",
      checkedAt: new Date().toISOString(),
    };
    try {
      const snap = await this.connectivity.detect();
      const state: NetworkState = !snap.internetAvailable
        ? "OFFLINE"
        : snap.networkQuality === "poor" || snap.connectionStability === "unstable"
          ? "LIMITED"
          : "ONLINE";
      this.network = {
        state,
        internetAvailable: snap.internetAvailable,
        latencyMs: snap.latencyMs,
        checkedAt: snap.checkedAt,
        detail: snap.detail,
        mode: snap.internetAvailable ? "ONLINE_KNOWLEDGE" : "OFFLINE_KNOWLEDGE",
      };
    } catch (error) {
      this.network = {
        state: "ERROR",
        internetAvailable: false,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
        mode: "OFFLINE_KNOWLEDGE",
      };
    }
    return this.getNetwork();
  }

  listHistory(limit = 40): ResearchHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  listRefreshQueue() {
    return [...this.refreshQueue];
  }

  enqueueRefresh(knowledgeId: string, topic: string): void {
    if (!/^[a-zA-Z0-9._-]+$/.test(knowledgeId)) return;
    if (this.refreshQueue.some((q) => q.knowledgeId === knowledgeId)) return;
    this.refreshQueue.push({ knowledgeId, topic, queuedAt: new Date().toISOString() });
  }

  /**
   * Main research entry: offline → local KB only; online → allowlisted trusted sources + persist to PMC.
   */
  async research(input: ResearchRequest): Promise<ResearchResult> {
    const researchId = `research-${Date.now()}`;
    const query = (input.query ?? "").trim();
    if (!query) {
      return this.failResult(researchId, query, input.topic ?? "", "Query is required");
    }

    // Scope gate
    const topic = (input.topic ?? query).trim();
    if (!isTopicWithinProfessionalResearchScope(topic) && !isTopicWithinProfessionalResearchScope(query)) {
      // Soft allow if matches our domain keywords
      const domain = input.domain ?? inferDomain(query, topic);
      if (!DOMAIN_KEYWORDS[domain].some((k) => `${query} ${topic}`.toLowerCase().includes(k))) {
        return this.failResult(
          researchId,
          query,
          topic,
          "Query outside configured professional research domains. Narrow to studio-related topics.",
        );
      }
    }

    if (!this.allowRequest()) {
      return this.failResult(researchId, query, topic, "Rate limit exceeded — try again shortly.");
    }

    this.phase = "SEARCHING";
    await this.refreshNetwork();
    const domain = input.domain ?? inferDomain(query, topic);
    const persist = input.persist !== false;
    const maxSources = Math.min(input.maxSources ?? 4, 6);

    // Always search local first (offline-first)
    let localHits = 0;
    try {
      if (persistentMemoryCenter.isReady()) {
        const local = await persistentMemoryCenter.searchKnowledge({ text: query, topic, limit: 12 });
        localHits = local.length;
      }
    } catch {
      /* continue */
    }

    if (!this.network.internetAvailable) {
      this.phase = "READY";
      const entry: ResearchHistoryEntry = {
        researchId,
        at: new Date().toISOString(),
        query,
        topic,
        mode: "OFFLINE_KNOWLEDGE",
        sourcesTried: 0,
        saved: 0,
        status: "offline",
        message: "Current online information is unavailable because the machine is offline. Using local knowledge only.",
      };
      this.pushHistory(entry);
      return {
        ok: true,
        researchId,
        phase: this.phase,
        network: this.getNetwork(),
        query,
        topic,
        mode: "OFFLINE_KNOWLEDGE",
        candidates: [],
        savedKnowledgeIds: [],
        ignored: [{ reason: "Internet offline — online acquisition skipped" }],
        localHits,
        message: entry.message,
      };
    }

    this.phase = "ANALYZING";
    const candidates: ExtractedKnowledgeCandidate[] = [];
    const ignored: Array<{ reason: string; title?: string }> = [];
    const sources = this.selectTrustedSources(query, topic, domain, maxSources);

    for (const src of sources) {
      try {
        const url = src.definition.location.value;
        const host = new URL(url).hostname;
        if (!hostAllowed(host) || !isAllowlistedHost(host)) {
          ignored.push({ reason: "Source host not allowlisted", title: src.definition.name });
          continue;
        }
        const fetched = await httpGetText(url);
        if (!fetched.ok) {
          ignored.push({ reason: `Fetch failed: ${fetched.error ?? fetched.status}`, title: src.definition.name });
          continue;
        }
        const text = stripToText(fetched.body);
        if (text.length < 80) {
          ignored.push({ reason: "Extracted content too short / not useful", title: src.definition.name });
          continue;
        }
        const injectionAttemptDetected = detectInjection(text);
        // Still store as DATA with warning — never execute
        const { summary, keyFacts, practicalUse } = extractFacts(text, query);
        const contentHash = hashContent(`${url}::${summary}`);
        const confidence = this.scoreConfidence(src, keyFacts.length, injectionAttemptDetected);
        const verification = injectionAttemptDetected
          ? KnowledgeVerificationStatus.Pending
          : src.definition.trustClass?.includes("official") || String(src.definition.type).includes("official")
            ? KnowledgeVerificationStatus.Pending
            : KnowledgeVerificationStatus.Unverified;

        candidates.push({
          title: `${src.definition.name}: ${topic.slice(0, 80)}`,
          topic,
          domain,
          summary,
          keyFacts,
          practicalUse,
          sourceName: src.definition.name,
          sourceUrl: url,
          sourceDomain: host,
          sourceType: String(src.definition.type),
          confidence,
          verificationStatus: verification,
          contentHash,
          freshness: "CURRENT",
          conflictWith: null,
          rawExcerpt: text.slice(0, 600),
          injectionAttemptDetected,
        });
      } catch (error) {
        ignored.push({
          reason: error instanceof Error ? error.message : "Source error",
          title: src.definition.name,
        });
      }
    }

    // Conflict detection vs local knowledge
    if (persistentMemoryCenter.isReady() && candidates.length) {
      for (const c of candidates) {
        const existing = await persistentMemoryCenter.searchKnowledge({ text: c.summary.slice(0, 80), topic, limit: 5 });
        const clash = existing.find((e) => {
          const old = String(e.description ?? "");
          return old && old !== c.summary && this.looksConflicting(old, c.summary);
        });
        if (clash) {
          c.conflictWith = clash.knowledgeId;
          c.verificationStatus = KnowledgeVerificationStatus.Pending;
          ignored.push({
            reason: `KNOWLEDGE_CONFLICT with existing ${clash.knowledgeId} — stored as pending review, not overwritten`,
            title: c.title,
          });
        }
      }
    }

    const savedKnowledgeIds: string[] = [];
    if (persist && candidates.length && persistentMemoryCenter.isReady()) {
      this.phase = "SAVING";
      for (const c of candidates) {
        if (c.injectionAttemptDetected && c.confidence < 40) {
          ignored.push({ reason: "Rejected low-confidence content with injection patterns", title: c.title });
          continue;
        }
        try {
          const saved = await persistentMemoryCenter.saveKnowledge({
            title: c.title,
            topic: c.topic,
            content: [
              c.summary,
              "",
              "KEY FACTS:",
              ...c.keyFacts.map((f) => `- ${f}`),
              "",
              `PRACTICAL USE: ${c.practicalUse}`,
              c.injectionAttemptDetected ? "\nWARNING: Untrusted instructional patterns detected in source text — treated as DATA only." : "",
            ].join("\n"),
            source: c.sourceName,
            sourceUrl: c.sourceUrl,
            knowledgeType: mapDomainToStorageType(c.domain),
            tags: [c.domain, c.sourceType, "online-acquired", c.freshness],
            confidence: c.confidence,
            verificationStatus: c.verificationStatus,
            payload: {
              domain: c.domain,
              sourceDomain: c.sourceDomain,
              contentHash: c.contentHash,
              freshness: c.freshness,
              keyFacts: c.keyFacts,
              practicalUse: c.practicalUse,
              conflictWith: c.conflictWith,
              injectionAttemptDetected: c.injectionAttemptDetected,
              acquiredVia: "online-knowledge-engine",
              acquiredAt: new Date().toISOString(),
              researchId,
            },
          });
          if (saved.knowledgeId) savedKnowledgeIds.push(String(saved.knowledgeId));
          this.writeCache(c.contentHash, c);
        } catch (error) {
          ignored.push({
            reason: error instanceof Error ? error.message : "Save failed",
            title: c.title,
          });
        }
      }
    }

    this.phase = "READY";
    const status = savedKnowledgeIds.length || candidates.length ? (ignored.length ? "partial" : "ok") : "failed";
    const message = candidates.length
      ? `Research complete (${this.network.mode}). Saved ${savedKnowledgeIds.length} knowledge item(s) into existing Knowledge Base.`
      : `No persistable sources collected. Local knowledge hits: ${localHits}.`;

    const entry: ResearchHistoryEntry = {
      researchId,
      at: new Date().toISOString(),
      query,
      topic,
      mode: this.network.mode,
      sourcesTried: sources.length,
      saved: savedKnowledgeIds.length,
      status,
      message,
    };
    this.pushHistory(entry);
    this.appendLog(entry, ignored);

    matchProfessionalResearchDomains(topic); // touch domains for future automation hooks

    return {
      ok: status !== "failed",
      researchId,
      phase: this.phase,
      network: this.getNetwork(),
      query,
      topic,
      mode: this.network.mode,
      candidates,
      savedKnowledgeIds,
      ignored,
      localHits,
      message,
    };
  }

  /** Offline retrieval helper for AI context. */
  async retrieveLocal(query: string, limit = 10) {
    if (!persistentMemoryCenter.isReady()) return [];
    return persistentMemoryCenter.searchKnowledge({ text: query, limit });
  }

  private selectTrustedSources(query: string, topic: string, domain: KnowledgeDomain, max: number) {
    const blob = `${query} ${topic} ${domain}`.toLowerCase();
    const scored = TRUSTED_SOURCE_LIBRARY.map((entry) => {
      const hay = [
        entry.definition.name,
        entry.definition.description,
        entry.category,
        ...entry.discoveryTopics,
        ...entry.definition.domainIds,
        ...entry.definition.tags,
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const w of blob.split(/\W+/).filter((x) => x.length > 3)) {
        if (hay.includes(w)) score += 1;
      }
      // Prefer official docs
      if (String(entry.definition.type).includes("official")) score += 2;
      return { entry, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const picked = (scored.length ? scored : TRUSTED_SOURCE_LIBRARY.map((entry) => ({ entry, score: 0 })))
      .slice(0, max)
      .map((x) => x.entry);

    return picked.filter((e) => {
      try {
        return e.definition.location.kind === "url" && hostAllowed(new URL(e.definition.location.value).hostname);
      } catch {
        return false;
      }
    });
  }

  private scoreConfidence(
    src: (typeof TRUSTED_SOURCE_LIBRARY)[number],
    factCount: number,
    injection: boolean,
  ): number {
    let score = 55;
    if (String(src.definition.type).includes("official")) score += 20;
    if (factCount >= 3) score += 10;
    if (injection) score -= 25;
    return Math.max(15, Math.min(92, score));
  }

  private looksConflicting(a: string, b: string): boolean {
    const na = a.toLowerCase().slice(0, 200);
    const nb = b.toLowerCase().slice(0, 200);
    if (na === nb) return false;
    // crude: both mention opposite cues
    const pairs: Array<[string, string]> = [
      ["short", "long"],
      ["vertical", "horizontal"],
      ["required", "optional"],
    ];
    return pairs.some(([x, y]) => (na.includes(x) && nb.includes(y)) || (na.includes(y) && nb.includes(x)));
  }

  private allowRequest(): boolean {
    const now = Date.now();
    this.requestTimes.push(now);
    while (this.requestTimes.length && now - this.requestTimes[0] > 60_000) this.requestTimes.shift();
    return this.requestTimes.length <= MAX_REQUESTS_PER_MINUTE;
  }

  private pushHistory(entry: ResearchHistoryEntry): void {
    this.history.unshift(entry);
    this.history.splice(100);
    try {
      fs.writeFileSync(
        path.join(this.researchRoot, "history", "research-history.json"),
        JSON.stringify(this.history, null, 2),
        "utf8",
      );
    } catch {
      /* ignore */
    }
  }

  private loadHistory(): void {
    try {
      const p = path.join(this.researchRoot, "history", "research-history.json");
      if (!fs.existsSync(p)) return;
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as ResearchHistoryEntry[];
      if (Array.isArray(raw)) this.history.push(...raw.slice(0, 100));
    } catch {
      /* ignore */
    }
  }

  private writeCache(hash: string, candidate: ExtractedKnowledgeCandidate): void {
    try {
      const p = path.join(this.researchRoot, "cache", `${hash}.json`);
      fs.writeFileSync(p, JSON.stringify({ cachedAt: new Date().toISOString(), candidate }, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  private appendLog(entry: ResearchHistoryEntry, ignored: Array<{ reason: string; title?: string }>): void {
    try {
      const logPath = path.join(this.researchRoot, "history", "acquisition.log");
      const line = `[${entry.at}] ${entry.researchId} mode=${entry.mode} saved=${entry.saved} status=${entry.status} query=${JSON.stringify(entry.query)} ignored=${ignored.length}\n`;
      fs.appendFileSync(logPath, line, "utf8");
    } catch {
      /* ignore */
    }
  }

  private failResult(researchId: string, query: string, topic: string, error: string): ResearchResult {
    this.phase = "NETWORK_ERROR";
    this.lastError = error;
    return {
      ok: false,
      researchId,
      phase: this.phase,
      network: this.getNetwork(),
      query,
      topic,
      mode: this.network.mode,
      candidates: [],
      savedKnowledgeIds: [],
      ignored: [{ reason: error }],
      localHits: 0,
      message: error,
      error,
    };
  }
}

export const onlineKnowledgeEngine = new OnlineKnowledgeEngine();
