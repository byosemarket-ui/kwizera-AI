/**
 * Phase 59.0.3 — Collect Automated Trading configured instruments for FC Offers subscribe.
 * Reads existing AT settings / monitor config only — never invents market symbols.
 * Does not enable trading or mutate broker orders.
 */
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync } from "../../../storage/safe-json.js";

export interface AtConfiguredQuoteInstrument {
  symbol: string;
  timeframe: string;
  source: "at-selectedInstrument" | "at-monitor";
}

export interface CollectConfiguredAtQuoteInstrumentsResult {
  instruments: AtConfiguredQuoteInstrument[];
  selectedEnvironment: "DEMO" | "LIVE" | null;
  note: string;
  placesOrders: false;
  acceptsForExecution: false;
}

function pushUnique(
  out: AtConfiguredQuoteInstrument[],
  seen: Set<string>,
  symbolRaw: unknown,
  timeframe: string,
  source: AtConfiguredQuoteInstrument["source"],
): void {
  const symbol = String(symbolRaw ?? "").trim();
  if (!symbol) return;
  const key = symbol.replace(/\s+/g, "").toUpperCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ symbol, timeframe: timeframe || "1m", source });
}

/**
 * Load AT-selected + monitor instruments from durable storage.
 * Empty result means instruments are not configured — caller must not invent symbols.
 */
export function collectConfiguredAtQuoteInstruments(
  storageRoot?: string,
): CollectConfiguredAtQuoteInstrumentsResult {
  const root = storageRoot ?? resolveStorageRoot();
  const instruments: AtConfiguredQuoteInstrument[] = [];
  const seen = new Set<string>();
  let selectedEnvironment: "DEMO" | "LIVE" | null = null;

  const settingsPath = path.join(root, "forex-automated-trading", "settings.json");
  const settings = readJsonSafeSync<Record<string, unknown> | null>(settingsPath, null).value;
  if (settings && typeof settings === "object") {
    const envRaw = settings.selectedEnvironment;
    selectedEnvironment = envRaw === "LIVE" ? "LIVE" : envRaw === "DEMO" ? "DEMO" : null;
    const environments = settings.environments;
    if (environments && typeof environments === "object") {
      const envKey = selectedEnvironment ?? "DEMO";
      const envState = (environments as Record<string, unknown>)[envKey];
      if (envState && typeof envState === "object") {
        pushUnique(
          instruments,
          seen,
          (envState as Record<string, unknown>).selectedInstrument,
          "1m",
          "at-selectedInstrument",
        );
      }
    }
  }

  const monitorPath = path.join(root, "forex-automated-trading", "monitoring.json");
  const monitor = readJsonSafeSync<Record<string, unknown> | null>(monitorPath, null).value;
  if (monitor && typeof monitor === "object") {
    const config = monitor.config;
    if (config && typeof config === "object") {
      const c = config as Record<string, unknown>;
      const tf = typeof c.timeframe === "string" && c.timeframe.trim() ? c.timeframe.trim() : "1m";
      // Only seed monitor instrument when it matches the active AT environment (or env unset).
      const monEnv = c.environment === "LIVE" ? "LIVE" : c.environment === "DEMO" ? "DEMO" : null;
      if (!selectedEnvironment || !monEnv || monEnv === selectedEnvironment) {
        pushUnique(instruments, seen, c.instrument, tf, "at-monitor");
      }
    }
  }

  return {
    instruments,
    selectedEnvironment,
    note: instruments.length === 0
      ? "No Automated Trading selectedInstrument or monitor instrument not configured — Offers subscribe not seeded."
      : `Seeded from ${instruments.map((i) => i.source).join(",")}.`,
    placesOrders: false,
    acceptsForExecution: false,
  };
}
