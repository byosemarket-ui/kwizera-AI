/**
 * Phase 44A — OpenAI verification, GPT-6 eligibility, discovery probes.
 */
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  OPENAI_GPT6_CANDIDATE_IDS,
  createForexOpenAiConfigStore,
  filterEligibleOpenAiModels,
  isOpenAiChatEligibleModel,
  isOpenAiGpt6FamilyModel,
  resetForexOpenAiConfigStoreForTests,
} from "../../../../ai/forex-ai/snapshot-openai/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 44A model policy", () => {
  it("includes GPT-6 family in eligibility allowlist", () => {
    expect(isOpenAiChatEligibleModel("gpt-6-astra")).toBe(true);
    expect(isOpenAiChatEligibleModel("gpt-6.1-sol")).toBe(true);
    expect(isOpenAiChatEligibleModel("gpt-6-luna")).toBe(true);
    expect(isOpenAiGpt6FamilyModel("gpt-6-astra")).toBe(true);
    expect(isOpenAiChatEligibleModel("gpt-4o-mini")).toBe(true);
    expect(isOpenAiChatEligibleModel("text-embedding-3-small")).toBe(false);
    expect(OPENAI_GPT6_CANDIDATE_IDS).toContain("gpt-6-astra");
  });

  it("filters eligible models including gpt-6*", () => {
    const filtered = filterEligibleOpenAiModels([
      { id: "gpt-4o-mini", created: 1, ownedBy: "openai" },
      { id: "gpt-6-astra", created: 2, ownedBy: "openai" },
      { id: "text-embedding-3-large", created: 3, ownedBy: "openai" },
    ]);
    expect(filtered.map((m) => m.id).sort()).toEqual(["gpt-4o-mini", "gpt-6-astra"]);
  });
});

describe("Phase 44A config verification display", () => {
  const prevPass = process.env.KWIZERA_SECRETS_PASSPHRASE;

  beforeEach(() => {
    process.env.KWIZERA_SECRETS_PASSPHRASE = "test-passphrase-phase44a-not-real";
  });

  afterEach(() => {
    if (prevPass == null) delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    else process.env.KWIZERA_SECRETS_PASSPHRASE = prevPass;
    resetForexOpenAiConfigStoreForTests();
  });

  it("does not claim VERIFIED merely because a key is configured", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-44a-"));
    const store = createForexOpenAiConfigStore(dir);
    const before = await store.getPublicStatus();
    expect(before.configured).toBe(false);
    expect(before.verificationDisplay).toBe("NOT_VERIFIED");

    await store.setApiKey("sk-testkeyphase44a1234567890abcdef", "gpt-4o-mini");
    const after = await store.getPublicStatus();
    expect(after.configured).toBe(true);
    expect(after.verificationDisplay).toBe("NOT_VERIFIED");
    expect(JSON.stringify(after)).not.toContain("sk-");

    await store.recordValidation(true, "Verified model gpt-4o-mini via bounded ping.");
    const ok = await store.getPublicStatus();
    expect(ok.verificationDisplay).toBe("VERIFIED");
    expect(ok.lastVerificationNote).toMatch(/Verified/);

    await store.recordValidation(false, "OpenAI authentication failed.");
    const failed = await store.getPublicStatus();
    expect(failed.verificationDisplay).toBe("VERIFICATION_FAILED");
    expect(failed.lastVerificationNote).not.toMatch(/sk-/);

    rmSync(dir, { recursive: true, force: true });
  });

  it("preserves saved model across discovery cache writes", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-44a-m-"));
    const store = createForexOpenAiConfigStore(dir);
    await store.setApiKey("sk-testkeyphase44a1234567890abcdef", "gpt-4o-mini");
    await store.saveDiscoveredModels([
      { id: "gpt-4o-mini", created: 1, ownedBy: "openai", eligible: true, source: "list", gpt6Family: false },
      { id: "gpt-6-astra", created: 2, ownedBy: "openai", eligible: true, source: "probe", gpt6Family: true },
    ]);
    expect(await store.getModel()).toBe("gpt-4o-mini");
    const cached = await store.getDiscoveredModels();
    expect(cached.models.some((m) => m.id === "gpt-6-astra")).toBe(true);
    expect(await store.getModel()).toBe("gpt-4o-mini");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Phase 44A wiring + security contracts", () => {
  it("wires verify route, discovery probes, and Admin verify UI", () => {
    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    const policy = read("ai/forex-ai/snapshot-openai/model-policy.ts");
    const client = read("ai/forex-ai/snapshot-openai/openai-client.ts");
    const discover = read("ai/forex-ai/snapshot-openai/discover-models.ts");
    const admin = read("desktop/forex-admin/ForexAdminIntelligencePages.tsx");
    const adminApi = read("desktop/forex-admin/api.ts");

    expect(policy).toContain('"gpt-6"');
    expect(discover).toContain("OPENAI_GPT6_CANDIDATE_IDS");
    expect(discover).toContain("getOpenAiModel");
    expect(client).toContain("verifyOpenAiConnection");
    expect(client).not.toMatch(/console\.log\([^)]*apiKey/);
    expect(client).toContain("Does not log Authorization headers");
    expect(api).toContain("/api/forex-admin/openai-config/verify");
    expect(api).toContain("verifyOpenAiConnection");
    expect(api).toContain("requireForexAdmin");
    expect(api).not.toMatch(/apiKey:\s*status/);
    expect(admin).toContain("data-openai-verify-btn");
    expect(admin).toContain("Verify connection");
    expect(adminApi).toContain("verify:");
  });
});
