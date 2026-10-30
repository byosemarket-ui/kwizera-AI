/**
 * Phase 3.9 — API must not invent idempotency keys or silently coerce lots.
 * Source-wiring assertions (no broker mutation).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 59.0.16 DEMO API idempotency fail-closed", () => {
  const api = readFileSync(
    join(process.cwd(), "dev/server/forex-automated-trading-api.ts"),
    "utf8",
  );

  it("does not invent Date.now idempotency keys for open/close/cancel", () => {
    expect(api).not.toMatch(/demo_open_\$\{Date\.now\(\)\}/);
    expect(api).not.toMatch(/demo_close_\$\{Date\.now\(\)\}/);
    expect(api).not.toMatch(/demo_cancel_\$\{Date\.now\(\)\}/);
    expect(api).toContain('code: "IDEMPOTENCY_KEY_REQUIRED"');
  });

  it("rejects invalid lots instead of coercing to 1", () => {
    expect(api).not.toContain("Math.max(1, Math.floor(Number(body.lots ?? 1)))");
    expect(api).toContain('code: "LOTS_INVALID"');
  });
});
