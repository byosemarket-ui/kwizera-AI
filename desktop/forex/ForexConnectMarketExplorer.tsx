/**
 * Phase 36D — ForexConnect Multi-Asset Market Explorer (existing Markets shell).
 */
import { useMemo, useState } from "react";
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
    contractCurrency: item.metadata?.contractCurrency != null
      ? String(item.metadata.contractCurrency)
      : null,
    tradingStatus: item.metadata?.tradingStatus != null ? String(item.metadata.tradingStatus) : null,
  };
}

function dataStatusLabel(item: ClassifiedForexConnectInstrument): string {
  if (item.status === "available") return "In catalog";
  return item.status || "unknown";
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
      <div data-fc-explorer="blocked" data-fc-explorer-state={catalogState}>
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

  const selectInstrument = (item: ClassifiedForexConnectInstrument) => {
    onSelect({
      venue: "forexconnect",
      symbol: item.providerSymbol,
      displaySymbol: item.displaySymbol,
      provider: "FOREXCONNECT",
    });
  };

  return (
    <div
      className="fx-fc-explorer"
      data-fc-explorer="true"
      data-fc-explorer-total={String(catalog.summary.deduplicatedCount)}
      data-fc-explorer-raw={String(catalog.summary.rawCount)}
      data-fc-explorer-unclassified={String(catalog.summary.unclassifiedCount)}
      data-fc-explorer-env={String(envLabel)}
      data-fc-explorer-category={categoryId}
    >
      <div className="fx-fc-explorer-header">
        <div>
          <p className="fx-eyebrow">ForexConnect Market Explorer</p>
          <p className="fx-panel-meta">
            Provider FOREXCONNECT · {envLabel}
            {" · "}
            {catalog.summary.deduplicatedCount} instruments
            {catalog.summary.rawCount !== catalog.summary.deduplicatedCount
              ? ` · ${catalog.summary.rawCount} raw / ${catalog.summary.deduplicatedCount} deduped`
              : ""}
            {catalog.summary.unclassifiedCount > 0
              ? ` · ${catalog.summary.unclassifiedCount} unclassified`
              : ""}
          </p>
          <p className="fx-panel-meta">
            Catalog from authenticated Offers table. LIVE only after Offers quote events — historical availability is separate.
          </p>
        </div>
        <button type="button" className="fx-text-button" onClick={onRefresh} data-fc-explorer-refresh="true">
          Refresh catalog
        </button>
      </div>

      <div className="fx-fc-explorer-layout">
        <nav className="fx-fc-explorer-nav" aria-label="ForexConnect categories">
          {FOREXCONNECT_EXPLORER_CATEGORIES.map((cat) => {
            const count = catalog.summary.categoryCounts[cat.id] ?? 0;
            const empty = cat.id !== "all" && count === 0;
            return (
              <button
                key={cat.id}
                type="button"
                className={`fx-fc-explorer-cat${categoryId === cat.id ? " is-active" : ""}${empty ? " is-empty" : ""}`}
                aria-pressed={categoryId === cat.id}
                data-fc-category={cat.id}
                data-fc-category-count={String(count)}
                onClick={() => {
                  setCategoryId(cat.id);
                  setVisible(PAGE_SIZE);
                }}
              >
                <span>{cat.label}</span>
                <span className="fx-fc-explorer-count">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="fx-fc-explorer-main">
          <div className="fx-fc-explorer-toolbar">
            <label className="fx-markets-search">
              Search ForexConnect
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="EUR/USD, AAPL.us, US30…"
                aria-label="Search ForexConnect instruments"
              />
            </label>
            <p className="fx-panel-meta" data-fc-explorer-filtered={String(filtered.length)}>
              Showing {page.length} of {filtered.length}
              {categoryId !== "all"
                ? ` · ${FOREXCONNECT_EXPLORER_CATEGORIES.find((c) => c.id === categoryId)?.label}`
                : ""}
            </p>
          </div>

          {filtered.length === 0 ? (
            <ForexEmptyState
              title={
                query.trim()
                  ? "No instruments match this search."
                  : categoryId === "all"
                    ? "No ForexConnect instruments available."
                    : "This category has no instruments in the authenticated account."
              }
              description={
                query.trim()
                  ? "Try another symbol or clear the search."
                  : "Categories are derived from the real Demo catalog — empty categories are not fabricated."
              }
              actionLabel="Clear filters"
              onAction={() => {
                setQuery("");
                setCategoryId("all");
              }}
            />
          ) : (
            <div className="fx-markets-table-wrap">
              <table className="fx-markets-table" data-fc-explorer-table="true">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Category</th>
                    <th>Offer</th>
                    <th>Data</th>
                    <th>Select</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((item) => {
                    const active = selected?.venue === "forexconnect"
                      && selected.symbol === item.providerSymbol;
                    return (
                      <tr
                        key={`FOREXCONNECT:${item.canonicalSymbol}`}
                        data-selected={active ? "true" : "false"}
                        data-provider="FOREXCONNECT"
                        data-fc-category={item.categoryId}
                        data-fc-symbol={item.providerSymbol}
                      >
                        <td>
                          <strong>{item.displaySymbol}</strong>
                          <span className="fx-panel-meta"> {item.providerSymbol}</span>
                        </td>
                        <td>{item.categoryLabel}</td>
                        <td>{item.offerId ?? "—"}</td>
                        <td>
                          <ForexStatusBadge tone="future">
                            {dataStatusLabel(item)}
                          </ForexStatusBadge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="fx-text-button"
                            aria-pressed={active}
                            onClick={() => selectInstrument(item)}
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
            <p className="fx-panel-meta" data-fc-explorer-selected={selected.symbol}>
              Selected {selected.displaySymbol} · Provider FOREXCONNECT · {envLabel}.
              Charts and Technical Analysis use this exact provider symbol.{" "}
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
