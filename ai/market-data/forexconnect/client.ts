/**
 * Phase 33 — Node → localhost ForexConnect sidecar client.
 */
import { resolveForexConnectConfig, type ForexConnectConfig } from "./config.js";
import type {
  ForexConnectInstrumentsResult,
  ForexConnectSafeStatus,
} from "./types.js";

export type FetchLike = typeof fetch;

function sanitize(message: string): string {
  return String(message ?? "")
    .replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/[0-9a-f]{32,}/gi, "[redacted]")
    .slice(0, 500);
}

function localStatus(
  cfg: ForexConnectConfig,
  partial: Partial<ForexConnectSafeStatus> & { status: string },
): ForexConnectSafeStatus {
  return {
    ok: true,
    provider: "FOREXCONNECT",
    apiPath: "FXCM ForexConnect SDK (sidecar)",
    status: partial.status,
    enabled: cfg.enabled,
    configured: cfg.usernameConfigured && cfg.passwordConfigured,
    environment: cfg.environment,
    environmentLabel: cfg.environmentLabel,
    urlHost: cfg.urlHost,
    usernameConfigured: cfg.usernameConfigured,
    passwordConfigured: cfg.passwordConfigured,
    trading: "DISABLED",
    sidecarReachable: partial.sidecarReachable ?? false,
    errorCode: partial.errorCode ?? null,
    errorMessage: partial.errorMessage ? sanitize(partial.errorMessage) : null,
    instrumentCount: partial.instrumentCount ?? 0,
    connectedAt: partial.connectedAt ?? null,
    lastInstrumentAt: partial.lastInstrumentAt ?? null,
    sdkAvailable: partial.sdkAvailable,
    sdkImportError: partial.sdkImportError ?? null,
    connecting: partial.connecting ?? false,
    note: partial.note
      ?? "ForexConnect via private localhost sidecar. Trading disabled.",
    checkedAt: new Date().toISOString(),
  };
}

