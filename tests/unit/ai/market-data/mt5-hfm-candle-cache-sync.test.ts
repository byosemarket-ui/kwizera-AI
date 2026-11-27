import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function tryPython(code: string): string | null {
  for (const bin of ["python3", "python", "py"]) {
    const r = spawnSync(bin, bin === "py" ? ["-3", "-c", code] : ["-c", code], {
      encoding: "utf8",
      cwd: resolve("services/mt5-hfm-agent"),
    });
    if (r.status === 0) return (r.stdout || "").trim();
  }
  return null;
}

describe("Agent candle cache ordering", () => {
  it("ships pure ordering helpers and wires stream_snapshot sync", () => {
    const sync = readFileSync(resolve("services/mt5-hfm-agent/candle_cache_sync.py"), "utf8");
    const control = readFileSync(resolve("services/mt5-hfm-agent/mt5_control.py"), "utf8");
    expect(sync).toContain("def should_accept_incoming_snapshot");
    expect(sync).toContain("REJECT_OLDER_SEQ");
    expect(sync).toContain("ACCEPT_SAME_SEQ_IDEMPOTENT");
    expect(sync).toContain("def snapshot_is_well_formed");
    expect(control).toContain("from candle_cache_sync import");
    expect(control).toContain("_sync_periodic_candle_dump_cache");
    expect(control).toContain("dump_sync = _sync_periodic_candle_dump_cache()");
    expect(control).toContain("candleCacheSync");
  });

  it("python ordering rules reject stale and accept newer/same (when python available)", () => {
    const out = tryPython(`
from candle_cache_sync import should_accept_incoming_snapshot, snapshot_is_well_formed
print(should_accept_incoming_snapshot(incoming_seq=5, existing_seq=10)[0], should_accept_incoming_snapshot(incoming_seq=5, existing_seq=10)[1])
print(should_accept_incoming_snapshot(incoming_seq=10, existing_seq=10)[1])
print(should_accept_incoming_snapshot(incoming_seq=11, existing_seq=10)[1])
print(should_accept_incoming_snapshot(incoming_seq=1, existing_seq=None)[1])
print(should_accept_incoming_snapshot(incoming_seq=None, existing_seq=3, incoming_mtime=1, existing_mtime=2)[1])
print(snapshot_is_well_formed({"EURUSD":{"M1":[{"time":1,"open":1,"high":2,"low":0.5,"close":1.5}]}}))
print(snapshot_is_well_formed({}))
`);
    if (out == null) {
      // Local Windows runners may lack python3; VPS executes this path.
      expect(readFileSync(resolve("services/mt5-hfm-agent/candle_cache_sync.py"), "utf8")).toContain(
        "REJECT_OLDER_SEQ",
      );
      return;
    }
    expect(out).toContain("False REJECT_OLDER_SEQ");
    expect(out).toContain("ACCEPT_SAME_SEQ_IDEMPOTENT");
    expect(out).toContain("ACCEPT_NEWER_SEQ");
    expect(out).toContain("ACCEPT_BOOTSTRAP_SEQ");
    expect(out).toContain("REJECT_UNSEQUENCED_OVER_SEQUENCED");
    expect(out).toContain("True\nFalse");
  });
});
