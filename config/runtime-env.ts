import fs from "node:fs";
import path from "node:path";

const DEFAULT_PORT = 5173;

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production" || process.env.KWIZERA_ENV === "production";
}

export function resolveBindHost(): string {
  const host = process.env.KWIZERA_HOST || process.env.KWIZERA_BIND_HOST;
  return host && host.trim() ? host.trim() : "127.0.0.1";
}

export function resolveBindPort(defaultPort = DEFAULT_PORT): number {
  const raw = process.env.KWIZERA_PORT || process.env.KWIZERA_DEV_PORT;
  const n = raw ? Number(raw) : defaultPort;
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : defaultPort;
}

export function resolveHealthProbeHost(bindHost: string): string {
  if (!bindHost || bindHost === "0.0.0.0" || bindHost === "::" || bindHost === "[::]") {
    return "127.0.0.1";
  }
  return bindHost;
}

/**
 * Load `.env` from the project root without overwriting variables already set
 * in the process environment (systemd EnvironmentFile / shell export win).
 */
export function loadProjectEnv(projectRoot: string): string | null {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return null;

  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return envPath;
}