async function sidecarFetch(
  cfg: ForexConnectConfig,
  path: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.sidecarBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export class ForexConnectBridge {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: FetchLike;

  constructor(options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  }) {
    this.env = options?.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  getConfig(): ForexConnectConfig {
    return resolveForexConnectConfig(this.env);
  }

  async getStatus(): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return localStatus(cfg, {
        status: "DISABLED",
        errorCode: "FOREXCONNECT_DISABLED",
        errorMessage: "ForexConnect is disabled. Set KWIZERA_FOREXCONNECT_ENABLED=1.",
      });
    }
    if (!(cfg.usernameConfigured && cfg.passwordConfigured)) {
      // Still try sidecar health for SDK availability diagnostics.
      try {
        const remote = await sidecarFetch(cfg, "/status", { method: "GET" }, this.fetchImpl);
        if (remote.body && typeof remote.body.status === "string") {
          return {
            ...(remote.body as unknown as ForexConnectSafeStatus),
            sidecarReachable: true,
            trading: "DISABLED",
          };
        }
      } catch {
        /* fall through */
      }
      return localStatus(cfg, {
        status: "NOT_CONFIGURED",
        errorCode: "FOREXCONNECT_NOT_CONFIGURED",
        errorMessage:
          "Set KWIZERA_FOREXCONNECT_USERNAME and KWIZERA_FOREXCONNECT_PASSWORD on the server.",
      });
    }

    try {
      const remote = await sidecarFetch(cfg, "/status", { method: "GET" }, this.fetchImpl);
      if (!remote.body || typeof remote.body !== "object") {
        return localStatus(cfg, {
          status: "SERVICE_UNAVAILABLE",
          errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          errorMessage: "ForexConnect sidecar returned an invalid status payload.",
          sidecarReachable: true,
        });
      }
      return {
        ...(remote.body as unknown as ForexConnectSafeStatus),
        sidecarReachable: true,
        trading: "DISABLED",
        errorMessage: remote.body.errorMessage
          ? sanitize(String(remote.body.errorMessage))
          : null,
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
        sidecarReachable: false,
      });
    }
  }

  async connect(): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      return localStatus(cfg, {
        status: "DISABLED",
        errorCode: "FOREXCONNECT_DISABLED",
        errorMessage: "ForexConnect is disabled.",
      });
    }
    if (!(cfg.usernameConfigured && cfg.passwordConfigured)) {
      return localStatus(cfg, {
        status: "NOT_CONFIGURED",
        errorCode: "FOREXCONNECT_NOT_CONFIGURED",
        errorMessage:
          "Set KWIZERA_FOREXCONNECT_USERNAME and KWIZERA_FOREXCONNECT_PASSWORD on the server.",
      });
    }
    try {
      const remote = await sidecarFetch(
        cfg,
        "/connect",
        { method: "POST", body: "{}" },
        this.fetchImpl,
      );
      const body = remote.body as unknown as ForexConnectSafeStatus;
      return {
        ...body,
        ok: body.status === "CONNECTED",
        sidecarReachable: true,
        trading: "DISABLED",
        errorMessage: body.errorMessage ? sanitize(String(body.errorMessage)) : null,
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
        sidecarReachable: false,
      });
    }
  }

  async disconnect(): Promise<ForexConnectSafeStatus> {
    const cfg = this.getConfig();
    try {
      const remote = await sidecarFetch(
        cfg,
        "/disconnect",
        { method: "POST", body: "{}" },
        this.fetchImpl,
      );
      return {
        ...(remote.body as unknown as ForexConnectSafeStatus),
        sidecarReachable: true,
        trading: "DISABLED",
      };
    } catch (error) {
      return localStatus(cfg, {
        status: "SERVICE_UNAVAILABLE",
        errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
        errorMessage: sanitize(
          error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
        ),
      });
    }
  }

  async listInstruments(): Promise<ForexConnectInstrumentsResult> {
    const cfg = this.getConfig();
    const status = await this.getStatus();
    if (status.status !== "CONNECTED") {
      return {
        ok: false,
        count: 0,
        instruments: [],
        status,
        error: {
          code: String(status.errorCode ?? `FOREXCONNECT_${status.status}`),
          message: status.errorMessage
            ?? "ForexConnect is not connected. Connect before discovering instruments.",
        },
      };
    }
    try {
      const remote = await sidecarFetch(cfg, "/instruments", { method: "GET" }, this.fetchImpl);
      const body = remote.body as unknown as ForexConnectInstrumentsResult;
      if (!body.ok) {
        return {
          ok: false,
          count: 0,
          instruments: [],
          status,
          error: body.error ?? {
            code: "FOREXCONNECT_DISCOVERY_FAILED",
            message: "Instrument discovery failed.",
          },
        };
      }
      const instruments = Array.isArray(body.instruments) ? body.instruments : [];
      return {
        ok: true,
        count: instruments.length,
        instruments,
        fetchedAt: body.fetchedAt ?? null,
        status,
        note: body.note
          ?? "Instruments from authenticated ForexConnect Offers table.",
      };
    } catch (error) {
      return {
        ok: false,
        count: 0,
        instruments: [],
        status: {
          ...status,
          status: "SERVICE_UNAVAILABLE",
          sidecarReachable: false,
          errorCode: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          errorMessage: sanitize(
            error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
          ),
        },
        error: {
          code: "FOREXCONNECT_SERVICE_UNAVAILABLE",
          message: sanitize(
            error instanceof Error ? error.message : "ForexConnect sidecar is unreachable.",
          ),
        },
      };
    }
  }
}

let singleton: ForexConnectBridge | null = null;

export function getForexConnectBridge(): ForexConnectBridge {
  singleton ??= new ForexConnectBridge();
  return singleton;
}

export function createForexConnectBridge(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
}): ForexConnectBridge {
  return new ForexConnectBridge(options);
}

export function assertNoSecretsInForexConnectPayload(
  payload: unknown,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): void {
  const password = String(env.KWIZERA_FOREXCONNECT_PASSWORD ?? "").trim();
  const text = JSON.stringify(payload);
  if (password.length >= 4 && text.includes(password)) {
    throw new Error("Refusing to expose ForexConnect password in API payload.");
  }
}
