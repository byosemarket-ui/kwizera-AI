import { describe, expect, it } from "vitest";
import { uiEnvFromFc } from "../../../../../ai/forex-ai/automated-trading/verification-engine.js";

describe("uiEnvFromFc — Stage 7.3 DEMO session label parsing", () => {
  it("accepts structured environment tokens", () => {
    expect(uiEnvFromFc("demo")).toBe("DEMO");
    expect(uiEnvFromFc("DEMO")).toBe("DEMO");
    expect(uiEnvFromFc("live")).toBe("LIVE");
    expect(uiEnvFromFc("real")).toBe("LIVE");
  });

  it("accepts ForexConnect display labels without requiring exact equality", () => {
    expect(uiEnvFromFc("FXCM DEMO")).toBe("DEMO");
    expect(uiEnvFromFc("fxcm demo")).toBe("DEMO");
    expect(uiEnvFromFc("FXCM Real")).toBe("LIVE");
    expect(uiEnvFromFc("FXCM LIVE")).toBe("LIVE");
  });

  it("prefers failing closed on unknown / empty labels", () => {
    expect(uiEnvFromFc(null)).toBeNull();
    expect(uiEnvFromFc("")).toBeNull();
    expect(uiEnvFromFc("unknown")).toBeNull();
    expect(uiEnvFromFc("demonstration")).toBeNull();
  });
});
