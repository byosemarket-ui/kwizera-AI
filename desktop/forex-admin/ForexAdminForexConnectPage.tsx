import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

type FcStatus = Record<string, unknown>;

const SAMPLE_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

function tone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "CONNECTED") return "ok";
  if (status === "CONNECTING" || status === "NOT_CONFIGURED" || status === "DISCONNECTED") return "warn";
  if (
    status === "AUTHENTICATION_FAILED"
    || status === "SDK_UNAVAILABLE"
    || status === "SERVICE_UNAVAILABLE"
    || status === "ERROR"
    || status === "DISABLED"
  ) {
    return "danger";
  }
  return "neutral";
}

export function ForexAdminForexConnectPage() {
  const [status, setStatus] = useState<FcStatus | null>(null);
  const [instruments, setInstruments] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState<"connect" | "instruments" | "disconnect" | "candles" | "stream" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleSymbol, setSampleSymbol] = useState("EUR/USD");
  const [sampleTf, setSampleTf] = useState<(typeof SAMPLE_TIMEFRAMES)[number]>("1h");
  const [stream, setStream] = useState<Record<string, unknown> | null>(null);
  const [lastQuote, setLastQuote] = useState<Record<string, unknown> | null>(null);
  const [candleSample, setCandleSample] = useState<{
    count: number;
    priceBasis?: string;
    periodId?: string;
    fetchedAt?: string | null;
    first?: Record<string, unknown> | null;
    last?: Record<string, unknown> | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await forexProvidersApi.forexConnectStatus();
      setStatus(res as unknown as FcStatus);
      setError(null);
      try {
        const streamRes = await forexProvidersApi.forexConnectStreamStatus();
        setStream(streamRes as unknown as Record<string, unknown>);
      } catch {
        setStream(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load ForexConnect status.");
      setStatus({ status: "SERVICE_UNAVAILABLE" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy("connect");
    setNote(null);
    try {
      const res = await forexProvidersApi.forexConnectConnect();
      setStatus(res as unknown as FcStatus);
      setNote(
        res.status === "CONNECTED"
          ? `Connected. Instruments available: ${Number(res.instrumentCount ?? 0)}`
          : String(res.errorMessage ?? res.status),
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Connect failed.");
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      const res = await forexProvidersApi.forexConnectDisconnect();
      setStatus(res as unknown as FcStatus);
      setInstruments([]);
      setCandleSample(null);
      setNote("Disconnected.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  };

  const loadInstruments = async () => {
    setBusy("instruments");
    setNote(null);
    try {
      const res = await forexProvidersApi.forexConnectInstruments();
      const list = (res.instruments as Array<Record<string, unknown>>) ?? [];
      setInstruments(list);
      if (list[0]?.providerSymbol) {
        setSampleSymbol(String(list[0].providerSymbol));
      }
      setNote(`Discovered ${res.count} instruments from ForexConnect Offers.`);
      void refresh();
    } catch (err) {
      setInstruments([]);
      setNote(err instanceof Error ? err.message : "Instrument discovery failed.");
    } finally {
      setBusy(null);
    }
  };

  const testHistorical = async () => {
    setBusy("candles");
    setNote(null);
    setCandleSample(null);
    try {
      const res = await forexProvidersApi.forexConnectCandles({
        symbol: sampleSymbol,
        timeframe: sampleTf,
        limit: 20,
      });
      const candles = Array.isArray(res.candles) ? res.candles : [];
      const providerOk = res.ok && candles.every((c) => {
        // Bridge returns normalized candles; accept either shape.
        return Number.isFinite(Number(c.time ?? c.Date ? Date.parse(String(c.Date)) / 1000 : NaN))
          || Number.isFinite(Number(c.open ?? c.BidOpen));
      });
      if (!res.ok || !providerOk) {
        setNote(res.error?.message ?? "Historical sample failed validation.");
        return;
      }
      setCandleSample({
        count: res.count,
        priceBasis: res.priceBasis,
        periodId: res.periodId,
        fetchedAt: res.fetchedAt ?? res.lastHistoricalAt ?? null,
        first: candles[0] ?? null,
        last: candles[candles.length - 1] ?? null,
      });
      setNote(
        `Historical sample OK: ${res.count} candles · basis ${res.priceBasis ?? "bid"} · period ${res.periodId ?? sampleTf}.`,
      );
      void refresh();
    } catch (err) {
      setCandleSample(null);
      setNote(err instanceof Error ? err.message : "Historical candle request failed.");
    } finally {
      setBusy(null);
    }
  };

  const connectionStatus = String(status?.status ?? "—");
  const configured = Boolean(status?.configured);
  const enabled = Boolean(status?.enabled);
  const historicalCapable = Boolean(status?.historicalCapable) || connectionStatus === "CONNECTED";
  const supportedTfs = Array.isArray(status?.supportedTimeframes)
    ? (status?.supportedTimeframes as string[])
    : [...SAMPLE_TIMEFRAMES];

  return (
    <div data-forex-admin-forexconnect>
      <section className="fxa-card">
        <h2>FOREXCONNECT</h2>
        <p className="fxa-muted">
          Official FXCM ForexConnect SDK via private localhost sidecar.
          Username/password authentication (not Socket REST token). Trading disabled.
          Historical candles use get_history (bid OHLC). Credentials stay server-side.
        </p>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}

      <section className="fxa-card" data-fc-status={connectionStatus}>
        <h3>Connection status</h3>
        <ul>
          <li>
            Status:{" "}
            <span className="fxa-badge" data-tone={tone(connectionStatus) === "neutral" ? undefined : tone(connectionStatus)}>
              {connectionStatus}
            </span>
          </li>
          <li>Enabled: {enabled ? "YES" : "NO"}</li>
          <li>Configured: {configured ? "YES (username/password present)" : "NO"}</li>
          <li>Environment: {String(status?.environmentLabel ?? "—")}</li>
          <li>SDK available: {String(status?.sdkAvailable ?? "—")}</li>
          <li>Sidecar reachable: {String(status?.sidecarReachable ?? "—")}</li>
          <li>Connected at: {String(status?.connectedAt ?? "—")}</li>
          <li>Instrument count: {String(status?.instrumentCount ?? 0)}</li>
          <li>Historical capable: {historicalCapable ? "YES (when CONNECTED)" : "NO"}</li>
          <li>Price basis: bid</li>
          <li>Supported timeframes: {supportedTfs.join(", ")}</li>
          <li>Last historical at: {String(status?.lastHistoricalAt ?? candleSample?.fetchedAt ?? "—")}</li>
          <li>Trading: DISABLED</li>
          {status?.errorCode ? <li>Error code: {String(status.errorCode)}</li> : null}
          {status?.errorMessage ? <li>Safe error: {String(status.errorMessage)}</li> : null}
          {status?.sdkImportError ? <li>SDK import: {String(status.sdkImportError)}</li> : null}
        </ul>
        {note ? <p className="fxa-muted">{note}</p> : null}
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void connect()}>
            {busy === "connect" ? "Connecting…" : "Connect ForexConnect"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null || connectionStatus !== "CONNECTED"} onClick={() => void loadInstruments()}>
            {busy === "instruments" ? "Loading…" : "Discover instruments"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void disconnect()}>
            Disconnect
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void refresh()}>
            Refresh status
          </button>
        </div>
        {!enabled ? (
          <p className="fxa-muted">
            Set KWIZERA_FOREXCONNECT_ENABLED=1 and credentials in the server .env, install the ForexConnect
            Python package on the VPS, and start kwizera-forexconnect.service.
          </p>
        ) : null}
      </section>

      <section className="fxa-card" data-fc-stream>
        <h3>Live stream (Offers table)</h3>
        <p className="fxa-muted">
          Read-only subscription via official Common.subscribe_table_updates on Offers.
          Candle OHLC uses bid (same basis as historical). LIVE only after real updates arrive.
        </p>
        <ul>
          <li>Stream state: {String(stream?.streamState ?? "—")}</li>
          <li>Offers listener: {String(stream?.offersListenerActive ?? "—")}</li>
          <li>Active subscriptions: {String(stream?.subscriptionCount ?? 0)} / {String(stream?.maxSubscriptions ?? 8)}</li>
          <li>Subscribed: {Array.isArray(stream?.subscriptions) ? (stream!.subscriptions as string[]).join(", ") || "—" : "—"}</li>
          <li>Update count: {String(stream?.updateCount ?? 0)}</li>
          <li>Last quote at: {String(stream?.lastQuoteAt ?? "—")}</li>
          <li>Last quote age (ms): {String(stream?.lastQuoteAgeMs ?? "—")}</li>
          <li>Last stream error: {String(stream?.lastStreamError ?? "—")}</li>
          <li>Price basis: bid</li>
          {lastQuote ? (
            <li>
              Latest quote {String(lastQuote.providerSymbol)} bid={String(lastQuote.bid)} ask={String(lastQuote.ask ?? "—")}
            </li>
          ) : null}
        </ul>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || connectionStatus !== "CONNECTED"}
            onClick={() => {
              void (async () => {
                setBusy("stream");
                setNote(null);
                try {
                  const res = await forexProvidersApi.forexConnectSubscribe(sampleSymbol);
                  setNote(res.ok
                    ? `Subscribed ${res.providerSymbol ?? sampleSymbol}. Waiting for Offers updates…`
                    : (res.error?.message ?? "Subscribe failed."));
                  const quotes = await forexProvidersApi.forexConnectQuotes().catch(() => null);
                  setLastQuote((quotes?.quotes?.[0] as Record<string, unknown>) ?? null);
                  void refresh();
                } catch (err) {
                  setNote(err instanceof Error ? err.message : "Subscribe failed.");
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            {busy === "stream" ? "Working…" : "Test live subscribe"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null}
            onClick={() => {
              void (async () => {
                setBusy("stream");
                try {
                  await forexProvidersApi.forexConnectUnsubscribe(sampleSymbol);
                  setLastQuote(null);
                  setNote(`Unsubscribed ${sampleSymbol}.`);
                  void refresh();
                } catch (err) {
                  setNote(err instanceof Error ? err.message : "Unsubscribe failed.");
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            Stop test subscription
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void refresh()}>
            Refresh stream status
          </button>
        </div>
      </section>

      <section className="fxa-card" data-fc-historical>
        <h3>Historical candles (diagnostics)</h3>
        <p className="fxa-muted">
          Bounded sample via official ForexConnect.get_history. Never fabricates candles.
          Requires an authenticated session. Distinct from FXCM Socket REST.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            Instrument
            <input
              value={sampleSymbol}
              onChange={(e) => setSampleSymbol(e.target.value)}
              disabled={busy !== null}
              aria-label="ForexConnect sample instrument"
            />
          </label>
          <label>
            Timeframe
            <select
              value={sampleTf}
              onChange={(e) => setSampleTf(e.target.value as (typeof SAMPLE_TIMEFRAMES)[number])}
              disabled={busy !== null}
              aria-label="ForexConnect sample timeframe"
            >
              {SAMPLE_TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || connectionStatus !== "CONNECTED"}
            onClick={() => void testHistorical()}
          >
            {busy === "candles" ? "Requesting…" : "Test historical sample (20)"}
          </button>
        </div>
        {candleSample ? (
          <ul>
            <li>Candles returned: {candleSample.count}</li>
            <li>Price basis: {candleSample.priceBasis ?? "bid"}</li>
            <li>Period id: {candleSample.periodId ?? "—"}</li>
            <li>Fetched at: {String(candleSample.fetchedAt ?? "—")}</li>
            {candleSample.first ? (
              <li>
                First: t={String(candleSample.first.time ?? "—")} O={String(candleSample.first.open ?? candleSample.first.BidOpen ?? "—")}
                {" "}C={String(candleSample.first.close ?? candleSample.first.BidClose ?? "—")}
              </li>
            ) : null}
            {candleSample.last ? (
              <li>
                Last: t={String(candleSample.last.time ?? "—")} O={String(candleSample.last.open ?? candleSample.last.BidOpen ?? "—")}
                {" "}C={String(candleSample.last.close ?? candleSample.last.BidClose ?? "—")}
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="fxa-muted">No historical sample loaded yet.</p>
        )}
      </section>

      <section className="fxa-card">
        <h3>Instruments ({instruments.length})</h3>
        {instruments.length === 0 ? (
          <p className="fxa-muted">No instruments loaded. Connect successfully, then discover.</p>
        ) : (
          <div className="fx-markets-table-wrap">
            <table className="fx-markets-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Symbol</th>
                  <th>Canonical</th>
                  <th>Base</th>
                  <th>Quote</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {instruments.slice(0, 200).map((row) => (
                  <tr key={String(row.canonicalSymbol ?? row.providerSymbol)}>
                    <td>{String(row.provider ?? "FOREXCONNECT")}</td>
                    <td>{String(row.displaySymbol ?? row.providerSymbol)}</td>
                    <td>{String(row.canonicalSymbol ?? "—")}</td>
                    <td>{String(row.baseAsset ?? "—")}</td>
                    <td>{String(row.quoteAsset ?? "—")}</td>
                    <td>{String(row.marketType ?? "FOREX")}</td>
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
