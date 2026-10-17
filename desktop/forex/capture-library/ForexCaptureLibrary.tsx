/**
 * Phase 49B — Chart capture library on Forex AI Analysis.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ChartCaptureListItem } from "../../../ai/forex-chart-capture/types";
import {
  captureImageUrl,
  deleteCapture,
  listCaptures,
  setCaptureSelected,
} from "../chart/capture/capture-client";

function formatLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(new Date(ms));
  } catch {
    return new Date(ms).toString();
  }
}

export function ForexCaptureLibrary({
  onSelectionChange,
}: {
  onSelectionChange?: (selected: ChartCaptureListItem[]) => void;
}) {
  const [items, setItems] = useState<ChartCaptureListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterTf, setFilterTf] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterInstrument, setFilterInstrument] = useState("");
  const [viewer, setViewer] = useState<ChartCaptureListItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listCaptures({
      limit: 60,
      timeframe: filterTf || undefined,
      mode: filterMode || undefined,
      instrument: filterInstrument || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to load captures.");
      setItems([]);
      onSelectionChange?.([]);
      return;
    }
    setItems(result.items);
    onSelectionChange?.(result.items.filter((i) => i.selectedForAi));
  }, [filterTf, filterMode, filterInstrument, onSelectionChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(() => items.filter((i) => i.selectedForAi), [items]);

  const toggle = async (item: ChartCaptureListItem) => {
    const next = !item.selectedForAi;
    const r = await setCaptureSelected(item.captureId, next);
    if (!r.ok) {
      setError(r.error ?? "Selection update failed.");
      return;
    }
    await refresh();
  };

  const remove = async (item: ChartCaptureListItem) => {
    if (!window.confirm(`Delete capture ${item.instrument.displaySymbol} · ${item.timeframe}? This cannot be undone.`)) {
      return;
    }
    const r = await deleteCapture(item.captureId);
    if (!r.ok) {
      setError(r.error ?? "Delete failed.");
      return;
    }
    if (viewer?.captureId === item.captureId) setViewer(null);
    await refresh();
  };

  return (
    <section className="fx-capture-library" data-phase-49b="true" data-fx-capture-library="true">
      <header className="fx-capture-library-head">
        <div>
          <h2>Chart capture library</h2>
          <p className="fx-panel-meta">
            Screenshots from Charts. Select multiple timeframes for OpenAI review.
            Deselect does not delete. {selected.length} selected.
          </p>
        </div>
        <button type="button" className="fx-text-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="fx-capture-filters">
        <input
          aria-label="Filter instrument"
          placeholder="Instrument"
          value={filterInstrument}
          onChange={(e) => setFilterInstrument(e.target.value)}
        />
        <select aria-label="Filter timeframe" value={filterTf} onChange={(e) => setFilterTf(e.target.value)}>
          <option value="">All TF</option>
          {["5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
        <select aria-label="Filter mode" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
          <option value="">All modes</option>
          <option value="MANUAL">Manual</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
      </div>

      {error ? <p className="fx-capture-status is-error" role="alert">{error}</p> : null}

      {items.length === 0 && !loading ? (
        <p className="fx-panel-meta fx-capture-empty">
          No captures yet. On Charts, capture 5m / 15m / 30m / 1h / 4h screenshots, then refresh here.
        </p>
      ) : (
        <ul className="fx-capture-list">
          {items.map((item) => (
            <li key={item.captureId} className="fx-capture-card" data-capture-id={item.captureId} data-selected={item.selectedForAi ? "true" : "false"}>
              <button
                type="button"
                className="fx-capture-thumb-btn"
                onClick={() => setViewer(item)}
                aria-label={`Preview ${item.instrument.displaySymbol} ${item.timeframe}`}
              >
                <img
                  className="fx-capture-thumb"
                  src={captureImageUrl(item.captureId)}
                  alt=""
                  loading="lazy"
                  width={120}
                  height={68}
                />
              </button>
              <div className="fx-capture-card-meta">
                <strong>{item.instrument.displaySymbol}</strong>
                <span>{item.instrument.provider} · {item.timeframe} · {item.mode}</span>
                <span>{formatLocal(item.capturedAtUtc)}</span>
                <span>Feed {item.quote.feedHealth}</span>
                <span>
                  Snapshot {item.marketSnapshot.snapshotId ? "linked" : "none at capture"}
                </span>
                <div className="fx-capture-card-actions">
                  <label className="fx-capture-select">
                    <input
                      type="checkbox"
                      checked={item.selectedForAi}
                      onChange={() => void toggle(item)}
                    />
                    Select
                  </label>
                  <button
                    type="button"
                    className="fx-icon-button"
                    aria-label="Delete capture"
                    onClick={() => void remove(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewer ? (
        <div className="fx-capture-viewer" role="dialog" aria-modal="true" aria-label="Capture preview">
          <div className="fx-capture-viewer-inner">
            <header className="fx-capture-viewer-head">
              <strong>
                {viewer.instrument.displaySymbol} · {viewer.timeframe} · {viewer.mode}
              </strong>
              <button type="button" className="fx-text-button" onClick={() => setViewer(null)}>Close</button>
            </header>
            <img
              className="fx-capture-viewer-img"
              src={captureImageUrl(viewer.captureId)}
              alt={`${viewer.instrument.displaySymbol} chart capture`}
            />
            <dl className="fx-capture-meta-grid">
              <div><dt>Capture ID</dt><dd>{viewer.captureId}</dd></div>
              <div><dt>UTC</dt><dd>{viewer.capturedAtUtc}</dd></div>
              <div><dt>Provider</dt><dd>{viewer.instrument.provider}</dd></div>
              <div><dt>Feed</dt><dd>{viewer.quote.feedHealth}</dd></div>
              <div><dt>Bid / Ask / Last</dt><dd>{viewer.quote.bid ?? "—"} / {viewer.quote.ask ?? "—"} / {viewer.quote.lastPrice ?? "—"}</dd></div>
              <div><dt>Candles</dt><dd>{viewer.candleWindow.closedCount} closed · {viewer.candleWindow.formingCount} forming</dd></div>
              <div><dt>Capture snapshot</dt><dd>{viewer.marketSnapshot.snapshotId ?? "none"}</dd></div>
              <div><dt>Image</dt><dd>{viewer.image.width}×{viewer.image.height} · {viewer.image.byteLength} B</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </section>
  );
}
