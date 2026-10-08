import { useCallback, useState } from "react";
import { forexProvidersApi } from "./api";

type HistResult = Awaited<ReturnType<typeof forexProvidersApi.fxcmHistorical>>;

export function ForexAdminHistoricalPage({ onOpen }: { onOpen: (path: string) => void }) {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("15m");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistResult | null>(null);

  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await forexProvidersApi.fxcmHistorical({
        symbol: symbol.trim(),
        timeframe,
        limit: Number(limit) || 100,
        refresh,
      });
      setData(res);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "FXCM historical request failed.");
    } finally {
      setBusy(false);
    }
  }, [symbol, timeframe, limit]);

  const quality = data?.quality ?? null;
  const gaps = Array.isArray(quality?.gaps) ? (quality.gaps as Array<Record<string, unknown>>) : [];

  return (
    <div data-forex-admin-historical>
      <section className="fxa-card">
        <h2>FXCM HISTORICAL DATA</h2>
        <p className="fxa-muted">
          Phase 28 official FXCM historical candles. Mode = HISTORICAL — not LIVE.
          No streaming, no trading, no synthetic candles.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="fxa-muted">
            Instrument (provider symbol)
            <input
              className="fxa-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="EUR/USD"
              style={{ display: "block", marginTop: 4, minWidth: 140 }}
            />
          </label>
          <label className="fxa-muted">
            Timeframe
            <select
              className="fxa-input"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{ display: "block", marginTop: 4 }}
            >
              {["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"].map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </label>
          <label className="fxa-muted">
            Limit
            <input
              className="fxa-input"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ display: "block", marginTop: 4, width: 80 }}
            />
          </label>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void load(true)}>
            {busy ? "Loading…" : "Fetch Historical"}
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/instruments")}>
            Instruments
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex")}>
            Dashboard
          </button>
        </div>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}

      {data ? (
        <>
          <section className="fxa-card">
            <h3>Request result</h3>
            <ul>
              <li>Provider: FXCM</li>
              <li>Environment: {String(data.environmentLabel)}</li>
              <li>Mode: HISTORICAL</li>
              <li>Source: {String(data.source)}</li>
              <li>Provider symbol: {String(data.providerSymbol)}</li>
              <li>Canonical: {String(data.canonicalSymbol)}</li>
              <li>Display: {String(data.displaySymbol)}</li>
              <li>Market type: {String(data.marketType)}</li>
              <li>Timeframe: {String(data.timeframe)} (FXCM {String(data.providerPeriod)})</li>
              <li>Candle count: {data.count}</li>
              <li>Fetched: {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "—"}</li>
              <li>Quality: {String(quality?.status ?? "—")}</li>
              <li>First: {String(quality?.firstTimestamp ?? "—")}</li>
              <li>Last: {String(quality?.lastTimestamp ?? "—")}</li>
              <li>Duplicates removed: {String(quality?.duplicatesRemoved ?? 0)}</li>
              <li>Invalid candles: {String(quality?.invalidCandles ?? 0)}</li>
              <li>Gaps: {gaps.length}</li>
              <li>Live Stream: NOT ENABLED YET</li>
              <li>Trading: DISABLED</li>
            </ul>
            {data.note ? <p className="fxa-muted">{data.note}</p> : null}
            {gaps.length > 0 ? (
              <ul>
                {gaps.slice(0, 8).map((g, idx) => (
                  <li key={idx}>
                    {String(g.kind)} · {String(g.gapStart)} → {String(g.gapEnd)}
                    {" "}(est. missing {String(g.missingCandlesEstimate)})
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="fxa-card">
            <h3>Candle preview</h3>
            {data.candles.length === 0 ? (
              <p className="fxa-muted">No candles returned.</p>
            ) : (
              <div className="fxa-table-wrap">
                <table className="fxa-table">
                  <thead>
                    <tr>
                      <th>Timestamp (UTC)</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                      <th>Volume</th>
                      <th>TickQty</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.candles.slice(-50).map((c) => (
                      <tr key={String(c.time)}>
                        <td>{new Date(Number(c.time) * 1000).toISOString()}</td>
                        <td>{String(c.open)}</td>
                        <td>{String(c.high)}</td>
                        <td>{String(c.low)}</td>
                        <td>{String(c.close)}</td>
                        <td>{c.volume == null ? "N/A" : String(c.volume)}</td>
                        <td>{c.tickQty == null ? "N/A" : String(c.tickQty)}</td>
                        <td>{c.closed ? "yes" : "no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="fxa-muted">Showing up to the last 50 candles. Prices are mid OHLC from FXCM bid/ask.</p>
          </section>
        </>
      ) : (
        <section className="fxa-card">
          <p className="fxa-muted">
            Configure server-side FXCM credentials, discover instruments, then fetch a bounded historical window.
          </p>
        </section>
      )}
    </div>
  );
}
