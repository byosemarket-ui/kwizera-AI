/**
 * Phase 19 / 38B — Forex Admin HTTP API (/api/forex-admin/*).
 * Protected by requireForexAdmin (Admin Control Plane token / role / development-open).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  FOREX_INDEXING_STATUSES,
  FOREX_KNOWLEDGE_STATUSES,
  FOREX_KNOWLEDGE_TYPES,
  FOREX_PDF_MAX_BYTES,
  getForexKnowledgeService,
  type ForexIndexingStatus,
  type ForexKnowledgeStatus,
  type ForexKnowledgeType,
} from "../../ai/forex-knowledge/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function fail(sendJson: SendJson, res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { ok: false, error: { code, message } });
}

export async function handleForexAdminApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex-admin")) return false;

  if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;

  const service = getForexKnowledgeService();
  await service.ensureReady();
  const sub = url.pathname.slice("/api/forex-admin".length) || "/";

  try {
    if (sub === "/meta" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, {
        ok: true,
        surface: "forex-admin",
        canonicalEntry: "/admin/forex",
        authentication: "admin-token",
        knowledgeTypes: FOREX_KNOWLEDGE_TYPES,
        statuses: FOREX_KNOWLEDGE_STATUSES,
        indexingStatuses: FOREX_INDEXING_STATUSES,
        pdfMaxBytes: FOREX_PDF_MAX_BYTES,
      });
      return true;
    }

    if (sub === "/overview" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, { ok: true, overview: await service.getOverview() });
      return true;
    }

    if (sub === "/categories" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, { ok: true, categories: await service.listCategories() });
      return true;
    }

    if (sub === "/categories" && req.method === "POST") {
      const body = (await readJsonBody(req)) as { name?: string; description?: string };
      const category = await service.createCategory({
        name: String(body.name ?? ""),
        description: body.description,
      });
      sendJson(res, 201, { ok: true, category });
      return true;
    }

    if (sub === "/topics" && (req.method === "GET" || req.method === "HEAD")) {
      const categoryId = url.searchParams.get("categoryId") ?? undefined;
      sendJson(res, 200, { ok: true, topics: await service.listTopics(categoryId) });
      return true;
    }

    if (sub === "/topics" && req.method === "POST") {
      const body = (await readJsonBody(req)) as { categoryId?: string; name?: string; description?: string };
      const topic = await service.createTopic({
        categoryId: String(body.categoryId ?? ""),
        name: String(body.name ?? ""),
        description: body.description,
      });
      sendJson(res, 201, { ok: true, topic });
      return true;
    }

    if (sub === "/knowledge" && (req.method === "GET" || req.method === "HEAD")) {
      const status = url.searchParams.get("status");
      const indexingStatus = url.searchParams.get("indexingStatus");
      const knowledgeType = url.searchParams.get("knowledgeType");
      const result = await service.listDocuments({
        q: url.searchParams.get("q") ?? undefined,
        categoryId: url.searchParams.get("categoryId") ?? undefined,
        topicId: url.searchParams.get("topicId") ?? undefined,
        tag: url.searchParams.get("tag") ?? undefined,
        language: url.searchParams.get("language") ?? undefined,
        status: status && (FOREX_KNOWLEDGE_STATUSES as readonly string[]).includes(status)
          ? status as ForexKnowledgeStatus
          : undefined,
        indexingStatus: indexingStatus && (FOREX_INDEXING_STATUSES as readonly string[]).includes(indexingStatus)
          ? indexingStatus as ForexIndexingStatus
          : undefined,
        knowledgeType: knowledgeType && (FOREX_KNOWLEDGE_TYPES as readonly string[]).includes(knowledgeType)
          ? knowledgeType as ForexKnowledgeType
          : undefined,
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 20),
        sort: (url.searchParams.get("sort") as "updatedAt" | "createdAt" | "title" | null) || "updatedAt",
        order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
      });
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (sub === "/knowledge" && req.method === "POST") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const document = await service.createDocument({
        title: String(body.title ?? ""),
        summary: body.summary != null ? String(body.summary) : undefined,
        content: String(body.content ?? ""),
        categoryId: body.categoryId === null ? null : body.categoryId != null ? String(body.categoryId) : undefined,
        topicId: body.topicId === null ? null : body.topicId != null ? String(body.topicId) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        knowledgeType: body.knowledgeType != null ? String(body.knowledgeType) as ForexKnowledgeType : undefined,
        status: body.status != null ? String(body.status) as ForexKnowledgeStatus : "DRAFT",
        sourceType: body.sourceType != null ? String(body.sourceType) as never : undefined,
        sourceName: body.sourceName != null ? String(body.sourceName) : undefined,
        sourceReference: body.sourceReference != null ? String(body.sourceReference) : undefined,
        sourceUrl: body.sourceUrl != null ? String(body.sourceUrl) : undefined,
        language: body.language != null ? String(body.language) : undefined,
        author: body.author != null ? String(body.author) : undefined,
        metadata: body.metadata && typeof body.metadata === "object"
          ? body.metadata as Record<string, unknown>
          : undefined,
      });
      sendJson(res, 201, { ok: true, document });
      return true;
    }

    if (sub === "/knowledge/upload-pdf" && req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
        title?: string;
        categoryId?: string | null;
        topicId?: string | null;
        tags?: string[];
        publish?: boolean;
      };
      const fileName = String(body.fileName ?? "").trim();
      const mimeType = String(body.mimeType ?? "application/pdf").trim();
      const dataBase64 = String(body.dataBase64 ?? "").trim();
      if (!fileName || !/\.pdf$/i.test(fileName)) {
        fail(sendJson, res, 400, "BAD_REQUEST", "fileName must end with .pdf");
        return true;
      }
      if (mimeType && mimeType !== "application/pdf" && mimeType !== "application/x-pdf") {
        fail(sendJson, res, 400, "BAD_REQUEST", "mimeType must be application/pdf");
        return true;
      }
      if (!dataBase64) {
        fail(sendJson, res, 400, "BAD_REQUEST", "dataBase64 is required.");
        return true;
      }
      let bytes: Buffer;
      try {
        bytes = Buffer.from(dataBase64, "base64");
      } catch {
        fail(sendJson, res, 400, "BAD_REQUEST", "dataBase64 is not valid base64.");
        return true;
      }
      if (bytes.byteLength > FOREX_PDF_MAX_BYTES) {
        fail(sendJson, res, 400, "BAD_REQUEST", `PDF exceeds 15 MB limit (${FOREX_PDF_MAX_BYTES} bytes).`);
        return true;
      }
      // Validate PDF magic bytes; full parse happens in ingestPdf via extractPdfText.
      if (
        bytes.byteLength < 5
        || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46
      ) {
        fail(sendJson, res, 400, "BAD_REQUEST", "File is not a valid PDF document.");
        return true;
      }

      const document = await service.ingestPdf({
        bytes,
        fileName,
        mimeType,
        title: body.title != null ? String(body.title) : undefined,
        categoryId: body.categoryId === null ? null : body.categoryId != null ? String(body.categoryId) : undefined,
        topicId: body.topicId === null ? null : body.topicId != null ? String(body.topicId) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        publish: Boolean(body.publish),
      });
      sendJson(res, 201, { ok: true, document });
      return true;
    }

    if (sub === "/knowledge/retrieve" && req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        query?: string;
        categoryId?: string;
        topicId?: string;
        tags?: string[];
        knowledgeType?: string;
        limit?: number;
      };
      const hits = await service.retrieveRelevantForexKnowledge({
        query: String(body.query ?? ""),
        categoryId: body.categoryId,
        topicId: body.topicId,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        knowledgeType: body.knowledgeType && (FOREX_KNOWLEDGE_TYPES as readonly string[]).includes(body.knowledgeType)
          ? body.knowledgeType as ForexKnowledgeType
          : undefined,
        limit: body.limit,
      });
      sendJson(res, 200, { ok: true, hits, count: hits.length });
      return true;
    }

    const knowledgeMatch = sub.match(/^\/knowledge\/([^/]+)(?:\/(publish|unpublish|archive|reindex|chunks))?$/);
    if (knowledgeMatch) {
      const id = decodeURIComponent(knowledgeMatch[1]!);
      const action = knowledgeMatch[2];

      if (!action && (req.method === "GET" || req.method === "HEAD")) {
        const document = await service.getDocument(id);
        if (!document) {
          fail(sendJson, res, 404, "NOT_FOUND", "Knowledge document not found.");
          return true;
        }
        sendJson(res, 200, { ok: true, document });
        return true;
      }

      if (!action && req.method === "DELETE") {
        const result = await service.deleteDocument(id);
        sendJson(res, 200, { ok: true, ...result });
        return true;
      }

      if (!action && req.method === "PATCH") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const document = await service.updateDocument(id, {
          title: body.title != null ? String(body.title) : undefined,
          summary: body.summary != null ? String(body.summary) : undefined,
          content: body.content != null ? String(body.content) : undefined,
          categoryId: body.categoryId === null ? null : body.categoryId != null ? String(body.categoryId) : undefined,
          topicId: body.topicId === null ? null : body.topicId != null ? String(body.topicId) : undefined,
          tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
          knowledgeType: body.knowledgeType != null ? String(body.knowledgeType) as ForexKnowledgeType : undefined,
          sourceType: body.sourceType != null ? String(body.sourceType) as never : undefined,
          sourceName: body.sourceName != null ? String(body.sourceName) : undefined,
          sourceReference: body.sourceReference != null ? String(body.sourceReference) : undefined,
          sourceUrl: body.sourceUrl != null ? String(body.sourceUrl) : undefined,
          language: body.language != null ? String(body.language) : undefined,
          author: body.author != null ? String(body.author) : undefined,
          metadata: body.metadata && typeof body.metadata === "object"
            ? body.metadata as Record<string, unknown>
            : undefined,
        });
        sendJson(res, 200, { ok: true, document });
        return true;
      }

      if (action === "chunks" && (req.method === "GET" || req.method === "HEAD")) {
        sendJson(res, 200, { ok: true, chunks: await service.listChunks(id) });
        return true;
      }

      if (action && req.method === "POST") {
        const document = action === "publish"
          ? await service.publishDocument(id)
          : action === "unpublish"
            ? await service.unpublishDocument(id)
            : action === "archive"
              ? await service.archiveDocument(id)
              : await service.reindexDocument(id);
        sendJson(res, 200, { ok: true, document });
        return true;
      }
    }

    fail(sendJson, res, 404, "NOT_FOUND", `Unknown Forex Admin route: ${sub}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not found/i.test(message) ? 404 : /required|invalid|already exists|cannot|exceeds|mime|filename/i.test(message) ? 400 : 500;
    fail(sendJson, res, status, status === 404 ? "NOT_FOUND" : status === 400 ? "BAD_REQUEST" : "INTERNAL", message);
    return true;
  }
}
