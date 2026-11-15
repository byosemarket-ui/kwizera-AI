import { useCallback, useEffect, useState } from "react";
import {
  clearForexAdminSessionToken,
  forexProvidersApi,
  getForexAdminSessionToken,
  setForexAdminSessionToken,
  type Mt5HfmDemoStatus,
  type Mt5HfmEnvStatus,
} from "./api";

type EnvTab = "demo" | "live";
type Busy = "auth" | "save" | "clear" | "test" | "refresh" | null;

function emptyDraft() {
  return { login: "", server: "", password: "" };
}

export function ForexAdminMt5HfmPage() {
  const [status, setStatus] = useState<Mt5HfmDemoStatus | null>(null);
  const [tab, setTab] = useState<EnvTab>("demo");
  const [demoDraft, setDemoDraft] = useState(emptyDraft);
  const [liveDraft, setLiveDraft] = useState(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);
  const [adminTokenDraft, setAdminTokenDraft] = useState("");
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminAuthChecking, setAdminAuthChecking] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const draft = tab === "demo" ? demoDraft : liveDraft;
  const setDraft = tab === "demo" ? setDemoDraft : setLiveDraft;
  const envStatus: Mt5HfmEnvStatus | null = status ? (tab === "demo" ? status.demo : status.live) : null;

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setError(null);
    try {
      const next = await forexProvidersApi.mt5HfmStatus();
      setStatus(next);
      setDemoDraft((prev) => ({
        ...prev,
        server: prev.server || next.demo.server || "",
      }));
      setLiveDraft((prev) => ({
        ...prev,
        server: prev.server || next.live.server || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HFM MT5 status.");
    } finally {
      setBusy(null);
    }
  }, []);

  const checkAdminAuth = useCallback(async () => {
    if (!getForexAdminSessionToken()) {
      setAdminAuthorized(false);
      return;
    }
    setAdminAuthChecking(true);
    try {
      await forexProvidersApi.mt5HfmAuthCheck();
      setAdminAuthorized(true);
    } catch {
      setAdminAuthorized(false);
    } finally {
      setAdminAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkAdminAuth();
    void refresh();
  }, [checkAdminAuth, refresh]);

  useEffect(() => {
    setShowPassword(false);
    setError(null);
    setNote(null);
  }, [tab]);

  async function unlockAdmin() {
    setBusy("auth");
    setError(null);
    try {
      const token = adminTokenDraft.trim();
      if (!token) throw new Error("Paste KWIZERA_ADMIN_API_TOKEN to authorize.");
      setForexAdminSessionToken(token);
      setAdminTokenDraft("");
      await forexProvidersApi.mt5HfmAuthCheck();
      setAdminAuthorized(true);
      setNote("Admin session authorized for HFM MT5 credential actions.");
      await refresh();
    } catch (err) {
      clearForexAdminSessionToken();
      setAdminAuthorized(false);
      setError(err instanceof Error ? err.message : "Admin authorization failed.");
    } finally {
      setBusy(null);
    }
  }

  function clearAdminSession() {
    clearForexAdminSessionToken();
    setAdminAuthorized(false);
    setNote("Admin session cleared.");
  }

  async function saveCredentials() {
    setBusy("save");
    setError(null);
    setNote(null);
    try {
      const result = await forexProvidersApi.mt5HfmSaveCredentials({
        environment: tab,
        login: draft.login.trim(),
        server: draft.server.trim(),
        password: draft.password,
      });
      setStatus(result.status);
      setDraft((prev) => ({ ...prev, password: "" }));
      setShowPassword(false);
      setNote(result.note ?? `${tab.toUpperCase()} credentials saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function clearCredentials() {
    const label = tab === "demo" ? "Demo" : "Live";
    if (!window.confirm(`Clear saved HFM MT5 ${label} credentials from the encrypted vault?`)) {
      return;
    }
    setBusy("clear");
    setError(null);
    setNote(null);
    try {
      const result = await forexProvidersApi.mt5HfmClearCredentials({ environment: tab });
      setStatus(result.status);
      setDraft(emptyDraft());
      setNote(result.note ?? `${label} credentials cleared.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed.");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    if (tab === "live") {
      setError("Live connection testing is locked. Live credentials may be stored only.");
      setNote(status?.liveGate.note ?? null);
      return;
    }
    setBusy("test");
    setError(null);
    setNote(null);
    try {
      const result = await forexProvidersApi.mt5HfmTestConnection({ environment: "demo" });
      setStatus(result.status);
      setNote(result.note ?? result.probe?.summary ?? "Test finished.");
      if (result.probe && !result.probe.ok) {
        setError(result.probe.summary ?? "Demo network probe failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test connection failed.");
    } finally {
      setBusy(null);
    }
  }

  const account = tab === "demo" ? status?.demo.account ?? null : null;
  const connectionTone =
    envStatus?.connectionStatus === "demo_network_reachable"
      ? "ok"
      : envStatus?.connectionStatus === "credentials_saved"
        ? "warn"
        : envStatus?.connectionStatus?.includes("unreachable") || envStatus?.connectionStatus?.includes("failed")
          ? "danger"
          : "warn";

  return (
    <div data-forex-admin-mt5-hfm>
      <section className="fxa-card">
        <h2>HFM MT5 Connection Manager</h2>
        <p className="fxa-muted">
          Encrypted Demo + Live credential vault · Live login/trading locked · No order execution
        </p>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}
      {status?.persistenceWarning ? (
        <div className="fxa-error" role="status">{status.persistenceWarning}</div>
      ) : null}

      <section className="fxa-card" data-mt5-admin-access>
        <h3>Admin API Access</h3>
        <p className="fxa-muted">
          Production requires the server Admin API token for Save / Clear / Test.
          Same session token as ForexConnect. Not an HFM trading password.
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
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={clearAdminSession}>
            Clear admin session
          </button>
        )}
      </section>

      <section className="fxa-card" data-mt5-env-tabs>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="fxa-btn"
            data-tone={tab === "demo" ? "ok" : undefined}
            aria-pressed={tab === "demo"}
            disabled={busy !== null}
            onClick={() => setTab("demo")}
          >
            DEMO{status?.demo.configured ? " · ✓" : ""}
          </button>
          <button
            type="button"
            className="fxa-btn"
            data-tone={tab === "live" ? "warn" : undefined}
            aria-pressed={tab === "live"}
            disabled={busy !== null}
            onClick={() => setTab("live")}
            title="Live credentials may be stored; login remains locked"
          >
            LIVE{status?.live.configured ? " · saved" : ""} · locked
          </button>
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          {tab === "demo"
            ? "Demo connection testing allowed (network probe). Terminal login bridge not enabled yet."
            : (status?.liveGate.note ?? status?.liveNote ?? "Live login and trading are disabled pending explicit owner authorization.")}
        </p>
      </section>

      <section className="fxa-card" data-mt5-credentials>
        <h3>{tab === "demo" ? "Demo" : "Live"} credentials</h3>
        {tab === "live" ? (
          <p className="fxa-muted" role="status">
            Saving Live credentials does <strong>not</strong> authorize Live login, connection tests, or trading.
          </p>
        ) : null}
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            {tab === "demo" ? "Demo" : "Live"} account number
            <input
              value={draft.login}
              onChange={(e) => setDraft((prev) => ({ ...prev, login: e.target.value }))}
              autoComplete="off"
              disabled={busy !== null}
              placeholder={envStatus?.loginHint ? `Saved: ${envStatus.loginHint}` : "Account login"}
              aria-label={`HFM ${tab} account number`}
            />
          </label>
          <label>
            {tab === "demo" ? "Demo" : "Live"} server
            <input
              value={draft.server}
              onChange={(e) => setDraft((prev) => ({ ...prev, server: e.target.value }))}
              autoComplete="off"
              list={`mt5-hfm-${tab}-servers`}
              disabled={busy !== null}
              placeholder={
                envStatus?.server
                ?? (tab === "demo" ? "HFMarketsGlobal-Demo" : "HFMarketsGlobal-Live1")
              }
              aria-label={`HFM ${tab} server`}
            />
            <datalist id={`mt5-hfm-${tab}-servers`}>
              {(envStatus?.allowedServers ?? []).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label>
            Password
            <span className="fxa-row" style={{ gap: 6, alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={draft.password}
                onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
                disabled={busy !== null}
                placeholder={envStatus?.passwordConfigured ? "•••••••• (saved)" : "Password"}
                aria-label={`HFM ${tab} password`}
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
            {busy === "save"
              ? "Saving…"
              : envStatus?.passwordConfigured
                ? "Replace credentials"
                : "Save credentials"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void clearCredentials()}
          >
            {busy === "clear" ? "…" : "Clear credentials"}
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy !== null || !adminAuthorized || tab === "live"}
            title={tab === "live" ? "Live connection testing is locked" : undefined}
            onClick={() => void testConnection()}
          >
            {busy === "test" ? "Testing…" : tab === "live" ? "Test locked" : "Test connection"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void refresh()}>
            {busy === "refresh" ? "…" : "Refresh status"}
          </button>
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          Password: {envStatus?.passwordConfigured ? "saved (masked)" : "not saved"}
          {envStatus?.loginHint ? ` · Login: ${envStatus.loginHint}` : ""}
          {envStatus?.server ? ` · Server: ${envStatus.server}` : ""}
        </p>
        {note ? <p className="fxa-muted" style={{ marginTop: 10 }}>{note}</p> : null}
      </section>

      <section className="fxa-card" data-mt5-status>
        <h3>{tab === "demo" ? "Demo" : "Live"} connection status</h3>
        <ul>
          <li>
            Environment:{" "}
            <span className="fxa-badge" data-tone={tab === "demo" ? "ok" : "warn"}>
              {tab.toUpperCase()}
            </span>
            {" · "}
            <span className="fxa-badge" data-tone="danger">
              LIVE login locked
            </span>
          </li>
          <li>
            Vault:{" "}
            <span className="fxa-badge" data-tone={status?.vaultUnlocked ? "ok" : "warn"}>
              {status?.storageMode ?? "—"}
            </span>
          </li>
          <li>
            Configured:{" "}
            <span className="fxa-badge" data-tone={envStatus?.configured ? "ok" : "warn"}>
              {envStatus?.configured ? "yes" : "no"}
            </span>
          </li>
          <li>
            Connection:{" "}
            <span className="fxa-badge" data-tone={connectionTone}>
              {envStatus?.connectionStatus ?? "unknown"}
            </span>
          </li>
          {tab === "demo" ? (
            <>
              <li>Last successful auth / probe: {envStatus?.lastAuthAt ?? "—"}</li>
              <li>Last connection error: {envStatus?.lastAuthError ?? "—"}</li>
              <li>Last sync: {envStatus?.lastSyncAt ?? "—"}</li>
              <li>Market-data / probe: {envStatus?.lastProbeSummary ?? "—"}</li>
              <li>MT5 login bridge: {status?.mt5LoginBridge ?? "not_implemented"}</li>
            </>
          ) : (
            <>
              <li>Activation locked: {status?.live.activationLocked ? "yes" : "no"}</li>
              <li>Login enabled: {String(status?.liveGate.loginEnabled ?? false)}</li>
              <li>Connection test enabled: {String(status?.liveGate.connectionTestEnabled ?? false)}</li>
              <li>Order execution enabled: {String(status?.liveGate.orderExecutionEnabled ?? false)}</li>
              <li>Automation enabled: {String(status?.liveGate.automationEnabled ?? false)}</li>
              <li>Credentials updated: {envStatus?.credentialsUpdatedAt ?? "—"}</li>
            </>
          )}
          {tab === "demo" ? <li>Credentials updated: {envStatus?.credentialsUpdatedAt ?? "—"}</li> : null}
        </ul>
      </section>

      <section className="fxa-card" data-mt5-account>
        <h3>{tab === "demo" ? "Demo account information" : "Live account information"}</h3>
        {tab === "live" ? (
          <p className="fxa-muted">
            Live account sync is disabled. Stored Live credentials are never used for login or trading
            until separate explicit owner authorization.
          </p>
        ) : account ? (
          <ul>
            <li>Login: {account.loginHint ?? "—"}</li>
            <li>Server: {account.server ?? "—"}</li>
            <li>Company: {account.company ?? "—"}</li>
            <li>Currency: {account.currency ?? "—"}</li>
            <li>Balance: {account.balance ?? "—"}</li>
            <li>Equity: {account.equity ?? "—"}</li>
            <li>Free margin: {account.freeMargin ?? "—"}</li>
            <li>Margin level: {account.marginLevel ?? "—"}</li>
            <li>Leverage: {account.leverage ?? "—"}</li>
            <li>Synced: {account.syncedAt ?? "—"}</li>
            {account.note ? <li>{account.note}</li> : null}
          </ul>
        ) : (
          <p className="fxa-muted">
            No verified Demo account snapshot yet. Network Test Connection does not log into MT5.
            Account balance/equity require the approved local `mt5` agent (proposed, not enabled).
          </p>
        )}
      </section>
    </div>
  );
}
