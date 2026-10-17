/**
 * Phase 49A — Chart capture & screenshot session API.
 *
 * GET    /api/forex/chart-captures/meta
 * GET    /api/forex/chart-captures
 * POST   /api/forex/chart-captures
 * GET    /api/forex/chart-captures/:id
 * GET    /api/forex/chart-captures/:id/image
 * DELETE /api/forex/chart-captures/:id
 * PATCH  /api/forex/chart-captures/:id/selection
 * GET    /api/forex/chart-captures/sessions
 * POST   /api/forex/chart-captures/sessions
 * PATCH  /api/forex/chart-captures/sessions/:id
 *
 * Ownership: studio-scoped (same pattern as analysis-snapshot). No per-user identity.
 * Scheduling is client-driven; sessions are persisted for audit / resume UX only.
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CAPTURE_ALLOWED_MIME,
  CAPTURE_INTERVAL_PRESETS_MS,
  CAPTURE_LIST_DEFAULT_LIMIT,
  CAPTURE_MAX_ACTIVE_SESSIONS,
  CAPTURE_MAX_DURATION_MS,
  CAPTURE_MAX_IMAGE_BYTES,
  CAPTURE_MAX_INTERVAL_MS,
  CAPTURE_MAX_PER_SESSION,
  CAPTURE_MAX_STORED,
  CAPTURE_MIN_DURATION_MS,
  CAPTURE_MIN_INTERVAL_MS,
  CAPTURE_REQUEST_BODY_MAX_BYTES,
  CAPTURE_TIMEFRAME_IDS,
  CHART_CAPTURE_SCHEMA_VERSION,
  getChartCaptureStore,
  validateCreateCaptureInput,
  validateSessionConfig,
  type ChartCaptureSessionState,
} from "../../ai/forex-chart-capture/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage, maxBytes = CAPTURE_REQUEST_BODY_MAX_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("Request body too large.");
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function sendBinary(res: ServerResponse, status: number, mime: string, buffer: Buffer): void {
  res.writeHead(status, {
    "Content-Type": mime,
    "Content-Length": buffer.length,
    "Cache-Control": "private, max-age=60",
  });
  res.end(buffer);
}

export async function handleForexChartCaptureApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/chart-captures")) return false;

  const store = getChartCaptureStore();

  try {
    if (url.pathname === "/api/forex/chart-captures/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        schemaVersion: CHART_CAPTURE_SCHEMA_VERSION,
        phase: "49A",
        timeframes: CAPTURE_TIMEFRAME_IDS,
        allowedMime: CAPTURE_ALLOWED_MIME,
        maxImageBytes: CAPTURE_MAX_IMAGE_BYTES,
        maxStored: CAPTURE_MAX_STORED,
        scheduling: {
          clientDriven: true,
          requiresBrowserOpen: true,
          minIntervalMs: CAPTURE_MIN_INTERVAL_MS,
          maxIntervalMs: CAPTURE_MAX_INTERVAL_MS,
          intervalPresetsMs: CAPTURE_INTERVAL_PRESETS_MS,
          minDurationMs: CAPTURE_MIN_DURATION_MS,
          maxDurationMs: CAPTURE_MAX_DURATION_MS,
          maxCapturesPerSession: CAPTURE_MAX_PER_SESSION,
          maxActiveSessions: CAPTURE_MAX_ACTIVE_SESSIONS,
          note:
            "Scheduled captures run in the browser while this page stays open. "
            + "Closing the tab, navigating away, or reloading stops the session timer. "
            + "Captures never auto-invoke OpenAI.",
        },
        multiTimeframe: {
          isolatedRenderer: false,
          capturesActiveChartOnly: true,
          note:
            "Phase 49A captures the currently visible chart timeframe only. "
            + "It does not silently switch the active chart to gather other timeframes.",
        },
        ownership: {
          scope: "studio",
          note: "No per-user identity in this deployment; captures share studio-scoped storage like analysis snapshots.",
        },
        futureAi: {
          selectionSupported: true,
          imageSubmissionImplemented: false,
        },
      });
      return true;
    }

    if (url.pathname === "/api/forex/chart-captures/sessions") {
      if (req.method === "GET" || req.method === "HEAD") {
        const items = await store.listSessions(Number(url.searchParams.get("limit") ?? 10) || 10);
        sendJson(res, 200, { ok: true, count: items.length, items });
        return true;
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req, 64_000) as Record<string, unknown>;
        const cfg = validateSessionConfig(body.config ?? body);
        if (!cfg.ok) {
          sendJson(res, 422, { ok: false, error: { code: "INVALID_SESSION_CONFIG", message: cfg.error } });
          return true;
        }
        const now = new Date();
        const sessionId = randomUUID();
        const endsAt = new Date(now.getTime() + cfg.value.durationMs).toISOString();
        const session: ChartCaptureSessionState = {
          sessionId,
          status: cfg.value.enabled ? "RUNNING" : "IDLE",
          config: cfg.value,
          startedAtUtc: cfg.value.enabled ? now.toISOString() : null,
          endsAtUtc: cfg.value.enabled ? endsAt : null,
          pausedAtUtc: null,
          nextCaptureAtUtc: cfg.value.enabled
            ? new Date(now.getTime() + cfg.value.intervalMs).toISOString()
            : null,
          captureCount: 0,
          lastCaptureId: null,
          lastError: null,
          requiresBrowserOpen: true,
          updatedAtUtc: now.toISOString(),
        };
        await store.upsertSession(session);
        sendJson(res, 200, { ok: true, session });
        return true;
      }
      sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
      return true;
    }

    const sessionMatch = url.pathname.match(/^\/api\/forex\/chart-captures\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1] ?? "");
      if (req.method === "GET" || req.method === "HEAD") {
        const session = await store.getSession(sessionId);
        if (!session) {
          sendJson(res, 404, { ok: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found." } });
          return true;
        }
        sendJson(res, 200, { ok: true, session });
        return true;
      }
      if (req.method === "PATCH") {
        const existing = await store.getSession(sessionId);
        if (!existing) {
          sendJson(res, 404, { ok: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found." } });
          return true;
        }
        const body = await readJsonBody(req, 64_000) as Record<string, unknown>;
        const action = String(body.action ?? "").toUpperCase();
        const now = new Date().toISOString();
        let next: ChartCaptureSessionState = { ...existing, updatedAtUtc: now };
        if (action === "PAUSE") {
          if (existing.status !== "RUNNING") {
            sendJson(res, 422, { ok: false, error: { code: "INVALID_STATE", message: "Only RUNNING sessions can pause." } });
            return true;
          }
          next = { ...next, status: "PAUSED", pausedAtUtc: now, nextCaptureAtUtc: null };
        } else if (action === "RESUME") {
          if (existing.status !== "PAUSED") {
            sendJson(res, 422, { ok: false, error: { code: "INVALID_STATE", message: "Only PAUSED sessions can resume." } });
            return true;
          }
          const nextAt = new Date(Date.now() + existing.config.intervalMs).toISOString();
          next = { ...next, status: "RUNNING", pausedAtUtc: null, nextCaptureAtUtc: nextAt };
        } else if (action === "STOP") {
          next = {
            ...next,
            status: "STOPPED",
            nextCaptureAtUtc: null,
            pausedAtUtc: null,
          };
        } else if (action === "TICK") {
          // Client reports progress after a capture attempt.
          const captureCount = Number(body.captureCount);
          if (Number.isFinite(captureCount) && captureCount >= 0) {
            next.captureCount = Math.floor(captureCount);
          }
          if (body.lastCaptureId != null) next.lastCaptureId = String(body.lastCaptureId);
          if (body.lastError != null) next.lastError = String(body.lastError);
          if (body.nextCaptureAtUtc != null) next.nextCaptureAtUtc = String(body.nextCaptureAtUtc);
          if (body.status != null) {
            const st = String(body.status).toUpperCase();
            if (["RUNNING", "PAUSED", "COMPLETED", "STOPPED", "FAILED", "IDLE"].includes(st)) {
              next.status = st as ChartCaptureSessionState["status"];
            }
          }
        } else {
          sendJson(res, 422, {
            ok: false,
            error: { code: "INVALID_ACTION", message: "action must be PAUSE, RESUME, STOP, or TICK." },
          });
          return true;
        }
        await store.upsertSession(next);
        sendJson(res, 200, { ok: true, session: next });
        return true;
      }
      sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or PATCH." } });
      return true;
    }

    if (url.pathname === "/api/forex/chart-captures") {
      if (req.method === "GET" || req.method === "HEAD") {
        const items = await store.list({
          limit: Number(url.searchParams.get("limit") ?? CAPTURE_LIST_DEFAULT_LIMIT) || CAPTURE_LIST_DEFAULT_LIMIT,
          instrument: url.searchParams.get("instrument") ?? undefined,
          timeframe: url.searchParams.get("timeframe") ?? undefined,
          sessionId: url.searchParams.get("sessionId") ?? undefined,
          mode: url.searchParams.get("mode") ?? undefined,
          fromUtc: url.searchParams.get("fromUtc") ?? undefined,
          toUtc: url.searchParams.get("toUtc") ?? undefined,
        });
        sendJson(res, 200, { ok: true, count: items.length, items });
        return true;
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const validated = validateCreateCaptureInput(body);
        if (!validated.ok) {
          sendJson(res, 422, {
            ok: false,
            error: { code: "INVALID_CAPTURE", message: validated.error },
          });
          return true;
        }
        const record = await store.create(validated.value, validated.imageBuffer);
        sendJson(res, 200, { ok: true, capture: record });
        return true;
      }
      sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
      return true;
    }

    const selectionMatch = url.pathname.match(/^\/api\/forex\/chart-captures\/([^/]+)\/selection$/);
    if (selectionMatch) {
      if (req.method !== "PATCH") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use PATCH." } });
        return true;
      }
      const id = decodeURIComponent(selectionMatch[1] ?? "");
      const body = await readJsonBody(req, 8_000) as Record<string, unknown>;
      const updated = await store.setSelectedForAi(id, Boolean(body.selectedForAi ?? body.selected));
      if (!updated) {
        sendJson(res, 404, { ok: false, error: { code: "CAPTURE_NOT_FOUND", message: "Capture not found." } });
        return true;
      }
      sendJson(res, 200, { ok: true, capture: updated });
      return true;
    }

    const imageMatch = url.pathname.match(/^\/api\/forex\/chart-captures\/([^/]+)\/image$/);
    if (imageMatch) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const id = decodeURIComponent(imageMatch[1] ?? "");
      const image = await store.getImage(id);
      if (!image) {
        sendJson(res, 404, { ok: false, error: { code: "CAPTURE_NOT_FOUND", message: "Capture image not found." } });
        return true;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, {
          "Content-Type": image.mimeType,
          "Content-Length": image.buffer.length,
        });
        res.end();
        return true;
      }
      sendBinary(res, 200, image.mimeType, image.buffer);
      return true;
    }

    const idMatch = url.pathname.match(/^\/api\/forex\/chart-captures\/([^/]+)$/);
    if (idMatch) {
      const id = decodeURIComponent(idMatch[1] ?? "");
      if (req.method === "GET" || req.method === "HEAD") {
        const capture = await store.get(id);
        if (!capture) {
          sendJson(res, 404, { ok: false, error: { code: "CAPTURE_NOT_FOUND", message: "Capture not found." } });
          return true;
        }
        sendJson(res, 200, { ok: true, capture });
        return true;
      }
      if (req.method === "DELETE") {
        const deleted = await store.delete(id);
        if (!deleted) {
          sendJson(res, 404, { ok: false, error: { code: "CAPTURE_NOT_FOUND", message: "Capture not found." } });
          return true;
        }
        sendJson(res, 200, { ok: true, deleted: true, captureId: id });
        return true;
      }
      sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or DELETE." } });
      return true;
    }

    sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Unknown chart-captures route." } });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, {
      ok: false,
      error: { code: "CHART_CAPTURE_ERROR", message: message.slice(0, 300) },
    });
    return true;
  }
}
