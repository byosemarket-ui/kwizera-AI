/**
 * Phase 29 — FXCM Engine.IO v3 / Socket.IO transport (official Socket REST).
 *
 * Uses long-polling (EIO=3) already established in Phase 25/26 auth handshake,
 * kept alive so market-data push events can be received.
 *
 * Packet model (official Engine.IO / Socket.IO):
 * - Engine open: 0{sid,...}
 * - Engine message carrying Socket.IO EVENT: 42["EUR/USD","{...json...}"]
 *
 * No invented WebSocket endpoints. No synthetic price events.
 */
import type { FetchLike } from "./client.js";
import { parseEngineIoSid } from "./client.js";
import { FXCM_REST_PATHS, readFxcmAccessToken, type FxcmConfig } from "./config.js";
import { FxcmMarketDataError } from "./errors.js";
import type { FxcmSessionHandle } from "./types.js";

export type FxcmTransportEventHandler = (eventName: string, data: unknown) => void;
export type FxcmTransportStateHandler = (state: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR", detail?: string) => void;

export interface FxcmSocketTransport {
  connect(): Promise<FxcmSessionHandle>;
  disconnect(): void;
  isConnected(): boolean;
  getSession(): FxcmSessionHandle | null;
  onEvent(handler: FxcmTransportEventHandler): void;
  onState(handler: FxcmTransportStateHandler): void;
  /** Register interest in a Socket.IO event name (provider symbol). */
  watchEvent(eventName: string): void;
  unwatchEvent(eventName: string): void;
}

export interface FxcmSocketTransportOptions {
  config: FxcmConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  /** Injected for tests — bypasses real Engine.IO polling. */
  fake?: FakeFxcmTransportController;
}

export interface FakeFxcmTransportController {
  session?: FxcmSessionHandle;
  connectError?: Error;
  autoConnect?: boolean;
  emit?: (eventName: string, data: unknown) => void;
  setConnected?: (connected: boolean) => void;
  disconnect?: () => void;
  /** Internal hooks filled by fake transport. */
  _handlers?: {
    onEvent?: FxcmTransportEventHandler;
    onState?: FxcmTransportStateHandler;
    watched?: Set<string>;
  };
}

function decodePayloadChunk(chunk: string): string {
  // Engine.IO with b64=1 may prefix length:N:payload
  const colon = chunk.indexOf(":");
  if (colon > 0 && /^\d+$/.test(chunk.slice(0, colon))) {
    return chunk.slice(colon + 1);
  }
  return chunk;
}

/**
 * Parse Engine.IO polling payload into Socket.IO event tuples.
 * Supports concatenated packets and optional length prefixes.
 */
export function parseEngineIoPollingBody(body: string): Array<{ type: string; eventName?: string; data?: unknown; raw: string }> {
  const text = String(body ?? "").trim();
  if (!text) return [];
  const out: Array<{ type: string; eventName?: string; data?: unknown; raw: string }> = [];

  // Split on length-prefixed frames when present: N:payloadN:payload
  const frames: string[] = [];
  let i = 0;
  while (i < text.length) {
    const colon = text.indexOf(":", i);
    if (colon > i && /^\d+$/.test(text.slice(i, colon))) {
      const len = Number(text.slice(i, colon));
      const start = colon + 1;
      frames.push(text.slice(start, start + len));
      i = start + len;
      continue;
    }
    // No length prefix — treat remainder as one frame (or already-decoded packet string)
    frames.push(text.slice(i));
    break;
  }

  for (const frame of frames) {
    const packet = decodePayloadChunk(frame);
    if (!packet) continue;
    const engineType = packet[0];
    if (engineType === "0") {
      out.push({ type: "open", raw: packet });
      continue;
    }
    if (engineType === "1") {
      out.push({ type: "close", raw: packet });
      continue;
    }
    if (engineType === "2") {
      out.push({ type: "ping", raw: packet });
      continue;
    }
    if (engineType === "3") {
      out.push({ type: "pong", raw: packet });
      continue;
    }
    if (engineType === "4") {
      const sio = packet.slice(1);
      const sioType = sio[0];
      if (sioType === "2") {
        // EVENT — 42["name", payload]
        try {
          const arr = JSON.parse(sio.slice(1)) as unknown;
          if (Array.isArray(arr) && arr.length >= 1) {
            out.push({
              type: "event",
              eventName: String(arr[0]),
              data: arr.length > 1 ? arr[1] : null,
              raw: packet,
            });
          }
        } catch {
          out.push({ type: "message", raw: packet });
        }
      } else if (sioType === "0") {
        out.push({ type: "connect", raw: packet });
      } else if (sioType === "1") {
        out.push({ type: "disconnect", raw: packet });
      } else {
        out.push({ type: "message", raw: packet });
      }
    }
  }
  return out;
}

class EngineIoPollingTransport implements FxcmSocketTransport {
  private readonly config: FxcmConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: FetchLike;
  private readonly nowMs: () => number;
  private session: FxcmSessionHandle | null = null;
  private running = false;
  private loopAbort: AbortController | null = null;
  private eventHandler: FxcmTransportEventHandler | null = null;
  private stateHandler: FxcmTransportStateHandler | null = null;
  private watched = new Set<string>();
  private pingIntervalMs = 25_000;

  constructor(options: FxcmSocketTransportOptions) {
    this.config = options.config;
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  onEvent(handler: FxcmTransportEventHandler): void {
    this.eventHandler = handler;
  }

  onState(handler: FxcmTransportStateHandler): void {
    this.stateHandler = handler;
  }

  watchEvent(eventName: string): void {
    this.watched.add(eventName);
  }

  unwatchEvent(eventName: string): void {
    this.watched.delete(eventName);
  }

  isConnected(): boolean {
    return this.running && this.session != null;
  }

  getSession(): FxcmSessionHandle | null {
    return this.session;
  }

  async connect(): Promise<FxcmSessionHandle> {
    if (!this.config.enabled) {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    const token = readFxcmAccessToken(this.env);
    if (!token) {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }

    this.stateHandler?.("CONNECTING");
    this.disconnect();
    this.loopAbort = new AbortController();
    const signal = this.loopAbort.signal;

    const openUrl = new URL(FXCM_REST_PATHS.socketIo, `${this.config.restBaseUrl}/`);
    openUrl.searchParams.set("access_token", token);
    openUrl.searchParams.set("EIO", "3");
    openUrl.searchParams.set("transport", "polling");
    openUrl.searchParams.set("b64", "1");

    let res: Response;
    try {
      res = await this.fetchImpl(openUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "*/*",
          "User-Agent": "kwizera-ai-studio/fxcm-stream",
        },
        signal,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/abort/i.test(msg)) {
        throw new FxcmMarketDataError("FXCM_TIMEOUT", "FXCM stream handshake aborted.");
      }
      this.stateHandler?.("ERROR", "handshake network error");
      throw new FxcmMarketDataError("FXCM_CONNECTION_FAILED", "FXCM stream handshake failed.");
    }

    if (res.status === 401 || res.status === 403) {
      this.stateHandler?.("ERROR", "authentication rejected");
      throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM stream authentication rejected.", res.status);
    }
    if (!res.ok) {
      this.stateHandler?.("ERROR", `handshake HTTP ${res.status}`);
      throw new FxcmMarketDataError("FXCM_CONNECTION_FAILED", `FXCM stream handshake HTTP ${res.status}.`, res.status);
    }

    const body = await res.text();
    const socketId = parseEngineIoSid(body);
    if (!socketId) {
      this.stateHandler?.("ERROR", "missing sid");
      throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "FXCM stream handshake did not return a session id.");
    }

    // Capture pingInterval if present
    try {
      const start = body.indexOf("{");
      if (start >= 0) {
        const obj = JSON.parse(body.slice(start).replace(/^\d+:0/, "").replace(/^0/, "")) as { pingInterval?: number };
        // body may already be length-prefixed; try direct match
        const m = body.match(/"pingInterval"\s*:\s*(\d+)/);
        if (m) this.pingIntervalMs = Number(m[1]);
        else if (obj.pingInterval) this.pingIntervalMs = obj.pingInterval;
      }
    } catch {
      // keep default
    }

    this.session = {
      socketId,
      restBaseUrl: this.config.restBaseUrl,
      authorizationHeader: `Bearer ${socketId}${token}`,
    };
    this.running = true;
    this.stateHandler?.("CONNECTED");

    // Start long-poll receive loop (non-blocking)
    void this.pollLoop(token, signal);

    return this.session;
  }

  private async pollLoop(token: string, signal: AbortSignal): Promise<void> {
    while (this.running && this.session && !signal.aborted) {
      const sid = this.session.socketId;
      const pollUrl = new URL(FXCM_REST_PATHS.socketIo, `${this.config.restBaseUrl}/`);
      pollUrl.searchParams.set("EIO", "3");
      pollUrl.searchParams.set("transport", "polling");
      pollUrl.searchParams.set("t", String(this.nowMs()));
      pollUrl.searchParams.set("b64", "1");
      pollUrl.searchParams.set("sid", sid);
      // access_token may be required on some FXCM revisions for poll continuity
      pollUrl.searchParams.set("access_token", token);

      try {
        const res = await this.fetchImpl(pollUrl.toString(), {
          method: "GET",
          headers: {
            Accept: "*/*",
            "User-Agent": "kwizera-ai-studio/fxcm-stream",
          },
          signal,
        });
        if (res.status === 401 || res.status === 403) {
          this.stateHandler?.("ERROR", "poll unauthorized");
          this.running = false;
          this.session = null;
          return;
        }
        if (!res.ok) {
          // Brief pause then continue — reconnect handled by service if loop ends
          await sleep(Math.min(this.pingIntervalMs, 2_000), signal);
          continue;
        }
        const body = await res.text();
        const packets = parseEngineIoPollingBody(body);
        for (const pkt of packets) {
          if (pkt.type === "ping") {
            await this.sendPong(sid, token, signal);
          } else if (pkt.type === "close") {
            this.running = false;
            this.session = null;
            this.stateHandler?.("DISCONNECTED", "provider closed");
            return;
          } else if (pkt.type === "event" && pkt.eventName) {
            // Deliver all named events; service filters by subscription.
            this.eventHandler?.(pkt.eventName, pkt.data);
          }
        }
      } catch (error) {
        if (signal.aborted || !this.running) return;
        const msg = error instanceof Error ? error.message : String(error);
        if (/abort/i.test(msg)) return;
        this.stateHandler?.("ERROR", "poll failed");
        this.running = false;
        this.session = null;
        this.stateHandler?.("DISCONNECTED", "poll failed");
        return;
      }
    }
  }

  private async sendPong(sid: string, token: string, signal: AbortSignal): Promise<void> {
    const url = new URL(FXCM_REST_PATHS.socketIo, `${this.config.restBaseUrl}/`);
    url.searchParams.set("EIO", "3");
    url.searchParams.set("transport", "polling");
    url.searchParams.set("sid", sid);
    url.searchParams.set("access_token", token);
    try {
      await this.fetchImpl(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "User-Agent": "kwizera-ai-studio/fxcm-stream",
        },
        body: "3",
        signal,
      });
    } catch {
      // ignore — next poll will surface disconnect
    }
  }

  disconnect(): void {
    this.running = false;
    this.loopAbort?.abort();
    this.loopAbort = null;
    if (this.session) {
      this.session = null;
      this.stateHandler?.("DISCONNECTED", "local disconnect");
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const t = setTimeout(resolve, ms);
    t.unref?.();
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    }, { once: true });
  });
}

