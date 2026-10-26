/**
 * Phase 60.0.14/60.0.15 — Central Forex Admin Access card.
 * Token is never logged or shown in full after save.
 */
import { useCallback, useEffect, useId, useState } from "react";
import {
  buildForexAdminHeaders,
  redactForexAdminToken,
} from "./forex-admin-token";
import { useForexAdminToken } from "./use-forex-admin-token";

export type ForexAdminVerifyState =
  | "idle"
  | "checking"
  | "verified"
  | "missing"
  | "invalid"
  | "error"
  | "unconfigured";

type VerifyResult = {
  state: ForexAdminVerifyState;
  message: string;
};

/** Modules that call buildForexAdminHeaders / shared token — not proof of live auth. */
export const FOREX_ADMIN_SHARED_MODULES = [
  { id: "trade-monitor", label: "Trade Monitor" },
  { id: "signals", label: "Market Monitor" },
  { id: "automated-trading", label: "Automated Trading" },
  { id: "trade-history", label: "Trade History" },
] as const;

async function probeAdminAuth(tokenPresent: boolean): Promise<VerifyResult> {
  if (!tokenPresent) {
    return { state: "unconfigured", message: "No token configured in this browser." };
  }
  try {
    const path = "/api/forex/automated-trading/status";
    const res = await fetch(path, {
      headers: buildForexAdminHeaders(path),
    });
    const body = await res.json().catch(() => ({})) as {
      ok?: boolean;
      error?: { code?: string; message?: string };
    };
    const code = String(body?.error?.code ?? "");
    if (res.ok && body?.ok !== false) {
      return { state: "verified", message: "Server accepted credentials." };
    }
    if (code === "ADMIN_TOKEN_MISSING" || res.status === 401) {
      return { state: "missing", message: "Server reports missing credentials." };
    }
    if (code === "ADMIN_TOKEN_INVALID" || res.status === 403) {
      return { state: "invalid", message: "Server rejected credentials." };
    }
    const raw = body?.error?.message || `HTTP ${res.status}`;
    return {
      state: "error",
      message: redactForexAdminToken(raw),
    };
  } catch {
    return { state: "error", message: "Could not reach auth probe endpoint." };
  }
}

