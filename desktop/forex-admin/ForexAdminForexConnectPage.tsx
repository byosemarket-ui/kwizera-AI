import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildForexConnectCatalog,
  FOREXCONNECT_EXPLORER_CATEGORIES,
} from "../../ai/market-data/forexconnect/instrument-classify";
import type { ForexConnectInstrument } from "../../ai/market-data/forexconnect/types";
import {
  clearForexAdminSessionToken,
  forexProvidersApi,
  getForexAdminSessionToken,
  setForexAdminSessionToken,
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
  | "auth"
  | "clear"
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
    || status === "AUTHENTICATED_IDLE"
    || status === "SUBSCRIBED"
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
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminTokenDraft, setAdminTokenDraft] = useState("");
  const [adminAuthChecking, setAdminAuthChecking] = useState(true);

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

  const catalogSummary = useMemo(() => {
    const mapped = instruments.map((row): ForexConnectInstrument => ({
      provider: "FOREXCONNECT",
      providerSymbol: String(row.providerSymbol ?? ""),
      canonicalSymbol: String(row.canonicalSymbol ?? ""),
      displaySymbol: String(row.displaySymbol ?? row.providerSymbol ?? ""),
      marketType: String(row.marketType ?? "FOREX"),
      baseAsset: row.baseAsset != null ? String(row.baseAsset) : null,
      quoteAsset: row.quoteAsset != null ? String(row.quoteAsset) : null,
      status: String(row.status ?? "available"),
      offerId: row.offerId != null ? String(row.offerId) : null,
      description: row.description != null ? String(row.description) : null,
      instrumentType: row.instrumentType ?? null,
    }));
    return buildForexConnectCatalog(mapped, {
      environment: activeEnv === "live" ? "real" : activeEnv === "demo" ? "demo" : null,
      environmentLabel: activeLabel === "NONE" ? null : activeLabel,
      fetchedAt: profile.lastInstrumentAt,
    }).summary;
  }, [instruments, activeEnv, activeLabel, profile.lastInstrumentAt]);

  const checkAdminAuth = useCallback(async () => {
    setAdminAuthChecking(true);
    if (!getForexAdminSessionToken()) {
      setAdminAuthorized(false);
      setAdminAuthChecking(false);
      return;
    }
    try {
      await forexProvidersApi.forexConnectAuthCheck();
      setAdminAuthorized(true);
    } catch {
      setAdminAuthorized(false);
    } finally {
      setAdminAuthChecking(false);
    }
  }, []);

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
    void checkAdminAuth();
    void refresh();
  }, [checkAdminAuth, refresh]);

  useEffect(() => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
  }, [tab]);

  const confirmIfNeeded = (message?: string): boolean => {
    if (!message) return true;
    return window.confirm(message);
  };

  const unlockAdmin = async () => {
    setBusy("auth");
    setNote(null);
    const token = adminTokenDraft.trim();
    if (!token) {
      setNote("Paste the Admin API token from the server .env (KWIZERA_ADMIN_API_TOKEN).");
      setBusy(null);
      return;
    }
    setForexAdminSessionToken(token);
    setAdminTokenDraft("");
    try {
      await forexProvidersApi.forexConnectAuthCheck();
      setAdminAuthorized(true);
      setNote("Admin session authorized for ForexConnect credential actions.");
    } catch (err) {
      clearForexAdminSessionToken();
      setAdminAuthorized(false);
      setNote(err instanceof Error ? err.message : "Admin authorization failed.");
    } finally {
      setBusy(null);
    }
  };

  const clearAdminSession = () => {
    clearForexAdminSessionToken();
    setAdminAuthorized(false);
    setAdminTokenDraft("");
    setNote("Admin session cleared. Re-enter the Admin API token to save credentials.");
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
      setAdminAuthorized(true);
      setNote(
        res.storageMode === "encrypted-vault"
          ? `${res.profile.label} credentials saved · Storage: encrypted-vault`
          : `${res.profile.label} credentials saved.`,
      );
      void refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      if (/Admin API token/i.test(message)) setAdminAuthorized(false);
      setNote(message);
    } finally {
      setBusy(null);
    }
  };

  const clearCredentials = async () => {
    if (!window.confirm(`Remove saved ${tab.toUpperCase()} credentials from the encrypted vault?`)) {
      return;
    }
    setBusy("clear");
    setNote(null);
    try {
      const res = await forexProvidersApi.forexConnectClearCredentials({ environment: tab });
      setProfiles(res.profiles);
      setUsername("");
      setPassword("");
      setNote(`${tab.toUpperCase()} credentials cleared.`);
      void refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Clear failed.");
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
      : streamState === "AUTHENTICATED_IDLE"
        ? "AUTHENTICATED_IDLE"
        : streamState;
  const feedLabel = streamState === "LIVE"
    ? "LIVE"
    : streamState === "STALE"
      ? "STALE"
      : connectionStatus === "CONNECTED"
        ? (Number(stream?.updateCount ?? 0) > 0 ? "AUTHENTICATED_IDLE" : "AUTHENTICATED_IDLE")
        : connectionStatus === "DISCONNECTED" || connectionStatus === "—"
          ? "DISCONNECTED"
          : String(connectionStatus);
  const subscribedInstrument = String(
    stream?.providerSymbol
    ?? stream?.symbol
    ?? (Array.isArray(stream?.subscriptions) && stream.subscriptions[0]
      ? (stream.subscriptions[0] as Record<string, unknown>).providerSymbol
      : null)
    ?? "—",
  );
  const activeSubscriptionCount = Number(
    stream?.activeSubscriptionCount
    ?? stream?.subscriptionCount
    ?? (Array.isArray(stream?.subscriptions) ? stream.subscriptions.length : 0)
    ?? 0,
  );
  const nextAction = !adminAuthorized
    ? "Authorize with Admin API token, then Test Connection on DEMO."
    : connectionStatus !== "CONNECTED"
      ? (profile.configured
        ? "DEMO credentials are saved. Click Activate / Connect (or wait for post-deploy DEMO restore), then Discover Instruments."
        : "Save DEMO credentials, then Activate / Connect and Discover Instruments.")
      : candleSample == null || candleSample.count <= 0
        ? "Load history for a discovered instrument (e.g. EUR/USD or AUD/CNH), then open Charts with provider=FOREXCONNECT."
        : Number(stream?.updateCount ?? 0) <= 0
          ? "Subscribe quotes on a discovered instrument. If updates stay 0, market may be closed — keep AUTHENTICATED_IDLE, retest when FXCM publishes ticks."
          : "Charts/Technical Analysis should consume the same FOREXCONNECT series. Retest live only when updateCount increases.";

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

      <section className="fxa-card" data-fc-admin-access>
        <h3>Admin API Access</h3>
        <p className="fxa-muted">
          Production requires the server Admin API token for Save / Test / Activate.
          Same browser session token as Admin Control Center → API Access. Not an FXCM password.
        </p>
        <ul>
          <li>
            Session:{" "}
            <span className="fxa-badge" data-tone={adminAuthorized ? "ok" : "warn"}>
              {adminAuthChecking ? "Checking…" : adminAuthorized ? "Authorized" : "Not authorized"}
            </span>
          </li>
        </ul>
        {!adminAuthorized ? (
          <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label>
              Admin API Token
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={adminTokenDraft}
                onChange={(e) => setAdminTokenDraft(e.target.value)}
                placeholder="Paste KWIZERA_ADMIN_API_TOKEN"
                aria-label="Admin API token"
                disabled={busy !== null}
              />
            </label>
            <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void unlockAdmin()}>
              {busy === "auth" ? "Checking…" : "Authorize session"}
            </button>
          </div>
        ) : (
          <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="fxa-btn" disabled={busy !== null} onClick={clearAdminSession}>
              Clear admin session
            </button>
          </div>
        )}
      </section>

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
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void saveCredentials()}
          >
            {busy === "save" ? "Saving…" : "Save Credentials"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void clearCredentials()}
          >
            {busy === "clear" ? "…" : "Clear Saved"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void runProfileAction("test")}
          >
            {busy === "test" ? "Testing…" : "Test Connection"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void discover()}
          >
            {busy === "discover" ? "Discovering…" : "Discover Instruments"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void runProfileAction("activate")}
          >
            {busy === "activate" ? "Activating…" : "Activate / Connect"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void disconnect()}
          >
            {busy === "disconnect" ? "…" : "Disconnect"}
          </button>
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          Password: {profile.passwordConfigured ? "saved" : "not saved"}
          {profile.usernameHint ? ` · User: ${profile.usernameHint}` : ""}
        </p>
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
          <li>Feed: <span className="fxa-badge" data-tone={tone(feedLabel) === "neutral" ? undefined : tone(feedLabel)}>{feedLabel}</span></li>
          <li>Streaming: {streamingLabel}</li>
          <li>Subscribed instrument: {subscribedInstrument}</li>
          <li>Active subscriptions: {String(activeSubscriptionCount)}</li>
          <li>Offers updates: {String(stream?.updateCount ?? 0)}</li>
          <li>Last quote: {String(stream?.lastQuoteAt ?? "—")} (age ms: {String(stream?.lastQuoteAgeMs ?? "—")})</li>
          <li>
            Historical sample:{" "}
            {candleSample
              ? `${candleSample.count} candles · last ${String((candleSample.last as { time?: number } | null)?.time ?? candleSample.fetchedAt ?? "—")}`
              : "not loaded"}
          </li>
          <li>Storage: {profiles?.storageMode ?? "—"}</li>
          <li>Trading: DISABLED</li>
          {profile.lastAuthError ? <li>Error: {profile.lastAuthError}</li> : null}
          {status?.errorMessage && !profile.lastAuthError ? <li>Error: {String(status.errorMessage)}</li> : null}
          <li data-fc-next-action>Next: {nextAction}</li>
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
              {candleSample.last && typeof (candleSample.last as { time?: number }).time === "number"
                ? ` · last candle t=${String((candleSample.last as { time: number }).time)}`
                : ""}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="fxa-card" data-fc-catalog-summary>
        <h3>Market Explorer diagnostics</h3>
        <ul>
          <li>Provider / environment: FOREXCONNECT · {activeLabel}</li>
          <li>Last discovery: {String(profile.lastInstrumentAt ?? "—")}</li>
          <li>Raw instruments: {catalogSummary.rawCount}</li>
          <li>Deduplicated: {catalogSummary.deduplicatedCount}</li>
          <li>Classified: {catalogSummary.classifiedCount}</li>
          <li>Unclassified: {catalogSummary.unclassifiedCount}</li>
        </ul>
        <ul data-fc-category-counts>
          {FOREXCONNECT_EXPLORER_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
            <li key={cat.id}>
              {cat.label}: {catalogSummary.categoryCounts[cat.id] ?? 0}
            </li>
          ))}
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
