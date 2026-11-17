import type { HfmCatalogCategory } from "../../../../../ai/market-data/mt5-hfm/catalog-types";
import {
  HFM_MW_CATEGORY_LABELS,
  HFM_MW_CATEGORY_ORDER,
  type HfmMwCatalogSummary,
  type HfmMwCategoryFilter,
  type HfmMwLoadState,
} from "../types";

export function HfmMarketCategories({
  load,
  catalog,
  active,
  onSelect,
  hideEmpty = true,
}: {
  load: HfmMwLoadState;
  catalog: HfmMwCatalogSummary | null;
  active: HfmMwCategoryFilter;
  onSelect: (next: HfmMwCategoryFilter) => void;
  /** When true, hide zero-count categories (All always shown). */
  hideEmpty?: boolean;
}) {
  const total =
    catalog?.available && catalog.totalInstruments != null ? catalog.totalInstruments : null;
  const counts = new Map(
    (catalog?.categories ?? []).map((row) => [row.category, row.count] as const),
  );

  const pills: Array<{ id: HfmMwCategoryFilter; label: string; count: number | null }> = [
    { id: "ALL", label: "All", count: total },
  ];

  for (const cat of HFM_MW_CATEGORY_ORDER) {
    const count = counts.get(cat) ?? 0;
    if (hideEmpty && count <= 0 && active !== cat) continue;
    pills.push({
      id: cat,
      label: HFM_MW_CATEGORY_LABELS[cat as HfmCatalogCategory] ?? cat,
      count: catalog?.available ? count : null,
    });
  }

  return (
    <div className="hfm-mw-toolbar-block">
      <div className="hfm-mw-categories" role="tablist" aria-label="Instrument categories">
        {pills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            role="tab"
            className="hfm-mw-cat-btn"
            data-active={active === pill.id}
            aria-selected={active === pill.id}
            disabled={load.catalog === "loading"}
            onClick={() => onSelect(pill.id)}
          >
            <span>{pill.label}</span>
            {pill.count != null ? (
              <span className="hfm-mw-cat-count">({pill.count.toLocaleString("en-US")})</span>
            ) : load.catalog === "loading" ? (
              <span className="hfm-mw-cat-count">…</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="hfm-mw-tools">
        <label className="hfm-mw-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            disabled
            placeholder="Search symbol (STEP 3B)…"
            aria-label="Search symbol — full search arrives in STEP 3B"
          />
        </label>
        <p className="hfm-mw-tool-note">
          Category filter is live from HFM classification. Full search, sort, and pagination ship in
          STEP 3B.
        </p>
      </div>
    </div>
  );
}
