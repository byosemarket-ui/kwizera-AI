/**
 * Phase 7 Step 1 — desktop config unit tests (no Electron required).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendAppLog,
  ensureAppDirectories,
  getLogPath,
  loadDesktopConfig,
  saveDesktopConfig,
} from "../electron/lib/config.mjs";

const tmpRoots: string[] = [];

function makeTemp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-desktop-"));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("desktop config", () => {
  it("creates defaults and persists without secrets", () => {
    const userData = makeTemp();
    const cfg = loadDesktopConfig(userData);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.port).toBeGreaterThan(0);
    expect(cfg.environment).toBe("local-desktop");
    expect(cfg.version).toBe(1);
    expect(fs.existsSync(path.join(userData, "desktop-config.json"))).toBe(true);

    const raw = fs.readFileSync(path.join(userData, "desktop-config.json"), "utf8");
    expect(raw).not.toMatch(/api[_-]?key|password|token|secret/i);
  });

  it("merges saved config safely", () => {
    const userData = makeTemp();
    const cfg = loadDesktopConfig(userData);
    cfg.port = 5199;
    cfg.lastWorkspace = "creative-review";
    saveDesktopConfig(cfg);
    const again = loadDesktopConfig(userData);
    expect(again.port).toBe(5199);
    expect(again.lastWorkspace).toBe("creative-review");
    expect(again.host).toBe("127.0.0.1");
  });

  it("ensures storage directories under configured root", () => {
    const userData = makeTemp();
    const storage = path.join(makeTemp(), "studio-data");
    const cfg = loadDesktopConfig(userData);
    cfg.storageRoot = storage;
    const dirs = ensureAppDirectories(cfg);
    expect(dirs.length).toBeGreaterThan(5);
    expect(fs.existsSync(path.join(storage, "database"))).toBe(true);
    expect(fs.existsSync(path.join(storage, "projects"))).toBe(true);
    expect(fs.existsSync(path.join(storage, "logs"))).toBe(true);
    expect(fs.existsSync(path.join(storage, "memory"))).toBe(true);
    expect(fs.existsSync(path.join(storage, "models"))).toBe(true);
  });

  it("appends structured log lines without throwing", () => {
    const userData = makeTemp();
    const storage = path.join(makeTemp(), "studio-data");
    const cfg = loadDesktopConfig(userData);
    cfg.storageRoot = storage;
    ensureAppDirectories(cfg);
    appendAppLog(cfg, "Startup");
    appendAppLog(cfg, "Health check READY");
    const log = getLogPath(cfg);
    expect(fs.existsSync(log)).toBe(true);
    const text = fs.readFileSync(log, "utf8");
    expect(text).toContain("Startup");
    expect(text).toContain("Health check READY");
  });
});
