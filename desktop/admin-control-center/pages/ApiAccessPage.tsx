import { KeyRound, ShieldCheck, ShieldOff, Cable } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AdminApiError,
  adminApi,
  clearStoredAdminToken,
  getStoredAdminToken,
  setStoredAdminToken,
} from "../admin-api";
import { PageHeader, SectionCard, StatusBadge, Toast } from "../components/ui";

/**
 * Admin API Access — browser session authorization ONLY.
 * AI provider API credentials live under AI Control → Providers.
 */
export function ApiAccessPage({ onGoToProviders }: { onGoToProviders?: () => void }) {
  const [draft, setDraft] = useState("");
  const [hasSessionToken, setHasSessionToken] = useState(() => Boolean(getStoredAdminToken()));
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const probe = () => {
    setChecking(true);
    setMessage(null);
    adminApi.health()
      .then(() => {
        setAuthorized(true);
        setHasSessionToken(Boolean(getStoredAdminToken()));
        setMessage(null);
      })
      .catch((err: unknown) => {
        setAuthorized(false);
        setHasSessionToken(Boolean(getStoredAdminToken()));
        if (err instanceof AdminApiError && err.status === 403) {
          setMessage(err.message);
        } else {
          setMessage(err instanceof Error ? err.message : "Could not verify Admin access");
        }
      })
      .finally(() => setChecking(false));
  };

  useEffect(probe, []);

  const unlock = async () => {
    const token = draft.trim();
    if (!token) {
      setToast("Enter the Admin API token from the server .env");
      return;
    }
    setBusy(true);
    setStoredAdminToken(token);
    setDraft("");
    try {
      await adminApi.health();
      setAuthorized(true);
      setHasSessionToken(true);
      setMessage(null);
      setToast("Admin session authorized");
    } catch (err) {
      clearStoredAdminToken();
      setAuthorized(false);
      setHasSessionToken(false);
      setMessage(err instanceof Error ? err.message : "Authorization failed");
      setToast("Authorization failed — token was not kept");
    } finally {
      setBusy(false);
    }
  };

  const clearSession = () => {
    clearStoredAdminToken();
    setDraft("");
    setAuthorized(false);
    setHasSessionToken(false);
    setMessage("Session cleared. Enter the Admin API token to authorize again.");
    setToast("Admin session cleared");
  };

  const statusLabel = checking
    ? "Checking…"
    : authorized
      ? "Authorized"
      : hasSessionToken
        ? "Token present — not accepted"
        : "Not authorized";

  return (
    <div className="acc-page acc-api-access-page">
      <PageHeader
        title="API Access"
        description="Admin session security only. AI provider API keys are managed under AI Control → Providers."
        breadcrumbs={[{ label: "Admin" }, { label: "Security" }, { label: "API Access" }]}
      />

      <SectionCard
        title="Admin API Access"
        description="Production Administration Security"
        actions={<StatusBadge status={statusLabel} />}
      >
        <div className="acc-api-access-grid">
          <article className="acc-info-card">
            <div className="acc-info-card-icon" aria-hidden>
              {authorized ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
            </div>
            <h3>Session status</h3>
            <p className="acc-muted">
              {authorized
                ? "This browser session can call protected Admin APIs."
                : "Protected Admin pages remain locked until a valid Admin API token is stored for this session."}
            </p>
            {message ? <p className="acc-auth-hint" role="status">{message}</p> : null}
          </article>

          <article className="acc-info-card">
            <div className="acc-info-card-icon" aria-hidden>
              <KeyRound size={20} />
            </div>
            <h3>Admin API Token</h3>
            <p className="acc-muted">
              This token authorizes this browser session to access protected Admin APIs.
              It is not an AI provider API key.
            </p>
            <label className="acc-field">
              <span>Admin API Token</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={hasSessionToken || authorized ? "••••••••••••" : "Paste Admin API Token"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void unlock();
                }}
              />
            </label>
            <div className="acc-form-actions">
              <button type="button" className="acc-button" disabled={busy} onClick={() => void unlock()}>
                {busy ? "Unlocking…" : "Unlock Admin"}
              </button>
              <button
                type="button"
                className="acc-button ghost"
                disabled={!hasSessionToken && !authorized}
                onClick={clearSession}
              >
                Clear Session
              </button>
            </div>
          </article>
        </div>

        <div className="acc-callout">
          <strong>Keep these separate</strong>
          <ul>
            <li>
              <strong>Admin API Token</strong> (this page) — authorizes Admin Control Center API requests
              from this browser session.
            </li>
            <li>
              <strong>AI Provider API Credentials</strong> — OpenAI, Google, Anthropic, fal.ai, and others,
              configured per provider under <strong>AI Control → Providers</strong>.
            </li>
          </ul>
          {onGoToProviders ? (
            <button type="button" className="acc-button ghost acc-callout-action" onClick={onGoToProviders}>
              <Cable size={14} />
              Open AI Providers
            </button>
          ) : null}
        </div>
      </SectionCard>
      <Toast message={toast} />
    </div>
  );
}
