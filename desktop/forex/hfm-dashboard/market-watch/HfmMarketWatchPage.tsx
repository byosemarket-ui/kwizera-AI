import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmCanonicalQuote } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmSubscriptionRecord } from "../../../../ai/market-data/mt5-hfm/subscription-types";
import { restartHfmRealtimeStore, useHfmRealtimeStore } from "../hfm-realtime-store";
import {
  fetchHfmAllSymbols,
  fetchHfmMarketWatchCatalog,
  fetchHfmQuotesSnapshot,
  fetchHfmSubscriptions,
  HfmMwApiError,
  pauseHfmSubscription,
  resumeHfmSubscription,
  subscribeHfmSymbols,
  unsubscribeHfmSymbols,
} from "./api";
import { HfmMarketCategories } from "./components/HfmMarketCategories";
import { HfmMarketOverview } from "./components/HfmMarketOverview";
import { HfmMarketWatchHeader } from "./components/HfmMarketWatchHeader";
import {
  HfmMarketWatchEmptyState,
  HfmMarketWatchErrorState,
  HfmMarketWatchLoadingState,
} from "./components/HfmMarketWatchStates";
import { HfmInstrumentsTable } from "./components/HfmInstrumentsTable";
import { HfmMarketPagination, HfmMarketToolbar } from "./components/HfmMarketToolbar";
import { HfmQuoteStatusStrip } from "./components/HfmQuoteStatusStrip";
import { HfmSelectedInstrumentPanel } from "./components/HfmSelectedInstrumentPanel";
import { HfmTradingSessionsPanel } from "./components/HfmTradingSessionsPanel";
import { listHfmFavoriteSymbols, toggleHfmFavorite } from "./favorites-store";
import {
  buildInstrumentRows,
  filterInstrumentRows,
  paginateRows,
  sortInstrumentRows,
  type HfmMwQuoteStatusFilter,
  type HfmMwSortId,
  type HfmMwSubscriptionFilter,
} from "./instrument-query";
import { unavailableMovementSummary } from "./movement";
import {
  resolveTradingSessionOverview,
  sessionsFromInstrumentMetadata,
} from "./sessions";
import {
  countQuoteAndSubscriptionStatuses,
  mergeSseQuotesIntoCanonicalMap,
} from "./sse-quote-bridge";
import type {
  HfmMwCatalogSummary,
  HfmMwCategoryFilter,
  HfmMwLoadState,
  HfmMwRealtimeHints,
} from "./types";
import {
  addSymbolToHfmWatchlist,
  createHfmWatchlist,
  deleteHfmWatchlist,
  listHfmWatchlists,
  removeSymbolFromHfmWatchlist,
  renameHfmWatchlist,
  type HfmMwWatchlist,
} from "./watchlists-store";
import "./hfm-market-watch.css";

