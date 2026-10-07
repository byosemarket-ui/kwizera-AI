/**
 * Phase 24 — Forex Intelligence Control Center API (/api/forex-admin/intelligence/*).
 * Safe diagnostics only — no broker execution, no model training, no shell commands.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getOllamaAdapter } from "../../ai/ai-provider/ollama-adapter.js";
import {
  buildForexAiSystemHealth,
  buildForexRetrievalDiagnostic,
  getForexIntelligenceSettingsService,
  type ForexIntelligenceSettings,
} from "../../ai/forex-ai/intelligence/index.js";
import { getForexMemoryService } from "../../ai/forex-memory/index.js";

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

const SAFE_SETTING_KEYS = new Set([
  "knowledgeRagEnabled",
  "memoryRetrievalEnabled",
  "memoryMaxExamples",
  "compactPromptMode",
  "promptCharBudget",
]);

export async function handleForexIntelligenceApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex-admin/intelligence")) return false;

  const sub = url.pathname.slice("/api/forex-admin/intelligence".length) || "/";

  try {
    if ((sub === "/" || sub === "/health") && (req.method === "GET" || req.method === "HEAD")) {
      const probe = url.searchParams.get("probe") !== "0";
      sendJson(res, 200, { ok: true, health: await buildForexAiSystemHealth({ probeInference: probe }) });
      return true;
    }

    if (sub === "/configuration" && (req.method === "GET" || req.method === "HEAD")) {
      const health = await buildForexAiSystemHealth({ probeInference: false });
      const audit = await getForexIntelligenceSettingsService().getAudit();
      sendJson(res, 200, {
        ok: true,
        readOnly: {
          provider: health.model.provider,
          modelId: health.model.modelId,
          preferredModel: health.model.preferredModel,
          modelStatus: health.model.status,
          ollamaExposure: health.ollama.exposure,
          ollamaHostDisplay: health.ollama.hostDisplay,
          promptVersion: health.prompt.promptVersion,
          decisionEngines: health.decision,
          modelTraining: health.modelTraining,
          memoryLearning: health.memoryLearning,
          knowledgeRetrieval: health.knowledgeRetrieval,
        },
        configurable: health.settings,
        audit: audit.slice(0, 50),
        note: "Ollama host, filesystem paths, secrets, and broker credentials are not editable here.",
      });
      return true;
    }

    if (sub === "/configuration" && req.method === "PATCH") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const patch: Partial<ForexIntelligenceSettings> = {};
      for (const key of Object.keys(body)) {
        if (!SAFE_SETTING_KEYS.has(key)) {
          fail(sendJson, res, 400, "INVALID_SETTING", `Setting not configurable: ${key}`);
          return true;
        }
      }
      if (typeof body.knowledgeRagEnabled === "boolean") patch.knowledgeRagEnabled = body.knowledgeRagEnabled;
      if (typeof body.memoryRetrievalEnabled === "boolean") {
        patch.memoryRetrievalEnabled = body.memoryRetrievalEnabled;
      }
      if (typeof body.compactPromptMode === "boolean") patch.compactPromptMode = body.compactPromptMode;
      if (typeof body.memoryMaxExamples === "number") patch.memoryMaxExamples = body.memoryMaxExamples;
      if (typeof body.promptCharBudget === "number") patch.promptCharBudget = body.promptCharBudget;

      const result = await getForexIntelligenceSettingsService().updateSettings(patch);
      sendJson(res, 200, { ok: true, settings: result.settings, changed: result.changed });
      return true;
    }

    if (sub === "/build-context" && req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        symbol?: string;
        timeframes?: string[];
        knowledgeQuery?: string;
      };
      const diagnostic = await buildForexRetrievalDiagnostic({
        symbol: body.symbol,
        timeframes: Array.isArray(body.timeframes) ? body.timeframes.map(String) : undefined,
        knowledgeQuery: body.knowledgeQuery,
      });
      sendJson(res, diagnostic.ok ? 200 : 422, { ok: diagnostic.ok, diagnostic });
      return true;
    }

    if (sub === "/test-ollama" && req.method === "POST") {
      const started = Date.now();
      const adapter = getOllamaAdapter();
      const health = await adapter.health({ probeInference: true });
      sendJson(res, 200, {
        ok: true,
        result: {
          ready: health.ready,
          code: health.code,
          model: health.model,
          latencyMs: health.latencyMs ?? Date.now() - started,
          notes: health.notes,
          exposure: "INTERNAL_ONLY",
          calledPublicly: false,
        },
      });
      return true;
    }

    if (sub === "/rebuild-learning" && req.method === "POST") {
      const learning = await getForexMemoryService().rebuildLearningAggregates();
      sendJson(res, 200, {
        ok: true,
        learning,
        note: "Deterministic aggregates recalculated. Historical analyses were not modified.",
      });
      return true;
    }

    if (sub === "/memory-diagnostics" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, {
        ok: true,
        diagnostics: await getForexMemoryService().memoryDiagnostics(),
      });
      return true;
    }

    fail(sendJson, res, 404, "NOT_FOUND", `Unknown intelligence route: ${sub}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(sendJson, res, 500, "INTERNAL", message);
    return true;
  }
}
