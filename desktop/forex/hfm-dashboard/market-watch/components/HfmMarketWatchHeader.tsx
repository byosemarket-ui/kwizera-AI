import { formatAge } from "../../format";
import { HFM_MW_PROVIDER, type HfmMwRealtimeHints } from "../types";
import { HfmProviderConnectionBadge } from "./HfmProviderStatus";

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
