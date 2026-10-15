/**
 * Phase 47B — ForexConnect account snapshot for risk settings.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyAccountSnapshotToRiskSettings,
  buildAccountSnapshotFromAccountsResult,
  FOREX_RISK_DEFAULT_SETTINGS,
  selectAccountRow,
  validateForexRiskSettingsPatch,
  type ForexRiskSettings,
} from "../../../../ai/forex-ai/position-sizing/index.ts";
import type { ForexConnectAccountsResult } from "../../../../ai/market-data/forexconnect/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function accountsResult(
  accounts: ForexConnectAccountsResult["accounts"],
  partial: Partial<ForexConnectAccountsResult> = {},
): ForexConnectAccountsResult {
  return {
    ok: true,
    code: accounts.length > 1 ? "MULTIPLE_ACCOUNTS" : accounts.length ? "OK" : "NO_ACCOUNTS",
    count: accounts.length,
    accounts,
    fetchedAt: "2026-10-15T18:00:00.000Z",
    status: {
      ok: true,
      provider: "FOREXCONNECT",
      apiPath: "sidecar",
      status: "CONNECTED",
      enabled: true,
      configured: true,
      environment: "demo",
      environmentLabel: "Demo",
      usernameConfigured: true,
      passwordConfigured: true,
      trading: "DISABLED",
    },
    trading: "DISABLED",
    ...partial,
  };
}

const demoAccount = {
  accountId: "286255",
  accountIdMasked: "***6255",
  accountNameMasked: "***6255",
  environment: "demo",
  accountCurrency: "USD",
  balance: 50_000,
  equity: 50_120.5,
  usedMargin: 100,
  usableMargin: 50_020.5,
  missingFields: [],
  source: "forexconnect-accounts",
};

describe("Phase 47B account snapshot parsing", () => {
  it("parses supported account fields from a connected session", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([demoAccount]),
      nowMs: Date.parse("2026-10-15T18:00:30.000Z"),
      maxAgeMs: 60_000,
    });
    expect(snap.ok).toBe(true);
    expect(snap.code).toBe("OK");
    expect(snap.environmentLabel).toBe("DEMO");
    expect(snap.accountIdMasked).toBe("***6255");
    expect(snap.accountCurrency).toBe("USD");
    expect(snap.balance).toBe(50_000);
    expect(snap.equity).toBe(50_120.5);
    expect(snap.usedMargin).toBe(100);
    expect(snap.usableMargin).toBe(50_020.5);
    expect(snap.isFresh).toBe(true);
    expect(snap.fields.balance).toBe(true);
    expect(snap.source).toBe("forexconnect-accounts");
  });

  it("reports disconnected sessions explicitly", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: {
        ok: false,
        code: "DISCONNECTED",
        count: 0,
        accounts: [],
        fetchedAt: "2026-10-15T18:00:00.000Z",
        status: {
          ok: true,
          provider: "FOREXCONNECT",
          apiPath: "sidecar",
          status: "DISCONNECTED",
          enabled: true,
          configured: true,
          environment: "demo",
          environmentLabel: "Demo",
          usernameConfigured: true,
          passwordConfigured: true,
          trading: "DISABLED",
        },
        error: { code: "FOREXCONNECT_DISCONNECTED", message: "Not connected." },
      },
    });
    expect(snap.ok).toBe(false);
    expect(snap.code).toBe("DISCONNECTED");
    expect(snap.balance).toBeNull();
  });

  it("marks unavailable fields without inventing values", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([{
        ...demoAccount,
        equity: null,
        usableMargin: null,
        missingFields: ["equity", "usableMargin"],
      }]),
      nowMs: Date.parse("2026-10-15T18:00:10.000Z"),
    });
    expect(snap.equity).toBeNull();
    expect(snap.usableMargin).toBeNull();
    expect(snap.missingFields).toEqual(expect.arrayContaining(["equity", "usableMargin"]));
    expect(snap.code).toBe("OK"); // balance+currency still enough for balance basis
  });

  it("isolates DEMO vs LIVE and rejects environment mismatch", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([{ ...demoAccount, environment: "demo" }], {
        status: {
          ok: true,
          provider: "FOREXCONNECT",
          apiPath: "sidecar",
          status: "CONNECTED",
          enabled: true,
          configured: true,
          environment: "demo",
          environmentLabel: "Demo",
          usernameConfigured: true,
          passwordConfigured: true,
          trading: "DISABLED",
        },
      }),
      expectedEnvironment: "live",
      nowMs: Date.parse("2026-10-15T18:00:10.000Z"),
    });
    expect(snap.code).toBe("ENVIRONMENT_MISMATCH");
    expect(snap.balance).toBeNull();
  });

  it("requires explicit selection when multiple accounts exist", () => {
    const multi = selectAccountRow(
      [
        demoAccount,
        { ...demoAccount, accountId: "999001", accountIdMasked: "***9001" },
      ],
      null,
    );
    expect(multi.code).toBe("MULTIPLE_ACCOUNTS");
    expect(multi.row).toBeNull();

    const picked = selectAccountRow(
      [
        demoAccount,
        { ...demoAccount, accountId: "999001", accountIdMasked: "***9001" },
      ],
      "999001",
    );
    expect(picked.code).toBe("OK");
    expect(picked.row?.accountId).toBe("999001");
  });

  it("marks stale snapshots and refuses to apply them over manual values", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([demoAccount]),
      nowMs: Date.parse("2026-10-15T18:10:00.000Z"),
      maxAgeMs: 60_000,
    });
    expect(snap.code).toBe("STALE");
    expect(snap.isFresh).toBe(false);

    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
      accountCurrency: "EUR",
      manualBalance: 1234,
      riskBasis: "manual_balance",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(false);
    expect(settings.manualBalance).toBe(1234);
    expect(settings.accountCurrency).toBe("EUR");
  });

  it("applies fresh FXCM balance/currency ephemerally without treating missing as manual", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([demoAccount]),
      nowMs: Date.parse("2026-10-15T18:00:10.000Z"),
    });
    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
      accountCurrency: "",
      manualBalance: 9,
      riskBasis: "manual_balance",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(true);
    expect(applied.settings.accountCurrency).toBe("USD");
    expect(applied.settings.manualBalance).toBe(50_000);
    // Original settings object unchanged (ephemeral apply).
    expect(settings.manualBalance).toBe(9);
  });

  it("does not invent equity when only balance is available for equity basis", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([{
        ...demoAccount,
        equity: null,
        missingFields: ["equity"],
      }]),
      nowMs: Date.parse("2026-10-15T18:00:10.000Z"),
    });
    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
      riskBasis: "manual_equity",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(false);
    expect(applied.reason).toMatch(/equity/i);
  });

  it("validates accountDataSource preference fields", () => {
    expect(validateForexRiskSettingsPatch({ accountDataSource: "forexconnect" }).ok).toBe(true);
    expect(validateForexRiskSettingsPatch({ accountDataSource: "nope" as "manual" }).ok).toBe(false);
    expect(validateForexRiskSettingsPatch({ selectedForexConnectAccountId: "286255" }).ok).toBe(true);
    expect(validateForexRiskSettingsPatch({ selectedForexConnectAccountId: "bad id!" }).ok).toBe(false);
  });
});

describe("Phase 47B wiring — no broker orders", () => {
  it("wires sidecar /accounts, Admin snapshot API, UI refresh, and enrich path", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const api = read("dev/server/forex-risk-api.ts");
    const panel = read("desktop/forex-admin/ForexAdminRiskSettingsPanel.tsx");
    const client = read("ai/market-data/forexconnect/client.ts");
    const enrich = read("ai/forex-ai/position-sizing/enrich.ts");
    expect(sidecar).toContain('path == "/accounts"');
    expect(sidecar).toContain("accounts_payload");
    expect(sidecar).toContain("usable_margin");
    expect(sidecar).toContain('"trading": "DISABLED"');
    expect(sidecar).not.toMatch(/create_order_request|ORDER_TYPE/);
    expect(api).not.toMatch(/create_order_request|placeOrder|submitOrder/);
    expect(client).toContain("listAccounts");
    expect(api).toContain("/api/forex-admin/risk-settings/account-snapshot");
    expect(api).toContain("fetchForexConnectAccountSnapshot");
    expect(panel).toContain("Refresh FXCM Account Data");
    expect(panel).toContain("accountDataSource");
    expect(panel).toContain("data-fxcm-account-snapshot");
    expect(enrich).toContain("applyAccountSnapshotToRiskSettings");
  });
});
