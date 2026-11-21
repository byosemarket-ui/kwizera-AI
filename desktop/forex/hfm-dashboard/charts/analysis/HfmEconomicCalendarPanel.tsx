import type { HfmEconomicCalendarView } from "./parse-hfm-fundamentals";

export function HfmEconomicCalendarPanel(props: {
  view: HfmEconomicCalendarView;
  displayTimeZone?: string;
}) {
  const { view } = props;
  const tz = props.displayTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return (
    <section className="hap-calendar" data-phase7-calendar="true" data-availability={view.availability}>
      <header className="hap-section-head">
        <h3>Economic calendar</h3>
        <p className="hap-muted">
          Informational only — does not change technical ranking or place orders.
        </p>
      </header>

      {view.availability === "LICENSING_BLOCKED" ? (
        <p className="hap-empty" data-calendar-state="licensing-blocked">
          Calendar display is blocked pending licensing clearance.
        </p>
      ) : null}
      {view.availability === "NOT_CONFIGURED" ? (
        <p className="hap-empty" data-calendar-state="disabled">
          Economic calendar provider is disabled on the server.
        </p>
      ) : null}
      {view.availability === "UNAVAILABLE" ? (
        <p className="hap-empty" data-calendar-state="unavailable">
          No calendar cache is available. Empty does not mean no economic events exist.
        </p>
      ) : null}
      {view.availability === "STALE" ? (
        <p className="hap-warn" data-calendar-state="stale">
          Cached calendar data is stale and must not be treated as current.
        </p>
      ) : null}
      {view.availability === "EMPTY" || (view.ok && view.events.length === 0 && view.availability === "OK") ? (
        <p className="hap-empty" data-calendar-state="empty">
          No matching events in the checked window for this symbol.
        </p>
      ) : null}
      {view.loading ? (
        <p className="hap-muted" data-calendar-state="loading">
          Loading calendar…
        </p>
      ) : null}

      {view.events.length > 0 ? (
        <div className="hap-calendar-table-wrap">
          <table className="hap-calendar-table">
            <thead>
              <tr>
                <th>When ({tz})</th>
                <th>Ccy</th>
                <th>Impact</th>
                <th>Event</th>
                <th>Forecast</th>
                <th>Previous</th>
                <th>Actual</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {view.events.map((e) => (
                <tr key={e.eventId} data-impact={e.impact} data-confidence={e.confidence}>
                  <td title={e.scheduledAtUtc}>{formatInZone(e.scheduledAtUtc, tz)}</td>
                  <td>{e.currency}</td>
                  <td>{e.impact || "—"}</td>
                  <td>
                    <div>{e.title}</div>
                    {e.status === "tentative" ? (
                      <span className="hap-badge">tentative</span>
                    ) : null}
                    {e.confidence === "single_source" ? (
                      <span className="hap-badge">not official</span>
                    ) : null}
                  </td>
                  <td>{displayValue(e.forecast)}</td>
                  <td>{displayValue(e.previous)}</td>
                  <td>{displayValue(e.actual)}</td>
                  <td>{e.confidence || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {view.attribution ? (
        <p className="hap-attribution" data-calendar-attribution="true">
          <a href={view.attribution.url} target="_blank" rel="noreferrer">
            {view.attribution.text}
          </a>
        </p>
      ) : null}
    </section>
  );
}

function displayValue(v: string): string {
  return v.trim() ? v : "—";
}

function formatInZone(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso || "—";
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso || "—";
  }
}
