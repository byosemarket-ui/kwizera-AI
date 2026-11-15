import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const life = path.join(root, "services/mt5-hfm-lifecycle");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("mt5-hfm-lifecycle Phase 4 units", () => {
  it("ships separate xvfb, demo, and agent units without KWIZERA coupling", () => {
    expect(fs.existsSync(path.join(life, "kwizera-mt5-xvfb.service"))).toBe(true);
    expect(fs.existsSync(path.join(life, "kwizera-mt5-hfm-demo.service"))).toBe(true);
    expect(fs.existsSync(path.join(life, "kwizera-mt5-hfm-agent.service"))).toBe(true);
    expect(fs.existsSync(path.join(life, "ROLLBACK.md"))).toBe(true);

    const xvfb = read("services/mt5-hfm-lifecycle/kwizera-mt5-xvfb.service");
    const demo = read("services/mt5-hfm-lifecycle/kwizera-mt5-hfm-demo.service");
    const agent = read("services/mt5-hfm-lifecycle/kwizera-mt5-hfm-agent.service");

    expect(xvfb).toContain("User=mt5");
    expect(xvfb).toContain("ExecStart=/usr/bin/Xvfb :97");
    expect(xvfb).not.toMatch(/ExecStartPre=.*Xvfb/);
    expect(xvfb).not.toContain("pkill");

    expect(demo).toContain("Requires=kwizera-mt5-xvfb.service");
    expect(demo).toContain("User=mt5");
    expect(demo).toContain("WINEPREFIX=/home/mt5/.wine-hfm");
    expect(demo).toContain("MemoryMax=1G");
    expect(demo).not.toContain("kwizera-ai.service");
    expect(demo).not.toContain("kwizera-forexconnect.service");
    expect(demo).not.toContain("pkill");

    expect(agent).toContain("Requires=kwizera-mt5-hfm-demo.service");
    expect(agent).toContain("KWIZERA_MT5_HFM_AGENT_TOKEN_FILE=");
    expect(agent).not.toMatch(/Environment=.*TOKEN=[^F]/
    expect(agent).not.toContain("kwizera-ai.service");
  });

  it("stop script is prefix-scoped and helpers avoid broad pkill", () => {
    const stop = read("services/mt5-hfm-lifecycle/bin/stop-mt5-demo.sh");
    const start = read("services/mt5-hfm-lifecycle/bin/start-mt5-demo.sh");
    const xauth = read("services/mt5-hfm-lifecycle/bin/prepare-xauth.sh");

    expect(stop).toContain("wineserver");
    expect(stop).toContain("WINEPREFIX");
    expect(stop).not.toContain("pkill -9");
    expect(stop).not.toMatch(/pkill\s+-u\s+mt5\s+-f\s+'Xvfb/);
    expect(start).toContain("/portable");
    expect(start).toContain("must_run_as_mt5");
    expect(xauth).toContain("mcookie");
    expect(xauth).toContain("chmod 600");
  });
});