class FakeTransport implements FxcmSocketTransport {
  private connected = false;
  private session: FxcmSessionHandle | null = null;
  private eventHandler: FxcmTransportEventHandler | null = null;
  private stateHandler: FxcmTransportStateHandler | null = null;
  private watched = new Set<string>();
  private readonly fake: FakeFxcmTransportController;
  private readonly config: FxcmConfig;

  constructor(options: FxcmSocketTransportOptions) {
    this.config = options.config;
    this.fake = options.fake!;
    this.fake._handlers = {
      onEvent: undefined,
      onState: undefined,
      watched: this.watched,
    };
    this.fake.emit = (eventName: string, data: unknown) => {
      this.eventHandler?.(eventName, data);
    };
    this.fake.setConnected = (c: boolean) => {
      this.connected = c;
      if (!c) {
        this.session = null;
        this.stateHandler?.("DISCONNECTED");
      }
    };
    this.fake.disconnect = () => this.disconnect();
  }

  onEvent(handler: FxcmTransportEventHandler): void {
    this.eventHandler = handler;
    if (this.fake._handlers) this.fake._handlers.onEvent = handler;
  }

  onState(handler: FxcmTransportStateHandler): void {
    this.stateHandler = handler;
    if (this.fake._handlers) this.fake._handlers.onState = handler;
  }

  watchEvent(eventName: string): void {
    this.watched.add(eventName);
  }

  unwatchEvent(eventName: string): void {
    this.watched.delete(eventName);
  }

  isConnected(): boolean {
    return this.connected && this.session != null;
  }

  getSession(): FxcmSessionHandle | null {
    return this.session;
  }

  async connect(): Promise<FxcmSessionHandle> {
    this.stateHandler?.("CONNECTING");
    if (this.fake.connectError) {
      this.stateHandler?.("ERROR", this.fake.connectError.message);
      throw this.fake.connectError;
    }
    this.session = this.fake.session ?? {
      socketId: "FakeSid",
      restBaseUrl: this.config.restBaseUrl,
      authorizationHeader: "Bearer FakeSidfake-token-value-xxxxxxxx",
    };
    this.connected = true;
    this.stateHandler?.("CONNECTED");
    return this.session;
  }

  disconnect(): void {
    this.connected = false;
    this.session = null;
    this.stateHandler?.("DISCONNECTED", "local disconnect");
  }
}

export function createFxcmSocketTransport(options: FxcmSocketTransportOptions): FxcmSocketTransport {
  if (options.fake) return new FakeTransport(options);
  return new EngineIoPollingTransport(options);
}
