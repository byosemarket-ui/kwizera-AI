import { formatAge } from "../../format";
import {
  labelMt5AgentAuth,
  labelTerminalProcess,
} from "../../hfm-status-display";
import { HFM_MW_PROVIDER, type HfmMwRealtimeHints } from "../types";
import { HfmProviderConnectionBadge } from "./HfmProviderStatus";

function sseFeedLabel(status: HfmMwRealtimeHints["sseStatus"]): string {
  switch (status) {
    case "connected":
      return "SSE connected";
    case "connecting":
      return "SSE connecting";
    case "reconnecting":
      return "SSE reconnecting";
    case "auth_required":
      return "SSE auth required";
    case "error":
      return "SSE error";
    case "idle":
      return "SSE idle";
    default:
      return `SSE ${String(status)}`;
  }
}

function sseFeedTone(status: HfmMwRealtimeHints["sseStatus"]): "live" | "wait" | "down" {
  if (status === "connected") return "live";
  if (status === "error" || status === "auth_required") return "down";
  return "wait";
}

export function HfmMarketWatchHeader({
  realtime,
  onRefresh,
  refreshEnabled,
}: {
  realtime: HfmMwRealtimeHints;
  onRefresh?: (() => void) | null;
  refreshEnabled: boolean;
}) {
  const login = realtime.accountLogin;
  const server = realtime.accountServer;
  const accountLabel = login
    ? `Account (Demo) ${login}${server ? ` · ${server}` : ""}`
    : "Account unavailable";
  const term = labelTerminalProcess(realtime.terminalRunning);
  const auth = labelMt5AgentAuth(realtime.authenticated, realtime.terminalRunning);
  const terminalLabel = `MT5 ${term.text.toLowerCase()}`;
  const terminalTone = term.tone === "ok" ? "live" : term.tone === "bad" ? "down" : "wait";
  const authLabel = `Agent ${auth.text.toLowerCase()}`;
  const authTone = auth.tone === "ok" ? "live" : auth.tone === "bad" ? "down" : "wait";

  return (
    <header className="hfm-mw-header">
      <div className="hfm-mw-header-titles">
        <h1>
          <span className="hfm-mw-header-icon" aria-hidden="true">
            ▦
          </span>
          Market Watch — HFM MT5
        </h1>
        <p>
          Live catalog and provider status from {HFM_MW_PROVIDER.provider} (
          {HFM_MW_PROVIDER.environment.toUpperCase()}). Read-only · no broker orders.
        </p>
      </div>
      <div className="hfm-mw-header-actions">
        <div
          className="hfm-mw-account-chip"
          data-empty={!login}
          title={login ? "Authorized HFM Demo account from live feed" : "No authorized account snapshot yet"}
        >
          {accountLabel}
        </div>
        <HfmProviderConnectionBadge realtime={realtime} />
        <span
          className="hfm-badge"
          data-tone={sseFeedTone(realtime.sseStatus)}
          title={realtime.lastError ?? "Browser SSE socket status (not broker health)"}
        >
          {sseFeedLabel(realtime.sseStatus)}
        </span>
        <span className="hfm-badge" data-tone={terminalTone} title="MT5 terminal process">
          {terminalLabel}
        </span>
        <span className="hfm-badge" data-tone={authTone} title="MQL5 agent authentication">
          {authLabel}
        </span>
        <span className="hfm-badge" data-tone="wait" title="Environment">
          DEMO
        </span>
        <span className="hfm-clock" title="Last successful SSE update age">
          Updated {formatAge(null, realtime.lastEventAt)}
        </span>
        <button
          type="button"
          className="hfm-mw-icon-btn"
          aria-label="Reconnect HFM realtime feed"
          disabled={!refreshEnabled || !onRefresh}
          onClick={() => onRefresh?.()}
          title={
            refreshEnabled
              ? "Restart HFM SSE connection"
              : "Reconnect available when feed is reconnecting or in error"
          }
        >
          ↻
        </button>
      </div>
    </header>
  );
}
