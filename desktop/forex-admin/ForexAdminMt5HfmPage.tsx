import { useCallback, useEffect, useState } from "react";
import {
  clearForexAdminSessionToken,
  forexProvidersApi,
  getForexAdminSessionToken,
  setForexAdminSessionToken,
  type Mt5HfmDemoStatus,
} from "./api";

type Busy = "auth" | "save" | "clear" | "test" | "refresh" | null;

export function ForexAdminMt5HfmPage() {
  const [status, setStatus] = useState<Mt5HfmDemoStatus | null>(null);
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminTokenDraft, setAdminTokenDraft] = useState("");
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminAuthChecking, setAdminAuthChecking] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setError(null);
    try {
      const next = await forexProvidersApi.mt5HfmStatus();
      setStatus(next);
      if (!login && next.loginHint) {
        // Do not auto-fill full login; keep field empty with hint in placeholder.
      }
      if (!server && next.server) setServer(next.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HFM MT5 status.");
    } finally {
      setBusy(null);
    }
  }, [login, server]);

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
      setNote("Admin session authorized for HFM MT5 Demo actions.");
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
        login: login.trim(),
        server: server.trim(),
        password,
      });
      setStatus(result.status);
      setPassword("");
      setShowPassword(false);
      setNote(result.note ?? "Demo credentials saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function clearCredentials() {
    if (!window.confirm("Clear saved HFM MT5 Demo credentials from the encrypted vault?")) {
      return;
    }
    setBusy("clear");
    setError(null);
    setNote(null);
    try {
      const result = await forexProvidersApi.mt5HfmClearCredentials();
      setStatus(result.status);
      setLogin("");
      setServer("");
      setPassword("");
      setNote(result.note ?? "Demo credentials cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed.");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy("test");
    setError(null);
    setNote(null);
    try {
      const result = await forexProvidersApi.mt5HfmTestConnection();
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

  const account = status?.account ?? null;
  const connectionTone =
    status?.connectionStatus === "demo_network_reachable"
      ? "ok"
      : status?.connectionStatus === "credentials_saved"
        ? "warn"
        : status?.connectionStatus?.includes("unreachable") || status?.connectionStatus?.includes("failed")
          ? "danger"
          : "warn";

  return (
    <div data-forex-admin-mt5-hfm>
      <section className="fxa-card">
        <h2>HFM MT5 Demo</h2>
        <p className="fxa-muted">
          Demo credential vault and connectivity checks · Live unavailable · No order execution
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
          <button type="button" className="fxa-btn" data-tone="ok" aria-pressed>
            DEMO{status?.configured ? " · ✓" : ""}
          </button>
          <button type="button" className="fxa-btn" disabled title={status?.liveNote ?? "Live unavailable"}>
            LIVE · unavailable
          </button>
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          {status?.liveNote ?? "HFM Live login is disabled in this phase."}
        </p>
      </section>

      <section className="fxa-card" data-mt5-credentials>
        <h3>Demo credentials</h3>
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            Demo account number
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
              disabled={busy !== null}
              placeholder={status?.loginHint ? `Saved: ${status.loginHint}` : "Account login"}
              aria-label="HFM Demo account number"
            />
          </label>
          <label>
            Demo server
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              autoComplete="off"
              list="mt5-hfm-demo-servers"
              disabled={busy !== null}
              placeholder={status?.server ?? "HFMarketsGlobal-Demo"}
              aria-label="HFM Demo server"
            />
            <datalist id="mt5-hfm-demo-servers">
              {(status?.allowedServers ?? []).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
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
                placeholder={status?.passwordConfigured ? "•••••••• (saved)" : "Password"}
                aria-label="HFM Demo password"
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
            {busy === "save" ? "Saving…" : status?.passwordConfigured ? "Replace credentials" : "Save credentials"}
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
            disabled={busy !== null || !adminAuthorized}
            onClick={() => void testConnection()}
          >
            {busy === "test" ? "Testing…" : "Test connection"}
          </button>
          <button type="button" className="fxa-btn" disabled={busy !== null} onClick={() => void refresh()}>
            {busy === "refresh" ? "…" : "Refresh status"}
          </button>
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          Password: {status?.passwordConfigured ? "saved (masked)" : "not saved"}
          {status?.loginHint ? ` · Login: ${status.loginHint}` : ""}
          {status?.server ? ` · Server: ${status.server}` : ""}
        </p>
        {note ? <p className="fxa-muted" style={{ marginTop: 10 }}>{note}</p> : null}
      </section>

      <section className="fxa-card" data-mt5-status>
        <h3>Connection status</h3>
        <ul>
          <li>
            Environment:{" "}
            <span className="fxa-badge" data-tone="ok">DEMO</span>
            {" · "}
            <span className="fxa-badge" data-tone="danger">LIVE unavailable</span>
          </li>
          <li>
            Vault:{" "}
            <span className="fxa-badge" data-tone={status?.vaultUnlocked ? "ok" : "warn"}>
              {status?.storageMode ?? "—"}
            </span>
          </li>
          <li>
            Configured:{" "}
            <span className="fxa-badge" data-tone={status?.configured ? "ok" : "warn"}>
              {status?.configured ? "yes" : "no"}
            </span>
          </li>
          <li>
            Connection:{" "}
            <span className="fxa-badge" data-tone={connectionTone}>
              {status?.connectionStatus ?? "unknown"}
            </span>
          </li>
          <li>Last successful auth / probe: {status?.lastAuthAt ?? "—"}</li>
          <li>Last connection error: {status?.lastAuthError ?? "—"}</li>
          <li>Credentials updated: {status?.credentialsUpdatedAt ?? "—"}</li>
          <li>Last sync: {status?.lastSyncAt ?? "—"}</li>
          <li>MT5 login bridge: {status?.mt5LoginBridge ?? "not_implemented"}</li>
          <li>Probe summary: {status?.lastProbeSummary ?? "—"}</li>
        </ul>
      </section>

      <section className="fxa-card" data-mt5-account>
        <h3>Demo account information</h3>
        {account ? (
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
            No verified account snapshot yet. Network Test Connection does not log into MT5.
            Account balance/equity require the approved local `mt5` agent (proposed, not enabled).
          </p>
        )}
      </section>
    </div>
  );
}
