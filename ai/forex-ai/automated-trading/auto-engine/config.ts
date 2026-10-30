import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../demo-execution/demo-activation-config.js";
import { SMA_CROSSOVER_RULES } from "./strategy/rules.js";

export const AUTO_ENGINE_PHASE = "4.1" as const;

export interface AutoEngineConfig {
  enabled: boolean;
  /**
   * dry_run — signals + prepare only, never submit.
   * armed_prepare_only — prepare against live risk; still never submit here.
   * armed_execute — may call grant-scoped DEMO openMarket only when submitAuthorized gates pass.
   */
  mode: "off" | "dry_run" | "armed_prepare_only" | "armed_execute";
  instruments: string[];
  timeframe: string;
  lots: number;
  pollIntervalMs: number;
  strategyId: string;
  maxSpread: number | null;
  sessionUtcStartMinute: number;
  sessionUtcEndMinute: number;
  /** Explicit continuous-worker enable (still requires file lock + gates). */
  continuousEnabled: boolean;
  /** Must be true together with armed_execute + mutation + grant for any broker submit. */
  submitAuthorized: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

function parseLots(raw: unknown, maxLots: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0.01;
  // Allow fractional DEMO lots; never exceed proposed max.
  return Math.min(n, maxLots);
}

export function loadAutoEngineConfig(env: NodeJS.ProcessEnv = process.env): AutoEngineConfig {
  const modeRaw = String(env.KWIZERA_AUTO_ENGINE_MODE ?? "dry_run").trim().toLowerCase();
  const mode =
    modeRaw === "off"
    || modeRaw === "armed_prepare_only"
    || modeRaw === "armed_execute"
    || modeRaw === "dry_run"
      ? modeRaw
      : "dry_run";
  const enabled = mode !== "off";
  const instrumentsRaw = String(env.KWIZERA_AUTO_ENGINE_INSTRUMENTS ?? "XAU/USD").trim();
  const instruments = instrumentsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const timeframe = String(env.KWIZERA_AUTO_ENGINE_TIMEFRAME ?? "15m").trim() || "15m";
  const lots = parseLots(
    env.KWIZERA_AUTO_ENGINE_LOTS ?? 0.01,
    PROPOSED_BOUNDED_DEMO_ACTIVATION.maxLotsPerOrder,
  );
  const poll = Math.max(5_000, Math.floor(Number(env.KWIZERA_AUTO_ENGINE_POLL_MS ?? 30_000)) || 30_000);
  const continuousEnabled = String(env.KWIZERA_AUTO_ENGINE_CONTINUOUS ?? "").trim() === "1"
    || /^true$/i.test(String(env.KWIZERA_AUTO_ENGINE_CONTINUOUS ?? ""));
  const submitAuthorized = String(env.KWIZERA_AUTO_ENGINE_SUBMIT_AUTHORIZED ?? "").trim() === "1"
    || /^true$/i.test(String(env.KWIZERA_AUTO_ENGINE_SUBMIT_AUTHORIZED ?? ""));
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
    lots,
    pollIntervalMs: poll,
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    maxSpread: maxSpread != null && Number.isFinite(maxSpread) && maxSpread > 0 ? maxSpread : null,
    sessionUtcStartMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcStartMinute,
    sessionUtcEndMinute: PROPOSED_BOUNDED_DEMO_ACTIVATION.sessionUtcEndMinute,
    continuousEnabled,
    submitAuthorized: submitAuthorized && mode === "armed_execute",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
