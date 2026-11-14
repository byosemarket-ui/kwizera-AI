import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMt5HfmDemoProfileManager,
  MT5_HFM_DEMO_PASSWORD_SECRET_ID,
  resetMt5HfmDemoProfileManagerForTests,
  validateDemoLogin,
  validateDemoServer,
} from "../../../../ai/market-data/mt5-hfm/demo-profile";
import { assertNoSecretsInMt5HfmPayload } from "../../../../ai/market-data/mt5-hfm/secrets-guard";
import { endpointsForDemoServer } from "../../../../ai/market-data/mt5-hfm/connection-probe";
import { appendMt5HfmCredentialAudit } from "../../../../ai/market-data/mt5-hfm/credential-audit";
import { requestMt5HfmDemoLoginBridge } from "../../../../ai/market-data/mt5-hfm/login-bridge";

describe("MT5 HFM Demo profile manager", () => {
  const roots: string[] = [];

  afterEach(async () => {
    resetMt5HfmDemoProfileManagerForTests();
    delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    delete process.env.KWIZERA_STORAGE_ROOT;
    for (const root of roots.splice(0)) {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("validates demo login/server and rejects live-looking servers", () => {
    expect(validateDemoLogin("12345678")).toBe("12345678");
    expect(() => validateDemoLogin("ab")).toThrow(/4–32/);
    expect(validateDemoServer("HFMarketsGlobal-Demo")).toBe("HFMarketsGlobal-Demo");
    expect(() => validateDemoServer("HFMarketsGlobal-Live1")).toThrow(/Live server/);
  });

  it("maps demo servers to probe endpoints without secrets", () => {
    expect(endpointsForDemoServer("HFMarketsGlobal-Demo").length).toBeGreaterThan(0);
    expect(endpointsForDemoServer("HFMarketsGlobal-Demo3")[0]?.port).toBe(40305);
  });

  it("persists metadata without password and stores password only in vault", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-"));
    roots.push(root);
    process.env.KWIZERA_SECRETS_PASSPHRASE = "unit-test-passphrase-mt5-hfm";

    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    const status = await manager.saveCredentials({
      login: "90123456",
      server: "HFMarketsGlobal-Demo",
      password: "DemoSecretPass99",
    });

    expect(status.configured).toBe(true);
    expect(status.passwordConfigured).toBe(true);
    expect(status.loginHint).toBeTruthy();
    expect(JSON.stringify(status)).not.toContain("DemoSecretPass99");

    const metaRaw = await fs.readFile(path.join(root, "mt5-hfm", "demo-profile.json"), "utf8");
    expect(metaRaw).toContain("90123456");
    expect(metaRaw).toContain("HFMarketsGlobal-Demo");
    expect(metaRaw).not.toContain("DemoSecretPass99");
    expect(metaRaw).not.toMatch(/password/i);

    const secretsRaw = await fs.readFile(
      path.join(root, "connector-management", "secrets.json"),
      "utf8",
    );
    expect(secretsRaw).toContain(MT5_HFM_DEMO_PASSWORD_SECRET_ID);
    expect(secretsRaw).not.toContain("DemoSecretPass99");

    assertNoSecretsInMt5HfmPayload(status, ["DemoSecretPass99"]);
    expect(() =>
      assertNoSecretsInMt5HfmPayload({ password: "DemoSecretPass99" }, []),
    ).toThrow(/password field/);

    const cleared = await manager.clearCredentials();
    expect(cleared.configured).toBe(false);
    expect(cleared.passwordConfigured).toBe(false);
  });

  it("refuses durable save when vault passphrase is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-locked-"));
    roots.push(root);
    delete process.env.KWIZERA_SECRETS_PASSPHRASE;

    const manager = createMt5HfmDemoProfileManager();
    await manager.initialize(root);
    await expect(
      manager.saveCredentials({
        login: "90123456",
        server: "HFMarketsGlobal-Demo",
        password: "DemoSecretPass99",
      }),
    ).rejects.toThrow(/vault/i);
  });

  it("writes credential audit lines without password material", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mt5-hfm-audit-"));
    roots.push(root);
    process.env.KWIZERA_STORAGE_ROOT = root;
    await appendMt5HfmCredentialAudit({
      action: "save",
      ok: true,
      code: "SAVED",
      loginHint: "••••3456",
      server: "HFMarketsGlobal-Demo",
      detail: "ok",
    });
    const raw = await fs.readFile(path.join(root, "mt5-hfm", "credential-audit.jsonl"), "utf8");
    expect(raw).toContain('"action":"save"');
    expect(raw).not.toMatch(/password/i);
  });

  it("login bridge placeholder stays not_implemented", async () => {
    const bridge = await requestMt5HfmDemoLoginBridge();
    expect(bridge.status).toBe("not_implemented");
    expect(bridge.account).toBeNull();
  });
});