export function ForexAdminAccessCard({
  compact = false,
  onConfigured,
}: {
  compact?: boolean;
  onConfigured?: () => void;
}) {
  const { snapshot, save, clear } = useForexAdminToken();
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "err" | null>(null);
  const [verify, setVerify] = useState<VerifyResult>({
    state: snapshot.configured ? "idle" : "unconfigured",
    message: snapshot.configured
      ? "Saved in this browser only · not yet verified with server."
      : "No token configured in this browser.",
  });
  const [busy, setBusy] = useState(false);

  const runVerify = useCallback(async () => {
    setBusy(true);
    setVerify({ state: "checking", message: "Checking with server…" });
    const result = await probeAdminAuth(snapshot.configured);
    setVerify(result);
    setBusy(false);
  }, [snapshot.configured]);

  useEffect(() => {
    if (!snapshot.configured) {
      setVerify({ state: "unconfigured", message: "No token configured in this browser." });
      return;
    }
    setVerify({
      state: "idle",
      message: "Saved in this browser only · not yet verified with server.",
    });
  }, [snapshot.generation, snapshot.configured]);

  const onSave = () => {
    const result = save(draft);
    setDraft("");
    setShow(false);
    if (!result.ok) {
      setStatusTone("err");
      setStatus(result.error);
      return;
    }
    setStatusTone("ok");
    setStatus(
      result.snapshot.storageError
        ? result.snapshot.storageError
        : "Saved for this browser profile.",
    );
    onConfigured?.();
    void (async () => {
      setBusy(true);
      setVerify({ state: "checking", message: "Checking with server…" });
      const probe = await probeAdminAuth(true);
      setVerify(probe);
      setBusy(false);
    })();
  };

  const onClear = () => {
    if (!window.confirm("Remove the Admin API token from this browser?")) return;
    const result = clear();
    setDraft("");
    setShow(false);
    if (!result.ok) {
      setStatusTone("err");
      setStatus(result.error);
      return;
    }
    setStatusTone("warn");
    setStatus("Token removed from this browser.");
    setVerify({ state: "unconfigured", message: "No token configured in this browser." });
  };

  const verifyLabel =
    verify.state === "verified" ? "Verified"
      : verify.state === "checking" ? "Checking…"
        : verify.state === "invalid" ? "Rejected"
          : verify.state === "missing" ? "Missing"
            : verify.state === "unconfigured" ? "Not configured"
              : verify.state === "error" ? "Unverified"
                : snapshot.configured ? "Local only" : "Not configured";

  return (
    <section
      id="fx-admin-access"
      className={`fx-admin-access${compact ? " is-compact" : ""}`}
      data-forex-admin-access="true"
      data-token-configured={snapshot.configured ? "true" : "false"}
      data-auth-verify={verify.state}
      aria-labelledby="fx-admin-access-title"
    >
      <header className="fx-admin-access-head">
        <div>
          <h2 id="fx-admin-access-title" className="fx-admin-access-title">
            Forex Admin Token
          </h2>
          <p className="fx-admin-access-meta">
            One token for authorized Forex modules on this browser.
          </p>
        </div>
        <span
          className={`fx-admin-access-pill is-${verify.state}`}
          data-fx-admin-pill={verify.state}
        >
          {verifyLabel}
        </span>
      </header>

      <div className="fx-admin-access-body">
        {snapshot.configured ? (
          <p className="fx-admin-access-masked" data-fx-admin-masked="true">
            Saved · {snapshot.masked}
          </p>
        ) : (
          <p className="fx-admin-access-masked is-empty">No token saved</p>
        )}

        <label className="fx-admin-access-label" htmlFor={fieldId}>
          Admin API token
        </label>
        <div className="fx-admin-access-row">
          <input
            id={fieldId}
            className="fx-admin-access-input"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={snapshot.configured ? "Enter new token to update" : "Paste Admin API token"}
            aria-describedby="fx-admin-access-hint"
          />
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            aria-label={show ? "Hide token" : "Show token"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <p id="fx-admin-access-hint" className="fx-admin-access-hint">
          Never put the token in URLs. Clearing removes it from this browser only.
        </p>

        <div className="fx-admin-access-actions">
          <button
            type="button"
            className="fx-btn fx-tm-btn"
            onClick={onSave}
            disabled={busy || !draft.trim()}
            aria-label={snapshot.configured ? "Update admin token" : "Save admin token"}
          >
            {snapshot.configured ? "Update" : "Save"}
          </button>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary"
            onClick={() => void runVerify()}
            disabled={busy || !snapshot.configured}
            aria-label="Verify admin token with server"
          >
            Verify
          </button>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary is-danger"
            onClick={onClear}
            disabled={busy || !snapshot.configured}
            aria-label="Clear admin token"
          >
            Clear
          </button>
        </div>

        {status ? (
          <p
            className={`fx-admin-access-status is-${statusTone ?? "ok"}`}
            role="status"
            data-fx-admin-status={statusTone ?? "ok"}
          >
            {status}
          </p>
        ) : null}
        <p
          className={`fx-admin-access-verify is-${verify.state}`}
          role="status"
          data-fx-admin-verify={verify.state}
        >
          {verify.message}
        </p>
        {!snapshot.storageAvailable ? (
          <p className="fx-admin-access-status is-warn" role="status">
            localStorage unavailable — persistence may be limited to this tab.
          </p>
        ) : null}

        <div
          className="fx-admin-access-modules"
          data-fx-admin-modules="true"
          aria-labelledby="fx-admin-modules-title"
        >
          <div className="fx-admin-access-modules-head">
            <h3 id="fx-admin-modules-title" className="fx-admin-access-modules-title">
              Connected modules
            </h3>
            <span className="fx-admin-access-modules-pill">Uses shared token</span>
          </div>
          <p className="fx-admin-access-modules-meta">
            These modules use the shared token automatically. A green “connected” auth status
            appears only after each module’s own successful server response — not from this list.
          </p>
          <ul className="fx-admin-access-modules-grid">
            {FOREX_ADMIN_SHARED_MODULES.map((mod) => (
              <li
                key={mod.id}
                className="fx-admin-access-module"
                data-fx-admin-module={mod.id}
                data-shared-token="true"
              >
                <span className="fx-admin-access-module-label">{mod.label}</span>
                <span className="fx-admin-access-module-tag">Shared token</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="fx-admin-access-security" role="note">
          Credentials are never added to URLs or sent to public market-data providers.
        </p>
      </div>
    </section>
  );
}

const ADMIN_ACCESS_PATH = "/forex/admin-access";

/** Compact auth CTA used on pages that no longer host their own token form. */
export function ForexAdminAccessLink({
  onOpenAdminAccess,
  onOpenDashboard,
  reason,
}: {
  /** Prefer in-app navigation when the shell provides it. */
  onOpenAdminAccess?: () => void;
  /** @deprecated Use onOpenAdminAccess — kept for call-site compatibility. */
  onOpenDashboard?: () => void;
  reason?: string;
}) {
  const { snapshot } = useForexAdminToken();
  const go = () => {
    const navigate = onOpenAdminAccess ?? onOpenDashboard;
    if (navigate) {
      navigate();
      return;
    }
    if (typeof window !== "undefined") {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const target =
        returnTo && !returnTo.startsWith(ADMIN_ACCESS_PATH)
          ? `${ADMIN_ACCESS_PATH}?returnTo=${encodeURIComponent(returnTo)}`
          : ADMIN_ACCESS_PATH;
      window.location.assign(target);
    }
  };
  return (
    <p className="fx-admin-access-cta" data-fx-admin-cta="true" role="status">
      {reason
        ?? (snapshot.configured
          ? "Admin token configured. Open Admin Access to update or verify."
          : "Admin API token required.")}
      {" "}
      <button type="button" className="fx-text-button" onClick={go}>
        Admin Access
      </button>
    </p>
  );
}
