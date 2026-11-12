/**
 * Phase 1 — OpenAI client reliability (classification, backoff, retries).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as openaiClient from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";

const {
  classifyOpenAiHttpError,
  computeOpenAiRetryDelayMs,
  openAiChatJson,
  parseOpenAiRetryAfterMs,
} = openaiClient;

describe("classifyOpenAiHttpError", () => {
  it("maps 401 to OPENAI_AUTH_ERROR", () => {
    expect(classifyOpenAiHttpError(401, "")).toBe("OPENAI_AUTH_ERROR");
  });

  it("maps 429 rate_limit_exceeded to OPENAI_RATE_LIMIT", () => {
    const body = JSON.stringify({
      error: { code: "rate_limit_exceeded", message: "Rate limit reached" },
    });
    expect(classifyOpenAiHttpError(429, body)).toBe("OPENAI_RATE_LIMIT");
  });

  it("maps 429 insufficient_quota to OPENAI_BILLING_BLOCKED", () => {
    const body = JSON.stringify({
      error: { code: "insufficient_quota", message: "You exceeded your current quota." },
    });
    expect(classifyOpenAiHttpError(429, body)).toBe("OPENAI_BILLING_BLOCKED");
  });

  it("maps 500 to OPENAI_UNAVAILABLE", () => {
    expect(classifyOpenAiHttpError(500, "internal error")).toBe("OPENAI_UNAVAILABLE");
  });
});

describe("computeOpenAiRetryDelayMs", () => {
  it("honors Retry-After and caps at 20s", () => {
    expect(computeOpenAiRetryDelayMs(0, 3_000)).toBe(3_000);
    expect(computeOpenAiRetryDelayMs(2, 30_000)).toBe(20_000);
  });

  it("uses bounded exponential backoff when Retry-After is absent", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(computeOpenAiRetryDelayMs(0, null)).toBe(500);
    expect(computeOpenAiRetryDelayMs(1, null)).toBe(1_000);
    expect(computeOpenAiRetryDelayMs(10, null)).toBe(20_000);
    vi.mocked(Math.random).mockRestore();
  });
});

describe("parseOpenAiRetryAfterMs", () => {
  it("parses numeric Retry-After seconds", () => {
    expect(parseOpenAiRetryAfterMs({ "retry-after": "2" }, "")).toBe(2_000);
  });
});

describe("openAiChatJson fetch retries", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retries once after rate limit then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: { code: "rate_limit_exceeded", message: "Rate limit" },
          }),
          { status: 429, headers: { "retry-after": "1", "x-request-id": "req-rate-1" } },
        );
      }
      return new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
        { status: 200, headers: { "x-request-id": "req-ok-2" } },
      );
    }) as typeof fetch;

    vi.spyOn(openaiClient, "computeOpenAiRetryDelayMs").mockReturnValue(1);

    const result = await openAiChatJson({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      system: "sys",
      user: "user",
      timeoutMs: 60_000,
    });

    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.requestId).toBe("req-ok-2");
  });

  it("does not retry billing-blocked 429", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: { code: "insufficient_quota", message: "Quota exhausted" },
        }),
        { status: 429, headers: { "x-request-id": "req-bill-1" } },
      );
    }) as typeof fetch;

    const result = await openAiChatJson({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      system: "sys",
      user: "user",
      timeoutMs: 30_000,
    });

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("OPENAI_BILLING_BLOCKED");
    expect(result.attempts).toBe(1);
    expect(result.retryable).toBe(false);
    expect(result.error).toMatch(/billing or quota/i);
  });
});
