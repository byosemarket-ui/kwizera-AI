import {
  mapHfmProviderUiStatus,
  providerUiStatusLabel,
  providerUiStatusTone,
} from "../provider-status";
import { HFM_MW_PROVIDER, type HfmMwRealtimeHints } from "../types";

export function HfmProviderStatus({
  realtime,
  compact = false,
}: {
  realtime: HfmMwRealtimeHints;
  compact?: boolean;
}) {
  const status = mapHfmProviderUiStatus(realtime);
  const tone = providerUiStatusTone(status);
  const label = providerUiStatusLabel(status);

  if (compact) {
    return (
      <div
        className="hfm-mw-conn-footer"
        data-tone={tone}
        role="status"
        aria-label={`${HFM_MW_PROVIDER.label} ${label}`}
      >
        <span className="hfm-mw-live-dot" data-tone={tone} aria-hidden="true" />
        <span>
          {HFM_MW_PROVIDER.platform} · {label}
        </span>
      </div>
    );
  }

  return (
    <div className="hfm-mw-provider-card" role="group" aria-label="HFM provider identity">
      <div className="hfm-mw-provider-mark" aria-hidden="true">
        HFM
      </div>
      <div>
        <strong>{HFM_MW_PROVIDER.label}</strong>
        <span>
          {HFM_MW_PROVIDER.provider} · {HFM_MW_PROVIDER.environment.toUpperCase()} ·{" "}
          {HFM_MW_PROVIDER.platform}
        </span>
      </div>
      <span
        className="hfm-mw-live-dot"
        data-tone={tone}
        title={label}
        aria-label={label}
      />
    </div>
  );
}

export function HfmProviderConnectionBadge({ realtime }: { realtime: HfmMwRealtimeHints }) {
  const status = mapHfmProviderUiStatus(realtime);
  const tone = providerUiStatusTone(status);
  const label = providerUiStatusLabel(status);
  return (
    <span className="hfm-badge" data-tone={tone === "live" ? "live" : tone === "down" ? "down" : "wait"}>
      <span className="hfm-mw-live-dot" data-tone={tone} aria-hidden="true" />
      {label}
    </span>
  );
}
