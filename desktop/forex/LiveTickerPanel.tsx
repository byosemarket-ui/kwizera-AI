import { ForexStatusBadge } from "./components/ForexStatusBadge";
import {
  liveTickerPriceLabel,
  liveTickerStatusLabel,
  liveTickerStatusTone,
  type LiveTickerSnapshot,
} from "../../ai/market-data/binance/live-ticker";

export function LiveTickerPanel({
  snapshot,
  compact = false,
}: {
  snapshot: LiveTickerSnapshot;
  compact?: boolean;
}) {
  const live = snapshot.liveMarketData && snapshot.ticker;
  return (
    <div
      className={`fx-live-ticker ${compact ? "is-compact" : ""}`}
      data-live-ticker="true"
      data-ws-state={snapshot.connectionState}
      data-live-market={snapshot.liveMarketData ? "true" : "false"}
      data-live-symbol={snapshot.ticker?.symbol ?? snapshot.subscribedSymbol ?? ""}
      data-live-price={live ? String(snapshot.ticker!.price) : ""}
      data-live-stream={snapshot.streamType}
      data-ws-host={snapshot.websocketHost ?? ""}
    >
      <ForexStatusBadge tone={liveTickerStatusTone(snapshot)}>
        {live ? "LIVE" : liveTickerStatusLabel(snapshot)}
      </ForexStatusBadge>
      <p className="fx-live-price" data-price-kind={live ? "live" : "unavailable"}>
        {liveTickerPriceLabel(snapshot)}
      </p>
      {!compact ? (
        <p className="fx-panel-meta">
          {live
            ? `${snapshot.ticker!.displaySymbol} miniTicker · ${snapshot.websocketHost ?? "Binance"}`
            : snapshot.message}
        </p>
      ) : null}
    </div>
  );
}
