import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

type StreamStatus = Awaited<ReturnType<typeof forexProvidersApi.fxcmStreamStatus>>;

function fmtPrice(v: unknown): string {
  if (v == null || v === "") return "N/A";
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/A";
  return String(n);
}

function fmtTs(v: unknown): string {
  if (v == null || v === "") return "N/A";
  return String(v);
}

export function ForexAdminStreamPage({ onOpen }: { onOpen: (path: string) => void }) {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StreamStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await forexProvidersApi.fxcmStreamStatus();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FXCM stream status failed.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      await forexProvidersApi.fxcmStreamSubscribe(symbol.trim());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "FXCM subscribe failed.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      await forexProvidersApi.fxcmStreamUnsubscribe(symbol.trim());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "FXCM unsubscribe failed.");
    } finally {
      setBusy(false);
    }
  };

  const stream = data?.stream ?? null;
  const quotes = Array.isArray(data?.quotes) ? data!.quotes : [];
  const subscriptions = Array.isArray(data?.subscriptions) ? data!.subscriptions : [];

  return (
    <div data-forex-admin-stream>
      <section className="fxa-card">
        <h2>FXCM REAL-TIME STREAM</h2>
        <p className="fxa-muted">
          Phase 29 official FXCM market-data quotes via POST /subscribe + Socket.IO push.
          Mode = REALTIME_QUOTE — not live candles, not trading.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="fxa-muted">
            Instrument (discovered provider symbol)
            <input
              className="fxa-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="EUR/USD"
              style={{ display: "block", marginTop: 4, minWidth: 140 }}
            />
          </label>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void subscribe()}>
            {busy ? "Working…" : "Subscribe"}
          </button>
          <button type="button" className="fxa-btn-secondary" disabled={busy} onClick={() => void unsubscribe()}>
            Unsubscribe
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => void refresh()}>
            Refresh
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/instruments")}>
            Instruments
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/historical-data")}>
            Historical
          </button>
        </div>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}

      <section className="fxa-card">
        <h3>Stream status</h3>
        {!data ? (
          <p className="fxa-muted">Loading stream status…</p>
        ) : (
          <ul>
            <li>Provider: FXCM</li>
            <li>Environment: {String(data.environmentLabel)}</li>
            <li>Authentication: {String(data.authenticationState)}</li>
            <li>Stream: {String(stream?.streamState ?? "N/A")}</li>
            <li>Live stream capability: {String(data.liveStream)}</li>
            <li>Market data: {String(data.marketData)}</li>
            <li>Mode: {String(data.mode)}</li>
            <li>Trading: DISABLED</li>
            <li>Subscriptions: {String(stream?.subscriptionCount ?? subscriptions.length)}</li>
            <li>Events received: {String(stream?.eventsReceived ?? 0)}</li>
            <li>Invalid events: {String(stream?.invalidEvents ?? 0)}</li>
            <li>Reconnects: {String(stream?.reconnectCount ?? 0)}</li>
            <li>Last event: {fmtTs(stream?.lastEventAt)}</li>
            <li>Last source timestamp: {fmtTs(stream?.lastSourceTimestamp)}</li>
            <li>Latency: {stream?.latencyMs != null ? `${String(stream.latencyMs)} ms` : "N/A"}</li>
            <li>Stale threshold: {stream?.quoteStaleMs != null ? `${String(stream.quoteStaleMs)} ms` : "N/A"}</li>
            {data.errorCode ? <li>Error: {String(data.errorCode)} — {String(data.errorMessage ?? "")}</li> : null}
          </ul>
        )}
        <p className="fxa-muted">
          LIVE requires an authenticated stream, an active subscription, and a recent valid FXCM quote.
          Prices do not move unless FXCM sends an update.
        </p>
      </section>

      <section className="fxa-card">
        <h3>Subscriptions</h3>
        {subscriptions.length === 0 ? (
          <p className="fxa-muted">No active FXCM subscriptions.</p>
        ) : (
          <div className="fxa-table-wrap">
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Provider symbol</th>
                  <th>Canonical</th>
                  <th>State</th>
                  <th>Events</th>
                  <th>Last event</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={String(s.key ?? s.providerSymbol)}>
                    <td>{String(s.providerSymbol)}</td>
                    <td>{String(s.canonicalSymbol)}</td>
                    <td>{String(s.state)}</td>
                    <td>{String(s.eventsReceived ?? 0)}</td>
                    <td>{fmtTs(s.lastEventAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fxa-card">
        <h3>Current quotes</h3>
        {quotes.length === 0 ? (
          <p className="fxa-muted">No quotes yet — subscribe to a discovered instrument and wait for FXCM events.</p>
        ) : (
          <div className="fxa-table-wrap">
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>Mid</th>
                  <th>State</th>
                  <th>Source ts</th>
                  <th>Received</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={`${String(q.providerSymbol)}:${String(q.marketType)}`}>
                    <td>{String(q.displaySymbol ?? q.providerSymbol)}</td>
                    <td>{fmtPrice(q.bid)}</td>
                    <td>{fmtPrice(q.ask)}</td>
                    <td>{fmtPrice(q.mid)}</td>
                    <td>{String(q.state)}</td>
                    <td>{fmtTs(q.sourceTimestamp)}</td>
                    <td>{fmtTs(q.receivedAt)}</td>
                    <td>{q.latencyMs != null ? `${String(q.latencyMs)} ms` : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
