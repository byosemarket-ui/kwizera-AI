import { useMemo, useState } from "react";
import { filterBinanceMarkets } from "../../ai/market-data/binance/adapter";
import type { LiveTickerSnapshot, NormalizedMarket } from "../../ai/market-data/binance/types";
import type { MarketInstrument, MarketProviderId } from "../../ai/market-data/providers/types";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { ForexEmptyState } from "./components/ForexEmptyState";
import { ForexConnectMarketExplorer } from "./ForexConnectMarketExplorer";
import { useBinanceMarkets } from "./market-data/use-binance-markets";
import { useUnifiedInstruments } from "./market-data/use-unified-instruments";
import type { SelectedMarket } from "./market-data/selected-market";
import { LiveTickerPanel } from "./LiveTickerPanel";

const PAGE_SIZE = 50;
const QUOTE_FILTERS = ["ALL", "USDT", "USDC", "BTC", "ETH", "BNB"] as const;

function statusTone(market: NormalizedMarket): "future" | "offline" {
  return market.tradable ? "future" : "offline";
}

function instrumentTone(instrument: MarketInstrument): "future" | "offline" {
  return instrument.status === "available" ? "future" : "offline";
}

function fxcmEmptyTitle(state: string): string {
  if (state === "disabled") return "FXCM is disabled on this server.";
  if (state === "not_configured") return "FXCM is not configured.";
  if (state === "auth_error") return "FXCM authentication failed.";
  if (state === "error") return "Unable to load FXCM instruments.";
  return "No FXCM instruments available.";
}

