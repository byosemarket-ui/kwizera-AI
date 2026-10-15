/**
 * Phase 47B — ForexConnect account snapshot normalization for risk settings.
 * Read-only. Never invents balance/equity/currency. Never places orders.
 */
import { getForexConnectBridge } from "../../market-data/forexconnect/client.js";
import type {
  ForexConnectAccountRow,
  ForexConnectAccountsResult,
  ForexConnectSafeStatus,
} from "../../market-data/forexconnect/types.js";
import type { ForexRiskSettings } from "./types.js";

export type AccountSnapshotStatusCode =
  | "OK"
  | "DISCONNECTED"
  | "NO_ACCOUNTS"
  | "MULTIPLE_ACCOUNTS"
  | "ACCOUNT_NOT_FOUND"
  | "ENVIRONMENT_MISMATCH"
  | "STALE"
  | "INCOMPLETE"
  | "UNAVAILABLE";

export interface ForexAccountFieldAvailability {
  accountCurrency: boolean;
  balance: boolean;
  equity: boolean;
  usedMargin: boolean;
  usableMargin: boolean;
}

export interface ForexAccountSnapshot {
  ok: boolean;
  code: AccountSnapshotStatusCode;
  environment: "demo" | "live" | string | null;
  environmentLabel: "DEMO" | "LIVE" | string | null;
  accountId: string | null;
  accountIdMasked: string | null;
  accountNameMasked: string | null;
  accountCurrency: string | null;
  balance: number | null;
  equity: number | null;
  usedMargin: number | null;
  usableMargin: number | null;
  source: "forexconnect-accounts";
  fetchedAt: string | null;
  isFresh: boolean;
  maxAgeMs: number;
  ageMs: number | null;
  fields: ForexAccountFieldAvailability;
  missingFields: string[];
  accounts: Array<{
    accountId: string;
    accountIdMasked: string | null;
    accountNameMasked: string | null;
    accountCurrency: string | null;
    balance: number | null;
    equity: number | null;
  }>;
  connectionStatus: string | null;
  message: string;
  note: string;
}

const DEFAULT_MAX_AGE_MS = 60_000;

function envLabel(raw: string | null | undefined): "DEMO" | "LIVE" | string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "demo") return "DEMO";
  if (v === "live" || v === "real") return "LIVE";
  if (!v) return null;
  return v.toUpperCase();
}

function normalizeEnv(raw: string | null | undefined): "demo" | "live" | string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "demo") return "demo";
  if (v === "live" || v === "real") return "live";
  return v || null;
}

function ageMsOf(fetchedAt: string | null, nowMs: number): number | null {
  if (!fetchedAt) return null;
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, nowMs - t);
}

function emptySnapshot(partial: Partial<ForexAccountSnapshot> & {
  code: AccountSnapshotStatusCode;
  message: string;
}): ForexAccountSnapshot {
  return {
    ok: false,
    code: partial.code,
    environment: partial.environment ?? null,
    environmentLabel: partial.environmentLabel ?? null,
    accountId: null,
    accountIdMasked: null,
    accountNameMasked: null,
    accountCurrency: null,
    balance: null,
    equity: null,
    usedMargin: null,
    usableMargin: null,
    source: "forexconnect-accounts",
    fetchedAt: partial.fetchedAt ?? null,
    isFresh: false,
    maxAgeMs: partial.maxAgeMs ?? DEFAULT_MAX_AGE_MS,
    ageMs: partial.ageMs ?? null,
    fields: {
      accountCurrency: false,
      balance: false,
      equity: false,
      usedMargin: false,
      usableMargin: false,
    },
    missingFields: partial.missingFields ?? [],
    accounts: partial.accounts ?? [],
    connectionStatus: partial.connectionStatus ?? null,
    message: partial.message,
    note: partial.note
      ?? "Read-only ForexConnect account snapshot. Does not place broker orders.",
  };
}

function rowToPreview(row: ForexConnectAccountRow) {
  return {
    accountId: row.accountId,
    accountIdMasked: row.accountIdMasked ?? null,
    accountNameMasked: row.accountNameMasked ?? null,
    accountCurrency: row.accountCurrency ?? null,
    balance: row.balance ?? null,
    equity: row.equity ?? null,
  };
}

