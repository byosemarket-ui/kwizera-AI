import { describe, expect, it } from "vitest";
import {
  buildAgentRequest,
  encodeFrame,
  isAllowedMt5HfmAgentMethod,
  isForbiddenTradingMethod,
  redactAgentPayload,
  signAgentRequest,
  tryDecodeFrame,
  verifyAgentMac,
} from "../../../../ai/market-data/mt5-hfm/agent-protocol";
import { assertBridgeEnvironmentIsDemo } from "../../../../ai/market-data/mt5-hfm/bridge-guards";
import { Mt5HfmLiveActivationLockedError } from "../../../../ai/market-data/mt5-hfm/live-gate";
import { mt5HfmThreatModelSummary } from "../../../../ai/market-data/mt5-hfm/threat-model";

describe("MT5 HFM agent protocol security", () => {
  const token = "unit-test-agent-token-value-32chars!!";

  it("signs and verifies request MAC", () => {
    const req = buildAgentRequest(token, "health", {});
    expect(verifyAgentMac(token, req)).toBe(true);
    expect(verifyAgentMac("wrong-token-value-xxxxxxxx", req)).toBe(false);
  });

  it("rejects forbidden trading / live methods", () => {
    expect(isForbiddenTradingMethod("order.buy")).toBe(true);
    expect(isForbiddenTradingMethod("live.login")).toBe(true);
    expect(isForbiddenTradingMethod("shell.exec")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("demo.login")).toBe(true);
    expect(isAllowedMt5HfmAgentMethod("order.buy")).toBe(false);
  });

  it("enforces frame size and round-trips", () => {
    const frame = encodeFrame({ ok: true });
    const decoded = tryDecodeFrame(frame, 262144);
    expect(decoded).not.toBeNull();
    expect(JSON.parse(decoded!.frame.toString("utf8"))).toEqual({ ok: true });
    const huge = Buffer.concat([
      (() => {
        const h = Buffer.alloc(4);
        h.writeUInt32BE(9000, 0);
        return h;
      })(),
      Buffer.alloc(10),
    ]);
    expect(() => tryDecodeFrame(huge, 8192)).toThrow(/FRAME_TOO_LARGE|out of bounds/);
  });

  it("redacts secrets from payloads", () => {
    const redacted = redactAgentPayload({
      method: "demo.login",
      body: { password: "secret-value", login: "123456" },
      mac: "abc",
    }) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain("secret-value");
    expect((redacted.body as Record<string, unknown>).password).toBe("[redacted]");
  });

  it("blocks Live bridge environment and documents threat model", () => {
    expect(() => assertBridgeEnvironmentIsDemo("live")).toThrow(Mt5HfmLiveActivationLockedError);
    assertBridgeEnvironmentIsDemo("demo");
    const tm = mt5HfmThreatModelSummary();
    expect(tm.liveForbidden).toBe(true);
    expect(tm.ordersForbidden).toBe(true);
    expect(tm.publicTcpForbidden).toBe(true);
  });

  it("MAC changes when body changes", () => {
    const a = signAgentRequest(token, {
      requestId: "r1",
      ts: 100,
      method: "demo.login",
      body: { login: "1" },
    });
    const b = signAgentRequest(token, {
      requestId: "r1",
      ts: 100,
      method: "demo.login",
      body: { login: "2" },
    });
    expect(a).not.toBe(b);
  });
});
