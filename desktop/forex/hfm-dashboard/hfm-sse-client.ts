/**
 * HFM MT5 SSE client — fetch + ReadableStream with admin headers.
 * Never puts the admin token in the URL or console logs.
 */
import { buildForexAdminHeaders, getForexAdminToken } from "../admin-access/forex-admin-token";
import type { HfmEventEnvelope, HfmSseEventType } from "./types";

const STREAM_PATH = "/api/forex/providers/mt5-hfm/stream";

export type HfmSseHandlers = {
  onEvent: (type: HfmSseEventType, envelope: HfmEventEnvelope) => void;
  onStatus: (status: "connecting" | "connected" | "reconnecting" | "auth_required" | "error", detail?: string) => void;
};

function parseSseChunk(
  buffer: string,
): { events: Array<{ event: string; data: string; id?: string }>; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: Array<{ event: string; data: string; id?: string }> = [];
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = "message";
    let id: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      else if (line.startsWith("id:")) id = line.slice(3).trim();
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n"), id });
  }
  return { events, rest };
}

export async function connectHfmMt5Sse(
  handlers: HfmSseHandlers,
  opts: { symbols?: string[]; includeCandles?: boolean; signal: AbortSignal },
): Promise<void> {
  if (!getForexAdminToken()) {
    handlers.onStatus("auth_required", "Admin API token required. Configure it under Forex Admin Access.");
    return;
  }

  const params = new URLSearchParams();
  if (opts.symbols?.length) params.set("symbols", opts.symbols.join(","));
  if (opts.includeCandles) params.set("candles", "1");
  const path = `${STREAM_PATH}?${params.toString()}`;

  handlers.onStatus("connecting");
  const headers = buildForexAdminHeaders(STREAM_PATH);
  headers.Accept = "text/event-stream";

  let res: Response;
  try {
    res = await fetch(path, { method: "GET", headers, signal: opts.signal, cache: "no-store" });
  } catch (err) {
    if (opts.signal.aborted) return;
    handlers.onStatus("error", err instanceof Error ? err.message : "SSE fetch failed");
    return;
  }

  if (res.status === 401 || res.status === 403) {
    handlers.onStatus("auth_required", "Admin token rejected for HFM stream.");
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onStatus("error", `SSE HTTP ${res.status}`);
    return;
  }

  handlers.onStatus("connected");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (!opts.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      for (const ev of parsed.events) {
        try {
          const envelope = JSON.parse(ev.data) as HfmEventEnvelope;
          if (!envelope || typeof envelope !== "object") continue;
          const type = (ev.event || envelope.type) as HfmSseEventType;
          handlers.onEvent(type, envelope);
        } catch {
          /* skip malformed */
        }
      }
    }
  } catch (err) {
    if (opts.signal.aborted) return;
    handlers.onStatus("error", err instanceof Error ? err.message : "SSE read failed");
    return;
  }

  if (!opts.signal.aborted) {
    handlers.onStatus("reconnecting", "Stream ended");
  }
}
