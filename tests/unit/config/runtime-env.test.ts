import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isProductionEnv,
  loadProjectEnv,
  resolveBindHost,
  resolveBindPort,
  resolveHealthProbeHost,
} from "../../../config/runtime-env.js";

const keys = [
  "NODE_ENV",
  "KWIZERA_ENV",
  "KWIZERA_HOST",
  "KWIZERA_BIND_HOST",
  "KWIZERA_PORT",
  "KWIZERA_DEV_PORT",
];
const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

describe("runtime env", () => {
  it("defaults bind host to loopback", () => {
    delete process.env.KWIZERA_HOST;
    delete process.env.KWIZERA_BIND_HOST;
    expect(resolveBindHost()).toBe("127.0.0.1");
  });

  it("accepts KWIZERA_HOST for VPS bind", () => {
    process.env.KWIZERA_HOST = "0.0.0.0";
    expect(resolveBindHost()).toBe("0.0.0.0");
    expect(resolveHealthProbeHost(resolveBindHost())).toBe("127.0.0.1");
  });

  it("prefers KWIZERA_PORT over the legacy dev port", () => {
    process.env.KWIZERA_PORT = "8080";
    process.env.KWIZERA_DEV_PORT = "5173";
    expect(resolveBindPort()).toBe(8080);
  });

  it("detects production from NODE_ENV or KWIZERA_ENV", () => {
    process.env.NODE_ENV = "production";
    delete process.env.KWIZERA_ENV;
    expect(isProductionEnv()).toBe(true);
    process.env.NODE_ENV = "development";
    process.env.KWIZERA_ENV = "production";
    expect(isProductionEnv()).toBe(true);
  });

  it("loads .env without overwriting existing process env", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-env-"));
    fs.writeFileSync(path.join(dir, ".env"), "KWIZERA_HOST=0.0.0.0\nKWIZERA_PORT=9090\n", "utf8");
    process.env.KWIZERA_HOST = "127.0.0.1";
    delete process.env.KWIZERA_PORT;
    loadProjectEnv(dir);
    expect(process.env.KWIZERA_HOST).toBe("127.0.0.1");
    expect(process.env.KWIZERA_PORT).toBe("9090");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
