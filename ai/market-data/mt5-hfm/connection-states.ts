/**
 * Distinct HFM MT5 Demo connection states for Forex Admin.
 * Never collapse into a single misleading "Connected" flag.
 */

export const MT5_HFM_CONNECTION_STATES = [
  "CREDENTIALS_NOT_CONFIGURED",
  "CREDENTIALS_SAVED",
  "AGENT_OFFLINE",
  "AGENT_CONNECTED",
  "MT5_TERMINAL_STOPPED",
  "MT5_TERMINAL_RUNNING",
  "HFM_SERVER_DISCONNECTED",
  "DEMO_NETWORK_REACHABLE",
  "DEMO_AUTH_FAILED",
  "DEMO_AUTHENTICATED",
  "ACCOUNT_SYNCHRONIZED",
  "MARKET_DATA_AVAILABLE",
  "MARKET_DATA_STALE",
  "SYNC_FAILED",
  "LIVE_LOGIN_LOCKED",
] as const;

export type Mt5HfmConnectionStateId = (typeof MT5_HFM_CONNECTION_STATES)[number];

export interface Mt5HfmConnectionStateView {
  id: Mt5HfmConnectionStateId;
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  active: boolean;
}

export interface Mt5HfmConnectionStateInput {
  credentialsConfigured: boolean;
  agentOk: boolean | null;
  terminalRunning: boolean | null;
  hfmTcpOk: boolean | null;
  authenticated: boolean | null;
  authFailed: boolean | null;
  accountSynced: boolean | null;
  marketDataAvailable: boolean | null;
  marketDataStale: boolean | null;
  syncFailed: boolean | null;
}

const LABELS: Record<Mt5HfmConnectionStateId, { label: string; tone: Mt5HfmConnectionStateView["tone"] }> = {
  CREDENTIALS_NOT_CONFIGURED: { label: "Credentials not configured", tone: "warn" },
  CREDENTIALS_SAVED: { label: "Credentials saved", tone: "ok" },
  AGENT_OFFLINE: { label: "Agent offline", tone: "danger" },
  AGENT_CONNECTED: { label: "Agent connected", tone: "ok" },
  MT5_TERMINAL_STOPPED: { label: "MT5 terminal stopped", tone: "warn" },
  MT5_TERMINAL_RUNNING: { label: "MT5 terminal running", tone: "ok" },
  HFM_SERVER_DISCONNECTED: { label: "HFM server disconnected", tone: "danger" },
  DEMO_NETWORK_REACHABLE: { label: "Demo network reachable (TCP)", tone: "ok" },
  DEMO_AUTH_FAILED: { label: "Demo authentication failed", tone: "danger" },
  DEMO_AUTHENTICATED: { label: "Demo account authenticated", tone: "ok" },
  ACCOUNT_SYNCHRONIZED: { label: "Account synchronized", tone: "ok" },
  MARKET_DATA_AVAILABLE: { label: "Broker feed / market data available", tone: "ok" },
  MARKET_DATA_STALE: { label: "Market data stale", tone: "warn" },
  SYNC_FAILED: { label: "Synchronization failed", tone: "danger" },
  LIVE_LOGIN_LOCKED: { label: "LIVE login & trading locked", tone: "danger" },
};

export function buildMt5HfmConnectionStates(
  input: Mt5HfmConnectionStateInput,
): Mt5HfmConnectionStateView[] {
  const active = new Set<Mt5HfmConnectionStateId>();

  if (!input.credentialsConfigured) active.add("CREDENTIALS_NOT_CONFIGURED");
  else active.add("CREDENTIALS_SAVED");

  if (input.agentOk === false) active.add("AGENT_OFFLINE");
  if (input.agentOk === true) active.add("AGENT_CONNECTED");

  if (input.terminalRunning === false) active.add("MT5_TERMINAL_STOPPED");
  if (input.terminalRunning === true) active.add("MT5_TERMINAL_RUNNING");

  if (input.hfmTcpOk === false) active.add("HFM_SERVER_DISCONNECTED");
  if (input.hfmTcpOk === true) active.add("DEMO_NETWORK_REACHABLE");

  if (input.authFailed) active.add("DEMO_AUTH_FAILED");
  if (input.authenticated) active.add("DEMO_AUTHENTICATED");

  if (input.accountSynced) active.add("ACCOUNT_SYNCHRONIZED");
  if (input.syncFailed) active.add("SYNC_FAILED");

  if (input.marketDataAvailable) active.add("MARKET_DATA_AVAILABLE");
  if (input.marketDataStale) active.add("MARKET_DATA_STALE");

  // LIVE remains locked for this product surface — never imply Live is enabled.
  active.add("LIVE_LOGIN_LOCKED");

  return MT5_HFM_CONNECTION_STATES.map((id) => ({
    id,
    label: LABELS[id].label,
    tone: LABELS[id].tone,
    active: active.has(id),
  }));
}
