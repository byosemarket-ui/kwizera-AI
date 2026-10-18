/**
 * Phase 51 — Automated Trading foundation: env isolation, controls, no orders.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AUTOMATED_EXECUTION_BANNER,
  parseAutomatedTradingEnvironment,
  maskAccountId,
  getAutomatedTradingService,
  resetAutomatedTradingServiceForTests,
  resetAutomatedTradingStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 51 environment parsing & masking", () => {
  it("accepts DEMO/LIVE only", () => {
    expect(parseAutomatedTradingEnvironment("DEMO")).toBe("DEMO");
    expect(parseAutomatedTradingEnvironment("live")).toBe("LIVE");
    expect(parseAutomatedTradingEnvironment("real")).toBeNull();
    expect(parseAutomatedTradingEnvironment("")).toBeNull();
    expect(parseAutomatedTradingEnvironment(null)).toBeNull();
  });

  it("masks account ids without leaking full values", () => {
    expect(maskAccountId("12345678")).toMatch(/78$/);
    expect(maskAccountId("12345678")).not.toContain("123456");
    expect(maskAccountId("ab")).toBe("••••");
    expect(maskAccountId(null)).toBeNull();
  });
});

describe("Phase 51 store isolation & controls", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-at-"));
    resetAutomatedTradingStoreForTests();
    resetAutomatedTradingServiceForTests();
  });

  afterEach(() => {
    resetAutomatedTradingServiceForTests();
    resetAutomatedTradingStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("defaults to DEMO, entry lock ON, master OFF, and persists across reload", async () => {
    const svc = getAutomatedTradingService(tmp);
    const status = await svc.buildStatus();
    expect(status.selectedEnvironment).toBe("DEMO");
    expect(status.controls.masterEnable).toBe(false);
    expect(status.controls.emergencyEntryLock).toBe(true);
    expect(status.controls.automaticEntry).toBe("DISABLED");
    expect(status.controls.automatedExecutionEnabled).toBe(false);
    expect(status.placesOrders).toBe(false);
    expect(status.banner).toBe(AUTOMATED_EXECUTION_BANNER);
    expect(status.blockers.some((b) => /PHASE 5[12]/i.test(b))).toBe(true);

    resetAutomatedTradingServiceForTests();
    resetAutomatedTradingStoreForTests();
    const again = await getAutomatedTradingService(tmp).buildStatus();
    expect(again.selectedEnvironment).toBe("DEMO");
    expect(again.controls.emergencyEntryLock).toBe(true);
  });

  it("requires confirm and rejects stale epoch on environment switch", async () => {
    const svc = getAutomatedTradingService(tmp);
    const denied = await svc.selectEnvironment({
      environment: "LIVE",
      confirm: false,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("CONFIRMATION_REQUIRED");

    const invalid = await svc.selectEnvironment({
      environment: "PAPER",
      confirm: true,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("INVALID_ENVIRONMENT");

    const first = await svc.selectEnvironment({
      environment: "LIVE",
      confirm: true,
      expectedCurrentEnvironment: "DEMO",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.status.selectedEnvironment).toBe("LIVE");
    const epoch = first.status.environmentEpoch;

    const stale = await svc.selectEnvironment({
      environment: "DEMO",
      confirm: true,
      expectedCurrentEnvironment: "LIVE",
      expectedEnvironmentEpoch: epoch - 1,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("STALE_EPOCH");
  });

  it("keeps DEMO and LIVE control buckets isolated", async () => {
    const svc = getAutomatedTradingService(tmp);
    await svc.selectEnvironment({ environment: "DEMO", confirm: true });
    await svc.updateControls({
      environment: "DEMO",
      patch: { masterEnable: true },
    });
    await svc.selectEnvironment({ environment: "LIVE", confirm: true });
    const liveStatus = await svc.buildStatus();
    expect(liveStatus.selectedEnvironment).toBe("LIVE");
    expect(liveStatus.controls.masterEnable).toBe(false);

    const mismatch = await svc.updateControls({
      environment: "DEMO",
      patch: { masterEnable: false },
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("ENVIRONMENT_MISMATCH");
  });

  it("activates emergency lock and never enables automatic entry execution", async () => {
    const svc = getAutomatedTradingService(tmp);
    const unlocked = await svc.setEmergencyLock({
      environment: "DEMO",
      locked: false,
    });
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(unlocked.status.controls.emergencyEntryLock).toBe(false);

    const forced = await svc.updateControls({
      environment: "DEMO",
      patch: { automaticEntry: true, positionManagement: true },
    });
    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    expect(forced.status.controls.automaticEntry).toBe("DISABLED");
    expect(forced.status.controls.positionManagement).toBe("NOT_ACTIVE");
  });

  it("rejects verify-account for non-selected environment", async () => {
    const svc = getAutomatedTradingService(tmp);
    const res = await svc.recordAccountVerification({
      environment: "LIVE",
      accountId: "acct-1",
      status: "VERIFIED",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ENVIRONMENT_MISMATCH");
  });
});

describe("Phase 51 static contracts", () => {
  it("registers route, API, and never wires order submission", () => {
    expect(read("desktop/forex/forex-routes.ts")).toContain('"automated-trading"');
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/automated-trading");
    expect(read("desktop/forex/ForexShell.tsx")).toContain("ForexAutomatedTradingPage");
    expect(read("dev/server/index.ts")).toContain("handleForexAutomatedTradingApi");
    expect(read("dev/server/forex-automated-trading-api.ts")).toContain("EXECUTION_FORBIDDEN");
    expect(read("dev/server/forex-automated-trading-api.ts")).toContain("requireForexAdmin");

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);
    expect(service).toContain("AUTOMATED_EXECUTION_BANNER");
    expect(read("ai/forex-ai/automated-trading/types.ts")).toContain(BANNER_FRAGMENT);

    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    expect(read("desktop/forex/ForexAutomatedTradingPage.tsx")).toContain(BANNER_FRAGMENT);
    expect(read("ai/forex-ai/multi-image-openai/engine.ts")).toContain("applyBinaryDirectionalClassification");
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/ai-analysis");
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/charts");
  });
});

describe("Phase 51.1 UI polish contracts", () => {
  it("keeps a compact hierarchy, collapsible admin auth, and masked token input", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("FXCM ForexConnect automation");
    expect(page).toContain('data-fx-at-admin-auth="true"');
    expect(page).toContain("<details");
    expect(page).toContain('type="password"');
    expect(page).toContain("Admin authorization");
    expect(page).toContain('data-fx-at-summary="true"');
    expect(page).toContain(BANNER_FRAGMENT);
    expect(page).toContain("cannot submit broker orders");
    expect(page).toContain('data-fx-at-auto-entry="disabled"');
    expect(page).toContain('data-fx-at-pos-mgmt="not-active"');
    // Session-only storage key — no localStorage / URL persistence of the secret.
    expect(page).toContain("sessionStorage");
    expect(page).not.toMatch(/localStorage\.setItem/);
    expect(page).not.toMatch(/console\.(log|debug|info|warn|error)\([^)]*token/i);
    expect(page).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);
  });

  it("scopes Phase 51.1 CSS to Automated Trading without duplicate blocks", () => {
    const css = read("desktop/forex/forex.css");
    const marker = "Phase 51.1 - Automated Trading";
    expect(css).toContain(marker);
    expect(css.split(marker).length - 1).toBe(1);
    expect(css).toContain(".fx-auto-trading-auth");
    expect(css).toContain(".fx-auto-trading-summary");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain(".fx-auto-trading {");
  });
});

const BANNER_FRAGMENT = "AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 52";
