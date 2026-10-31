import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadOperatorEnv, parseDotEnvText } from "../../../scripts/lib/load-operator-env.mjs";

describe("Phase 4.7 load-operator-env", () => {
  it("parses dotenv keys without requiring quotes", () => {
    const parsed = parseDotEnvText([
      "# comment",
      "KWIZERA_ADMIN_API_TOKEN=abc123",
      "KWIZERA_PROD_BASE=\"http://127.0.0.1:5173\"",
      "IGNORED_OTHER=1",
      "",
    ].join("\n"));
    expect(parsed.KWIZERA_ADMIN_API_TOKEN).toBe("abc123");
    expect(parsed.KWIZERA_PROD_BASE).toBe("http://127.0.0.1:5173");
    expect(parsed.IGNORED_OTHER).toBeUndefined();
  });

  it("loads operator.env only when process env token is absent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-openv-"));
    const file = path.join(dir, "operator.env");
    fs.writeFileSync(file, "KWIZERA_ADMIN_API_TOKEN=from-file\nKWIZERA_PROD_BASE=http://example.test\n", "utf8");
    const prevToken = process.env.KWIZERA_ADMIN_API_TOKEN;
    const prevBase = process.env.KWIZERA_PROD_BASE;
    try {
      delete process.env.KWIZERA_ADMIN_API_TOKEN;
      delete process.env.KWIZERA_PROD_BASE;
      const loaded = loadOperatorEnv({ candidates: [file], apply: true });
      expect(loaded.loadedFrom).toBe(file);
      expect(loaded.adminTokenPresent).toBe(true);
      expect(process.env.KWIZERA_ADMIN_API_TOKEN).toBe("from-file");
      expect(process.env.KWIZERA_PROD_BASE).toBe("http://example.test");

      process.env.KWIZERA_ADMIN_API_TOKEN = "already-set";
      const second = loadOperatorEnv({ candidates: [file], apply: true });
      expect(second.keysApplied.includes("KWIZERA_ADMIN_API_TOKEN")).toBe(false);
      expect(process.env.KWIZERA_ADMIN_API_TOKEN).toBe("already-set");
    } finally {
      if (prevToken === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
      else process.env.KWIZERA_ADMIN_API_TOKEN = prevToken;
      if (prevBase === undefined) delete process.env.KWIZERA_PROD_BASE;
      else process.env.KWIZERA_PROD_BASE = prevBase;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
