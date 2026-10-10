import { useCallback, useEffect, useMemo, useState } from "react";
import {
  forexProvidersApi,
  type ForexConnectProfilePublic,
  type ForexConnectProfilesState,
} from "./api";

type FcStatus = Record<string, unknown>;
type EnvTab = "demo" | "live";
type Busy =
  | "save"
  | "test"
  | "discover"
  | "activate"
  | "disconnect"
  | "candles"
  | "stream"
  | null;

const SAMPLE_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

function tone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "CONNECTED" || status === "INSTRUMENTS_READY" || status === "STREAMING" || status === "LIVE") {
    return "ok";
  }
  if (
    status === "CONNECTING"
    || status === "NOT_CONFIGURED"
    || status === "DISCONNECTED"
    || status === "STALE"
    || status === "SUBSCRIBED_WAITING"
  ) {
    return "warn";
  }
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

function emptyProfile(env: EnvTab): ForexConnectProfilePublic {
  return {
    environment: env,
    sdkEnvironment: env === "live" ? "real" : "demo",
    label: env === "live" ? "LIVE" : "DEMO",
    usernameConfigured: false,
    passwordConfigured: false,
    usernameHint: null,
    configured: false,
    lastAuthStatus: null,
    lastAuthAt: null,
    lastAuthError: null,
    lastInstrumentCount: null,
    lastInstrumentAt: null,
    lastConnectedAt: null,
  };
}

