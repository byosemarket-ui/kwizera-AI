/**
 * Shared HFM MT5 agent framing + allowlist (Node side).
 * Wire format: u32be length + UTF-8 JSON (max 8192 request / 65536 response).
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MT5_HFM_AGENT_SOCKET_PATH = "/run/kwizera/mt5-hfm-agent.sock";
export const MT5_HFM_AGENT_TOKEN_SECRET_ID = "mt5-hfm:agent:token";
export const MT5_HFM_AGENT_MAX_REQUEST_BYTES = 8192;
export const MT5_HFM_AGENT_MAX_RESPONSE_BYTES = 262144;
export const MT5_HFM_AGENT_TIMESTAMP_WINDOW_SEC = 30;

export const MT5_HFM_AGENT_METHODS = [
  "health",
  "demo.login",
  "demo.account_snapshot",
  "demo.quotes_snapshot",
  "demo.candles",
  "demo.stream_snapshot",
  "demo.symbols",
  "demo.open_positions_snapshot",
  "demo.pending_orders_snapshot",
  "demo.trade_history_snapshot",
  "demo.logout",
  "demo.connection_status",
] as const;

export type Mt5HfmAgentMethod = (typeof MT5_HFM_AGENT_METHODS)[number];

export function isAllowedMt5HfmAgentMethod(method: string): method is Mt5HfmAgentMethod {
  return (MT5_HFM_AGENT_METHODS as readonly string[]).includes(method);
}

export function isForbiddenTradingMethod(method: string): boolean {
  return /^(live\.|order\.|ea\.|shell\.|buy|sell|trade_)/i.test(method);
}

export interface Mt5HfmAgentRequest {
  v: 1;
  requestId: string;
  ts: number;
  method: string;
  body: Record<string, unknown>;
  mac: string;
}

export interface Mt5HfmAgentResponse {
  v: 1;
  requestId: string;
  ok: boolean;
  code?: string;
  error?: string;
  result?: Record<string, unknown>;
}

export function bodyHash(body: Record<string, unknown>): string {
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  return createHmac("sha256", "mt5-hfm-body").update(canonical).digest("hex");
}

export function signAgentRequest(
  token: string,
  parts: { requestId: string; ts: number; method: string; body: Record<string, unknown> },
): string {
  const msg = `${parts.requestId}|${parts.ts}|${parts.method}|${bodyHash(parts.body)}`;
  return createHmac("sha256", token).update(msg).digest("hex");
}

export function verifyAgentMac(
  token: string,
  req: Pick<Mt5HfmAgentRequest, "requestId" | "ts" | "method" | "body" | "mac">,
): boolean {
  const expected = signAgentRequest(token, req);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(req.mac ?? ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildAgentRequest(
  token: string,
  method: Mt5HfmAgentMethod,
  body: Record<string, unknown> = {},
): Mt5HfmAgentRequest {
  const requestId = randomUUID();
  const ts = Math.floor(Date.now() / 1000);
  const mac = signAgentRequest(token, { requestId, ts, method, body });
  return { v: 1, requestId, ts, method, body, mac };
}

export function encodeFrame(obj: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(json.length, 0);
  return Buffer.concat([header, json]);
}

export function tryDecodeFrame(
  buffer: Buffer,
  maxBytes: number,
): { frame: Buffer; rest: Buffer } | null {
  if (buffer.length < 4) return null;
  const len = buffer.readUInt32BE(0);
  if (len <= 0 || len > maxBytes) {
    throw Object.assign(new Error("Frame length out of bounds"), { code: "FRAME_TOO_LARGE" });
  }
  if (buffer.length < 4 + len) return null;
  return { frame: buffer.subarray(4, 4 + len), rest: buffer.subarray(4 + len) };
}

/** Redact secret-looking fields for safe logging. */
export function redactAgentPayload(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactAgentPayload);
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/pass|token|mac|secret|pwd|hmac/i.test(k)) out[k] = "[redacted]";
    else out[k] = redactAgentPayload(v);
  }
  return out;
}