export function ForexMarketsPage({
  selected,
  onSelect,
  onClearSelection,
  liveTicker,
  onOpenCharts,
  onOpenTechnicalAnalysis,
  onOpenAdmin,
}: {
  selected: SelectedMarket | null;
  onSelect: (market: SelectedMarket) => void;
  onClearSelection?: () => void;
  liveTicker?: LiveTickerSnapshot | null;
  onOpenCharts: () => void;
  onOpenTechnicalAnalysis?: () => void;
  onOpenAdmin?: () => void;
}) {
  const [providerFilter, setProviderFilter] = useState<"ALL" | MarketProviderId>("ALL");
  const { result, refresh } = useBinanceMarkets();
  const fxcmCatalog = useUnifiedInstruments({
    provider: "FXCM",
    enabled: providerFilter === "ALL" || providerFilter === "FXCM",
  });
  const forexConnectCatalog = useUnifiedInstruments({
    provider: "FOREXCONNECT",
    enabled: providerFilter === "ALL" || providerFilter === "FOREXCONNECT",
  });
  const [query, setQuery] = useState("");
  const [quote, setQuote] = useState<(typeof QUOTE_FILTERS)[number]>("ALL");
  const [tradable, setTradable] = useState<"all" | "trading" | "not-trading">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filteredBinance = useMemo(
    () => filterBinanceMarkets(result.markets, {
      query,
      quoteAsset: quote === "ALL" ? "" : quote,
      tradable,
    }),
    [result.markets, query, quote, tradable],
  );

  const filteredFxcm = useMemo(() => {
    const q = query.trim().toUpperCase();
    return fxcmCatalog.instruments.filter((item) => {
      if (!q) return true;
      const hay = `${item.providerSymbol} ${item.canonicalSymbol} ${item.displaySymbol}`.toUpperCase();
      return hay.includes(q);
    });
  }, [fxcmCatalog.instruments, query]);

  const showBinance = providerFilter === "ALL" || providerFilter === "BINANCE";
  const showFxcm = providerFilter === "ALL" || providerFilter === "FXCM";
  const showForexConnect = providerFilter === "ALL" || providerFilter === "FOREXCONNECT";
  const binancePage = showBinance ? filteredBinance.slice(0, visible) : [];
  const fxcmPage = showFxcm ? filteredFxcm.slice(0, visible) : [];
  const forexConnectEnv = forexConnectCatalog.instruments[0]?.metadata?.environment != null
    ? String(forexConnectCatalog.instruments[0]!.metadata!.environment)
    : null;
  const forexConnectEnvLabel = forexConnectCatalog.instruments[0]?.metadata?.environmentLabel != null
    ? String(forexConnectCatalog.instruments[0]!.metadata!.environmentLabel)
    : null;
  const selectedSymbol = selected?.venue === "binance-spot"
    || selected?.venue === "fxcm"
    || selected?.venue === "forexconnect"
    ? selected.symbol
    : null;

  const changeProviderFilter = (next: "ALL" | MarketProviderId) => {
    setProviderFilter(next);
    setVisible(PAGE_SIZE);
    // Clearing incompatible selection prevents silent cross-provider symbol mapping.
    if (next === "FXCM" && selected?.venue === "binance-spot") onClearSelection?.();
    if (next === "FOREXCONNECT" && selected?.venue === "binance-spot") onClearSelection?.();
    if (next === "BINANCE" && (selected?.venue === "fxcm" || selected?.venue === "forexconnect")) {
      onClearSelection?.();
    }
  };

  const fxcmBlocked = showFxcm && (
    fxcmCatalog.state === "disabled"
    || fxcmCatalog.state === "not_configured"
    || fxcmCatalog.state === "auth_error"
    || fxcmCatalog.state === "error"
    || (fxcmCatalog.state === "empty" && providerFilter === "FXCM")
  );

  return (
    <section
      className="fx-markets-page"
      data-forex-page="markets"
      data-forex-markets="true"
      data-market-symbol={selectedSymbol ?? ""}
      data-provider-filter={providerFilter}
      data-fxcm-catalog-state={fxcmCatalog.state}
      data-fxcm-error-code={fxcmCatalog.errorCode ?? ""}
    >
      <ForexSectionHeader
        eyebrow="Market"
        title="Markets"
        description="Unified provider-aware catalog. Binance Spot, FXCM Socket REST, and ForexConnect instruments stay isolated — selection updates the shared workspace market."
      />

      <p className="fx-panel-meta" role="note">
        Provider identity is required. ForexConnect, FXCM Socket REST, and Binance Crypto never share the same market identity.
      </p>

      {selectedSymbol && selected?.venue === "binance-spot" && liveTicker ? (
        <div className="fx-markets-selected-ticker" data-markets-selected-ticker={selectedSymbol}>
          <p className="fx-panel-meta">
            Active workspace market · {selected.displaySymbol} · Provider BINANCE
          </p>
          <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedSymbol} compact />
        </div>
      ) : null}
      {selected?.venue === "fxcm" ? (
        <p className="fx-panel-meta" data-markets-selected-fxcm={selected.symbol}>
          Active workspace market · {selected.displaySymbol} · Provider FXCM · Market FOREX
        </p>
      ) : null}
      {selected?.venue === "forexconnect" ? (
        <p className="fx-panel-meta" data-markets-selected-forexconnect={selected.symbol}>
          Active workspace market · {selected.displaySymbol} · Provider FOREXCONNECT · multi-asset catalog · bid OHLC when historical
        </p>
      ) : null}

      <div className="fx-markets-toolbar">
        <label>
          Provider
          <select
            aria-label="Filter by provider"
            value={providerFilter}
            onChange={(event) => {
              changeProviderFilter(event.target.value as "ALL" | MarketProviderId);
            }}
          >
            <option value="ALL">All providers</option>
            <option value="BINANCE">Binance</option>
            <option value="FXCM">FXCM</option>
            <option value="FOREXCONNECT">ForexConnect</option>
          </select>
        </label>
        <label className="fx-markets-search">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="BTCUSDT, EUR/USD…"
            aria-label="Search markets"
          />
        </label>
        {showBinance ? (
          <>
            <label>
              Quote
              <select
                aria-label="Filter by quote asset"
                value={quote}
                onChange={(event) => {
                  setQuote(event.target.value as (typeof QUOTE_FILTERS)[number]);
                  setVisible(PAGE_SIZE);
                }}
              >
                {QUOTE_FILTERS.map((item) => (
                  <option key={item} value={item}>{item === "ALL" ? "All quotes" : item}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Filter by market status"
                value={tradable}
                onChange={(event) => {
                  setTradable(event.target.value as "all" | "trading" | "not-trading");
                  setVisible(PAGE_SIZE);
                }}
              >
                <option value="all">All statuses</option>
                <option value="trading">Trading</option>
                <option value="not-trading">Not trading</option>
              </select>
            </label>
          </>
        ) : null}
        <button
          type="button"
          className="fx-text-button"
          onClick={() => {
            refresh();
            fxcmCatalog.refresh();
            forexConnectCatalog.refresh();
          }}
        >
          Refresh
        </button>
      </div>

      {showBinance && result.state === "loading" ? (
        <p className="fx-page-desc" role="status">Loading Binance markets...</p>
      ) : null}
      {showFxcm && fxcmCatalog.state === "loading" ? (
        <p className="fx-page-desc" role="status" data-fxcm-loading="true">Loading FXCM instruments...</p>
      ) : null}
      {showBinance && result.state === "disconnected" ? (
        <ForexEmptyState title="Binance market service unavailable." description={result.message} actionLabel="Retry" onAction={refresh} />
      ) : null}
      {showBinance && result.state === "error" ? (
        <ForexEmptyState title="Unable to load Binance markets." description={result.message} actionLabel="Retry" onAction={refresh} />
      ) : null}

      {fxcmBlocked ? (
        <ForexEmptyState
          title={fxcmEmptyTitle(fxcmCatalog.state)}
          description={fxcmCatalog.message}
          actionLabel="Retry"
          onAction={fxcmCatalog.refresh}
        />
      ) : null}
      {fxcmBlocked && onOpenAdmin ? (
        <p className="fx-panel-meta">
          Server-side FXCM setup:{" "}
          <button type="button" className="fx-text-button" onClick={onOpenAdmin}>
            Open Forex Admin
          </button>
          {" "}(authentication / provider status). Credentials never leave the server.
        </p>
      ) : null}

      {showBinance && result.state === "ready" && binancePage.length > 0 ? (
        <>
          <p className="fx-panel-meta">
            Binance · Showing {binancePage.length} of {filteredBinance.length} Spot markets
            {result.restBaseHost ? ` · ${result.restBaseHost}` : ""}
          </p>
          <div className="fx-markets-table-wrap">
            <table className="fx-markets-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Symbol</th>
                  <th>Base</th>
                  <th>Quote</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {binancePage.map((market) => {
                  const active = selected?.venue === "binance-spot" && market.symbol === selected.symbol;
                  return (
                    <tr key={`BINANCE:${market.symbol}`} data-selected={active ? "true" : "false"} data-provider="BINANCE">
                      <td>BINANCE</td>
                      <td>
                        <strong>{market.symbol}</strong>
                        <span className="fx-panel-meta"> {market.displaySymbol}</span>
                      </td>
                      <td>{market.baseAsset}</td>
                      <td>{market.quoteAsset}</td>
                      <td>Crypto</td>
                      <td>
                        <ForexStatusBadge tone={statusTone(market)}>
                          {market.status}
                        </ForexStatusBadge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fx-text-button"
                          aria-pressed={active}
                          onClick={() => onSelect({
                            venue: "binance-spot",
                            symbol: market.symbol,
                            displaySymbol: market.displaySymbol,
                            provider: "BINANCE",
                          })}
                        >
                          {active ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {showFxcm && fxcmPage.length > 0 ? (
        <>
          <p className="fx-panel-meta">
            FXCM · Showing {fxcmPage.length} of {filteredFxcm.length} instruments
          </p>
          <div className="fx-markets-table-wrap">
            <table className="fx-markets-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Symbol</th>
                  <th>Base</th>
                  <th>Quote</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {fxcmPage.map((instrument) => {
                  const active = selected?.venue === "fxcm"
                    && selected.symbol.replace(/[/_-\s]/g, "").toUpperCase()
                      === instrument.canonicalSymbol.toUpperCase();
                  return (
                    <tr
                      key={`FXCM:${instrument.marketType}:${instrument.canonicalSymbol}`}
                      data-selected={active ? "true" : "false"}
                      data-provider="FXCM"
                    >
                      <td>FXCM</td>
                      <td>
                        <strong>{instrument.displaySymbol}</strong>
                        <span className="fx-panel-meta"> {instrument.canonicalSymbol}</span>
                      </td>
                      <td>{instrument.baseAsset ?? "—"}</td>
                      <td>{instrument.quoteAsset ?? "—"}</td>
                      <td>{instrument.marketType}</td>
                      <td>
                        <ForexStatusBadge tone={instrumentTone(instrument)}>
                          {instrument.status}
                        </ForexStatusBadge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fx-text-button"
                          aria-pressed={active}
                          onClick={() => onSelect({
                            venue: "fxcm",
                            symbol: instrument.providerSymbol,
                            displaySymbol: instrument.displaySymbol,
                            provider: "FXCM",
                          })}
                        >
                          {active ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {showForexConnect ? (
        <ForexConnectMarketExplorer
          instruments={forexConnectCatalog.instruments}
          catalogState={forexConnectCatalog.state}
          message={forexConnectCatalog.message}
          errorCode={forexConnectCatalog.errorCode}
          selected={selected}
          onSelect={onSelect}
          onOpenCharts={onOpenCharts}
          onOpenTechnicalAnalysis={onOpenTechnicalAnalysis}
          onRefresh={forexConnectCatalog.refresh}
          onOpenAdmin={onOpenAdmin}
          environment={forexConnectEnv}
          environmentLabel={forexConnectEnvLabel}
        />
      ) : null}

      {(binancePage.length > 0 || fxcmPage.length > 0) && (
        <button type="button" className="fx-text-button" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
          Show more markets
        </button>
      )}

      {selectedSymbol ? (
        <p className="fx-panel-meta">
          Selected {selected?.displaySymbol ?? selectedSymbol}
          {selected?.provider ? ` · Provider ${selected.provider}` : ""}.
          Charts and Technical Analysis use this same workspace market.{" "}
          <button type="button" className="fx-text-button" onClick={onOpenCharts}>Open Charts</button>
        </p>
      ) : null}
    </section>
  );
}