export function ForexAdminForexConnectPage() {
  const [tab, setTab] = useState<EnvTab>("demo");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profiles, setProfiles] = useState<ForexConnectProfilesState | null>(null);
  const [status, setStatus] = useState<FcStatus | null>(null);
  const [instruments, setInstruments] = useState<Array<Record<string, unknown>>>([]);
  const [instrumentQuery, setInstrumentQuery] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
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

  const profile = profiles?.profiles?.[tab] ?? emptyProfile(tab);
  const connectionStatus = String(status?.status ?? "—");
  const activeEnv = profiles?.activeEnvironment ?? null;
  const activeLabel = activeEnv === "live" ? "LIVE" : activeEnv === "demo" ? "DEMO" : "NONE";

  const filteredInstruments = useMemo(() => {
    const q = instrumentQuery.trim().toLowerCase();
    if (!q) return instruments;
    return instruments.filter((row) => {
      const hay = [
        row.providerSymbol,
        row.displaySymbol,
        row.canonicalSymbol,
        row.baseAsset,
        row.quoteAsset,
      ].map((v) => String(v ?? "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [instruments, instrumentQuery]);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, profilesRes] = await Promise.all([
        forexProvidersApi.forexConnectStatus(),
        forexProvidersApi.forexConnectProfiles().catch(() => null),
      ]);
      setStatus(statusRes as unknown as FcStatus);
      const nextProfiles = profilesRes ?? (statusRes.profiles ?? null);
      setProfiles(nextProfiles);
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

  useEffect(() => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
  }, [tab]);

  const confirmIfNeeded = (message?: string): boolean => {
    if (!message) return true;
    return window.confirm(message);
  };

  const saveCredentials = async () => {
    setBusy("save");
    setNote(null);
    try {
      const res = await forexProvidersApi.forexConnectSaveCredentials({
        environment: tab,
        username,
        password,
      });
      setProfiles(res.profiles);
      setPassword("");
      setShowPassword(false);
      setNote(`${res.profile.label} credentials saved.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  };

  const runProfileAction = async (
    kind: "test" | "activate",
    confirmSwitch = false,
  ) => {
    setBusy(kind);
    setNote(null);
    try {
      const res = kind === "test"
        ? await forexProvidersApi.forexConnectTestProfile({ environment: tab, confirmSwitch })
        : await forexProvidersApi.forexConnectActivateProfile({ environment: tab, confirmSwitch });
      setProfiles(res.profiles);
      setStatus(res.status as unknown as FcStatus);
      if (res.ok) {
        setNote(
          kind === "activate"
            ? `${res.label} activated. Instruments: ${Number(res.status.instrumentCount ?? 0)}`
            : `${res.label} test OK. Status: ${res.status.status}`,
        );
      } else {
        setNote(res.error?.message ?? res.status.errorMessage ?? res.status.status);
      }
    } catch (err) {
      const payload = (err as { payload?: {
        requiresConfirmation?: boolean;
        confirmationMessage?: string;
        profiles?: ForexConnectProfilesState;
      } }).payload;
      if (payload?.requiresConfirmation && payload.confirmationMessage) {
        if (confirmIfNeeded(payload.confirmationMessage)) {
          await runProfileAction(kind, true);
          return;
        }
        setNote("Switch cancelled.");
      } else {
        setNote(err instanceof Error ? err.message : `${kind} failed.`);
      }
      if (payload?.profiles) setProfiles(payload.profiles);
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const discover = async () => {
    setBusy("discover");
    setNote(null);
    try {
      const res = await forexProvidersApi.forexConnectDiscoverProfile({ environment: tab });
      const list = res.instruments ?? [];
      setInstruments(list);
      if (res.profiles) setProfiles(res.profiles);
      if (list[0]?.providerSymbol) setSampleSymbol(String(list[0].providerSymbol));
      setNote(
        res.ok
          ? `${res.label ?? tab.toUpperCase()}: ${res.count} instruments · FOREXCONNECT`
          : (res.error?.message ?? "Discovery failed."),
      );
    } catch (err) {
      setInstruments([]);
      setNote(err instanceof Error ? err.message : "Instrument discovery failed.");
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await forexProvidersApi.forexConnectDisconnect();
      setInstruments([]);
      setCandleSample(null);
      setLastQuote(null);
      setNote("Disconnected.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(null);
      void refresh();
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
      if (!res.ok) {
        setNote(res.error?.message ?? "Historical sample failed.");
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
      setNote(`Historical OK: ${res.count} candles · bid · ${res.periodId ?? sampleTf}.`);
    } catch (err) {
      setCandleSample(null);
      setNote(err instanceof Error ? err.message : "Historical candle request failed.");
    } finally {
      setBusy(null);
    }
  };

  const streamState = String(stream?.streamState ?? "—");
  const configLabel = profile.configured ? "CONFIGURED" : "NOT_CONFIGURED";
  const authLabel = profile.lastAuthStatus
    ?? (connectionStatus === "CONNECTED" && activeEnv === tab ? "CONNECTED" : "—");
  const instrumentsLabel = profile.lastInstrumentCount != null && profile.lastInstrumentCount > 0
    ? "INSTRUMENTS_READY"
    : (Number(status?.instrumentCount ?? 0) > 0 && activeEnv === tab ? "INSTRUMENTS_READY" : "—");
  const streamingLabel = streamState === "LIVE"
    ? "STREAMING"
    : streamState === "STALE"
      ? "STALE"
      : streamState;

  return (
    <div data-forex-admin-forexconnect>
      <section className="fxa-card">
        <h2>ForexConnect Accounts</h2>
        <p className="fxa-muted">
          DEMO and LIVE profiles · FOREXCONNECT · trading disabled
        </p>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}
      {profiles?.persistenceWarning ? (
        <div className="fxa-error" role="status">{profiles.persistenceWarning}</div>
      ) : null}

      <section className="fxa-card" data-fc-accounts>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["demo", "live"] as const).map((env) => (
            <button
              key={env}
              type="button"
              className="fxa-btn"
              data-tone={tab === env ? "ok" : undefined}
              aria-pressed={tab === env}
              onClick={() => setTab(env)}
            >
              {env === "demo" ? "DEMO" : "LIVE"}
              {profiles?.profiles?.[env]?.configured ? " · ✓" : ""}
            </button>
          ))}
        </div>

        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            Username / Login ID
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              disabled={busy !== null}
              placeholder={profile.usernameHint ? `Saved: ${profile.usernameHint}` : "FXCM login"}
              aria-label={`${tab} username`}
            />
          </label>
          <label>
            Password
            <span className="fxa-row" style={{ gap: 6, alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy !== null}
                placeholder={profile.passwordConfigured ? "••••••••" : "Password"}
                aria-label={`${tab} password`}
              />
              <button
                type="button"
                className="fxa-btn"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy !== null}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        </div>

        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void saveCredentials()}>
            {busy === "save" ? "Saving…" : "Save Credentials"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void runProfileAction("test")}>
            {busy === "test" ? "Testing…" : "Test Connection"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void discover()}>
            {busy === "discover" ? "Discovering…" : "Discover Instruments"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void runProfileAction("activate")}>
            {busy === "activate" ? "Activating…" : "Activate / Connect"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void disconnect()}>
            {busy === "disconnect" ? "…" : "Disconnect"}
          </button>
        </div>
        {note ? <p className="fxa-muted" style={{ marginTop: 10 }}>{note}</p> : null}
      </section>

      <section className="fxa-card" data-fc-status={connectionStatus}>
        <h3>Status</h3>
        <ul>
          <li>
            Active environment:{" "}
            <span className="fxa-badge" data-tone={activeEnv ? "ok" : "warn"}>{activeLabel}</span>
          </li>
          <li>
            Session:{" "}
            <span className="fxa-badge" data-tone={tone(connectionStatus) === "neutral" ? undefined : tone(connectionStatus)}>
              {connectionStatus}
            </span>
          </li>
          <li>Configuration ({profile.label}): {configLabel}</li>
          <li>SDK / sidecar: {String(status?.sdkAvailable ?? "—")} / {String(status?.sidecarReachable ?? "—")}</li>
          {status?.runtimeProbe && typeof status.runtimeProbe === "object" ? (
            <li>
              Runtime probe: {String((status.runtimeProbe as Record<string, unknown>).runtimeReady ?? "—")}
              {" · "}
              {String((status.runtimeProbe as Record<string, unknown>).os ?? "")}
              {" · "}
              {String((status.runtimeProbe as Record<string, unknown>).arch ?? "")}
              {" · "}
              {String((status.runtimeProbe as Record<string, unknown>).sdkVersionInstalled
                ?? (status.runtimeProbe as Record<string, unknown>).note
                ?? "")}
            </li>
          ) : null}
          <li>Authentication: {authLabel}</li>
          <li>Instruments: {instrumentsLabel} ({String(profile.lastInstrumentCount ?? status?.instrumentCount ?? 0)})</li>
          <li>Streaming: {streamingLabel}</li>
          <li>Last quote: {String(stream?.lastQuoteAt ?? "—")}</li>
          <li>Storage: {profiles?.storageMode ?? "—"}</li>
          <li>Trading: DISABLED</li>
          {profile.lastAuthError ? <li>Error: {profile.lastAuthError}</li> : null}
          {status?.errorMessage && !profile.lastAuthError ? <li>Error: {String(status.errorMessage)}</li> : null}
        </ul>
      </section>

      <section className="fxa-card" data-fc-stream>
        <h3>Live data</h3>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            Instrument
            <input
              value={sampleSymbol}
              onChange={(e) => setSampleSymbol(e.target.value)}
              disabled={busy !== null}
              aria-label="ForexConnect instrument"
            />
          </label>
          <label>
            Timeframe
            <select
              value={sampleTf}
              onChange={(e) => setSampleTf(e.target.value as (typeof SAMPLE_TIMEFRAMES)[number])}
              disabled={busy !== null}
              aria-label="ForexConnect timeframe"
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
            {busy === "candles" ? "…" : "Load history"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || connectionStatus !== "CONNECTED"}
            onClick={() => {
              void (async () => {
                setBusy("stream");
                try {
                  const res = await forexProvidersApi.forexConnectSubscribe(sampleSymbol);
                  setNote(res.ok
                    ? `Subscribed ${res.providerSymbol ?? sampleSymbol}`
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
            {busy === "stream" ? "…" : "Subscribe quotes"}
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
                  setNote(`Unsubscribed ${sampleSymbol}`);
                  void refresh();
                } catch (err) {
                  setNote(err instanceof Error ? err.message : "Unsubscribe failed.");
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            Stop
          </button>
        </div>
        <ul style={{ marginTop: 10 }}>
          <li>Stream: {streamState}</li>
          <li>Updates: {String(stream?.updateCount ?? 0)}</li>
          <li>Age (ms): {String(stream?.lastQuoteAgeMs ?? "—")}</li>
          {lastQuote ? (
            <li>
              Quote {String(lastQuote.providerSymbol)} bid={String(lastQuote.bid)} ask={String(lastQuote.ask ?? "—")}
            </li>
          ) : null}
          {candleSample ? (
            <li>
              History sample: {candleSample.count} · {candleSample.priceBasis ?? "bid"} · {String(candleSample.fetchedAt ?? "—")}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="fxa-card">
        <h3>Instruments ({filteredInstruments.length}{instrumentQuery ? ` / ${instruments.length}` : ""})</h3>
        <label>
          Search
          <input
            value={instrumentQuery}
            onChange={(e) => setInstrumentQuery(e.target.value)}
            placeholder="EUR, USD, …"
            aria-label="Search instruments"
          />
        </label>
        {filteredInstruments.length === 0 ? (
          <p className="fxa-muted">No instruments loaded for the active environment.</p>
        ) : (
          <div className="fx-markets-table-wrap">
            <table className="fx-markets-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Symbol</th>
                  <th>Canonical</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstruments.slice(0, 200).map((row) => (
                  <tr key={String(row.canonicalSymbol ?? row.providerSymbol)}>
                    <td>{String(row.provider ?? "FOREXCONNECT")}</td>
                    <td>{String(row.displaySymbol ?? row.providerSymbol)}</td>
                    <td>{String(row.canonicalSymbol ?? "—")}</td>
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
