import { ForexStatusBadge } from "./components/ForexStatusBadge";
import {
  liveTickerPriceLabel,
  type LiveTickerSnapshot,
} from "../../ai/market-data/binance/live-ticker";
import {
  formatLastUpdateUtc,
  liveMarketStatusLabel,
  liveMarketStatusTone,
  resolveTickerUiStatus,
  tickerMatchesSelection,
} from "./market-data/live-market-status";

export function LiveTickerPanel({
  snapshot,
  expectedSymbol,
  compact = false,
}: {
  snapshot: LiveTickerSnapshot;
  /** When set, LIVE/price only appear for this Binance symbol. */
  expectedSymbol?: string | null;
  compact?: boolean;
}) {
  const status = resolveTickerUiStatus(snapshot, expectedSymbol ?? snapshot.subscribedSymbol);
  const live = status === "LIVE" && tickerMatchesSelection(snapshot, expectedSymbol ?? snapshot.subscribedSymbol);
  const priceLabel = live
    ? liveTickerPriceLabel(snapshot)
    : status === "CONNECTING" || status === "CONNECTED" || status === "RECONNECTING"
      ? liveMarketStatusLabel(status)
      : expectedSymbol
        ? liveMarketStatusLabel(status)
        : liveTickerPriceLabel(snapshot);

  return (
    <div
      className={`fx-live-ticker ${compact ? "is-compact" : ""}`}
      data-live-ticker="true"
      data-ws-state={snapshot.connectionState}
      data-live-market={live ? "true" : "false"}
      data-live-status={status}
      data-live-symbol={live ? snapshot.ticker!.symbol : (expectedSymbol ?? snapshot.subscribedSymbol ?? "")}
      data-live-price={live ? String(snapshot.ticker!.price) : ""}
      data-live-stream={snapshot.streamType}
      data-ws-host={snapshot.websocketHost ?? ""}
      data-last-update={live ? String(snapshot.ticker!.eventTimeUtc) : ""}
    >
      <ForexStatusBadge tone={liveMarketStatusTone(status)}>
        {liveMarketStatusLabel(status)}
      </ForexStatusBadge>
      <p className="fx-live-price" data-price-kind={live ? "live" : "unavailable"}>
        {priceLabel}
      </p>
      {!compact ? (
        <p className="fx-panel-meta">
          {live
            ? `${snapshot.ticker!.displaySymbol} miniTicker · ${snapshot.websocketHost ?? "Binance"} · updated ${formatLastUpdateUtc(snapshot.ticker!.eventTimeUtc)}`
            : snapshot.message}
        </p>
      ) : null}
    </div>
  );
}
