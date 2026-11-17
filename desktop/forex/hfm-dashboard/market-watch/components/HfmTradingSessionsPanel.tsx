import type { HfmMwSessionRow } from "../types";

export function HfmTradingSessionsPanel({
  availability,
  rows,
  reason,
}: {
  availability: "available" | "unavailable" | "loading";
  rows: HfmMwSessionRow[];
  reason: string | null;
}) {
  return (
    <section className="hfm-mw-side-panel" aria-label="Trading sessions">
      <h2>Trading Sessions</h2>
      {availability === "loading" ? (
        <div className="hfm-mw-skeleton" role="status" aria-label="Loading sessions">
          <div className="hfm-mw-skel-line" data-w="lg" />
          <div className="hfm-mw-skel-line" data-w="md" />
          <div className="hfm-mw-skel-line" data-w="sm" />
        </div>
      ) : availability === "unavailable" || rows.length === 0 ? (
        <div className="hfm-mw-sessions-empty" role="status">
          <strong>Session schedule unavailable</strong>
          <p>
            {reason ??
              "Named global FX hub session statuses are not confirmed by the HFM backend. No fabricated session rows are shown."}
          </p>
        </div>
      ) : (
        <ul className="hfm-mw-session-list">
          {rows.map((row) => (
            <li key={row.name}>
              <span className="name">{row.name}</span>
              <span aria-label={`Status ${row.status ?? "unknown"}`}>
                {row.status ?? "Unknown"}
              </span>
              <span className="times">
                {[row.openTime, row.closeTime].filter(Boolean).join(" – ") || "Times unavailable"}
                {row.timeZone ? ` · ${row.timeZone}` : ""}
                {row.nextTransition ? ` · Next: ${row.nextTransition}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
