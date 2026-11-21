/**
 * Server-side feature + licensing gate for Phase 7 economic calendar.
 * Disabled by default — both env vars must be exactly "1".
 */
import {
  HFM_ECONOMIC_CALENDAR_ENABLED_ENV,
  HFM_ECONOMIC_CALENDAR_LICENSING_ENV,
  type HfmFundamentalsAvailability,
} from "./contracts.js";

export function isEconomicCalendarLicensingCleared(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV] ?? "").trim() === "1";
}

export function isEconomicCalendarProviderEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV] ?? "").trim() === "1";
}

/** Live provider HTTP + end-user calendar display require both gates. */
export function isEconomicCalendarLiveAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isEconomicCalendarLicensingCleared(env) && isEconomicCalendarProviderEnabled(env);
}

export function economicCalendarGateAvailability(
  env: NodeJS.ProcessEnv = process.env,
): HfmFundamentalsAvailability {
  if (!isEconomicCalendarLicensingCleared(env)) return "LICENSING_BLOCKED";
  if (!isEconomicCalendarProviderEnabled(env)) return "NOT_CONFIGURED";
  return "OK";
}

export function economicCalendarEnableInstructions(): string {
  return [
    "Licensing review must be cleared before production use.",
    `Set ${HFM_ECONOMIC_CALENDAR_LICENSING_ENV}=1 only after legal clearance.`,
    `Set ${HFM_ECONOMIC_CALENDAR_ENABLED_ENV}=1 to enable live ShowMyTrades consumption and Charts display.`,
    "Both must be exactly 1. Restart kwizera-ai.service after changing .env.",
    "Do not expose a public calendar proxy. Keep attribution visible when displaying events.",
    "Background refresh remains OFF (manual admin refresh only).",
  ].join(" ");
}
