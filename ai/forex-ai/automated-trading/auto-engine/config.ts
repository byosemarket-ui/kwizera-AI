import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../demo-execution/demo-activation-config.js";
import { SMA_CROSSOVER_RULES } from "./strategy/rules.js";

export const AUTO_ENGINE_PHASE = "4.1" as const;

export interface AutoEngineConfig {
  enabled: boolean;
  /** dry_run never submits; armed_prepare_only still never submits without separate activation. */
  mode: "off" | "dry_run" | "armed_prepare_only";
  instruments: string[];
  timeframe: string;
  lots: number;
  pollIntervalMs: number;
  strategyId: string;
  maxSpread: number | null;
  sessionUtcStartMinute: number;
  sessionUtcEndMinute: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export function loadAutoEngineConfig(env: NodeJS.ProcessEnv = process.env): AutoEngineConfig {
  const modeRaw = String(env.KWIZERA_AUTO_ENGINE_MODE ?? "dry_run").trim().toLowerCase();
  const mode =
    modeRaw === "off" || modeRaw === "armed_prepare_only" || modeRaw === "dry_run"
      ? modeRaw
      : "dry_run";
  const enabled = mode !== "off";
  const instrumentsRaw = String(env.KWIZERA_AUTO_ENGINE_INSTRUMENTS ?? "XAU/USD").trim();
  const instruments = instrumentsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const timeframe = String(env.KWIZERA_AUTO_ENGINE_TIMEFRAME ?? "15m").trim() || "15m";
  const lots = Math.max(1, Math.floor(Number(env.KWIZERA_AUTO_ENGINE_LOTS ?? 1)) || 1);
  const poll = Math.max(5_000, Math.floor(Number(env.KWIZERA_AUTO_ENGINE_POLL_MS ?? 30_000)) || 30_000);
  const maxSpreadRaw = env.KWIZERA_AUTO_ENGINE_MAX_SPREAD;
  const maxSpread =
    maxSpreadRaw == null || String(maxSpreadRaw).trim() === ""
      ? null
      : Number(maxSpreadRaw);

  return {
    enabled,
    mode,
    instruments: instruments.length > 0 ? instruments : [...PROPOSED_BOUNDED_DEMO_ACTIVATION.permittedInstruments],
    timeframe,
    lots: Math.min(lots, PROPOSED_BOUNDED_DEMO_ACTIVATION.maxLotsPerOrder),
    pollIntervalMs: poll,
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    maxSpread: maxSpread != null && Number.isFinite(maxSpread) && maxSpread > 0 ? maxSpread : null,
    sessionUtcStartMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcStartMinute,
    sessionUtcEndMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcEndMinute,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
