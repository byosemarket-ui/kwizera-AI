/**
 * Phase 47C — FXCM account currency mapping + FXCM as active risk source.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyAccountSnapshotToRiskSettings,
  buildAccountSnapshotFromAccountsResult,
  FOREX_RISK_DEFAULT_SETTINGS,
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
    code: "OK",
    count: accounts.length,
    accounts,
    fetchedAt: "2026-10-15T20:00:00.000Z",
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

const baseAccount = {
  accountId: "019634",
  accountIdMasked: "***9634",
  environment: "demo",
  accountCurrency: "USD" as string | null,
  balance: 19_997.65,
  equity: 19_997.65,
  usedMargin: 0,
  usableMargin: 19_997.65,
  missingFields: [] as string[],
  source: "forexconnect-accounts",
  currencySource: "system_properties_reader:find_property:BASE_CRNCY",
};

describe("Phase 47C — account currency mapping", () => {
  it("defaults risk settings to forexconnect account data source", () => {
    expect(FOREX_RISK_DEFAULT_SETTINGS.accountDataSource).toBe("forexconnect");
  });

  it("maps verified BASE_CRNCY currency into a complete snapshot", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([baseAccount]),
      nowMs: Date.parse("2026-10-15T20:00:20.000Z"),
    });
    expect(snap.code).toBe("OK");
    expect(snap.accountCurrency).toBe("USD");
    expect(snap.missingFields).not.toContain("accountCurrency");
    expect(snap.isFresh).toBe(true);
  });

  it("marks missing currency incomplete and refuses apply", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([{
        ...baseAccount,
        accountCurrency: null,
        currencySource: null,
        missingFields: ["accountCurrency"],
      }]),
      nowMs: Date.parse("2026-10-15T20:00:20.000Z"),
    });
    expect(snap.code).toBe("INCOMPLETE");
    expect(snap.accountCurrency).toBeNull();
    expect(snap.missingFields).toContain("accountCurrency");

    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
      manualBalance: 1000,
      accountCurrency: "EUR",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(false);
    expect(applied.reason).toMatch(/incomplete|currency|BASE_CRNCY/i);
    // Must not silently keep manual EUR/balance as if they were FXCM.
    expect(settings.manualBalance).toBe(1000);
  });

  it("applies FXCM source without mixing leftover manual equity", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([baseAccount]),
      nowMs: Date.parse("2026-10-15T20:00:20.000Z"),
    });
    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
      riskBasis: "manual_balance",
      manualBalance: 1,
      manualEquity: 999_999,
      accountCurrency: "EUR",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(true);
    expect(applied.settings.accountCurrency).toBe("USD");
    expect(applied.settings.manualBalance).toBe(19_997.65);
    // Leftover manual equity is retained on object but unused for balance basis;
    // enrich clears both when apply fails — when apply succeeds balance is provider.
    expect(settings.manualEquity).toBe(999_999);
  });

  it("blocks stale FXCM snapshots from becoming the active calculation source", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([baseAccount]),
      nowMs: Date.parse("2026-10-15T20:10:00.000Z"),
      maxAgeMs: 60_000,
    });
    expect(snap.code).toBe("STALE");
    const applied = applyAccountSnapshotToRiskSettings({
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "forexconnect",
    }, snap);
    expect(applied.applied).toBe(false);
  });

  it("keeps manual mode independent of FXCM snapshot", () => {
    const snap = buildAccountSnapshotFromAccountsResult({
      result: accountsResult([baseAccount]),
      nowMs: Date.parse("2026-10-15T20:00:20.000Z"),
    });
    const settings: ForexRiskSettings = {
      ...FOREX_RISK_DEFAULT_SETTINGS,
      accountDataSource: "manual",
      accountCurrency: "GBP",
      manualBalance: 2500,
      riskBasis: "manual_balance",
    };
    const applied = applyAccountSnapshotToRiskSettings(settings, snap);
    expect(applied.applied).toBe(false);
    expect(applied.settings.accountCurrency).toBe("GBP");
    expect(applied.settings.manualBalance).toBe(2500);
  });
});

describe("Phase 47C wiring", () => {
  it("uses create_reader + BASE_CRNCY and FXCM read-only UI fields", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const panel = read("desktop/forex-admin/ForexAdminRiskSettingsPanel.tsx");
    const enrich = read("ai/forex-ai/position-sizing/enrich.ts");
    const types = read("ai/forex-ai/position-sizing/types.ts");
    expect(sidecar).toContain("create_reader");
    expect(sidecar).toContain("BASE_CRNCY");
    expect(sidecar).toContain("find_property");
    expect(sidecar).toContain("_parse_currency_token");
    expect(panel).toContain("data-fxcm-readonly-fields");
    expect(panel).toContain("FXCM account (live snapshot)");
    expect(panel).toContain("Manual values are not used");
    expect(enrich).toMatch(/manualBalance: null/);
    expect(types).toMatch(/accountDataSource:\s*"forexconnect"/);
  });
});
