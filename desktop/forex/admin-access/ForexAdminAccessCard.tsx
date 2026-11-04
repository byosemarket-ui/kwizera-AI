/**
 * Phase 60.0.14/60.0.15/60.0.16 — Central Forex Admin Access card.
 * Token is never logged or shown in full after save.
 * Verify state is not clobbered by token-generation updates during an in-flight probe.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  | "unconfigured"
  | "unavailable";

export type ForexModuleAuthStatus =
  | "token-required"
  | "checking"
  | "connected"
  | "not-connected"
  | "server-unavailable";

type VerifyResult = {
  state: ForexAdminVerifyState;
  message: string;
};

type ModuleProbeDef = {
  id: string;
  label: string;
  /** Protected same-origin path used to prove this module can authenticate. */
  probePath: string;
};

/** Modules that call buildForexAdminHeaders / shared token — Connected only after probe success. */
export const FOREX_ADMIN_SHARED_MODULES: readonly ModuleProbeDef[] = [
  { id: "trade-monitor", label: "Trade Monitor", probePath: "/api/forex/automated-trading/broker-ro-tables" },
  { id: "signals", label: "Market Monitor", probePath: "/api/forex/automated-trading/monitor/status" },
  { id: "automated-trading", label: "Automated Trading", probePath: "/api/forex/automated-trading/status" },
  { id: "trade-history", label: "Trade History", probePath: "/api/forex/automated-trading/trade-history?limit=1" },
  { id: "risk-management", label: "Risk Management", probePath: "/api/forex/automated-trading/simulation-risk/status" },
  { id: "result-intake", label: "AI Analysis Result Intake", probePath: "/api/forex/automated-trading/result-intake/status" },
  { id: "result-intake-history", label: "Result Intake History", probePath: "/api/forex/automated-trading/result-intake/history?limit=4" },
  { id: "result-intake-handoff", label: "Result Intake Handoff", probePath: "/api/forex/automated-trading/result-intake/handoff" },
  { id: "proposal-status", label: "Order Proposal Status", probePath: "/api/forex/automated-trading/proposal/status" },
  { id: "proposal-allocation", label: "Proposal Allocation", probePath: "/api/forex/automated-trading/proposal/allocation" },
  { id: "proposal-history", label: "Proposal History", probePath: "/api/forex/automated-trading/proposal/history?limit=4" },
] as const;

type ModuleAuthRow = {
  id: string;
  label: string;
  status: ForexModuleAuthStatus;
  detail: string;
  checkedAt: string | null;
};

function initialModuleRows(tokenConfigured: boolean): ModuleAuthRow[] {
  return FOREX_ADMIN_SHARED_MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    status: tokenConfigured ? "token-required" : "token-required",
    detail: tokenConfigured
      ? "Shared token configured — not server-verified for this module."
      : "Token required.",
    checkedAt: null,
  }));
}

async function classifyAuthResponse(res: Response): Promise<{
  ok: boolean;
  kind: "ok" | "missing" | "invalid" | "error";
  message: string;
}> {
  const body = await res.json().catch(() => ({})) as {
    ok?: boolean;
    error?: { code?: string; message?: string };
  };
  const code = String(body?.error?.code ?? "");
  if (res.ok && body?.ok !== false) {
    return { ok: true, kind: "ok", message: "Server accepted credentials." };
  }
  if (code === "ADMIN_TOKEN_MISSING" || res.status === 401) {
    return { ok: false, kind: "missing", message: "Server reports missing credentials." };
  }
  if (code === "ADMIN_TOKEN_INVALID" || res.status === 403) {
    return { ok: false, kind: "invalid", message: "Server rejected credentials." };
  }
  const raw = body?.error?.message || `HTTP ${res.status}`;
  return { ok: false, kind: "error", message: redactForexAdminToken(raw) };
}

async function probeAdminAuth(tokenPresent: boolean): Promise<VerifyResult> {
  if (!tokenPresent) {
    return { state: "unconfigured", message: "No token configured in this browser." };
  }
  try {
    const path = "/api/forex/automated-trading/status";
    const res = await fetch(path, {
      headers: buildForexAdminHeaders(path),
    });
    const classified = await classifyAuthResponse(res);
    if (classified.ok) {
      return { state: "verified", message: classified.message };
    }
    if (classified.kind === "missing") {
      return { state: "missing", message: classified.message };
    }
    if (classified.kind === "invalid") {
      return { state: "invalid", message: classified.message };
    }
    return { state: "error", message: classified.message };
  } catch {
    return { state: "unavailable", message: "Server unavailable — could not reach auth probe endpoint." };
  }
}

