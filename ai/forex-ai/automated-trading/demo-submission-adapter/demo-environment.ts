/**
 * Stage 6 — Positive DEMO environment verification.
 * Client-supplied "DEMO" string alone is never sufficient.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { DemoEnvironmentVerification } from "./types.js";

function normEnv(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  return s || null;
}

function isLiveToken(s: string | null): boolean {
  return s === "live" || s === "real" || s === "production" || s === "prod";
}

function isDemoToken(s: string | null): boolean {
  return s === "demo";
}

/**
 * All environment signals must positively agree on DEMO.
 * LIVE anywhere → immediate reject. Unknown/missing → reject.
 */
export function verifyDemoEnvironment(input: {
  configuredEnvironment?: AutomatedTradingEnvironment | null;
  sessionEnvironment?: string | null;
  accountEnvironment?: string | null;
  accountIdMasked?: string | null;
  expectedAccountIdMasked?: string | null;
  /** ForexConnect profile/session status when known (e.g. CONNECTED). */
  sessionStatus?: string | null;
  clientClaimedEnvironment?: string | null;
}): DemoEnvironmentVerification {
  const configured = input.configuredEnvironment ?? null;
  const session = normEnv(input.sessionEnvironment);
  const account = normEnv(input.accountEnvironment);
  const clientClaim = normEnv(input.clientClaimedEnvironment);
  const accountIdMasked = input.accountIdMasked != null && String(input.accountIdMasked).trim()
    ? String(input.accountIdMasked).trim()
    : null;
  const expected = input.expectedAccountIdMasked != null && String(input.expectedAccountIdMasked).trim()
    ? String(input.expectedAccountIdMasked).trim()
    : null;

  const base = {
    configuredEnvironment: configured,
    sessionEnvironment: session,
    accountEnvironment: account,
    accountIdMasked,
    expectedAccountIdMasked: expected,
  };

  // Client claim alone never proves DEMO — but LIVE claim is still a hard reject signal.
  if (isLiveToken(clientClaim)) {
    return {
      ...base,
      ok: false,
      code: "LIVE_ENVIRONMENT_FORBIDDEN",
      message: "Client claimed LIVE — Stage 6 adapter rejects without mutation.",
      positivelyVerifiedDemo: false,
    };
  }

  if (configured === "LIVE" || isLiveToken(session) || isLiveToken(account)) {
    return {
      ...base,
      ok: false,
      code: "LIVE_ENVIRONMENT_FORBIDDEN",
      message: "LIVE account/session detected — adapter rejects immediately; no mutation called.",
      positivelyVerifiedDemo: false,
    };
  }

  if (configured !== "DEMO") {
    return {
      ...base,
      ok: false,
      code: "DEMO_ENVIRONMENT_NOT_VERIFIED",
      message: "Configured AT environment is not positively DEMO.",
      positivelyVerifiedDemo: false,
    };
  }

  if (!isDemoToken(session)) {
    return {
      ...base,
      ok: false,
      code: "DEMO_ENVIRONMENT_NOT_VERIFIED",
      message: "ForexConnect session environment is not positively verified DEMO.",
      positivelyVerifiedDemo: false,
    };
  }

  // Account environment when present must agree; when absent, fail closed
  // unless session+configured already DEMO and account id match is established.
  if (account != null && !isDemoToken(account)) {
    return {
      ...base,
      ok: false,
      code: "DEMO_ENVIRONMENT_NOT_VERIFIED",
      message: "Account environment is not positively DEMO.",
      positivelyVerifiedDemo: false,
    };
  }

  if (!accountIdMasked) {
    return {
      ...base,
      ok: false,
      code: "ACCOUNT_IDENTITY_MISSING",
      message: "Account identity missing — cannot bind DEMO submission adapter.",
      positivelyVerifiedDemo: false,
    };
  }

  if (expected && expected !== accountIdMasked) {
    return {
      ...base,
      ok: false,
      code: "ACCOUNT_IDENTITY_MISMATCH",
      message: "Account identity does not match expected DEMO account reference.",
      positivelyVerifiedDemo: false,
    };
  }

  const status = String(input.sessionStatus || "").trim().toUpperCase();
  if (status && status !== "CONNECTED") {
    return {
      ...base,
      ok: false,
      code: "SESSION_NOT_CONNECTED",
      message: `ForexConnect status is ${status}; CONNECTED DEMO session required.`,
      positivelyVerifiedDemo: false,
    };
  }

  return {
    ...base,
    ok: true,
    code: "DEMO_VERIFIED",
    message: "Configured AT environment, session, and account identity positively verify DEMO.",
    positivelyVerifiedDemo: true,
  };
}
