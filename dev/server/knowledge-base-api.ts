/**
 * Phase 17 — Knowledge Base boot + HTTP handlers.
 *
 * Admin: /api/admin/knowledge/* (called by handleAdminApi after the admin guard).
 * Customer: /api/workspace/projects/:id/knowledge[/search] — project-scoped documents only;
 * a customer can never read another project's documents or any raw source text.
 */
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  KnowledgePipeline,
  KnowledgeInputError,
  adaptKnowledgeStorageEngine,
  publicSourceView,
  type KnowledgeFeedbackKind,
} from "../../ai/knowledge-acquisition-engine/knowledge-pipeline.js";
import { getKnowledgePipeline, setKnowledgePipeline } from "../../ai/knowledge-acquisition-engine/knowledge-pipeline-registry.js";
import { ensureCoreKnowledge } from "../../ai/knowledge-acquisition-engine/kwizera-core-knowledge.js";
import {
  KNOWLEDGE_SOURCE_TYPES,
  listKnowledgeDomains,
  TASK_PROFILES,
  type KnowledgeSourceType,
  type SourceTrust,
} from "../../ai/knowledge-retrieval-engine/knowledge-taxonomy.js";
import { summarizeKnowledgeContext } from "../../ai/knowledge-retrieval-engine/knowledge-context-builder.js";
import { createKnowledgeFetcher, isOfficialKnowledgeHost, validateKnowledgeUrl } from "./knowledge-fetcher.js";
import { persistentMemoryCenter } from "./persistent-memory-center.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;
type ReadBody = (req: IncomingMessage) => Promise<string>;

const MAX_DOCUMENT_CHARS = 400_000;
const FEEDBACK_KINDS: KnowledgeFeedbackKind[] = ["USEFUL", "NOT_USEFUL", "OUTDATED", "INCORRECT", "IRRELEVANT"];
const ADMIN_TRUST: SourceTrust[] = ["TRUSTED", "VERIFIED", "UNVERIFIED", "LOW_CONFIDENCE"];

let bootPromise: Promise<void> | null = null;

export function bootKnowledgePipeline(): Promise<void> {
  bootPromise ??= (async () => {
    if (!persistentMemoryCenter.isReady()) throw new Error("Persistent Memory Center is not ready");
    const pipeline = new KnowledgePipeline({
      store: adaptKnowledgeStorageEngine(persistentMemoryCenter.getKnowledgeStorageEngine()),
      dataDir: path.join(persistentMemoryCenter.getKnowledgeRoot(), "pipeline"),
      fetcher: process.env.KWIZERA_KNOWLEDGE_ONLINE_RETRIEVAL === "0" ? null : createKnowledgeFetcher(),
    });
    await pipeline.boot();
    setKnowledgePipeline(pipeline);
    const coreJobs = ensureCoreKnowledge(pipeline);
    await Promise.all(coreJobs.map((job) => pipeline.waitForJob(job.jobId)));
    const hours = Number(process.env.KWIZERA_KNOWLEDGE_REFRESH_HOURS ?? 0);
    if (hours > 0) pipeline.startScheduledRefresh(hours);
    console.log(`[KWIZERA] Knowledge Base ready (${pipeline.overview().index.active} active items, core guide jobs: ${coreJobs.length}).`);
  })().catch((err) => {
    bootPromise = null;
    throw err;
  });
  return bootPromise;
}

function fail(sendJson: SendJson, res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { ok: false, error: { code, message }, code, message });
}

function ok(sendJson: SendJson, res: ServerResponse, data: Record<string, unknown>, status = 200): void {
  sendJson(res, status, { ok: true, ...data });
}

async function jsonBody(req: IncomingMessage, readBody: ReadBody): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x, 60)).filter(Boolean).slice(0, 12) : []);

