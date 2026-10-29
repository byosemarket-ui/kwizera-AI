import { describe, expect, it } from "vitest";
import { forexConnectErrorHttpStatus } from "../../../../ai/market-data/forexconnect/errors.js";

describe("forexConnectErrorHttpStatus", () => {
  it("maps unknown instruments to 404 instead of 502 Bad Gateway", () => {
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_UNKNOWN_INSTRUMENT")).toBe(404);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_INSTRUMENT_NOT_FOUND")).toBe(404);
  });

  it("maps client validation failures to 400", () => {
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_UNSUPPORTED_TIMEFRAME")).toBe(400);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_INVALID_REQUEST")).toBe(400);
  });

  it("maps disabled / unavailable configuration to 503", () => {
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_DISABLED")).toBe(503);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_NOT_CONFIGURED")).toBe(503);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_SERVICE_UNAVAILABLE")).toBe(503);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_SDK_UNAVAILABLE")).toBe(503);
  });

  it("maps auth failures to 401 and subscription limits to 429", () => {
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_AUTHENTICATION_FAILED")).toBe(401);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_SUBSCRIPTION_LIMIT")).toBe(429);
  });

  it("keeps genuine upstream failures as 502", () => {
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_HISTORICAL_FAILED")).toBe(502);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_DISCONNECTED")).toBe(502);
    expect(forexConnectErrorHttpStatus("FOREXCONNECT_STREAM_ERROR")).toBe(502);
  });
});