export function selectAccountRow(
  accounts: ForexConnectAccountRow[],
  selectedAccountId?: string | null,
): { row: ForexConnectAccountRow | null; code: AccountSnapshotStatusCode; message: string } {
  if (!accounts.length) {
    return {
      row: null,
      code: "NO_ACCOUNTS",
      message: "No ForexConnect accounts are available on the connected session.",
    };
  }
  if (selectedAccountId) {
    const hit = accounts.find((a) => a.accountId === selectedAccountId) ?? null;
    if (!hit) {
      return {
        row: null,
        code: "ACCOUNT_NOT_FOUND",
        message: "Selected account is not present in the current session account list.",
      };
    }
    return { row: hit, code: "OK", message: "Selected account snapshot loaded." };
  }
  if (accounts.length > 1) {
    return {
      row: null,
      code: "MULTIPLE_ACCOUNTS",
      message: "Multiple accounts available — select an account explicitly.",
    };
  }
  return {
    row: accounts[0]!,
    code: "OK",
    message: "Single account snapshot loaded.",
  };
}

export function buildAccountSnapshotFromAccountsResult(input: {
  result: ForexConnectAccountsResult;
  selectedAccountId?: string | null;
  expectedEnvironment?: string | null;
  maxAgeMs?: number;
  nowMs?: number;
}): ForexAccountSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const status = input.result.status as ForexConnectSafeStatus | undefined;
  const sessionEnv = normalizeEnv(status?.environment ?? null);
  const expected = normalizeEnv(input.expectedEnvironment ?? sessionEnv);
  const fetchedAt = input.result.fetchedAt ?? null;
  const ageMs = ageMsOf(fetchedAt, nowMs);
  const previews = (input.result.accounts ?? []).map(rowToPreview);

  if (!input.result.ok) {
    const disconnected = String(input.result.code ?? "").includes("DISCONNECTED")
      || status?.status !== "CONNECTED";
    return emptySnapshot({
      code: disconnected ? "DISCONNECTED" : "UNAVAILABLE",
      environment: sessionEnv,
      environmentLabel: envLabel(sessionEnv),
      fetchedAt,
      ageMs,
      maxAgeMs,
      accounts: previews,
      connectionStatus: status?.status ?? null,
      message: input.result.error?.message
        ?? "ForexConnect account snapshot unavailable.",
    });
  }

  if (expected && sessionEnv && expected !== sessionEnv) {
    return emptySnapshot({
      code: "ENVIRONMENT_MISMATCH",
      environment: sessionEnv,
      environmentLabel: envLabel(sessionEnv),
      fetchedAt,
      ageMs,
      maxAgeMs,
      accounts: previews,
      connectionStatus: status?.status ?? null,
      message:
        `Session environment ${envLabel(sessionEnv)} does not match expected `
        + `${envLabel(expected)}. Snapshot invalidated.`,
    });
  }

  const selected = selectAccountRow(input.result.accounts ?? [], input.selectedAccountId);
  if (!selected.row) {
    return emptySnapshot({
      code: selected.code,
      environment: sessionEnv,
      environmentLabel: envLabel(sessionEnv),
      fetchedAt,
      ageMs,
      maxAgeMs,
      accounts: previews,
      connectionStatus: status?.status ?? null,
      message: selected.message,
    });
  }

  const row = selected.row;
  const rowEnv = normalizeEnv(row.environment) ?? sessionEnv;
  if (sessionEnv && rowEnv && sessionEnv !== rowEnv) {
    return emptySnapshot({
      code: "ENVIRONMENT_MISMATCH",
      environment: sessionEnv,
      environmentLabel: envLabel(sessionEnv),
      fetchedAt,
      ageMs,
      maxAgeMs,
      accounts: previews,
      connectionStatus: status?.status ?? null,
      message: "Account environment does not match the active ForexConnect session.",
    });
  }

  const missing = Array.isArray(row.missingFields) ? [...row.missingFields] : [];
  const fields: ForexAccountFieldAvailability = {
    accountCurrency: row.accountCurrency != null && String(row.accountCurrency).trim() !== "",
    balance: typeof row.balance === "number" && Number.isFinite(row.balance),
    equity: typeof row.equity === "number" && Number.isFinite(row.equity),
    usedMargin: typeof row.usedMargin === "number" && Number.isFinite(row.usedMargin),
    usableMargin: typeof row.usableMargin === "number" && Number.isFinite(row.usableMargin),
  };
  for (const key of Object.keys(fields) as Array<keyof ForexAccountFieldAvailability>) {
    if (!fields[key] && !missing.includes(key)) missing.push(key);
  }

  const isFresh = ageMs != null && ageMs <= maxAgeMs;
  let code: AccountSnapshotStatusCode = "OK";
  let message = selected.message;
  if (!isFresh) {
    code = "STALE";
    message = "Account snapshot is stale — refresh FXCM account data before using it for risk.";
  } else if (!fields.accountCurrency || (!fields.balance && !fields.equity)) {
    code = "INCOMPLETE";
    message =
      "Account snapshot is incomplete: "
      + missing.join(", ");
  }

  return {
    ok: code === "OK" || code === "INCOMPLETE",
    code,
    environment: rowEnv,
    environmentLabel: envLabel(rowEnv),
    accountId: row.accountId,
    accountIdMasked: row.accountIdMasked ?? null,
    accountNameMasked: row.accountNameMasked ?? null,
    accountCurrency: fields.accountCurrency ? String(row.accountCurrency).toUpperCase() : null,
    balance: fields.balance ? row.balance : null,
    equity: fields.equity ? row.equity : null,
    usedMargin: fields.usedMargin ? row.usedMargin : null,
    usableMargin: fields.usableMargin ? row.usableMargin : null,
    source: "forexconnect-accounts",
    fetchedAt,
    isFresh,
    maxAgeMs,
    ageMs,
    fields,
    missingFields: missing,
    accounts: previews,
    connectionStatus: status?.status ?? "CONNECTED",
    message,
    note:
      "Read-only ForexConnect Accounts table. Provider-derived values are not persisted as manual settings.",
  };
}

