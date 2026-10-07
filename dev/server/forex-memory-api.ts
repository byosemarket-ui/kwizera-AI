/**
 * Phase 23 — Forex Memory API (/api/forex/memory/*).
 * Server owns outcomes/statistics. Browser may filter/list only.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBinanceMarketDataService } from "../../ai/market-data/binance/service.js";
import { buildForexMarketState } from "../../ai/forex-market-state/index.js";
import { parseInterval } from "../../ai/market-data/binance/adapter.js";
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

export async function handleForexMemoryApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/memory")) return false;

  const service = getForexMemoryService();
  await service.ensureReady();
  const sub = url.pathname.slice("/api/forex/memory".length) || "/";

  try {
    if ((sub === "/" || sub === "/overview") && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, { ok: true, overview: await service.overview() });
      return true;
    }

    if (sub === "/analysis" && (req.method === "GET" || req.method === "HEAD")) {
      const result = await service.listAnalyses({
        symbol: url.searchParams.get("symbol") ?? undefined,
        timeframe: url.searchParams.get("timeframe") ?? undefined,
        scenario: url.searchParams.get("scenario") ?? undefined,
        outcome: url.searchParams.get("outcome") ?? undefined,
        analysisType: url.searchParams.get("analysisType") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
        offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      });
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (sub.startsWith("/analysis/") && (req.method === "GET" || req.method === "HEAD")) {
      const id = decodeURIComponent(sub.slice("/analysis/".length));
      const analysis = await service.getAnalysis(id);
      if (!analysis) {
        fail(sendJson, res, 404, "NOT_FOUND", "Analysis memory record not found.");
        return true;
      }
      const outcomes = await service.listOutcomes({ limit: 50 });
      const mistakes = await service.listMistakes({ limit: 50 });
      sendJson(res, 200, {
        ok: true,
        analysis,
        outcomes: outcomes.items.filter((o) => o.analysisId === id),
        mistakes: mistakes.items.filter((m) => m.analysisId === id),
      });
      return true;
    }

    if (sub === "/outcomes" && (req.method === "GET" || req.method === "HEAD")) {
      const result = await service.listOutcomes({
        symbol: url.searchParams.get("symbol") ?? undefined,
        scenario: url.searchParams.get("scenario") ?? undefined,
        outcome: url.searchParams.get("status") ?? url.searchParams.get("outcome") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
        offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      });
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (sub === "/mistakes" && (req.method === "GET" || req.method === "HEAD")) {
      const result = await service.listMistakes({
        symbol: url.searchParams.get("symbol") ?? undefined,
        scenario: url.searchParams.get("scenario") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
        offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      });
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (sub === "/learning" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, { ok: true, learning: await service.getLearning() });
      return true;
    }

    if (sub === "/retrieve" && req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        symbol?: string;
        scenario?: string;
        marketRegime?: string;
        limit?: number;
      };
      const pack = await service.retrieve({
        symbol: body.symbol,
        scenario: body.scenario,
        marketRegime: body.marketRegime,
        limit: body.limit,
      });
      sendJson(res, 200, { ok: true, memory: pack });
      return true;
    }

    if (sub === "/evaluate" && req.method === "POST") {
      const body = (await readJsonBody(req)) as { analysisId?: string };
      const analysisId = String(body.analysisId ?? "").trim();
      if (!analysisId) {
        fail(sendJson, res, 400, "INVALID_REQUEST", "analysisId is required.");
        return true;
      }
      const analysis = await service.getAnalysis(analysisId);
      if (!analysis) {
        fail(sendJson, res, 404, "NOT_FOUND", "Analysis not found.");
        return true;
      }

      // Server obtains later price — never trust browser-supplied outcomes/prices.
      let laterPrice: number | null = null;
      let laterTimestamp: string | null = null;
      let historicalAvailable = false;
      try {
        const tf = parseInterval(analysis.timeframes[0] ?? "15m") ?? "15m";
        const binance = createBinanceMarketDataService();
        const series = await binance.listKlines({ symbol: analysis.symbol, timeframe: tf, limit: 50 });
        const state = buildForexMarketState({
          symbol: series.symbol,
          timeframe: series.timeframe,
          candles: series.candles,
          connection: "CONNECTED",
          lastMarketUpdateMs: series.candles.length
            ? series.candles[series.candles.length - 1]!.time * 1000
            : null,
        });
        laterPrice = state.price?.last ?? null;
        laterTimestamp = state.lastMarketUpdate != null
          ? new Date(state.lastMarketUpdate).toISOString()
          : null;
        historicalAvailable = laterPrice != null;
      } catch {
        historicalAvailable = false;
      }

      const result = await service.evaluateAnalysis({
        analysisId,
        laterPrice,
        laterTimestamp,
        historicalAvailable,
      });
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
      fail(sendJson, res, 405, "METHOD_NOT_ALLOWED", "Unsupported method for Forex memory routes.");
      return true;
    }

    fail(sendJson, res, 404, "NOT_FOUND", "Unknown Forex memory route.");
    return true;
  } catch (error) {
    console.error("[forex-memory] error", error instanceof Error ? error.message : error);
    fail(sendJson, res, 500, "MEMORY_ERROR", error instanceof Error ? error.message : "Memory request failed");
    return true;
  }
}
