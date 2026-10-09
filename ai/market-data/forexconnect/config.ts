/**
 * Phase 33 — ForexConnect sidecar configuration (server-only).
 * Credentials never leave the process / never returned to browsers.
 */

export type ForexConnectEnvironment = "demo" | "real";

export interface ForexConnectConfig {
  enabled: boolean;
  environment: ForexConnectEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  sidecarHost: string;
  sidecarPort: number;
  sidecarBaseUrl: string;
  timeoutMs: number;
  urlHost: string;
}

function truthy(raw: string | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseEnv(raw: string | undefined): ForexConnectEnvironment {
  const v = String(raw ?? "demo").trim().toLowerCase();
  if (v === "real" || v === "live" || v === "production" || v === "prod") return "real";
  return "demo";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function resolveForexConnectConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ForexConnectConfig {
  const enabled = truthy(env.KWIZERA_FOREXCONNECT_ENABLED);
  const environment = parseEnv(env.KWIZERA_FOREXCONNECT_ENVIRONMENT);
  const username = String(env.KWIZERA_FOREXCONNECT_USERNAME ?? "").trim();
  const password = String(env.KWIZERA_FOREXCONNECT_PASSWORD ?? "").trim();
  let sidecarHost = String(env.KWIZERA_FOREXCONNECT_SIDECAR_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
  if (sidecarHost !== "127.0.0.1" && sidecarHost !== "localhost" && sidecarHost !== "::1") {
    sidecarHost = "127.0.0.1";
  }
  const portRaw = Number(env.KWIZERA_FOREXCONNECT_SIDECAR_PORT ?? 5179);
  const sidecarPort = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? Math.floor(portRaw) : 5179;
  const timeoutRaw = Number(env.KWIZERA_FOREXCONNECT_TIMEOUT_MS ?? 20_000);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw >= 1_000 && timeoutRaw <= 120_000
    ? Math.floor(timeoutRaw)
    : 20_000;
  const url = String(env.KWIZERA_FOREXCONNECT_URL ?? "https://www.fxcorporate.com/Hosts.jsp").trim();

  return {
    enabled,
    environment,
    environmentLabel: environment === "real" ? "FXCM REAL" : "FXCM DEMO",
    usernameConfigured: username.length > 0,
    passwordConfigured: password.length >= 4,
    sidecarHost,
    sidecarPort,
    sidecarBaseUrl: `http://${sidecarHost === "::1" ? "[::1]" : sidecarHost}:${sidecarPort}`,
    timeoutMs,
    urlHost: hostOf(url),
  };
}

/** Server-only credential presence check — never returns secret values. */
export function forexConnectCredentialsConfigured(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const cfg = resolveForexConnectConfig(env);
  return cfg.usernameConfigured && cfg.passwordConfigured;
}
