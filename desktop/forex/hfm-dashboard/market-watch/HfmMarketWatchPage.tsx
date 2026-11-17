import { useCallback, useEffect, useMemo, useState } from "react";
import { restartHfmRealtimeStore } from "../hfm-realtime-store";
import { fetchHfmMarketWatchCatalog, HfmMwApiError } from "./api";
import { HfmMarketCategories } from "./components/HfmMarketCategories";
import { HfmMarketOverview } from "./components/HfmMarketOverview";
import { HfmMarketWatchHeader } from "./components/HfmMarketWatchHeader";
import { HfmMarketWatchWorkspace } from "./components/HfmMarketWatchWorkspace";
import { unavailableMovementSummary } from "./movement";
import { resolveTradingSessionOverview, resolveTradingSessionRows } from "./sessions";
import type {
  HfmMwCatalogSummary,
  HfmMwCategoryFilter,
  HfmMwLoadState,
  HfmMwRealtimeHints,
  HfmMwSelectedInstrument,
} from "./types";
import "./hfm-market-watch.css";

export function HfmMarketWatchPage({ realtime }: { realtime: HfmMwRealtimeHints }) {
  const [load, setLoad] = useState<HfmMwLoadState>({ catalog: "idle", catalogError: null });
  const [catalog, setCatalog] = useState<HfmMwCatalogSummary | null>(null);
  const [category, setCategory] = useState<HfmMwCategoryFilter>("ALL");
  const [selected] = useState<HfmMwSelectedInstrument | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadCatalog = useCallback(async (signal: AbortSignal) => {
    setLoad({ catalog: "loading", catalogError: null });
    try {
      const summary = await fetchHfmMarketWatchCatalog();
      if (signal.aborted) return;
      setCatalog(summary);
      setLoad({
        catalog: summary.available ? "ready" : "error",
        catalogError: summary.available ? null : summary.unavailableReason,
      });
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof HfmMwApiError && (err.code === "AUTH_REQUIRED" || err.code === "AUTH_REJECTED")) {
        setCatalog(null);
        setLoad({ catalog: "auth_required", catalogError: err.message });
        return;
      }
      setCatalog(null);
      setLoad({
        catalog: "error",
        catalogError: err instanceof Error ? err.message : "Failed to load HFM catalog",
      });
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadCatalog(ac.signal);
    return () => ac.abort();
  }, [loadCatalog, reloadToken]);

  const movement = useMemo(() => unavailableMovementSummary(), []);
  const sessionOverview = useMemo(() => resolveTradingSessionOverview(null), []);
  const sessionPanel = useMemo(() => resolveTradingSessionRows(null), []);

  const refreshEnabled =
    realtime.sseStatus === "reconnecting" ||
    realtime.sseStatus === "error" ||
    realtime.sseStatus === "idle";

  return (
    <div className="hfm-mw-page" data-hfm-market-watch="true">
      <HfmMarketWatchHeader
        realtime={realtime}
        refreshEnabled={refreshEnabled}
        onRefresh={() => restartHfmRealtimeStore()}
      />

      <HfmMarketOverview
        load={load}
        catalog={catalog}
        movement={movement}
        session={sessionOverview}
      />

      <HfmMarketCategories
        load={load}
        catalog={catalog}
        active={category}
        onSelect={setCategory}
      />

      <HfmMarketWatchWorkspace
        load={load}
        catalog={catalog}
        category={category}
        selected={selected}
        sessionsAvailability={sessionPanel.availability}
        sessionRows={sessionPanel.rows}
        sessionsReason={sessionPanel.reason}
        onRetryCatalog={() => setReloadToken((n) => n + 1)}
      />
    </div>
  );
}
