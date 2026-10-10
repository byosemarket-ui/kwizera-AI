/**
 * Phase 37B — compact Market Categories sidebar + functional instrument explorer.
 * Reuses Phase 36D/36F classification; never invents instruments or quotes.
 */
import { useEffect, useMemo, useState } from "react";
import type { MarketInstrument } from "../../ai/market-data/providers/types";
import {
  buildForexConnectCatalog,
  filterClassifiedInstruments,
  FOREXCONNECT_EXPLORER_CATEGORIES,
  type ClassifiedForexConnectInstrument,
  type ForexConnectExplorerCategoryId,
} from "../../ai/market-data/forexconnect/instrument-classify";
import type { ForexConnectInstrument } from "../../ai/market-data/forexconnect/types";
import { ForexEmptyState } from "./components/ForexEmptyState";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";

const PAGE_SIZE = 40;

/** Compact category marks — geometric letters only (no FXCM branding). */
const CATEGORY_MARK: Record<ForexConnectExplorerCategoryId, string> = {
  all: "∗",
  forex: "FX",
  forex_ndf: "ND",
  forex_baskets: "FB",
  indices: "IX",
  commodities: "CO",
  agriculture: "AG",
  metals: "MT",
  energy: "EN",
  cryptocurrency: "CR",
  shares_us: "US",
  shares_ca: "CA",
  shares_uk: "UK",
  shares_de: "DE",
  shares_fr: "FR",
  shares_nl: "NL",
  shares_jp: "JP",
  shares_hk: "HK",
  stock_baskets: "SB",
  treasury: "TB",
  etfs: "ET",
  other: "?",
};

function toFcInstrument(item: MarketInstrument): ForexConnectInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: item.providerSymbol,
    canonicalSymbol: item.canonicalSymbol,
    displaySymbol: item.displaySymbol,
    marketType: String(item.marketType),
    baseAsset: item.baseAsset,
    quoteAsset: item.quoteAsset,
    status: item.status,
    offerId: item.metadata?.offerId != null ? String(item.metadata.offerId) : null,
    source: item.metadata?.source != null ? String(item.metadata.source) : "forexconnect-offers",
    description: item.metadata?.description != null ? String(item.metadata.description) : item.displaySymbol,
    instrumentType: item.metadata?.instrumentType ?? null,
    instrumentTypeLabel: item.metadata?.instrumentTypeLabel != null
      ? String(item.metadata.instrumentTypeLabel)
      : null,
    contractCurrency: item.metadata?.contractCurrency != null
      ? String(item.metadata.contractCurrency)
      : null,
    tradingStatus: item.metadata?.tradingStatus != null ? String(item.metadata.tradingStatus) : null,
  };
}

function dataStatusLabel(item: ClassifiedForexConnectInstrument): string {
  if (item.dataAvailability === "SESSION_CLOSED") return "Session closed";
  if (item.dataAvailability === "AVAILABLE_IN_CATALOG") return "In catalog";
  return item.status || "unknown";
}

function dataStatusTone(item: ClassifiedForexConnectInstrument): "future" | "offline" {
  return item.dataAvailability === "SESSION_CLOSED" ? "offline" : "future";
}

