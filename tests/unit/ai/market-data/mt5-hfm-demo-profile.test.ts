import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMt5HfmDemoProfileManager,
  MT5_HFM_DEMO_PASSWORD_SECRET_ID,
  MT5_HFM_LIVE_PASSWORD_SECRET_ID,
  resetMt5HfmDemoProfileManagerForTests,
  validateDemoLogin,
  validateDemoServer,
  validateLiveServer,
} from "../../../../ai/market-data/mt5-hfm/demo-profile";
import { assertNoSecretsInMt5HfmPayload } from "../../../../ai/market-data/mt5-hfm/secrets-guard";
import { endpointsForDemoServer } from "../../../../ai/market-data/mt5-hfm/connection-probe";
import { appendMt5HfmCredentialAudit } from "../../../../ai/market-data/mt5-hfm/credential-audit";
import {
  assertLiveActivationAllowed,
  Mt5HfmLiveActivationLockedError,
  publicLiveGate,
} from "../../../../ai/market-data/mt5-hfm/live-gate";
import { assertBridgeEnvironmentIsDemo, requestMt5HfmDemoLoginBridge } from "../../../../ai/market-data/mt5-hfm/login-bridge";
import { initialConnectionStagesFromProbe } from "../../../../ai/market-data/mt5-hfm/demo-login-plan";
import { mt5HfmBridgeSecurityAuditSummary } from "../../../../ai/market-data/mt5-hfm/bridge-security-audit";
import { mt5HfmSystemdProposalSummary } from "../../../../ai/market-data/mt5-hfm/systemd-proposal";