export async function fetchForexConnectAccountSnapshot(input?: {
  selectedAccountId?: string | null;
  expectedEnvironment?: string | null;
  maxAgeMs?: number;
  nowMs?: number;
  bridge?: { listAccounts: () => Promise<ForexConnectAccountsResult> };
}): Promise<ForexAccountSnapshot> {
  const bridge = input?.bridge ?? getForexConnectBridge();
  const result = await bridge.listAccounts();
  return buildAccountSnapshotFromAccountsResult({
    result,
    selectedAccountId: input?.selectedAccountId,
    expectedEnvironment: input?.expectedEnvironment,
    maxAgeMs: input?.maxAgeMs,
    nowMs: input?.nowMs,
  });
}

/**
 * Build ephemeral risk settings for a calculation from a verified fresh snapshot.
 * Does not mutate persisted manualBalance/manualEquity.
 */
export function applyAccountSnapshotToRiskSettings(
  settings: ForexRiskSettings,
  snapshot: ForexAccountSnapshot,
): { settings: ForexRiskSettings; applied: boolean; reason: string | null } {
  if (settings.accountDataSource !== "forexconnect") {
    return { settings, applied: false, reason: null };
  }
  if (!snapshot.isFresh) {
    return {
      settings,
      applied: false,
      reason: snapshot.message || "FXCM account snapshot is not fresh.",
    };
  }
  if (snapshot.code === "MULTIPLE_ACCOUNTS" || snapshot.code === "ACCOUNT_NOT_FOUND") {
    return { settings, applied: false, reason: snapshot.message };
  }
  if (snapshot.code === "ENVIRONMENT_MISMATCH" || snapshot.code === "DISCONNECTED") {
    return { settings, applied: false, reason: snapshot.message };
  }
  if (!snapshot.accountCurrency) {
    return {
      settings,
      applied: false,
      reason: "FXCM account currency is unavailable — cannot apply provider account data.",
    };
  }

  const next: ForexRiskSettings = {
    ...settings,
    accountCurrency: snapshot.accountCurrency,
  };

  if (settings.riskBasis === "manual_equity") {
    if (snapshot.equity == null) {
      return {
        settings,
        applied: false,
        reason: "FXCM equity is unavailable for the selected risk basis.",
      };
    }
    next.manualEquity = snapshot.equity;
    // Clear opposing manual balance so basisValue does not mix sources.
    next.manualBalance = settings.manualBalance;
  } else {
    if (snapshot.balance == null) {
      return {
        settings,
        applied: false,
        reason: "FXCM balance is unavailable for the selected risk basis.",
      };
    }
    next.manualBalance = snapshot.balance;
    next.manualEquity = settings.manualEquity;
  }

  return { settings: next, applied: true, reason: null };
}
