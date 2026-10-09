import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

type FcStatus = Record<string, unknown>;

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
  const [busy, setBusy] = useState<"connect" | "instruments" | "disconnect" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await forexProvidersApi.forexConnectStatus();
      setStatus(res as unknown as FcStatus);
      setError(null);
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
      setInstruments((res.instruments as Array<Record<string, unknown>>) ?? []);
      setNote(`Discovered ${res.count} instruments from ForexConnect Offers.`);
      void refresh();
    } catch (err) {
      setInstruments([]);
      setNote(err instanceof Error ? err.message : "Instrument discovery failed.");
    } finally {
      setBusy(null);
    }
  };

  const connectionStatus = String(status?.status ?? "—");
  const configured = Boolean(status?.configured);
  const enabled = Boolean(status?.enabled);

  return (
    <div data-forex-admin-forexconnect>
      <section className="fxa-card">
        <h2>FOREXCONNECT</h2>
        <p className="fxa-muted">
          Official FXCM ForexConnect SDK via private localhost sidecar.
          Username/password authentication (not Socket REST token). Trading disabled.
          Credentials stay server-side.
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
