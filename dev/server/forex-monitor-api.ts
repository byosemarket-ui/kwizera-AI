/**
 * Phase 38F — Forex continuous monitoring API.
 *
 * GET  /api/forex/monitor/meta          (public meta, no secrets)
 * GET  /api/forex/monitor/stats         (admin)
 * GET  /api/forex/monitor/sessions      (admin)
 * POST /api/forex/monitor/sessions      (admin)
 * GET  /api/forex/monitor/sessions/:id
 * POST /api/forex/monitor/sessions/:id/pause|resume|stop
 * GET  /api/forex/monitor/sessions/:id/events
 *
 * Ownership model: Admin Control Plane boundary (no multi-user session ownership yet).
 * Never returns credentials or decrypted provider settings.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { probeResourceMetrics } from "../../ai/local-resource-manager/resource-probes.js";
import {
  FOREX_MONITOR_SCHEMA_VERSION,
  SETUP_RULE_ID,
  SETUP_RULE_VERSION,
  getForexMonitorManager,
  resolveForexMonitorLimits,
  type ForexMonitorSession,
} from "../../ai/forex-monitor/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function publicSession(session: ForexMonitorSession | null) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    provider: session.provider,
    environment: session.environment,
    symbol: session.symbol,
    timeframe: session.timeframe,
    config: {
      narrativeEnabled: session.config.narrativeEnabled,
      evaluateClosedCandlesOnly: true,
    },
    lifecycleState: session.lifecycleState,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    lastEvaluationAt: session.lastEvaluationAt,
    lastValidCandleTime: session.lastValidCandleTime,
    lastDataUpdateAt: session.lastDataUpdateAt,
    dataAgeMs: session.dataAgeMs,
    freshnessState: session.freshnessState,
    lastError: session.lastError,
    evaluationCount: session.evaluationCount,
    lastSetupEventId: session.lastSetupEventId,
    currentSetup: session.currentSetup,
    lastEvidenceSummary: session.lastEvidenceSummary,
    narrative: {
      status: session.narrative.status,
      eventId: session.narrative.eventId ?? null,
      analysisId: session.narrative.analysisId ?? null,
      summary: session.narrative.summary ?? null,
      latencyMs: session.narrative.latencyMs ?? null,
      error: session.narrative.error ?? null,
      requestedAt: session.narrative.requestedAt ?? null,
      completedAt: session.narrative.completedAt ?? null,
    },
    workerActive: Boolean(session.workerActive),
  };
}

function mapManagerError(error: unknown): { status: number; code: string; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === "DUPLICATE_ACTIVE_SESSION") {
    return { status: 409, code: "DUPLICATE_SESSION", message: "Active monitoring already exists for this provider/symbol/timeframe." };
  }
  if (msg === "MAX_SESSIONS_REACHED") {
    return { status: 409, code: "SESSION_LIMIT", message: "Maximum concurrent monitoring sessions reached." };
  }
  if (msg === "SESSION_NOT_FOUND") {
    return { status: 404, code: "NOT_FOUND", message: "Monitoring session not found." };
  }
  if (msg === "NOT_PAUSED") {
    return { status: 400, code: "INVALID_STATE", message: "Only PAUSED sessions can be resumed." };
  }
  if (msg.startsWith("Invalid monitor transition") || msg.includes("transition")) {
    return { status: 400, code: "INVALID_STATE", message: msg.slice(0, 200) };
  }
  return { status: 400, code: "MONITOR_ERROR", message: msg.slice(0, 200) };
}

const SESSION_PATH = /^\/api\/forex\/monitor\/sessions\/([^/]+)(?:\/(pause|resume|stop|events))?$/;

export async function handleForexMonitorApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/monitor")) return false;

  try {
    if (url.pathname === "/api/forex/monitor/meta" && (req.method === "GET" || req.method === "HEAD")) {
      const limits = resolveForexMonitorLimits();
      sendJson(res, 200, {
        ok: true,
        schemaVersion: FOREX_MONITOR_SCHEMA_VERSION,
        setupRuleId: SETUP_RULE_ID,
        setupRuleVersion: SETUP_RULE_VERSION,
        authorization: "admin-token",
        ownershipModel: "admin-boundary",
        evaluationStrategy: "closed-candle",
        note: "Continuous server-side monitoring. Analytical setups only — no broker orders. LLM narrative is optional and non-blocking.",
        limits: {
          maxSessions: limits.MAX_SESSIONS,
          pollIntervalMs: limits.POLL_INTERVAL_MS,
          narrativeTimeoutMs: limits.NARRATIVE_TIMEOUT_MS,
          maxNarrativeQueue: limits.MAX_NARRATIVE_QUEUE,
        },
      });
      return true;
    }

    if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;

    const manager = getForexMonitorManager();

    if (url.pathname === "/api/forex/monitor/stats" && (req.method === "GET" || req.method === "HEAD")) {
      const stats = manager.getRuntimeStats();
      let resources = null;
      try {
        const m = probeResourceMetrics();
        resources = {
          cpuUsage: m.cpuUsage,
          ramUsage: m.ramUsage,
          systemRamUsedMb: m.systemRamUsedMb,
          systemRamTotalMb: m.systemRamTotalMb,
        };
      } catch {
        resources = null;
      }
      sendJson(res, 200, {
        ok: true,
        stats: { ...stats, resources, limits: manager.getLimits() },
      });
      return true;
    }

    if (url.pathname === "/api/forex/monitor/sessions" && (req.method === "GET" || req.method === "HEAD")) {
      const sessions = (await manager.listSessions())
        .filter((s) => s.ownerKey === "admin")
        .map((s) => publicSession(s));
      sendJson(res, 200, { ok: true, sessions });
      return true;
    }

    if (url.pathname === "/api/forex/monitor/sessions" && req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        provider?: string;
        environment?: string | null;
        symbol?: string;
        timeframe?: string;
        enableNarrative?: boolean;
        narrativeEnabled?: boolean;
      };
      try {
        const session = await manager.start({
          provider: String(body.provider ?? "").trim(),
          environment: body.environment,
          symbol: String(body.symbol ?? "").trim(),
          timeframe: String(body.timeframe ?? "").trim(),
          ownerKey: "admin",
          config: {
            narrativeEnabled: body.narrativeEnabled ?? body.enableNarrative !== false,
          },
        });
        sendJson(res, 201, { ok: true, session: publicSession(session) });
      } catch (error) {
        const mapped = mapManagerError(error);
        sendJson(res, mapped.status, {
          ok: false,
          error: { code: mapped.code, message: mapped.message },
        });
      }
      return true;
    }

    const match = url.pathname.match(SESSION_PATH);
    if (match) {
      const sessionId = decodeURIComponent(match[1]!);
      const action = match[2] ?? null;

      const existing = manager.getSession(sessionId);
      if (!existing || existing.ownerKey !== "admin") {
        sendJson(res, 404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "Monitoring session not found." },
        });
        return true;
      }

      if (!action && (req.method === "GET" || req.method === "HEAD")) {
        sendJson(res, 200, { ok: true, session: publicSession(existing) });
        return true;
      }

      if (action === "events" && (req.method === "GET" || req.method === "HEAD")) {
        const events = await manager.getEvents(sessionId);
        sendJson(res, 200, { ok: true, events });
        return true;
      }

      if (action === "pause" && req.method === "POST") {
        try {
          const session = await manager.pause(sessionId);
          sendJson(res, 200, { ok: true, session: publicSession(session) });
        } catch (error) {
          const mapped = mapManagerError(error);
          sendJson(res, mapped.status, {
            ok: false,
            error: { code: mapped.code, message: mapped.message },
          });
        }
        return true;
      }

      if (action === "resume" && req.method === "POST") {
        try {
          const session = await manager.resume(sessionId);
          sendJson(res, 200, { ok: true, session: publicSession(session) });
        } catch (error) {
          const mapped = mapManagerError(error);
          sendJson(res, mapped.status, {
            ok: false,
            error: { code: mapped.code, message: mapped.message },
          });
        }
        return true;
      }

      if (action === "stop" && req.method === "POST") {
        try {
          const session = await manager.stop(sessionId);
          sendJson(res, 200, { ok: true, session: publicSession(session) });
        } catch (error) {
          const mapped = mapManagerError(error);
          sendJson(res, mapped.status, {
            ok: false,
            error: { code: mapped.code, message: mapped.message },
          });
        }
        return true;
      }
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown Forex monitor endpoint." },
    });
    return true;
  } catch (error) {
    console.warn("[forex-monitor] api-error", error instanceof Error ? error.message : error);
    sendJson(res, 500, {
      ok: false,
      error: {
        code: "MONITOR_INTERNAL",
        message: error instanceof Error ? error.message.slice(0, 200) : "Monitor API failed.",
      },
    });
    return true;
  }
}

export async function bootForexMonitor(): Promise<void> {
  try {
    const manager = getForexMonitorManager();
    const resumed = await manager.recoverOnBoot();
    console.info("[forex-monitor] boot", JSON.stringify({ resumed }));
  } catch (error) {
    console.warn(
      "[forex-monitor] boot-failed",
      error instanceof Error ? error.message : error,
    );
  }
}
