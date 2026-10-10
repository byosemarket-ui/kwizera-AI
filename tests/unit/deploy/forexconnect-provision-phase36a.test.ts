/**
 * Phase 36A — ForexConnect VPS provisioner presence and safety (mocked file checks).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 36A ForexConnect provision", () => {
  it("provisions a Python 3.7 venv, verifies import, and enables only when ready", () => {
    const script = read("deploy/provision-forexconnect.sh");
    expect(script).toContain("python3.7");
    expect(script).toContain("forexconnect==");
    expect(script).toContain("runtime-probe.json");
    expect(script).toContain("KWIZERA_FOREXCONNECT_ENABLED");
    expect(script).toContain("su -s /bin/bash");
    expect(script).toContain("import forexconnect");
    // Must not embed live credentials.
    expect(script).not.toMatch(/KWIZERA_FOREXCONNECT_PASSWORD=.+/);
    expect(script).not.toContain("place_order");
  });

  it("systemd unit uses venv python and localhost bind", () => {
    const unit = read("deploy/kwizera-forexconnect.service");
    expect(unit).toContain(".venv/bin/python");
    expect(unit).toContain("KWIZERA_FOREXCONNECT_SIDECAR_HOST=127.0.0.1");
    expect(unit).toContain("User=kwizera");
    expect(unit).toContain("TimeoutStartSec=60");
  });

  it("deploy restart path runs provisioner before enabling sidecar", () => {
    const update = read("deploy/update-from-github.sh");
    expect(update).toContain("provision-forexconnect.sh");
    expect(update).toContain("127.0.0.1:5179");
    expect(update).toContain("SECURITY: ForexConnect appears bound publicly");
  });

  it("status API exposes runtimeProbe helper", () => {
    const api = read("dev/server/forexconnect-api.ts");
    const probe = read("ai/market-data/forexconnect/runtime-probe.ts");
    expect(api).toContain("readForexConnectRuntimeProbe");
    expect(api).toContain("runtimeProbe");
    expect(probe).toContain("runtime-probe.json");
    expect(probe).not.toContain("password");
  });
});
