/**
 * Phase 60.0.14 — Compact central Forex Admin Access card.
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
      ? "Configured locally — not yet verified with server."
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
      message: "Configured locally — not yet verified with server.",
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
            Forex Admin Access
          </h2>
          <p className="fx-admin-access-meta">
            One token for Trade Monitor, Market Monitor, Automated Trading, and other protected Forex reads.
            Stored in this browser profile only — not encrypted against XSS.
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
          >
            {snapshot.configured ? "Update" : "Save"}
          </button>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary"
            onClick={() => void runVerify()}
            disabled={busy || !snapshot.configured}
          >
            Verify
          </button>
          <button
            type="button"
            className="fx-btn fx-tm-btn is-secondary"
            onClick={onClear}
            disabled={busy || !snapshot.configured}
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
      </div>
    </section>
  );
}

/** Compact auth CTA used on pages that no longer host their own token form. */
export function ForexAdminAccessLink({
  onOpenDashboard,
  reason,
}: {
  onOpenDashboard?: () => void;
  reason?: string;
}) {
  const { snapshot } = useForexAdminToken();
  const go = () => {
    if (onOpenDashboard) {
      onOpenDashboard();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.assign("/forex/dashboard#fx-admin-access");
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
