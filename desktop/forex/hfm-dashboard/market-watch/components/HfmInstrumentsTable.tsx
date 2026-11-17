import { formatPrice } from "../../format";
import type { HfmMwInstrumentRow } from "../instrument-query";

function quoteTone(status: string | null | undefined): "live" | "stale" | "wait" | "down" | "closed" {
  if (status === "LIVE") return "live";
  if (status === "MARKET_CLOSED") return "closed";
  if (status === "STALE" || status === "DELAYED" || status === "WAITING_FOR_DATA") return "stale";
  if (status === "ERROR" || status === "INVALID") return "down";
  return "wait";
}

function formatSpreadCell(row: HfmMwInstrumentRow): string {
  const q = row.quote;
  if (!q) return "—";
  if (q.spreadPoints != null && Number.isFinite(q.spreadPoints)) return q.spreadPoints.toFixed(1);
  if (q.spread != null && Number.isFinite(q.spread)) return formatPrice(q.spread, q.digits);
  return "—";
}

function formatQuoteAge(row: HfmMwInstrumentRow): string {
  const q = row.quote;
  if (!q) return "—";
  const ms =
    typeof q.quoteTimestampMs === "number" && Number.isFinite(q.quoteTimestampMs)
      ? q.quoteTimestampMs
      : typeof q.quoteTimestamp === "number" && Number.isFinite(q.quoteTimestamp)
        ? q.quoteTimestamp * 1000
        : null;
  if (ms == null) return "—";
  const ageSec = Math.max(0, (Date.now() - ms) / 1000);
  if (ageSec < 60) return `${ageSec.toFixed(0)}s`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m`;
  return `${(ageSec / 3600).toFixed(1)}h`;
}

export function HfmInstrumentsTable({
  rows,
  selectedSymbol,
  onSelect,
  onToggleFavorite,
  busySymbol,
}: {
  rows: HfmMwInstrumentRow[];
  selectedSymbol: string | null;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
  busySymbol?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="hfm-mw-state" data-kind="empty" role="status">
        <strong>No matching instruments</strong>
        <p>Adjust search or filters. Results use the live HFM catalog only.</p>
      </div>
    );
  }

  return (
    <div className="hfm-mw-table-scroll">
      <table className="hfm-mw-table" aria-label="HFM instruments">
        <thead>
          <tr>
            <th scope="col">Fav</th>
            <th scope="col">Symbol</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col">Bid</th>
            <th scope="col">Ask</th>
            <th scope="col">Spread</th>
            <th scope="col">Change</th>
            <th scope="col">Change %</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Status</th>
            <th scope="col">Age</th>
            <th scope="col">Subscription</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const q = row.quote;
            const status = q?.status ?? "NO_QUOTE";
            const digits = q?.digits ?? row.instrument.digits;
            const selected = row.symbol === selectedSymbol;
            return (
              <tr
                key={`HFM_MT5:${row.symbol}`}
                data-active={selected}
                data-busy={busySymbol === row.symbol}
                onClick={() => onSelect(row.symbol)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row.symbol);
                  }
                }}
                tabIndex={0}
                aria-selected={selected}
              >
                <td>
                  <button
                    type="button"
                    className="hfm-mw-fav-btn"
                    aria-label={row.favorite ? `Remove ${row.symbol} from favorites` : `Add ${row.symbol} to favorites`}
                    aria-pressed={row.favorite}
                    data-on={row.favorite}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(row.symbol);
                    }}
                  >
                    {row.favorite ? "★" : "☆"}
                  </button>
                </td>
                <td>
                  <span className="hfm-mw-sym">{row.symbol}</span>
                </td>
                <td className="hfm-mw-desc">{row.instrument.description ?? "—"}</td>
                <td>{row.instrument.classification?.category ?? "—"}</td>
                <td className="hfm-mw-num">{formatPrice(q?.bid ?? null, digits)}</td>
                <td className="hfm-mw-num">{formatPrice(q?.ask ?? null, digits)}</td>
                <td className="hfm-mw-num">{formatSpreadCell(row)}</td>
                <td className="hfm-mw-num" title="Requires broker daily reference baseline">
                  <span className="hfm-mw-na">Unavailable</span>
                </td>
                <td className="hfm-mw-num" title="Requires broker daily reference baseline">
                  <span className="hfm-mw-na">Unavailable</span>
                </td>
                <td className="hfm-mw-num" title="High not exposed by current HFM quote contract">
                  <span className="hfm-mw-na">Unavailable</span>
                </td>
                <td className="hfm-mw-num" title="Low not exposed by current HFM quote contract">
                  <span className="hfm-mw-na">Unavailable</span>
                </td>
                <td>
                  <span className="hfm-badge" data-tone={quoteTone(status)}>
                    {status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="hfm-mw-num">{formatQuoteAge(row)}</td>
                <td>
                  <span className="hfm-badge" data-tone="wait">
                    {row.subscription?.status ?? "UNSUBSCRIBED"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
