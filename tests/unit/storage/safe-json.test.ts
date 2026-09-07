/**
 * Safe JSON persistence — corrupt/truncated stores must not kill boot.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quarantineCorruptFile, readJsonSafe, writeJsonAtomic } from "../../../storage/safe-json.js";

describe("safe-json persistence recovery", () => {
  let root = "";

  afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
  });

  it("returns fallback and quarantines unterminated JSON", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-safe-json-"));
    const filePath = path.join(root, "learning.json");
    // Simulate truncated write (~same failure class as production 8MB unterminated string).
    await fs.writeFile(filePath, '{"experiences":[{"lesson":"unterminated', "utf8");

    const result = await readJsonSafe(filePath, { experiences: [] as unknown[] });
    expect(result.recovered).toBe(true);
    expect(result.value).toEqual({ experiences: [] });
    expect(result.quarantinedPath).toBeTruthy();

    await expect(fs.access(filePath)).rejects.toBeTruthy();
    await expect(fs.access(result.quarantinedPath!)).resolves.toBeUndefined();
  });

  it("writes atomically and reads back", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-safe-json-"));
    const filePath = path.join(root, "store.json");
    await writeJsonAtomic(filePath, { ok: true, n: 3 });
    const result = await readJsonSafe<{ ok: boolean; n: number }>(filePath, { ok: false, n: 0 });
    expect(result.recovered).toBe(false);
    expect(result.value).toEqual({ ok: true, n: 3 });
  });

  it("quarantineCorruptFile renames without deleting sibling assets", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-safe-json-"));
    const bad = path.join(root, "profiles.json");
    const keep = path.join(root, "asset.bin");
    await fs.writeFile(bad, "{bad", "utf8");
    await fs.writeFile(keep, "keep-me", "utf8");
    const dest = await quarantineCorruptFile(bad, "parse error");
    expect(dest).toBeTruthy();
    await expect(fs.readFile(keep, "utf8")).resolves.toBe("keep-me");
  });
});