describe("MT5 HFM Demo + Live profile manager", () => {
  const roots: string[] = [];

  afterEach(async () => {
    resetMt5HfmDemoProfileManagerForTests();
    delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    delete process.env.KWIZERA_STORAGE_ROOT;
    for (const root of roots.splice(0)) {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("validates demo/live servers without cross-contamination", () => {
    expect(validateDemoLogin("12345678")).toBe("12345678");
    expect(() => validateDemoLogin("ab")).toThrow(/4–32/);
    expect(validateDemoServer("HFMarketsGlobal-Demo")).toBe("HFMarketsGlobal-Demo");
    expect(() => validateDemoServer("HFMarketsGlobal-Live1")).toThrow(/Live server/);
    expect(validateLiveServer("HFMarketsGlobal-Live1")).toBe("HFMarketsGlobal-Live1");
    expect(() => validateLiveServer("HFMarketsGlobal-Demo")).toThrow(/Demo server/);
  });

  it("maps demo servers to probe endpoints without secrets", () => {
    expect(endpointsForDemoServer("HFMarketsGlobal-Demo").length).toBeGreaterThan(0);
    expect(endpointsForDemoServer("HFMarketsGlobal-Demo3")[0]?.port).toBe(40305);
  });

  it("persists demo and live passwords in separate vault namespaces", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-"));
    roots.push(root);
    process.env.KWIZERA_SECRETS_PASSPHRASE = "unit-test-passphrase-mt5-hfm";

    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    const afterDemo = await manager.saveCredentials({
      environment: "demo",
      login: "90123456",
      server: "HFMarketsGlobal-Demo",
      password: "DemoSecretPass99",
    });
    const afterLive = await manager.saveCredentials({
      environment: "live",
      login: "80123456",
      server: "HFMarketsGlobal-Live1",
      password: "LiveSecretPass88",
    });

    expect(afterDemo.demo.configured).toBe(true);
    expect(afterLive.live.configured).toBe(true);
    expect(afterLive.liveAvailable).toBe(false);
    expect(afterLive.liveGate.loginEnabled).toBe(false);
    expect(JSON.stringify(afterLive)).not.toContain("DemoSecretPass99");
    expect(JSON.stringify(afterLive)).not.toContain("LiveSecretPass88");

    const demoMeta = await fs.readFile(path.join(root, "mt5-hfm", "demo-profile.json"), "utf8");
    const liveMeta = await fs.readFile(path.join(root, "mt5-hfm", "live-profile.json"), "utf8");
    expect(demoMeta).toContain("90123456");
    expect(demoMeta).not.toContain("DemoSecretPass99");
    expect(liveMeta).toContain("80123456");
    expect(liveMeta).not.toContain("LiveSecretPass88");
    expect(demoMeta).not.toContain("80123456");
    expect(liveMeta).not.toContain("90123456");

    const secretsRaw = await fs.readFile(
      path.join(root, "connector-management", "secrets.json"),
      "utf8",
    );
    expect(secretsRaw).toContain(MT5_HFM_DEMO_PASSWORD_SECRET_ID);
    expect(secretsRaw).toContain(MT5_HFM_LIVE_PASSWORD_SECRET_ID);
    expect(secretsRaw).not.toContain("DemoSecretPass99");
    expect(secretsRaw).not.toContain("LiveSecretPass88");

    expect(manager.getDemoPassword()).toBe("DemoSecretPass99");
    expect(manager.getLivePassword()).toBe("LiveSecretPass88");

    assertNoSecretsInMt5HfmPayload(afterLive, ["DemoSecretPass99", "LiveSecretPass88"]);

    const clearedLive = await manager.clearCredentials("live");
    expect(clearedLive.live.configured).toBe(false);
    expect(clearedLive.demo.configured).toBe(true);
    expect(manager.getLivePassword()).toBeNull();
    expect(manager.getDemoPassword()).toBe("DemoSecretPass99");
  });

  it("refuses durable save when vault passphrase is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-locked-"));
    roots.push(root);
    delete process.env.KWIZERA_SECRETS_PASSPHRASE;

    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    await expect(
      manager.saveCredentials({
        environment: "live",
        login: "80123456",
        server: "HFMarketsGlobal-Live1",
        password: "LiveSecretPass88",
      }),
    ).rejects.toThrow(/vault/i);
  });

  it("keeps Live activation fail-closed", () => {
    const gate = publicLiveGate();
    expect(gate.ownerAuthorized).toBe(false);
    expect(gate.loginEnabled).toBe(false);
    expect(gate.connectionTestEnabled).toBe(false);
    expect(gate.orderExecutionEnabled).toBe(false);
    expect(gate.credentialStorageEnabled).toBe(true);
    expect(() => assertLiveActivationAllowed("login")).toThrow(Mt5HfmLiveActivationLockedError);
    expect(() => assertLiveActivationAllowed("connection_test")).toThrow(Mt5HfmLiveActivationLockedError);
  });

  it("writes credential audit lines without password material", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-audit-"));
    roots.push(root);
    process.env.KWIZERA_STORAGE_ROOT = root;
    await appendMt5HfmCredentialAudit({
      action: "save",
      ok: true,
      actor: "forex-admin",
      environment: "live",
      code: "SAVED",
      loginHint: "••••3456",
      server: "HFMarketsGlobal-Live1",
      detail: "ok",
    });
    const raw = await fs.readFile(path.join(root, "mt5-hfm", "credential-audit.jsonl"), "utf8");
    expect(raw).toContain('"action":"save"');
    expect(raw).toContain('"environment":"live"');
    expect(raw).toContain('"actor":"forex-admin"');
    expect(raw).not.toMatch(/password/i);
  });

  it("does not wipe MQL balance when a thinner journal snapshot is recorded", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-acct-merge-"));
    roots.push(root);
    process.env.KWIZERA_SECRETS_PASSPHRASE = "unit-test-passphrase-mt5-hfm";
    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    await manager.recordDemoAccountSnapshot({
      loginHint: "••••3799",
      server: "HFMarketsGlobal-Demo",
      currency: "USD",
      balance: 100000,
      equity: 100000,
      freeMargin: 100000,
      marginLevel: 0,
      leverage: "2000",
      company: "HF Markets (SV) Ltd.",
      syncedAt: "2026-11-17T13:00:00Z",
      note: "MQL snapshot",
    });
    await manager.recordDemoAccountSnapshot({
      loginHint: "••••3799",
      server: "HFMarketsGlobal-Demo",
      currency: null,
      balance: null,
      equity: null,
      freeMargin: null,
      marginLevel: null,
      leverage: null,
      company: "HF Markets (SV) Ltd.",
      syncedAt: "2026-11-17T13:01:00Z",
      note: "Journal-verified Demo identity",
    });
    const acct = manager.publicStatus().demo.account;
    expect(acct?.balance).toBe(100000);
    expect(acct?.equity).toBe(100000);
    expect(acct?.currency).toBe("USD");
    expect(acct?.freeMargin).toBe(100000);
    expect(acct?.syncedAt).toBe("2026-11-17T13:01:00Z");
  });

  it("login bridge is Demo-only and fails closed without agent socket", async () => {
    const bridge = await requestMt5HfmDemoLoginBridge();
    expect(bridge.environment).toBe("demo");
    expect(bridge.authenticatedLogin).toBe(false);
    expect(["agent_unavailable", "error", "implemented_agent_optional"]).toContain(bridge.status);
    expect(bridge.security.publicTcpForbidden).toBe(true);
    expect(() => assertBridgeEnvironmentIsDemo("live")).toThrow(Mt5HfmLiveActivationLockedError);
  });

  it("blocks Live password activation reads while gate is locked", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-live-read-"));
    roots.push(root);
    process.env.KWIZERA_SECRETS_PASSPHRASE = "unit-test-passphrase-mt5-hfm";
    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    await manager.saveCredentials({
      environment: "live",
      login: "80123456",
      server: "HFMarketsGlobal-Live1",
      password: "LiveSecretPass88",
    });
    expect(manager.getLivePassword()).toBe("LiveSecretPass88");
    expect(() => manager.getLivePasswordForActivation()).toThrow(Mt5HfmLiveActivationLockedError);
    // Demo bridge path still only sees Demo vault.
    expect(manager.getDemoPassword()).toBeNull();
  });

  it("distinguishes TCP probe from login stages and keeps systemd proposal uninstalled", () => {
    const stages = initialConnectionStagesFromProbe({
      ok: true,
      status: "demo_network_reachable",
      summary: "3/4 Demo endpoints open",
    });
    expect(stages[0]?.stage).toBe("dns_tcp");
    expect(stages[0]?.status).toBe("ok");
    expect(stages.find((s) => s.stage === "demo_login")?.status).toBe("not_verified");
    expect(stages.find((s) => s.stage === "market_data")?.status).toBe("not_verified");
    expect(mt5HfmBridgeSecurityAuditSummary().publicTcpForbidden).toBe(true);
    expect(mt5HfmSystemdProposalSummary().installed).toBe(false);
    expect(mt5HfmSystemdProposalSummary().enabled).toBe(false);
    expect(mt5HfmSystemdProposalSummary().autoStart).toBe(false);
    expect(mt5HfmSystemdProposalSummary().status).toBe("phase4_units_authored_not_enabled");
  });
});
