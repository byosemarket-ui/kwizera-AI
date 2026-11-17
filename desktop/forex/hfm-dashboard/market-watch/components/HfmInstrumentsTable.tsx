import { memo } from "react";
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

const InstrumentTableRow = memo(function InstrumentTableRow({
  row,
  selected,
  busy,
  onSelect,
  onToggleFavorite,
}: {
  row: HfmMwInstrumentRow;
  selected: boolean;
  busy: boolean;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
}) {
  const q = row.quote;
  const status = q?.status ?? "NO_QUOTE";
  const digits = q?.digits ?? row.instrument.digits;
  return (
    <tr
      data-active={selected}
      data-busy={busy}
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
      <td className="hfm-mw-col-cat">{row.instrument.classification?.category ?? "—"}</td>
      <td className="hfm-mw-num">{formatPrice(q?.bid ?? null, digits)}</td>
      <td className="hfm-mw-num">{formatPrice(q?.ask ?? null, digits)}</td>
      <td className="hfm-mw-num">{formatSpreadCell(row)}</td>
      <td className="hfm-mw-num hfm-mw-col-move" title="Requires broker daily reference baseline">
        <span className="hfm-mw-na">Unavailable</span>
      </td>
      <td className="hfm-mw-num hfm-mw-col-move" title="Requires broker daily reference baseline">
        <span className="hfm-mw-na">Unavailable</span>
      </td>
      <td className="hfm-mw-num hfm-mw-col-hl" title="High not exposed by current HFM quote contract">
        <span className="hfm-mw-na">Unavailable</span>
      </td>
      <td className="hfm-mw-num hfm-mw-col-hl" title="Low not exposed by current HFM quote contract">
        <span className="hfm-mw-na">Unavailable</span>
      </td>
      <td>
        <span className="hfm-badge" data-tone={quoteTone(status)}>
          {status.replace(/_/g, " ")}
        </span>
      </td>
      <td className="hfm-mw-num hfm-mw-col-age">{formatQuoteAge(row)}</td>
      <td className="hfm-mw-col-sub">
        <span className="hfm-badge" data-tone="wait">
          {row.subscription?.status ?? "UNSUBSCRIBED"}
        </span>
      </td>
    </tr>
  );
});

const InstrumentCard = memo(function InstrumentCard({
  row,
  selected,
  busy,
  onSelect,
  onToggleFavorite,
}: {
  row: HfmMwInstrumentRow;
  selected: boolean;
  busy: boolean;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
}) {
  const q = row.quote;
  const status = q?.status ?? "NO_QUOTE";
  const digits = q?.digits ?? row.instrument.digits;
  return (
    <article
      className="hfm-mw-inst-card"
      data-active={selected}
      data-busy={busy}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(row.symbol)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(row.symbol);
        }
      }}
    >
      <header className="hfm-mw-inst-card-head">
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
        <div>
          <strong className="hfm-mw-sym">{row.symbol}</strong>
          <span className="hfm-mw-desc">{row.instrument.description ?? "—"}</span>
        </div>
        <span className="hfm-badge" data-tone={quoteTone(status)}>
          {status.replace(/_/g, " ")}
        </span>
      </header>
      <dl className="hfm-mw-inst-card-grid">
        <div>
          <dt>Bid</dt>
          <dd className="hfm-mw-num">{formatPrice(q?.bid ?? null, digits)}</dd>
        </div>
        <div>
          <dt>Ask</dt>
          <dd className="hfm-mw-num">{formatPrice(q?.ask ?? null, digits)}</dd>
        </div>
        <div>
          <dt>Spread</dt>
          <dd className="hfm-mw-num">{formatSpreadCell(row)}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd className="hfm-mw-num">{formatQuoteAge(row)}</dd>
        </div>
        <div>
          <dt>Subscription</dt>
          <dd>{row.subscription?.status ?? "UNSUBSCRIBED"}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{row.instrument.classification?.category ?? "—"}</dd>
        </div>
      </dl>
    </article>
  );
});

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
    <>
      <div className="hfm-mw-table-scroll" data-layout="table">
        <table className="hfm-mw-table" aria-label="HFM instruments">
          <thead>
            <tr>
              <th scope="col">Fav</th>
              <th scope="col">Symbol</th>
              <th scope="col">Description</th>
              <th scope="col" className="hfm-mw-col-cat">
                Category
              </th>
              <th scope="col">Bid</th>
              <th scope="col">Ask</th>
              <th scope="col">Spread</th>
              <th scope="col" className="hfm-mw-col-move">
                Change
              </th>
              <th scope="col" className="hfm-mw-col-move">
                Change %
              </th>
              <th scope="col" className="hfm-mw-col-hl">
                High
              </th>
              <th scope="col" className="hfm-mw-col-hl">
                Low
              </th>
              <th scope="col">Status</th>
              <th scope="col" className="hfm-mw-col-age">
                Age
              </th>
              <th scope="col" className="hfm-mw-col-sub">
                Subscription
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <InstrumentTableRow
                key={`HFM_MT5:${row.symbol}`}
                row={row}
                selected={row.symbol === selectedSymbol}
                busy={busySymbol === row.symbol}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="hfm-mw-inst-cards" data-layout="cards" aria-label="HFM instruments">
        {rows.map((row) => (
          <InstrumentCard
            key={`HFM_MT5:card:${row.symbol}`}
            row={row}
            selected={row.symbol === selectedSymbol}
            busy={busySymbol === row.symbol}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </>
  );
}