export function HfmMarketWatchPage({ realtime }: { realtime: HfmMwRealtimeHints }) {
  const sseState = useHfmRealtimeStore();
  const [load, setLoad] = useState<HfmMwLoadState>({ catalog: "idle", catalogError: null });
  const [catalog, setCatalog] = useState<HfmMwCatalogSummary | null>(null);
  const [instruments, setInstruments] = useState<HfmCatalogInstrument[]>([]);
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, HfmCanonicalQuote>>({});
  const [subsBySymbol, setSubsBySymbol] = useState<Record<string, HfmSubscriptionRecord>>({});
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => listHfmFavoriteSymbols());
  const [watchlists, setWatchlists] = useState<HfmMwWatchlist[]>(() => listHfmWatchlists());
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const [category, setCategory] = useState<HfmMwCategoryFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [quoteStatus, setQuoteStatus] = useState<HfmMwQuoteStatusFilter>("ALL");
  const [subscriptionFilter, setSubscriptionFilter] = useState<HfmMwSubscriptionFilter>("SUBSCRIBED");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<HfmMwSortId>("symbol_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [busySymbol, setBusySymbol] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async (signal: AbortSignal) => {
    setLoad({ catalog: "loading", catalogError: null });
    try {
      const [summary, allSymbols, quotes, subs] = await Promise.all([
        fetchHfmMarketWatchCatalog(signal),
        fetchHfmAllSymbols({ signal }),
        fetchHfmQuotesSnapshot(signal),
        fetchHfmSubscriptions(signal),
      ]);
      if (signal.aborted) return;
      setCatalog(summary);
      setInstruments(allSymbols.symbols);
      setQuotesBySymbol(quotes.quotesBySymbol);
      setSubsBySymbol(subs.bySymbol);
      const ok = summary.available && allSymbols.available;
      setLoad({
        catalog: ok ? "ready" : "error",
        catalogError: ok
          ? null
          : summary.unavailableReason ?? allSymbols.unavailableReason ?? "HFM catalog unavailable",
      });
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof HfmMwApiError && (err.code === "AUTH_REQUIRED" || err.code === "AUTH_REJECTED")) {
        setCatalog(null);
        setInstruments([]);
        setLoad({ catalog: "auth_required", catalogError: err.message });
        return;
      }
      setCatalog(null);
      setInstruments([]);
      setLoad({
        catalog: "error",
        catalogError: err instanceof Error ? err.message : "Failed to load HFM Market Watch data",
      });
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadAll(ac.signal);
    return () => ac.abort();
  }, [loadAll, reloadToken]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const refreshOverlays = useCallback(async () => {
    try {
      const [quotes, subs] = await Promise.all([
        fetchHfmQuotesSnapshot(),
        fetchHfmSubscriptions(),
      ]);
      setQuotesBySymbol(quotes.quotesBySymbol);
      setSubsBySymbol(subs.bySymbol);
    } catch {
      // Keep last-known overlays; table status remains from prior snapshot.
    }
  }, []);

  // Light REST overlay poll so Bid/Ask keep advancing even if SSE misses a tick.
  useEffect(() => {
    if (load.catalog !== "ready") return;
    const id = setInterval(() => {
      void refreshOverlays();
    }, 5000);
    return () => clearInterval(id);
  }, [load.catalog, refreshOverlays]);

  const movement = useMemo(() => unavailableMovementSummary(), []);
  const sessionOverview = useMemo(() => resolveTradingSessionOverview(null), []);

  const mergedQuotes = useMemo(
    () => mergeSseQuotesIntoCanonicalMap(quotesBySymbol, sseState.quotes),
    [quotesBySymbol, sseState.quotes],
  );

  const rows = useMemo(
    () =>
      buildInstrumentRows({
        instruments,
        quotesBySymbol: mergedQuotes,
        subscriptionsBySymbol: subsBySymbol,
        favoriteSymbols,
      }),
    [instruments, mergedQuotes, subsBySymbol, favoriteSymbols],
  );

  const statusCounts = useMemo(() => countQuoteAndSubscriptionStatuses(rows), [rows]);

  const watchlistSymbolSet = useMemo(() => {
    if (!watchlistOnly || !activeWatchlistId) return null;
    const wl = watchlists.find((w) => w.id === activeWatchlistId);
    return wl ? new Set(wl.symbols) : new Set<string>();
  }, [watchlistOnly, activeWatchlistId, watchlists]);

  const filtered = useMemo(
    () =>
      filterInstrumentRows(rows, {
        search,
        category,
        quoteStatus,
        subscription: subscriptionFilter,
        favoritesOnly,
        watchlistSymbols: watchlistSymbolSet,
      }),
    [rows, search, category, quoteStatus, subscriptionFilter, favoritesOnly, watchlistSymbolSet],
  );

  const sorted = useMemo(() => sortInstrumentRows(filtered, sort), [filtered, sort]);
  const paged = useMemo(() => paginateRows(sorted, page, pageSize), [sorted, page, pageSize]);

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  const selectedInstrument = useMemo(
    () => (selectedSymbol ? instruments.find((i) => i.symbol === selectedSymbol) ?? null : null),
    [instruments, selectedSymbol],
  );
  const selectedQuote = selectedSymbol
    ? mergedQuotes[selectedSymbol] ?? mergedQuotes[selectedSymbol.toUpperCase()] ?? null
    : null;
  const selectedSub = selectedSymbol ? subsBySymbol[selectedSymbol] ?? null : null;
  const selectedSessions = useMemo(
    () => sessionsFromInstrumentMetadata(selectedInstrument?.sessions ?? null, { symbol: selectedSymbol }),
    [selectedInstrument, selectedSymbol],
  );

  const refreshEnabled =
    realtime.sseStatus === "reconnecting" ||
    realtime.sseStatus === "error" ||
    realtime.sseStatus === "idle";

  async function runSubOp(symbol: string, op: () => Promise<{ ok: boolean; reason?: string | null }>) {
    setBusySymbol(symbol);
    setActionMessage(null);
    try {
      const result = await op();
      await refreshOverlays();
      setActionMessage(result.ok ? `Updated subscription for ${symbol}` : result.reason ?? `Failed for ${symbol}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Subscription operation failed");
    } finally {
      setBusySymbol(null);
    }
  }

  return (
    <div className="hfm-mw-page" data-hfm-market-watch="true" data-hfm-step="3b">
      <HfmMarketWatchHeader
        realtime={realtime}
        refreshEnabled={refreshEnabled}
        onRefresh={() => {
          restartHfmRealtimeStore();
          setReloadToken((n) => n + 1);
        }}
      />

      <HfmMarketOverview
        load={load}
        catalog={catalog}
        movement={movement}
        session={sessionOverview}
      />

      <div className="hfm-mw-toolbar-block">
        <HfmMarketCategories
          load={load}
          catalog={catalog}
          active={category}
          onSelect={(next) => {
            setCategory(next);
            setPage(1);
          }}
        />
        <HfmMarketToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          sort={sort}
          onSortChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          quoteStatus={quoteStatus}
          onQuoteStatusChange={(v) => {
            setQuoteStatus(v);
            setPage(1);
          }}
          subscription={subscriptionFilter}
          onSubscriptionChange={(v) => {
            setSubscriptionFilter(v);
            setPage(1);
          }}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={(v) => {
            setFavoritesOnly(v);
            setPage(1);
          }}
          pageSize={pageSize}
          onPageSizeChange={(v) => {
            setPageSize(v);
            setPage(1);
          }}
          resultCount={sorted.length}
          onClearFilters={() => {
            setSearchInput("");
            setSearch("");
            setCategory("ALL");
            setQuoteStatus("ALL");
            setSubscriptionFilter("ALL");
            setFavoritesOnly(false);
            setWatchlistOnly(false);
            setActiveWatchlistId(null);
            setSort("symbol_asc");
            setPage(1);
          }}
        />
        <HfmQuoteStatusStrip
          catalogTotal={catalog?.available ? catalog.totalInstruments : null}
          counts={statusCounts}
          ready={load.catalog === "ready"}
        />
        <div className="hfm-mw-watchlist-bar">
          <label className="hfm-mw-select">
            <span className="hfm-sr-only">Watchlist filter</span>
            <select
              value={activeWatchlistId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setActiveWatchlistId(id);
                setWatchlistOnly(Boolean(id));
                setPage(1);
              }}
              aria-label="Filter by HFM watchlist"
            >
              <option value="">All instruments (no watchlist filter)</option>
              {watchlists.map((wl) => (
                <option key={wl.id} value={wl.id}>
                  Watchlist: {wl.name} ({wl.symbols.length})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="hfm-mw-retry"
            disabled={!activeWatchlistId}
            onClick={() => {
              if (!activeWatchlistId) return;
              const current = watchlists.find((w) => w.id === activeWatchlistId);
              const name =
                typeof window !== "undefined"
                  ? window.prompt("Rename HFM watchlist", current?.name ?? "")
                  : null;
              if (!name) return;
              const r = renameHfmWatchlist(activeWatchlistId, name);
              setWatchlists(listHfmWatchlists());
              setActionMessage(r.ok ? `Renamed watchlist to ${r.list?.name}` : r.error);
            }}
          >
            Rename list
          </button>
          <button
            type="button"
            className="hfm-mw-retry"
            disabled={!activeWatchlistId}
            onClick={() => {
              if (!activeWatchlistId) return;
              const current = watchlists.find((w) => w.id === activeWatchlistId);
              const ok =
                typeof window === "undefined" ||
                window.confirm(`Delete watchlist “${current?.name ?? activeWatchlistId}”?`);
              if (!ok) return;
              const r = deleteHfmWatchlist(activeWatchlistId);
              setWatchlists(listHfmWatchlists());
              setActiveWatchlistId(null);
              setWatchlistOnly(false);
              setActionMessage(r.ok ? "Watchlist deleted" : r.error);
            }}
          >
            Delete list
          </button>
          <button
            type="button"
            className="hfm-mw-retry"
            disabled={!activeWatchlistId || !selectedSymbol}
            onClick={() => {
              if (!activeWatchlistId || !selectedSymbol) return;
              const r = removeSymbolFromHfmWatchlist(activeWatchlistId, selectedSymbol);
              setWatchlists(listHfmWatchlists());
              setActionMessage(
                r.ok ? `Removed ${selectedSymbol} from watchlist` : r.error,
              );
            }}
          >
            Remove selected
          </button>
          <p className="hfm-mw-watchlist-note">
            Watchlists and favorites are local preferences — they do not subscribe broker quotes.
          </p>
        </div>
      </div>

      <div className="hfm-mw-workspace">
        <section className="hfm-mw-table-panel" aria-label="HFM instruments table">
          <div className="hfm-mw-table-head">
            <h2>Instruments</h2>
            {catalog?.available && catalog.totalInstruments != null ? (
              <span className="hfm-badge" data-tone="wait">
                Catalog {catalog.totalInstruments.toLocaleString("en-US")}
              </span>
            ) : null}
          </div>
          <div className="hfm-mw-table-body">
            {load.catalog === "loading" || load.catalog === "idle" ? (
              <HfmMarketWatchLoadingState label="Loading HFM instrument catalog…" />
            ) : load.catalog === "auth_required" ? (
              <HfmMarketWatchErrorState
                title="Authentication required"
                detail="Configure the Admin API token at /forex/admin-access to load the HFM catalog."
              />
            ) : load.catalog === "error" ? (
              <HfmMarketWatchErrorState
                title="Catalog unavailable"
                detail={load.catalogError ?? "HFM symbol catalog request failed."}
                onRetry={() => setReloadToken((n) => n + 1)}
              />
            ) : instruments.length === 0 ? (
              <HfmMarketWatchEmptyState
                title="No HFM instruments"
                detail={catalog?.unavailableReason ?? "The HFM catalog returned no instruments."}
              />
            ) : (
              <>
                <HfmInstrumentsTable
                  rows={paged.slice}
                  selectedSymbol={selectedSymbol}
                  busySymbol={busySymbol}
                  onSelect={setSelectedSymbol}
                  onToggleFavorite={(sym) => {
                    const r = toggleHfmFavorite(sym);
                    setFavoriteSymbols(r.symbols);
                    if (!r.ok) setActionMessage(r.error ?? "Favorite update failed");
                  }}
                />
                <HfmMarketPagination
                  page={paged.page}
                  totalPages={paged.totalPages}
                  total={paged.total}
                  pageSize={paged.pageSize}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </section>

        <div className="hfm-mw-side-stack">
          <HfmSelectedInstrumentPanel
            symbol={selectedSymbol}
            instrument={selectedInstrument}
            quote={selectedQuote}
            subscription={selectedSub}
            favorite={selectedSymbol ? favoriteSymbols.includes(selectedSymbol) : false}
            watchlists={watchlists}
            activeWatchlistId={activeWatchlistId}
            busy={Boolean(busySymbol)}
            actionMessage={actionMessage}
            onToggleFavorite={() => {
              if (!selectedSymbol) return;
              const r = toggleHfmFavorite(selectedSymbol);
              setFavoriteSymbols(r.symbols);
              setActionMessage(r.ok ? (r.favorite ? "Added to favorites" : "Removed from favorites") : r.error);
            }}
            onSubscribe={() => {
              if (!selectedSymbol) return;
              void runSubOp(selectedSymbol, async () => {
                const r = await subscribeHfmSymbols([selectedSymbol]);
                return { ok: r.ok, reason: r.ok ? null : "Subscribe rejected or capacity reached" };
              });
            }}
            onUnsubscribe={() => {
              if (!selectedSymbol) return;
              void runSubOp(selectedSymbol, async () => {
                const r = await unsubscribeHfmSymbols([selectedSymbol]);
                return { ok: r.ok, reason: r.ok ? null : "Unsubscribe rejected" };
              });
            }}
            onPause={() => {
              if (!selectedSymbol) return;
              void runSubOp(selectedSymbol, () => pauseHfmSubscription(selectedSymbol));
            }}
            onResume={() => {
              if (!selectedSymbol) return;
              void runSubOp(selectedSymbol, () => resumeHfmSubscription(selectedSymbol));
            }}
            onAddToWatchlist={(id) => {
              if (!selectedSymbol) return;
              const r = addSymbolToHfmWatchlist(id, selectedSymbol);
              setWatchlists(listHfmWatchlists());
              setActionMessage(r.ok ? `Added ${selectedSymbol} to watchlist` : r.error);
            }}
            onCreateWatchlist={() => {
              const name = typeof window !== "undefined" ? window.prompt("New HFM watchlist name") : null;
              if (!name) return;
              const r = createHfmWatchlist(name);
              setWatchlists(listHfmWatchlists());
              if (r.ok && r.list) {
                setActiveWatchlistId(r.list.id);
                setActionMessage(`Created watchlist ${r.list.name}`);
              } else {
                setActionMessage(r.error);
              }
            }}
          />
          <HfmTradingSessionsPanel
            availability={selectedSessions.availability}
            rows={selectedSessions.rows}
            reason={selectedSessions.reason}
          />
        </div>
      </div>
    </div>
  );
}