async function probeModule(mod: ModuleProbeDef): Promise<ModuleAuthRow> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(mod.probePath, {
      headers: buildForexAdminHeaders(mod.probePath),
    });
    const classified = await classifyAuthResponse(res);
    if (classified.ok) {
      return {
        id: mod.id,
        label: mod.label,
        status: "connected",
        detail: "Authenticated with server.",
        checkedAt,
      };
    }
    if (classified.kind === "missing" || classified.kind === "invalid") {
      return {
        id: mod.id,
        label: mod.label,
        status: "not-connected",
        detail: classified.message,
        checkedAt,
      };
    }
    return {
      id: mod.id,
      label: mod.label,
      status: "not-connected",
      detail: classified.message,
      checkedAt,
    };
  } catch {
    return {
      id: mod.id,
      label: mod.label,
      status: "server-unavailable",
      detail: "Server unavailable.",
      checkedAt,
    };
  }
}

function moduleStatusLabel(status: ForexModuleAuthStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "checking":
      return "Checking…";
    case "not-connected":
      return "Not Connected";
    case "server-unavailable":
      return "Server Unavailable";
    default:
      return "Token Required";
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
  const probeSeq = useRef(0);
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
  const [moduleRows, setModuleRows] = useState<ModuleAuthRow[]>(() =>
    initialModuleRows(snapshot.configured),
  );
  const [busy, setBusy] = useState(false);

  // Only react to configured true/false — never reset an in-flight or completed verify on generation bump.
  useEffect(() => {
    if (!snapshot.configured) {
      probeSeq.current += 1;
      setVerify({ state: "unconfigured", message: "No token configured in this browser." });
      setModuleRows(initialModuleRows(false));
      return;
    }
    setModuleRows((prev) => {
      if (prev.length === FOREX_ADMIN_SHARED_MODULES.length) return prev;
      return initialModuleRows(true);
    });
  }, [snapshot.configured]);

  const runFullVerify = useCallback(async (tokenPresent: boolean) => {
    const seq = ++probeSeq.current;
    setBusy(true);
    setVerify({ state: "checking", message: "Checking with server…" });
    setModuleRows((rows) =>
      rows.map((r) => ({
        ...r,
        status: "checking" as const,
        detail: "Probing…",
        checkedAt: null,
      })),
    );

    const primary = await probeAdminAuth(tokenPresent);
    if (seq !== probeSeq.current) return;

    setVerify(primary);

    if (primary.state !== "verified") {
      setModuleRows(
        FOREX_ADMIN_SHARED_MODULES.map((m) => ({
          id: m.id,
          label: m.label,
          status:
            primary.state === "unavailable"
              ? "server-unavailable"
              : primary.state === "unconfigured"
                ? "token-required"
                : "not-connected",
          detail: primary.message,
          checkedAt: new Date().toISOString(),
        })),
      );
      setBusy(false);
      return;
    }

    const settled = await Promise.all(FOREX_ADMIN_SHARED_MODULES.map((m) => probeModule(m)));
    if (seq !== probeSeq.current) return;
    setModuleRows(settled);
    setBusy(false);
  }, []);

  const runVerify = useCallback(async () => {
    await runFullVerify(snapshot.configured);
  }, [runFullVerify, snapshot.configured]);

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
    void runFullVerify(true);
  };

  const onClear = () => {
    if (!window.confirm("Remove the Admin API token from this browser?")) return;
    probeSeq.current += 1;
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
    setModuleRows(initialModuleRows(false));
  };

  const verifyLabel =
    verify.state === "verified" ? "Verified"
      : verify.state === "checking" ? "Checking…"
        : verify.state === "invalid" ? "Rejected"
          : verify.state === "missing" ? "Missing"
            : verify.state === "unconfigured" ? "Not configured"
              : verify.state === "unavailable" ? "Server unavailable"
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
          Server credentials stay on the VPS until you rotate them separately.
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
            Shared token alone is not Connected. Each row shows the last authenticated
            server probe for that module (Verify / Update).
          </p>
          <ul className="fx-admin-access-modules-grid">
            {moduleRows.map((mod) => (
              <li
                key={mod.id}
                className="fx-admin-access-module"
                data-fx-admin-module={mod.id}
                data-shared-token="true"
                data-module-auth={mod.status}
              >
                <span className="fx-admin-access-module-label">{mod.label}</span>
                <span
                  className={`fx-admin-access-module-tag is-${mod.status}`}
                  data-fx-admin-module-status={mod.status}
                  title={mod.detail}
                >
                  {moduleStatusLabel(mod.status)}
                </span>
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
