/**
 * Phase 44A.1 — Model-compatible temperature / verification request policy.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  OPENAI_GPT6_CANDIDATE_IDS,
  openAiOmitsCustomTemperature,
} from "../../../../ai/forex-ai/snapshot-openai/model-policy.ts";
import { buildOpenAiChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 44A.1 temperature compatibility policy", () => {
  it("omits custom temperature for GPT-5 / GPT-6 / o-series; keeps it for gpt-4o*", () => {
    expect(openAiOmitsCustomTemperature("gpt-4o-mini")).toBe(false);
    expect(openAiOmitsCustomTemperature("gpt-4o")).toBe(false);
    expect(openAiOmitsCustomTemperature("gpt-6-luna")).toBe(true);
    expect(openAiOmitsCustomTemperature("gpt-6-astra")).toBe(true);
    expect(openAiOmitsCustomTemperature("gpt-6-sol")).toBe(true);
    expect(openAiOmitsCustomTemperature("gpt-6.1-sol")).toBe(true);
    expect(openAiOmitsCustomTemperature("gpt-5")).toBe(true);
    expect(openAiOmitsCustomTemperature("gpt-5-mini")).toBe(true);
    expect(openAiOmitsCustomTemperature("o1")).toBe(true);
    expect(openAiOmitsCustomTemperature("o3-mini")).toBe(true);
  });

  it("builds Chat Completions bodies without temperature for GPT-6; with temperature for gpt-4o-mini", () => {
    const classic = buildOpenAiChatJsonBody({
      model: "gpt-4o-mini",
      system: "sys",
      user: "user",
      temperature: 0,
    });
    expect(classic.temperature).toBe(0);
    expect(classic.model).toBe("gpt-4o-mini");
    expect(classic.response_format).toEqual({ type: "json_object" });

    const gpt6 = buildOpenAiChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      user: "user",
      temperature: 0,
    });
    expect(gpt6).not.toHaveProperty("temperature");
    expect(gpt6.model).toBe("gpt-6-luna");

    const astra = buildOpenAiChatJsonBody({
      model: "gpt-6-astra",
      system: "sys",
      user: "user",
      temperature: 0.1,
    });
    expect(astra).not.toHaveProperty("temperature");
  });

  it("lists GPT-6 sol variants among probe candidates", () => {
    expect(OPENAI_GPT6_CANDIDATE_IDS).toContain("gpt-6-sol");
    expect(OPENAI_GPT6_CANDIDATE_IDS).toContain("gpt-6.1-sol");
  });
});

describe("Phase 44A.1 wiring", () => {
  it("routes verify and Forex inference through buildOpenAiChatJsonBody", () => {
    const client = read("ai/forex-ai/snapshot-openai/openai-client.ts");
    const policy = read("ai/forex-ai/snapshot-openai/model-policy.ts");
    const engine = read("ai/forex-ai/snapshot-openai/engine.ts");
    expect(policy).toContain("openAiOmitsCustomTemperature");
    expect(client).toContain("buildOpenAiChatJsonBody");
    expect(client).toContain("openAiOmitsCustomTemperature");
    expect(client).toContain("verifyOpenAiConnection");
    // Engine still may pass temperature intents; the client must decide omission.
    expect(engine).toContain("temperature:");
    expect(client).not.toMatch(/console\.log\([^)]*apiKey/);
  });
});
