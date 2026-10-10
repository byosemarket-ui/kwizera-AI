/**
 * Phase 36E — ForexConnect live Offers streaming safeguards (unit).
 * Real LIVE proof requires production Offers bid/ask changes (updateCount > 0).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FOREXCONNECT_STALE_MS } from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 36E Offers streaming lifecycle", () => {
  it("sidecar registers callbacks and polls Offers table for genuine bid/ask diffs", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("on_change_callback=_on_offer_changed");
    expect(sidecar).toContain("on_add_callback=_on_offer_changed");
    expect(sidecar).toContain("_poll_offers_table_once");
    expect(sidecar).toContain('event_source="offers-table-diff"');
    expect(sidecar).toContain('event_source="offers-callback"');
    expect(sidecar).toContain("require_change");
    expect(sidecar).toContain("callbackInvocations");
    expect(sidecar).toContain("pollChanges");
    expect(sidecar).toContain("MARKET_INACTIVE");
    expect(sidecar).toContain("Seeded snapshots do not set LIVE");
  });

  it("live service marks LIVE only when sidecar updateCount advances", () => {
    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("hasNewOffersEvents");
    expect(live).toContain("lastSeenStreamUpdateCount");
    expect(live).toContain("SUBSCRIBED_WAITING");
    expect(live).not.toMatch(/streamState\s*=\s*"LIVE"[\s\S]{0,40}seed/i);
    expect(FOREXCONNECT_STALE_MS).toBe(15_000);
  });

  it("stream status exposes diagnostics without secrets", () => {
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("diagnostics:");
    expect(client).toContain("callbackInvocations");
    expect(client).toContain("$1=[redacted]");
    expect(client).toContain("delete safe.password");
    expect(client).toContain("assertNoSecretsInForexConnectPayload");
    const types = read("ai/market-data/forexconnect/live-types.ts");
    expect(types).toContain("ForexConnectStreamDiagnostics");
    expect(types).toContain("MARKET_INACTIVE");
    const admin = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    expect(admin).toContain("data-fc-stream-diagnostics");
    expect(admin).toContain("Offers poll:");
  });

  it("does not introduce Socket REST fallback or invented ticks", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).not.toContain("socketapi");
    expect(sidecar).not.toMatch(/invent(?:ed)?\s+(?:bid|ask|tick|quote|price)/i);
    expect(sidecar).toContain("Never invents prices");
    expect(sidecar).toContain("require_change");
    const service = read("ai/market-data/providers/market-data-service.ts");
    expect(service).toContain("never fall back to Binance or FXCM Socket REST");
  });
});