function handleError(err: unknown, sendJson: SendJson, res: ServerResponse): void {
  if (err instanceof KnowledgeInputError) {
    fail(sendJson, res, err.code.endsWith("NOT_FOUND") ? 404 : 400, err.code, err.message);
    return;
  }
  if (err instanceof SyntaxError) {
    fail(sendJson, res, 400, "INVALID_JSON", "Request body must be valid JSON.");
    return;
  }
  console.error("[KWIZERA] Knowledge API error:", err instanceof Error ? err.message : err);
  fail(sendJson, res, 500, "KNOWLEDGE_ERROR", "The knowledge request could not be completed.");
}

function publicJob(job: ReturnType<KnowledgePipeline["listJobs"]>[number]) {
  return {
    jobId: job.jobId,
    sourceId: job.sourceId,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    history: job.history,
    attempts: job.attempts,
    error: job.error,
    result: job.result,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function requirePipeline(sendJson: SendJson, res: ServerResponse): KnowledgePipeline | null {
  const pipeline = getKnowledgePipeline();
  if (!pipeline) {
    fail(sendJson, res, 503, "KNOWLEDGE_NOT_READY", "The knowledge base is starting. Try again shortly.");
    return null;
  }
  return pipeline;
}

/** Returns true when handled. Must be called only after the admin guard has passed. */
export async function handleAdminKnowledgeApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: { sendJson: SendJson; readBody: ReadBody },
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/admin/knowledge")) return false;
  const { sendJson, readBody } = deps;
  const pipeline = requirePipeline(sendJson, res);
  if (!pipeline) return true;
  const sub = url.pathname.slice("/api/admin/knowledge".length) || "/";
  const method = req.method ?? "GET";
  try {
    if (sub === "/overview" && method === "GET") {
      ok(sendJson, res, { overview: pipeline.overview() });
      return true;
    }
    if (sub === "/domains" && method === "GET") {
      ok(sendJson, res, {
        domains: listKnowledgeDomains(),
        sourceTypes: KNOWLEDGE_SOURCE_TYPES,
        tasks: Object.keys(TASK_PROFILES),
      });
      return true;
    }
    if (sub === "/sources" && method === "GET") {
      ok(sendJson, res, { items: pipeline.listSources({ includeScoped: true }).map(publicSourceView) });
      return true;
    }
    if (sub === "/sources" && method === "POST") {
      const body = await jsonBody(req, readBody);
      const sourceType = str(body.sourceType, 40) as KnowledgeSourceType;
      if (sourceType === "USER_DOCUMENT") {
        fail(sendJson, res, 400, "USE_PROJECT_ROUTE", "Customer documents are added from the customer's project.");
        return true;
      }
      const rawUrl = str(body.url, 2_000);
      const content = typeof body.content === "string" ? body.content.slice(0, MAX_DOCUMENT_CHARS + 1) : undefined;
      let officialHost = false;
      if (rawUrl) {
        try {
          officialHost = isOfficialKnowledgeHost(validateKnowledgeUrl(rawUrl).hostname);
        } catch (err) {
          fail(sendJson, res, 400, "URL_NOT_ALLOWED", err instanceof Error ? err.message : "URL not allowed");
          return true;
        }
      } else if (!content) {
        fail(sendJson, res, 400, "CONTENT_REQUIRED", "Provide a URL or document text.");
        return true;
      }
      const source = pipeline.registerSource({
        sourceType,
        title: str(body.title, 200),
        url: rawUrl || null,
        author: str(body.author, 200) || null,
        publisher: str(body.publisher, 200) || null,
        publicationDate: str(body.publicationDate, 40) || null,
        license: str(body.license, 200) || null,
        language: str(body.language, 12) || undefined,
        domain: str(body.domain, 60),
        topics: strList(body.topics),
        officialHost,
      });
      const job = pipeline.ingest(source.sourceId, {
        content,
        mimeType: str(body.mimeType, 80) || undefined,
        fileName: str(body.fileName, 200) || undefined,
      });
      ok(sendJson, res, { source: publicSourceView(source), job: publicJob(job) }, 202);
      return true;
    }
    const sourceMatch = sub.match(/^\/sources\/([0-9a-f-]{36})(?:\/(approve|reject|disable|enable|refresh|trust))?$/);
    if (sourceMatch) {
      const [, sourceId, action] = sourceMatch;
      const source = pipeline.getSource(sourceId);
      if (!source) {
        fail(sendJson, res, 404, "SOURCE_NOT_FOUND", "Knowledge source not found.");
        return true;
      }
      if (!action && method === "GET") {
        ok(sendJson, res, {
          source: publicSourceView(source),
          items: pipeline.listSourceItems(sourceId),
          jobs: pipeline.listJobs(200).filter((j) => j.sourceId === sourceId).slice(0, 20).map(publicJob),
        });
        return true;
      }
      if (action && method === "POST") {
        const body = await jsonBody(req, readBody);
        const note = str(body.note, 200);
        let updated = source;
        let job = null;
        if (action === "approve") updated = await pipeline.setSourceTrust(sourceId, "VERIFIED", `Approved by admin${note ? `: ${note}` : ""}`);
        else if (action === "reject") updated = await pipeline.setSourceTrust(sourceId, "REJECTED", `Rejected by admin${note ? `: ${note}` : ""}`);
        else if (action === "trust") {
          const trust = str(body.trust, 20) as SourceTrust;
          if (!ADMIN_TRUST.includes(trust)) {
            fail(sendJson, res, 400, "INVALID_TRUST", "Unsupported trust level.");
            return true;
          }
          updated = await pipeline.setSourceTrust(sourceId, trust, `Trust set by admin${note ? `: ${note}` : ""}`);
        } else if (action === "disable") updated = await pipeline.setSourceStatus(sourceId, "DISABLED");
        else if (action === "enable") updated = await pipeline.setSourceStatus(sourceId, "ACTIVE");
        else if (action === "refresh") job = publicJob(pipeline.refreshSource(sourceId, body.force === true));
        ok(sendJson, res, { source: publicSourceView(updated), job });
        return true;
      }
    }
    if (sub === "/jobs" && method === "GET") {
      ok(sendJson, res, { items: pipeline.listJobs(100).map(publicJob) });
      return true;
    }
    const retryMatch = sub.match(/^\/jobs\/([0-9a-f-]{36})\/retry$/);
    if (retryMatch && method === "POST") {
      ok(sendJson, res, { job: publicJob(pipeline.retryJob(retryMatch[1])) });
      return true;
    }
    if (sub === "/reindex" && method === "POST") {
      ok(sendJson, res, { result: await pipeline.reindex() });
      return true;
    }
    if (sub === "/refresh-stale" && method === "POST") {
      ok(sendJson, res, { jobs: pipeline.refreshStale().map(publicJob) });
      return true;
    }
    if (sub === "/retrievals" && method === "GET") {
      ok(sendJson, res, { items: pipeline.listRetrievals(100) });
      return true;
    }
    if (sub === "/search" && method === "POST") {
      const body = await jsonBody(req, readBody);
      const query = str(body.query, 500);
      if (query.length < 2) {
        fail(sendJson, res, 400, "QUERY_REQUIRED", "Enter a search query.");
        return true;
      }
      const context = await pipeline.retrieve({
        task: str(body.task, 40) || "GENERAL",
        query,
        projectId: str(body.projectId, 80) || null,
        caller: "admin-diagnostic",
      });
      ok(sendJson, res, { context });
      return true;
    }
    if (sub === "/feedback" && method === "POST") {
      const body = await jsonBody(req, readBody);
      const kind = str(body.kind, 20) as KnowledgeFeedbackKind;
      if (!FEEDBACK_KINDS.includes(kind)) {
        fail(sendJson, res, 400, "INVALID_FEEDBACK", "Unsupported feedback kind.");
        return true;
      }
      ok(sendJson, res, { feedback: pipeline.recordFeedback(str(body.itemId, 80), kind, str(body.note, 300)) });
      return true;
    }
    fail(sendJson, res, 404, "NOT_FOUND", "Unknown knowledge endpoint.");
    return true;
  } catch (err) {
    handleError(err, sendJson, res);
    return true;
  }
}

/** Customer project documents. Returns true when handled. */
export async function handleProjectKnowledgeApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: { sendJson: SendJson; readBody: ReadBody; projectExists: (projectId: string) => Promise<boolean> },
): Promise<boolean> {
  const match = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/knowledge(\/search)?$/);
  if (!match) return false;
  const { sendJson, readBody } = deps;
  const projectId = decodeURIComponent(match[1]);
  const isSearch = Boolean(match[2]);
  try {
    if (!(await deps.projectExists(projectId))) {
      fail(sendJson, res, 404, "PROJECT_NOT_FOUND", "Project not found.");
      return true;
    }
    const pipeline = requirePipeline(sendJson, res);
    if (!pipeline) return true;
    const projectSources = () => pipeline.listSources({ includeScoped: true }).filter((s) => s.projectId === projectId);
    const customerView = (s: ReturnType<typeof projectSources>[number]) => {
      const v = publicSourceView(s);
      return {
        sourceId: v.sourceId, title: v.title, domain: v.domain, status: v.status, trust: v.trust,
        currentVersion: v.currentVersion, lastRetrievedAt: v.lastRetrievedAt, lastError: v.lastError,
        chunks: v.stats.stored, createdAt: v.createdAt,
      };
    };

    if (!isSearch && req.method === "GET") {
      ok(sendJson, res, {
        items: projectSources().map(customerView),
        jobs: pipeline.listJobs(200).filter((j) => projectSources().some((s) => s.sourceId === j.sourceId)).slice(0, 20)
          .map((j) => ({ jobId: j.jobId, sourceId: j.sourceId, status: j.status, stage: j.stage, error: j.error, updatedAt: j.updatedAt })),
      });
      return true;
    }
    if (!isSearch && req.method === "POST") {
      const body = await jsonBody(req, readBody);
      const content = typeof body.content === "string" ? body.content : "";
      if (!content.trim()) {
        fail(sendJson, res, 400, "CONTENT_REQUIRED", "Paste or upload the document text.");
        return true;
      }
      if (content.length > MAX_DOCUMENT_CHARS) {
        fail(sendJson, res, 413, "DOCUMENT_TOO_LARGE", "The document is too large.");
        return true;
      }
      const source = pipeline.registerSource({
        sourceType: "USER_DOCUMENT",
        title: str(body.title, 200) || str(body.fileName, 200) || "Project document",
        domain: str(body.domain, 60) || "PRODUCT_CREATIVE",
        topics: strList(body.topics),
        projectId,
      });
      const job = pipeline.ingest(source.sourceId, {
        content,
        mimeType: str(body.mimeType, 80) || undefined,
        fileName: str(body.fileName, 200) || undefined,
      });
      ok(sendJson, res, { source: customerView(source), job: { jobId: job.jobId, status: job.status, stage: job.stage } }, 202);
      return true;
    }
    if (isSearch && req.method === "POST") {
      const body = await jsonBody(req, readBody);
      const query = str(body.query, 300);
      if (query.length < 2) {
        fail(sendJson, res, 400, "QUERY_REQUIRED", "Enter a search query.");
        return true;
      }
      const context = await pipeline.retrieve({
        task: str(body.task, 40) || "GENERAL",
        query,
        projectId,
        caller: "customer-project-search",
        limit: 6,
      });
      ok(sendJson, res, {
        knowledge: summarizeKnowledgeContext(context),
        results: context.items.map((i) => ({ id: i.id, title: i.title, section: i.citation.section ?? null, excerpt: i.excerpt, domain: i.domain })),
      });
      return true;
    }
    fail(sendJson, res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return true;
  } catch (err) {
    handleError(err, sendJson, res);
    return true;
  }
}
