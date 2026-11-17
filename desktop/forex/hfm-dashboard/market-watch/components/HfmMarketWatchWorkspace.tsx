import type { ReactNode } from "react";
import type {
  HfmMwCatalogSummary,
  HfmMwCategoryFilter,
  HfmMwLoadState,
  HfmMwSelectedInstrument,
  HfmMwSessionRow,
} from "../types";
import { HFM_MW_CATEGORY_LABELS } from "../types";
import {
  HfmMarketWatchEmptyState,
  HfmMarketWatchErrorState,
  HfmMarketWatchLoadingState,
} from "./HfmMarketWatchStates";
import { HfmSelectedInstrumentPanel } from "./HfmSelectedInstrumentPanel";
import { HfmTradingSessionsPanel } from "./HfmTradingSessionsPanel";

export function HfmMarketWatchWorkspace({
  load,
  catalog,
  category,
  selected,
  sessionsAvailability,
  sessionRows,
  sessionsReason,
  onRetryCatalog,
}: {
  load: HfmMwLoadState;
  catalog: HfmMwCatalogSummary | null;
  category: HfmMwCategoryFilter;
  selected: HfmMwSelectedInstrument | null;
  sessionsAvailability: "available" | "unavailable" | "loading";
  sessionRows: HfmMwSessionRow[];
  sessionsReason: string | null;
  onRetryCatalog: () => void;
}) {
  const categoryLabel =
    category === "ALL" ? "All" : HFM_MW_CATEGORY_LABELS[category] ?? category;
  const categoryCount =
    category === "ALL"
      ? catalog?.totalInstruments ?? null
      : catalog?.categories.find((c) => c.category === category)?.count ?? null;

  let tableBody: ReactNode;
  if (load.catalog === "loading" || load.catalog === "idle") {
    tableBody = <HfmMarketWatchLoadingState label="Loading HFM instrument catalog…" />;
  } else if (load.catalog === "auth_required") {
    tableBody = (
      <HfmMarketWatchErrorState
        title="Authentication required"
        detail="Configure the Admin API token at /forex/admin-access to load the HFM catalog."
      />
    );
  } else if (load.catalog === "error") {
    tableBody = (
      <HfmMarketWatchErrorState
        title="Catalog unavailable"
        detail={load.catalogError ?? "HFM symbol catalog request failed."}
        onRetry={onRetryCatalog}
      />
    );
  } else if (!catalog?.available || catalog.totalInstruments === 0) {
    tableBody = (
      <HfmMarketWatchEmptyState
        title="No HFM instruments"
        detail={
          catalog?.unavailableReason ??
          "The HFM catalog returned no instruments for the current view."
        }
      />
    );
  } else if (category !== "ALL" && (categoryCount == null || categoryCount <= 0)) {
    tableBody = (
      <HfmMarketWatchEmptyState
        title={`No instruments in ${categoryLabel}`}
        detail="This category has no classified HFM instruments in the current catalog snapshot."
      />
    );
  } else {
    tableBody = (
      <HfmMarketWatchEmptyState
        title="Instrument table ready for STEP 3B"
        detail={`HFM catalog connected · ${categoryLabel}${
          categoryCount != null ? ` · ${categoryCount.toLocaleString("en-US")} instruments` : ""
        }. Quote rows, search, sort, and pagination are intentionally not fabricated in STEP 3A.`}
      />
    );
  }

  return (
    <div className="hfm-mw-workspace">
      <section className="hfm-mw-table-panel" aria-label="Instruments table foundation">
        <div className="hfm-mw-table-head">
          <h2>Instruments</h2>
          {catalog?.available && catalog.totalInstruments != null ? (
            <span className="hfm-badge" data-tone="wait">
              Catalog {catalog.totalInstruments.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
        <div className="hfm-mw-table-body">{tableBody}</div>
      </section>

      <div className="hfm-mw-side-stack">
        <HfmSelectedInstrumentPanel selected={selected} />
        <HfmTradingSessionsPanel
          availability={sessionsAvailability}
          rows={sessionRows}
          reason={sessionsReason}
        />
      </div>
    </div>
  );
}