function categoryLabel(id: ForexConnectExplorerCategoryId): string {
  return FOREXCONNECT_EXPLORER_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function ForexConnectMarketExplorer({
  instruments,
  catalogState,
  message,
  errorCode,
  selected,
  onSelect,
  onOpenCharts,
  onOpenTechnicalAnalysis,
  onRefresh,
  onOpenAdmin,
  environment,
  environmentLabel,
  fetchedAt,
}: {
  instruments: MarketInstrument[];
  catalogState: string;
  message: string;
  errorCode: string | null;
  selected: SelectedMarket | null;
  onSelect: (market: SelectedMarket) => void;
  onOpenCharts: () => void;
  onOpenTechnicalAnalysis?: () => void;
  onRefresh: () => void;
  onOpenAdmin?: () => void;
  environment?: string | null;
  environmentLabel?: string | null;
  fetchedAt?: string | null;
}) {
  const [categoryId, setCategoryId] = useState<ForexConnectExplorerCategoryId>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const catalog = useMemo(
    () => buildForexConnectCatalog(instruments.map(toFcInstrument), {
      environment: environment ?? null,
      environmentLabel: environmentLabel ?? null,
      fetchedAt: fetchedAt ?? null,
    }),
    [instruments, environment, environmentLabel, fetchedAt],
  );

  const filtered = useMemo(
    () => filterClassifiedInstruments(catalog.instruments, { categoryId, query }),
    [catalog.instruments, categoryId, query],
  );

  // Keep page window valid when category/search shrinks the list.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [categoryId, query]);

  const page = filtered.slice(0, visible);
  const envLabel = catalog.summary.environmentLabel
    || (catalog.summary.environment === "demo" ? "DEMO" : catalog.summary.environment)
    || environmentLabel
    || "—";

  const blocked = catalogState === "disabled"
    || catalogState === "not_configured"
    || catalogState === "auth_error"
    || catalogState === "error"
    || catalogState === "empty";

  if (catalogState === "loading") {
    return (
      <p className="fx-page-desc" role="status" data-fc-explorer-loading="true">
        Loading ForexConnect instrument catalog…
      </p>
    );
  }

  if (blocked && catalog.summary.deduplicatedCount === 0) {
    return (
      <div data-fc-explorer="blocked" data-fc-explorer-state={catalogState} data-phase="37b">
        <ForexEmptyState
          title={
            catalogState === "disabled"
              ? "ForexConnect is disabled on this server."
              : catalogState === "not_configured"
                ? "ForexConnect is not configured."
                : catalogState === "auth_error"
                  ? "ForexConnect authentication failed."
                  : catalogState === "empty"
                    ? "No ForexConnect instruments in the authenticated account."
                    : "Unable to load ForexConnect instruments."
          }
          description={message || errorCode || "Discover instruments from Admin after connecting DEMO."}
          actionLabel="Retry / Refresh"
          onAction={onRefresh}
        />
        {onOpenAdmin ? (
          <p className="fx-panel-meta">
            <button type="button" className="fx-text-button" onClick={onOpenAdmin}>
              Open Forex Admin → ForexConnect
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  const toSelectedMarket = (item: ClassifiedForexConnectInstrument): SelectedMarket => ({
    venue: "forexconnect",
    symbol: item.providerSymbol,
    displaySymbol: item.displaySymbol,
    provider: "FOREXCONNECT",
  });

  const selectInstrument = (item: ClassifiedForexConnectInstrument) => {
    onSelect(toSelectedMarket(item));
  };

  /** Phase 37B — selecting an instrument opens Charts with exact provider symbol. */
  const openInstrumentInCharts = (item: ClassifiedForexConnectInstrument) => {
    onSelect(toSelectedMarket(item));
    onOpenCharts();
  };

  const selectCategory = (id: ForexConnectExplorerCategoryId) => {
    setCategoryId(id);
    setMobileNavOpen(false);
  };

  return (
    <div
      className="fx-fc-explorer fx-market-explorer"
      data-fc-explorer="true"
      data-market-explorer="true"
      data-phase="37b"
      data-fc-explorer-total={String(catalog.summary.deduplicatedCount)}
      data-fc-explorer-raw={String(catalog.summary.rawCount)}
      data-fc-explorer-unclassified={String(catalog.summary.unclassifiedCount)}
      data-fc-explorer-env={String(envLabel)}
      data-fc-explorer-category={categoryId}
      data-mobile-nav-open={mobileNavOpen ? "true" : "false"}
    >
      <header className="fx-market-explorer-header">
        <div className="fx-market-explorer-identity">
          <h2 className="fx-market-explorer-title">Market Explorer</h2>
          <p className="fx-market-explorer-meta">
            FOREXCONNECT · {envLabel}
            {" · "}
            <span data-fc-explorer-deduped={String(catalog.summary.deduplicatedCount)}>
              {catalog.summary.deduplicatedCount} instruments
            </span>
            {catalog.summary.unclassifiedCount > 0
              ? ` · ${catalog.summary.unclassifiedCount} in Other`
              : ""}
          </p>
        </div>
        <div className="fx-market-explorer-actions">
          <button
            type="button"
            className="fx-text-button fx-market-explorer-cat-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="fx-market-category-nav"
            data-fc-explorer-cat-toggle="true"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? "Hide categories" : `Categories · ${categoryLabel(categoryId)}`}
          </button>
          <button type="button" className="fx-text-button" onClick={onRefresh} data-fc-explorer-refresh="true">
            Refresh catalog
          </button>
        </div>
      </header>

      <div className="fx-fc-explorer-layout fx-market-explorer-layout">
        <nav
          id="fx-market-category-nav"
          className={`fx-fc-explorer-nav fx-market-category-nav${mobileNavOpen ? " is-open" : ""}`}
          aria-label="Market categories"
          data-fc-category-nav="true"
        >
          <p className="fx-market-category-heading">Categories</p>
          {FOREXCONNECT_EXPLORER_CATEGORIES.map((cat) => {
            const count = catalog.summary.categoryCounts[cat.id] ?? 0;
            const empty = cat.id !== "all" && count === 0;
            return (
              <button
                key={cat.id}
                type="button"
                className={`fx-fc-explorer-cat fx-market-category${categoryId === cat.id ? " is-active" : ""}${empty ? " is-empty" : ""}`}
                aria-pressed={categoryId === cat.id}
                data-fc-category={cat.id}
                data-fc-category-count={String(count)}
                title={empty ? `${cat.label}: no instruments in this catalog` : cat.label}
                onClick={() => selectCategory(cat.id)}
              >
                <span className="fx-market-category-mark" aria-hidden="true">{CATEGORY_MARK[cat.id]}</span>
                <span className="fx-market-category-label">{cat.label}</span>
                <span className="fx-fc-explorer-count">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="fx-fc-explorer-main fx-market-instrument-panel">
          <div className="fx-fc-explorer-toolbar fx-market-instrument-toolbar">
            <label className="fx-markets-search fx-market-search">
              Search
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="EUR/USD, Gold, AAPL.us, US30…"
                aria-label="Search instruments in selected category"
                data-fc-explorer-search="true"
              />
            </label>
            <p className="fx-panel-meta" data-fc-explorer-filtered={String(filtered.length)}>
              {categoryLabel(categoryId)}
              {" · "}
              {page.length}/{filtered.length}
              {query.trim() ? ` · “${query.trim()}”` : ""}
            </p>
          </div>

          {categoryId !== "all" && (catalog.summary.categoryCounts[categoryId] ?? 0) === 0 && !query.trim() ? (
            <ForexEmptyState
              title={`${categoryLabel(categoryId)} has no instruments in this catalog.`}
              description="Empty categories are kept for navigation — they do not invent markets. Counts come from the authenticated ForexConnect Offers catalog only."
              actionLabel="Show all markets"
              onAction={() => selectCategory("all")}
            />
          ) : filtered.length === 0 ? (
            <ForexEmptyState
              title={
                query.trim()
                  ? "No instruments match this search in the selected category."
                  : "No ForexConnect instruments available."
              }
              description={
                query.trim()
                  ? "Search stays category-scoped. Clear the query or switch category — the selected workspace symbol is unchanged."
                  : "Categories are derived from the real Demo catalog."
              }
              actionLabel={query.trim() ? "Clear search" : "Show all markets"}
              onAction={() => {
                if (query.trim()) setQuery("");
                else selectCategory("all");
              }}
            />
          ) : (
            <div className="fx-markets-table-wrap fx-market-instrument-list">
              <table className="fx-markets-table" data-fc-explorer-table="true">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Symbol</th>
                    <th>Category</th>
                    <th>Quote</th>
                    <th>Data</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((item) => {
                    const active = selected?.venue === "forexconnect"
                      && selected.symbol === item.providerSymbol;
                    return (
                      <tr
                        key={`FOREXCONNECT:${item.providerSymbol}`}
                        data-selected={active ? "true" : "false"}
                        data-provider="FOREXCONNECT"
                        data-fc-category={item.categoryId}
                        data-fc-symbol={item.providerSymbol}
                        data-fc-availability={item.dataAvailability}
                        className={active ? "is-selected" : undefined}
                      >
                        <td>
                          <strong>{item.displaySymbol}</strong>
                          {item.searchAliases.length > 0 ? (
                            <span className="fx-panel-meta">
                              {" "}
                              ({item.searchAliases.slice(0, 2).join(", ").toLowerCase()})
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <code className="fx-market-symbol-code" data-fc-exact-symbol={item.providerSymbol}>
                            {item.providerSymbol}
                          </code>
                        </td>
                        <td>{item.categoryLabel}</td>
                        <td>
                          <span className="fx-panel-meta" data-fc-quote="unavailable">
                            No live quote
                          </span>
                        </td>
                        <td>
                          <ForexStatusBadge tone={dataStatusTone(item)}>
                            {dataStatusLabel(item)}
                          </ForexStatusBadge>
                        </td>
                        <td className="fx-market-row-actions">
                          <button
                            type="button"
                            className="fx-text-button"
                            aria-pressed={active}
                            data-fc-select={item.providerSymbol}
                            onClick={() => selectInstrument(item)}
                          >
                            {active ? "Selected" : "Select"}
                          </button>
                          <button
                            type="button"
                            className="fx-text-button fx-market-open-charts"
                            data-fc-open-charts={item.providerSymbol}
                            onClick={() => openInstrumentInCharts(item)}
                          >
                            Open Charts
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > visible ? (
            <button
              type="button"
              className="fx-text-button"
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
            >
              Show more instruments
            </button>
          ) : null}

          {selected?.venue === "forexconnect" ? (
            <p className="fx-panel-meta fx-market-selected-bar" data-fc-explorer-selected={selected.symbol}>
              Selected{" "}
              <code data-fc-selected-exact={selected.symbol}>{selected.symbol}</code>
              {" · "}
              Provider FOREXCONNECT · {envLabel}. Exact symbol preserved for Charts.{" "}
              <button type="button" className="fx-text-button" onClick={onOpenCharts}>
                Open Charts
              </button>
              {onOpenTechnicalAnalysis ? (
                <>
                  {" "}
                  <button type="button" className="fx-text-button" onClick={onOpenTechnicalAnalysis}>
                    Open Technical Analysis
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
